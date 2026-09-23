"""
HTTP bridge server for the CC4 MCP plugin.

Uses Python's built-in http.server (no external dependencies). RLPy is not
thread-safe, so every action is queued here and executed on CC4's main thread
by the QTimer in main.py (process_command_queue).

The action registry (ACTIONS / GET_ROUTES / POST_ROUTES / JOB_ACTIONS) lives in
cc4_api.py and is looked up per request, so POST /reload picks up changes to it.
A change to this file still needs a CC4 restart.
"""

from __future__ import annotations

import hmac
import importlib
import json
import os
import queue
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

import cc4_api

RELOAD_SECRET = os.environ.get("CC4_RELOAD_SECRET", "")
DEV_MODE = os.environ.get("CC4_DEV_MODE", "0") == "1"  # Default: dev mode OFF
API_VERSION = "2.0.0"
SERVICE_NAME = "cc4-mcp-bridge"

# Thread-safe command queue: HTTP threads -> main thread
command_queue: queue.Queue = queue.Queue(maxsize=100)
_store_lock = threading.Lock()
response_store: dict[str, Any] = {}
response_events: dict[str, threading.Event] = {}

_command_counter = 0
_counter_lock = threading.Lock()
_processing = False  # Re-entrance guard for process_command_queue

MAX_REQUEST_BYTES = 1 * 1024 * 1024  # 1 MB
MAX_JOBS_KEPT = 50

# Job table: answered directly from HTTP threads, never via the main-thread queue.
_jobs_lock = threading.Lock()
jobs: dict[str, dict[str, Any]] = {}

_httpd: HTTPServer | None = None
_bound_port = 0


def _next_id(prefix: str) -> str:
    global _command_counter
    with _counter_lock:
        _command_counter += 1
        return f"{prefix}_{_command_counter}"


def _actions() -> dict[str, Any]:
    return cc4_api.ACTIONS


# --- Job table ---

def _job_update(job_id: str, **fields: Any) -> None:
    with _jobs_lock:
        job = jobs.get(job_id)
        if job is not None:
            job.update(fields)


def _job_create(action: str) -> str:
    job_id = _next_id("job")
    with _jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "action": action,
            "status": "queued",
            "submitted_at": time.time(),
        }
        # Drop the oldest finished jobs beyond the cap.
        if len(jobs) > MAX_JOBS_KEPT:
            finished = [j for j in jobs.values() if j["status"] in ("done", "failed")]
            finished.sort(key=lambda j: j["submitted_at"])
            for j in finished[: len(jobs) - MAX_JOBS_KEPT]:
                jobs.pop(j["job_id"], None)
    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        job = jobs.get(job_id)
        return dict(job) if job is not None else None


# --- Main-thread execution ---

def _run_action(action: str, params: dict) -> Any:
    entry = _actions().get(action)
    if entry is None:
        return {"success": False, "error": f"Unknown action: {action}"}
    handler = entry[0]
    try:
        return handler(params)
    except Exception as e:
        print(f"[CC4 MCP Bridge] Action '{action}' failed: {traceback.format_exc()}")
        return {"success": False, "error": str(e)}


def process_command_queue() -> None:
    """Drain the queue and execute RLPy calls on the main thread. Called by QTimer."""
    global _processing
    if _processing:
        return
    _processing = True
    try:
        while not command_queue.empty():
            try:
                cmd = command_queue.get_nowait()
            except queue.Empty:
                break

            job_id = cmd.get("job_id")
            if job_id:
                _job_update(job_id, status="running", started_at=time.time())

            result = _run_action(cmd["action"], cmd["params"])

            if job_id:
                failed = isinstance(result, dict) and result.get("success") is False
                _job_update(
                    job_id,
                    status="failed" if failed else "done",
                    finished_at=time.time(),
                    result=result,
                )
            else:
                with _store_lock:
                    event = response_events.pop(cmd["id"], None)
                    if event:
                        response_store[cmd["id"]] = result
                        event.set()

            command_queue.task_done()
    finally:
        _processing = False


