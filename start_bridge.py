"""
CC4 MCP Bridge manual starter — run from CC4's Script > Load Python.

Normally not needed: the installed plugin starts the bridge when CC4 launches.
Use this only if auto-loading fails (see docs/spikes.md, spike 0).
"""
import os
import socket
import sys

# Prefer the repo copy next to this script, else the installed plugin.
_plugin_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cc4-plugin")
if not os.path.isdir(_plugin_dir):
    _plugin_dir = os.path.join(
        os.environ.get("CC4_ROOT", r"C:\Program Files\Reallusion\Character Creator 4"),
        "Bin64", "OpenPlugin", "CC4_MCP_Bridge",
    )
if _plugin_dir not in sys.path:
    sys.path.insert(0, _plugin_dir)

# Clear module cache to load latest code
for m in ["server", "cc4_api"]:
    if m in sys.modules:
        del sys.modules[m]

from PySide2.QtCore import QTimer
import server as bridge_server

BRIDGE_PORT = int(os.environ.get("CC4_BRIDGE_PORT", "5101"))

_timer = None
_thread = None


def _port_free(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        return s.connect_ex(("127.0.0.1", port)) != 0
    finally:
        s.close()


def _start():
    global _timer, _thread
    if not _port_free(BRIDGE_PORT):
        # Do not silently move ports: the MCP server would talk to whatever owns 5101.
        raise RuntimeError(f"Port {BRIDGE_PORT} is already in use (bridge already running?)")
    _thread = bridge_server.start_server(port=BRIDGE_PORT)
    _timer = QTimer()
    _timer.timeout.connect(bridge_server.process_command_queue)
    _timer.start(16)
    print(f"[CC4 MCP Bridge] Started on http://127.0.0.1:{BRIDGE_PORT}")


_start()
