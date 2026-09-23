"""
CC4 MCP Bridge Plugin - Entry Point

Starts a local HTTP server inside Character Creator 4 so the MCP server
can control CC4 via the RLPy API.

Install location:
  C:/Program Files/Reallusion/Character Creator 4/Bin64/OpenPlugin/CC4_MCP_Bridge/
"""

from __future__ import annotations

import os
import sys

# Add plugin directory to path so cc4_api and server modules are importable
_plugin_dir = os.path.dirname(os.path.abspath(__file__))
if _plugin_dir not in sys.path:
    sys.path.insert(0, _plugin_dir)

# Dev mode only: load server/cc4_api from a working copy (e.g. the repo's
# cc4-plugin/) so POST /reload picks up edits without reinstalling into
# Program Files. Ignored unless CC4_DEV_MODE=1.
_dev_dir = os.environ.get("CC4_PLUGIN_DEV_DIR", "")
if os.environ.get("CC4_DEV_MODE") == "1" and _dev_dir and os.path.isfile(os.path.join(_dev_dir, "cc4_api.py")):
    sys.path.insert(0, _dev_dir)
    print(f"[CC4 MCP Bridge] DEV: loading plugin modules from {_dev_dir}")

import RLPy
from PySide2.QtCore import QTimer  # CC4 ships PySide2

import server as bridge_server

# Plugin metadata required for auto-loading. CC4 runs on the iClone 8 engine;
# whether CC4 4.70 accepts this value is checked in spike 0 (docs/spikes.md).
rl_plugin_info = {
    "ap": "iClone",
    "ap_version": "8.0",
}

# Keep both timers as module-level globals so PySide2/Qt cannot GC them while
# the plugin is alive.
_timer = None          # 16 ms  — command-queue drain (~60 Hz)
_health_timer = None   # 5000 ms — watchdog health check (1/5 s)
_server_thread = None

BRIDGE_PORT = int(os.environ.get("CC4_BRIDGE_PORT", "5101"))
HEALTH_CHECK_INTERVAL_MS = 5000   # watchdog cadence
COMMAND_QUEUE_INTERVAL_MS = 16    # command-dispatch cadence (~60 fps)


def _check_server_health() -> None:
    """Watchdog: restart HTTP server if it crashed."""
    global _server_thread
    if _server_thread is not None and not _server_thread.is_alive():
        print("[CC4 MCP Bridge] Server thread died — restarting...")
        try:
            _server_thread = bridge_server.start_server(port=BRIDGE_PORT)
            print(f"[CC4 MCP Bridge] Server restarted on http://127.0.0.1:{BRIDGE_PORT}")
        except Exception as e:
            print(f"[CC4 MCP Bridge] Failed to restart: {e}")


def _on_timer() -> None:
    """16 ms QTimer callback: drain the command queue only."""
    bridge_server.process_command_queue()


def _on_health_timer() -> None:
    """5000 ms QTimer callback: watchdog health check only."""
    _check_server_health()


def initialize_plugin() -> int:
    """Entry point called by CC4 when the plugin is loaded."""
    global _timer, _health_timer, _server_thread

    print("[CC4 MCP Bridge] Initializing plugin...")

    try:
        _server_thread = bridge_server.start_server(port=BRIDGE_PORT)

        _timer = QTimer()
        _timer.timeout.connect(_on_timer)
        _timer.start(COMMAND_QUEUE_INTERVAL_MS)

        _health_timer = QTimer()
        _health_timer.timeout.connect(_on_health_timer)
        _health_timer.start(HEALTH_CHECK_INTERVAL_MS)

        print(f"[CC4 MCP Bridge] Bridge server running on http://127.0.0.1:{BRIDGE_PORT}")
    except Exception as e:
        print(f"[CC4 MCP Bridge] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return RLPy.RStatus.Failure

    return RLPy.RStatus.Success


def uninitialize_plugin() -> None:
    """Called by CC4 when the plugin is unloaded."""
    global _timer, _health_timer, _server_thread

    if _timer is not None:
        _timer.stop()
        _timer = None

    if _health_timer is not None:
        _health_timer.stop()
        _health_timer = None

    bridge_server.stop_server()
    if _server_thread is not None:
        _server_thread.join(timeout=5.0)
        _server_thread = None
    print("[CC4 MCP Bridge] Plugin unloaded.")
