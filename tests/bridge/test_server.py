"""Offline tests for the CC4 bridge HTTP layer (server.py + cc4_api registry).

Run: python -m unittest discover -s tests/bridge -v
RLPy is replaced by tests/bridge/fake_rlpy.py; a background thread stands in
for CC4's QTimer that drains the command queue.
"""

from __future__ import annotations

import ast
import http.client
import json
import os
import sys
import threading
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "cc4-plugin"))
sys.path.insert(0, HERE)
sys.path.insert(0, PLUGIN_DIR)

import fake_rlpy  # noqa: E402

sys.modules["RLPy"] = fake_rlpy
os.environ.pop("CC4_DEV_MODE", None)
os.environ.pop("CC4_RELOAD_SECRET", None)

import server  # noqa: E402

PORT = 5199


def _drain_loop(stop: threading.Event) -> None:
    while not stop.is_set():
        server.process_command_queue()
        time.sleep(0.005)


class BridgeHttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.thread = server.start_server(port=PORT)
        cls.stop = threading.Event()
        cls.drain = threading.Thread(target=_drain_loop, args=(cls.stop,), daemon=True)
        cls.drain.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.stop.set()
        server.stop_server()

    def setUp(self) -> None:
        fake_rlpy.RScene.avatars = [fake_rlpy._Avatar("Camila", 7)]

    def request(self, method: str, path: str, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
        hdrs = {"Content-Type": "application/json"}
        hdrs.update(headers or {})
        payload = json.dumps(body).encode() if body is not None else None
        conn.request(method, path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        data = json.loads(resp.read() or b"{}")
        conn.close()
        return resp.status, data

    # --- basics ---

    def test_health_reports_dev_mode_off_by_default(self):
        status, data = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["result"]["service"], "cc4-mcp-bridge")
        self.assertFalse(data["result"]["dev_mode"])

    def test_get_route_dispatches_on_drain_thread(self):
        status, data = self.request("GET", "/avatars")
        self.assertEqual(status, 200)
        self.assertEqual(data["result"][0]["name"], "Camila")

    def test_api_lists_diagnostics_and_jobs(self):
        status, data = self.request("GET", "/api")
        self.assertEqual(status, 200)
        self.assertIn("symbol_search", data["result"]["diagnostic_queries"])
        self.assertIn("export_fbx", data["result"]["job_actions"])

    # --- removed surface ---

    def test_exec_python_is_gone(self):
        status, _ = self.request("POST", "/exec/python", {"code": "1+1"})
        self.assertEqual(status, 404)

    def test_metahuman_and_mixer_routes_are_gone(self):
        for path in ("/export/head_mh", "/actor_mixer/create", "/skin/bake", "/subdivision", "/item/visible",
                     "/spike/save_project", "/spike/convert_lod"):
            status, _ = self.request("POST", path, {})
            self.assertEqual(status, 404, path)

    # --- browser / rebinding protection ---

    def test_origin_header_rejected(self):
        status, _ = self.request("GET", "/avatars", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)

    def test_cross_site_fetch_rejected(self):
        status, _ = self.request("GET", "/avatars", headers={"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(status, 403)

    def test_non_loopback_host_rejected(self):
        status, _ = self.request("GET", "/health", headers={"Host": "attacker.example:5199"})
        self.assertEqual(status, 403)

    def test_post_requires_json_content_type(self):
        status, data = self.request("POST", "/diagnostics", {"query": "symbol_search"},
                                    headers={"Content-Type": "text/plain"})
        self.assertEqual(status, 400)
        self.assertIn("application/json", data["error"])

    # --- reload ---

    def test_reload_refused_without_dev_mode(self):
        status, _ = self.request("POST", "/reload", {})
        self.assertEqual(status, 403)

    def test_reload_is_not_a_get(self):
        status, _ = self.request("GET", "/reload")
        self.assertEqual(status, 404)

    # --- diagnostics ---

    def test_diagnostics_symbol_search(self):
        status, data = self.request("POST", "/diagnostics", {"query": "symbol_search", "arg": "ExportFbxOptions3"})
        self.assertEqual(status, 200)
        self.assertIn("EExportFbxOptions3_ExportJson", data["result"]["symbols"])

    def test_diagnostics_enum_values(self):
        status, data = self.request("POST", "/diagnostics", {"query": "enum_values", "arg": "EExportFbxOptions3_"})
        self.assertEqual(status, 200)
        self.assertEqual(data["result"]["values"]["EExportFbxOptions3_ExportJson"], 1)

    def test_morph_minmax_reads_floatpair_without_iterating(self):
        status, data = self.request("POST", "/diagnostics", {"query": "morph_minmax", "arg": "cc embed morphs/embed_full_body5"})
        self.assertEqual(status, 200, data)
        self.assertEqual((data["result"]["min"], data["result"]["max"]), (-1.0, 1.0))

    def test_diagnostics_unknown_query_rejected(self):
        status, data = self.request("POST", "/diagnostics", {"query": "exec", "arg": "import os"})
        self.assertEqual(status, 400)
        self.assertIn("Unknown query", data["error"])

    def test_diagnostics_signature_rejects_private_names(self):
        status, _ = self.request("POST", "/diagnostics", {"query": "signature", "arg": "RScene.__class__"})
        self.assertEqual(status, 400)

    def test_missing_required_param(self):
        status, data = self.request("POST", "/diagnostics", {})
        self.assertEqual(status, 400)
        self.assertIn("query", data["error"])

    # --- jobs ---

    def _wait_job(self, job_id: str) -> dict:
        for _ in range(200):
            _, data = self.request("POST", "/job/status", {"job_id": job_id})
            if data["result"]["status"] in ("done", "failed"):
                return data["result"]
            time.sleep(0.01)
        self.fail("job did not finish")

    def test_job_runs_and_reports_failure_result(self):
        status, data = self.request("POST", "/job/start", {
            "action": "load_item",
            "params": {"file_path": r"C:\does\not\exist.ccCloth"},
        })
        self.assertEqual(status, 200)
        job = self._wait_job(data["result"]["job_id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("File not found", job["result"]["error"])

    def test_job_rejects_non_job_action(self):
        status, _ = self.request("POST", "/job/start", {"action": "undo", "params": {}})
        self.assertEqual(status, 400)

    def test_unknown_job_is_404(self):
        status, _ = self.request("POST", "/job/status", {"job_id": "job_nope"})
        self.assertEqual(status, 404)


class Python38CompatTest(unittest.TestCase):
    def test_plugin_parses_as_python_38(self):
        for name in ("main.py", "server.py", "cc4_api.py", "bridge_state.py"):
            with open(os.path.join(PLUGIN_DIR, name), encoding="utf-8") as f:
                ast.parse(f.read(), filename=name, feature_version=(3, 8))

    def test_plugin_uses_postponed_annotations(self):
        for name in ("main.py", "server.py", "cc4_api.py", "bridge_state.py"):
            with open(os.path.join(PLUGIN_DIR, name), encoding="utf-8") as f:
                self.assertIn("from __future__ import annotations", f.read(), name)


class RegistryConsistencyTest(unittest.TestCase):
    def test_every_route_targets_a_registered_action(self):
        import cc4_api
        for route, action in list(cc4_api.GET_ROUTES.items()) + list(cc4_api.POST_ROUTES.items()):
            self.assertIn(action, cc4_api.ACTIONS, route)
        for action in cc4_api.JOB_ACTIONS:
            self.assertIn(action, cc4_api.ACTIONS)


if __name__ == "__main__":
    unittest.main()