def _validate_params(action: str, params: dict) -> str | None:
    entry = _actions().get(action)
    if entry is None:
        return f"Unknown action: {action}"
    missing = [f for f in entry[1] if f not in params]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}"
    return None


def _execute_sync(action: str, params: dict) -> tuple[int, Any]:
    """Queue a command, wait for main-thread execution, return (http_status, body)."""
    error = _validate_params(action, params)
    if error:
        return 400, {"error": error}
    timeout = float(_actions()[action][2])

    cmd_id = _next_id("cmd")
    event = threading.Event()
    with _store_lock:
        response_events[cmd_id] = event

    try:
        command_queue.put_nowait({"id": cmd_id, "action": action, "params": params})
    except queue.Full:
        with _store_lock:
            response_events.pop(cmd_id, None)
        return 503, {"error": "server busy, command queue full"}

    if not event.wait(timeout=timeout):
        with _store_lock:
            response_events.pop(cmd_id, None)
            response_store.pop(cmd_id, None)
        return 504, {"error": f"Timeout after {timeout:.0f}s waiting for CC4 to process '{action}' "
                              "(it may still be running on the main thread)"}

    with _store_lock:
        result = response_store.pop(cmd_id, None)
        response_events.pop(cmd_id, None)

    if isinstance(result, dict) and result.get("success") is False:
        return 400, result
    return 200, {"result": result}


def _start_job(action: str, params: dict) -> tuple[int, Any]:
    if action not in cc4_api.JOB_ACTIONS:
        return 400, {"error": f"'{action}' cannot run as a job. Allowed: {', '.join(sorted(cc4_api.JOB_ACTIONS))}"}
    error = _validate_params(action, params)
    if error:
        return 400, {"error": error}
    job_id = _job_create(action)
    try:
        command_queue.put_nowait({"id": job_id, "job_id": job_id, "action": action, "params": params})
    except queue.Full:
        _job_update(job_id, status="failed", result={"success": False, "error": "command queue full"})
        return 503, {"error": "server busy, command queue full"}
    return 200, {"result": {"job_id": job_id, "status": "queued"}}


# --- Hot reload ---

def reload_modules() -> dict[str, Any]:
    """Hot-reload cc4_api (functions + action registry) without restarting CC4."""
    global cc4_api
    try:
        importlib.reload(cc4_api)
        cc4_api = sys.modules["cc4_api"]
        return {"success": True, "message": "cc4_api reloaded", "actions": len(cc4_api.ACTIONS)}
    except Exception as e:
        print(f"[CC4 MCP Bridge] Reload failed: {traceback.format_exc()}")
        return {"success": False, "error": str(e)}


def _api_info() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": API_VERSION,
        "endpoints": {
            "GET": ["/health", "/api"] + sorted(cc4_api.GET_ROUTES),
            "POST": ["/job/start", "/job/status", "/reload"] + sorted(cc4_api.POST_ROUTES),
        },
        "required_params": {name: entry[1] for name, entry in cc4_api.ACTIONS.items() if entry[1]},
        "job_actions": sorted(cc4_api.JOB_ACTIONS),
        "diagnostic_queries": sorted(cc4_api.DIAGNOSTIC_QUERIES),
    }


# --- HTTP layer ---

class BridgeHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the CC4 bridge API."""

    def log_message(self, format: str, *args: Any) -> None:
        if args and not str(args[0]).startswith("2"):
            print(f"[CC4 MCP Bridge] {format % args}")

    def _send_json(self, status: int, data: Any) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _reject_browser_and_rebinding(self) -> bool:
        """Refuse requests a web page could make. Returns True if rejected.

        - Browsers attach Origin to cross-origin fetches and form POSTs.
        - Sec-Fetch-Site marks browser navigations/subresources.
        - A Host other than loopback means DNS rebinding.
        """
        if self.headers.get("Origin"):
            self._send_json(403, {"error": "Browser-origin requests are not allowed"})
            return True
        if self.headers.get("Sec-Fetch-Site", "none") not in ("none", "same-origin"):
            self._send_json(403, {"error": "Browser-origin requests are not allowed"})
            return True
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        if host not in ("127.0.0.1", "localhost", "::1"):
            self._send_json(403, {"error": f"Host '{host}' not allowed"})
            return True
        return False

    def _read_json(self) -> dict:
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            raise ValueError("Content-Type must be application/json")
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            raise ValueError(f"Invalid Content-Length: {raw_length!r}")
        if length <= 0:
            return {}
        if length > MAX_REQUEST_BYTES:
            raise ValueError(f"Request body too large: {length} bytes (max {MAX_REQUEST_BYTES})")
        try:
            parsed = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError) as e:
            raise ValueError(f"Invalid JSON in request body: {e}") from e
        if not isinstance(parsed, dict):
            raise ValueError("Request body must be a JSON object")
        return parsed

    def do_GET(self) -> None:
        if self._reject_browser_and_rebinding():
            return
        path = urlparse(self.path).path

        if path == "/health":
            # Never touches RLPy: answered from the HTTP thread even while the
            # main thread is busy (useful to measure GIL behavior during exports).
            self._send_json(200, {"result": {
                "status": "ok",
                "service": SERVICE_NAME,
                "version": API_VERSION,
                "dev_mode": DEV_MODE,
                "python": sys.version.split()[0],
                "queue_depth": command_queue.qsize(),
                "port": _bound_port,
            }})
            return

        if path == "/api":
            self._send_json(200, {"result": _api_info()})
            return

        action = cc4_api.GET_ROUTES.get(path)
        if action:
            status, data = _execute_sync(action, {})
            self._send_json(status, data)
        else:
            self._send_json(404, {"error": f"Not found: {path}"})

    def do_POST(self) -> None:
        if self._reject_browser_and_rebinding():
            return
        path = urlparse(self.path).path

        try:
            params = self._read_json()
        except ValueError as e:
            self._send_json(400, {"error": str(e)})
            return

        if path == "/reload":
            if not DEV_MODE or not RELOAD_SECRET:
                self._send_json(403, {"error": "/reload requires CC4_DEV_MODE=1 and CC4_RELOAD_SECRET"})
                return
            if not hmac.compare_digest(self.headers.get("X-Reload-Token", ""), RELOAD_SECRET):
                self._send_json(403, {"error": "Forbidden"})
                return
            result = reload_modules()
            self._send_json(200 if result.get("success") else 500, {"result": result})
            return

        if path == "/job/start":
            action = params.get("action")
            job_params = params.get("params", {})
            if not isinstance(action, str) or not isinstance(job_params, dict):
                self._send_json(400, {"error": "Body must be {action: str, params: object}"})
                return
            status, data = _start_job(action, job_params)
            self._send_json(status, data)
            return

        if path == "/job/status":
            job = get_job(str(params.get("job_id", "")))
            if job is None:
                self._send_json(404, {"error": f"Unknown job: {params.get('job_id')}"})
            else:
                self._send_json(200, {"result": job})
            return

        action = cc4_api.POST_ROUTES.get(path)
        if action:
            status, data = _execute_sync(action, params)
            self._send_json(status, data)
        else:
            self._send_json(404, {"error": f"Not found: {path}"})


class ReusableHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_server(port: int = 5101) -> threading.Thread:
    """Start the HTTP bridge server in a background daemon thread."""
    global _httpd, _bound_port
    httpd = ReusableHTTPServer(("127.0.0.1", port), BridgeHandler)
    _httpd = httpd
    _bound_port = port

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    if DEV_MODE:
        print("[CC4 MCP Bridge] DEV MODE on: /reload enabled" + ("" if RELOAD_SECRET else " (but CC4_RELOAD_SECRET is empty, so it will refuse)"))
    return thread


def stop_server() -> None:
    """Shut down the HTTP server gracefully."""
    global _httpd
    if _httpd is not None:
        _httpd.shutdown()
        _httpd.server_close()
        _httpd = None
