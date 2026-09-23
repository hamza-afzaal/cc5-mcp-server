"""
CC4 MCP feasibility probe
-------------------------
Run inside Character Creator 4:  Script > Load Python > select this file.
Load a standard CC character into the scene first.

Checks the capabilities a local MCP bridge needs:
  1. environment (CC version, embedded Python, PySide2)
  2. API surface (hasattr checks on the calls the CC5 MCP bridge relies on)
  3. shaping morphs: enumerate, set, read back, restore
  4. materials: read mesh/material names
  5. FBX export with the Unity preset to %TEMP%
  6. viewport render to PNG
  7. bridge pattern: localhost HTTP server thread -> queue -> QTimer on main thread -> RLPy

Nothing is saved to your project; the morph is restored after the test.
Results print to the console and are written to %TEMP%/cc4_mcp_probe.json
(the bridge test result arrives about 4 seconds after the script returns).
"""

import json, os, sys, queue, tempfile, threading, time, traceback, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

import RLPy
from PySide2.QtCore import QTimer

RUN_EXPORT = True     # set False to skip the FBX export test (can take a while on HD characters)
RUN_RENDER = True
OUT_DIR = os.path.join(tempfile.gettempdir(), "cc4_mcp_probe")
os.makedirs(OUT_DIR, exist_ok=True)
REPORT = {}


def check(name, fn):
    try:
        REPORT[name] = {"ok": True, "result": fn()}
    except Exception as e:
        REPORT[name] = {"ok": False, "error": f"{type(e).__name__}: {e}",
                        "trace": traceback.format_exc(limit=2)}


def flag(name):
    return getattr(RLPy, name, 0)


# 1. Environment
check("environment", lambda: {
    "product": RLPy.RApplication.GetProductName(),
    "version": list(RLPy.RApplication.GetProductVersion()),
    "python": sys.version,
    "program_path": RLPy.RApplication.GetProgramPath(),
})

# 2. API surface used by the CC5 bridge
API = {
    "RLPy.RScene.GetAvatars": (RLPy, "RScene", "GetAvatars"),
    "RLPy.RFileIO.LoadObject": (RLPy, "RFileIO", "LoadObject"),
    "RLPy.RFileIO.LoadFile": (RLPy, "RFileIO", "LoadFile"),
    "RLPy.RFileIO.ExportFbxFile": (RLPy, "RFileIO", "ExportFbxFile"),
    "RLPy.RExportFbxSetting": (RLPy, "RExportFbxSetting", None),
    "RLPy.EExportFbxOptions2_UnityPreset": (RLPy, "EExportFbxOptions2_UnityPreset", None),
    "RLPy.RGlobal.RenderImage": (RLPy, "RGlobal", "RenderImage"),
    "RLPy.RGlobal.SetRenderExportParameter": (RLPy, "RGlobal", "SetRenderExportParameter"),
    "RLPy.RGlobal.Undo": (RLPy, "RGlobal", "Undo"),
    "RLPy.RApplication.GetContentFilesInFolder": (RLPy, "RApplication", "GetContentFilesInFolder"),
    "RLPy.RScene.SetHDSubdivisionLevel": (RLPy, "RScene", "SetHDSubdivisionLevel"),
}
def api_surface():
    out = {}
    for label, (mod, a, b) in API.items():
        obj = getattr(mod, a, None)
        out[label] = obj is not None and (b is None or hasattr(obj, b))
    return out
check("api_surface", api_surface)

avatars = RLPy.RScene.GetAvatars()
avatar = avatars[0] if avatars else None
REPORT["avatar_loaded"] = bool(avatar)

if avatar:
    check("avatar", lambda: {
        "name": avatar.GetName(),
        "methods": {m: hasattr(avatar, m) for m in (
            "GetAvatarShapingComponent", "GetMaterialComponent", "GetClothes",
            "GetHairs", "GetAccessories", "GetFaceComponent")},
    })

    # 3. Shaping morphs: set, read back, restore
    def morph_test():
        asc = avatar.GetAvatarShapingComponent()
        cats = list(asc.GetShapingMorphCatergoryNames())
        ids = []
        for c in cats:
            ids.extend(asc.GetShapingMorphIDs(c))
        if not ids:
            return {"categories": len(cats), "morph_ids": 0}
        mid = ids[0]
        before = asc.GetShapingMorphWeight(mid)
        target = 0.5 if abs(before - 0.5) > 1e-3 else 0.25
        asc.SetShapingMorphWeight(mid, target)
        RLPy.RGlobal.ObjectModified(avatar, flag("EObjectModifiedType_MorphWeight") or flag("EObjectModifiedType_Attribute"))
        avatar.Update()
        after = asc.GetShapingMorphWeight(mid)
        asc.SetShapingMorphWeight(mid, before)
        avatar.Update()
        return {"categories": len(cats), "morph_ids": len(ids), "tested_id": mid,
                "set_to": target, "read_back": after, "roundtrip_ok": abs(after - target) < 1e-3,
                "sample_ids": ids[:10]}
    check("shaping_morphs", morph_test)

    # 4. Materials (read only)
    def material_test():
        mc = avatar.GetMaterialComponent()
        meshes = list(avatar.GetMeshNames())
        return {"meshes": len(meshes),
                "materials_on_first_mesh": list(mc.GetMaterialNames(meshes[0]))[:8] if meshes else []}
    check("materials", material_test)

    # 5. FBX export, Unity preset
    if RUN_EXPORT:
        def export_test():
            path = os.path.join(OUT_DIR, "probe_unity.fbx")
            s = RLPy.RExportFbxSetting()
            s.SetOption(flag("EExportFbxOptions_AutoSkinRigidMesh"))
            s.SetOption2(flag("EExportFbxOptions2_UnityPreset") | flag("EExportFbxOptions2_YUp"))
            t0 = time.time()
            RLPy.RFileIO.ExportFbxFile(avatar, path, s)
            return {"path": path, "exists": os.path.exists(path),
                    "size_mb": round(os.path.getsize(path) / 1e6, 2) if os.path.exists(path) else 0,
                    "seconds": round(time.time() - t0, 1)}
        check("fbx_export_unity", export_test)

# 6. Viewport render
if RUN_RENDER:
    def render_test():
        path = os.path.join(OUT_DIR, "probe_view.png")
        g = RLPy.RGlobal
        if hasattr(g, "GetRenderExportImageParameter"):
            p = g.GetRenderExportImageParameter()
            if hasattr(p, "kCommon"):
                p.kCommon.nOutputSizeWidth, p.kCommon.nOutputSizeHeight = 1280, 720
                g.SetRenderExportParameter(p)
        g.RenderImage(path)
        return {"path": path, "exists": os.path.exists(path)}
    check("viewport_render", render_test)

# 7. Bridge pattern: HTTP thread -> queue -> QTimer (main thread) -> RLPy
_Q = queue.Queue()
_state = {}

class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        ev, box = threading.Event(), {}
        _Q.put((ev, box))
        ok = ev.wait(5)
        body = json.dumps({"dispatched": ok, **box}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a):
        pass

def _drain():
    while not _Q.empty():
        ev, box = _Q.get_nowait()
        box["on_main_thread"] = threading.current_thread() is threading.main_thread()
        box["avatar_count_via_rlpy"] = len(RLPy.RScene.GetAvatars())
        ev.set()

def _client(port):
    time.sleep(0.5)
    try:
        _state["response"] = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/probe", timeout=8).read())
    except Exception as e:
        _state["error"] = f"{type(e).__name__}: {e}"

def _finish():
    REPORT["bridge_pattern"] = {"ok": "response" in _state and _state["response"].get("dispatched", False), **_state}
    RLPy._cc4_probe["timer"].stop()
    threading.Thread(target=RLPy._cc4_probe["httpd"].shutdown, daemon=True).start()
    _write("final")

def _write(stage):
    path = os.path.join(tempfile.gettempdir(), "cc4_mcp_probe.json")
    with open(path, "w") as f:
        json.dump(REPORT, f, indent=2, default=str)
    print(f"\n===== CC4 MCP probe ({stage}) =====")
    for k, v in REPORT.items():
        status = v.get("ok") if isinstance(v, dict) and "ok" in v else v
        print(f"  {k:22s} {status}")
    print(f"  full report: {path}")

try:
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    timer = QTimer(); timer.timeout.connect(_drain); timer.start(16)
    RLPy._cc4_probe = {"httpd": httpd, "timer": timer}   # keep refs alive after the script returns
    threading.Thread(target=_client, args=(port,), daemon=True).start()
    QTimer.singleShot(4000, _finish)
    _write("sync checks done, bridge test pending")
except Exception as e:
    REPORT["bridge_pattern"] = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    _write("final")
