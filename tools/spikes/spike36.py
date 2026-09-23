"""Spikes 3 + 6: ConvertTo (ActorBUILD / LOD1 / LOD2) on saved copies.

Usage: python tools/spikes/spike36.py <base.ccProject> <out.json> [variant ...]
Variants: ab_tex (ActorBuild, bakeTexture=True), ab_notex (bakeTexture=False),
lod1, lod2. For each: load base -> save copy -> ConvertTo -> snapshot -> export
(Unity, JSON, hidden/tearline removed) -> fbx_stats. Base is reloaded after each.
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from fbx_stats import stats  # noqa: E402
from spike0 import call  # noqa: E402

OUT_DIR = os.path.join(os.path.expanduser("~"), "CC4Export", "spikes")
VARIANTS = {
    "ab_tex": {"level": "actorbuild", "bake_expression": True, "bake_texture": True, "pose": "default"},
    "ab_notex": {"level": "actorbuild", "bake_expression": True, "bake_texture": False, "pose": "default"},
    "lod1": {"level": "lod1", "bake_expression": True, "bake_texture": True, "pose": "default"},
    "lod2": {"level": "lod2", "bake_expression": True, "bake_texture": True, "pose": "default"},
}


def run_job(action: str, params: dict, limit_s: float = 900) -> dict:
    job_id = call("/job/start", {"action": action, "params": params})[1]["result"]["job_id"]
    t0 = time.time()
    while time.time() - t0 < limit_s:
        job = call("/job/status", {"job_id": job_id}, timeout=60)[1]["result"]
        if job["status"] in ("done", "failed"):
            return job
        time.sleep(1)
    return {"status": "timeout", "job_id": job_id}


def variant(base: str, name: str) -> dict:
    r: dict = {}
    r["load_base"] = run_job("spike_load_project", {"path": base}).get("result")
    r["save_copy"] = run_job("spike_save_project", {"name": f"s36_{name}"}).get("result")
    conv = run_job("spike_convert_lod", VARIANTS[name])
    r["convert"] = conv.get("result", conv)
    if conv.get("status") != "done":
        return r
    exp = run_job("export_fbx", {"output_path": os.path.join(OUT_DIR, f"s36_{name}.fbx"), "target_tool": "Unity",
                                 "export_json": True, "export_motion": False,
                                 "delete_hidden_faces": True, "remove_tearline_occlusion": True})
    r["export"] = {k: v for k, v in (exp.get("result") or {}).items() if k != "notes"}
    if (exp.get("result") or {}).get("success"):
        s = stats(exp["result"]["path"])
        r["fbx"] = {k: s[k] for k in ("meshes", "triangles", "material_slots", "bones", "blendshapes", "textures")}
        r["fbx_per_mesh"] = {m["mesh"]: {"tris": m["triangles"], "mats": len(m["materials"]), "shapes": m["blendshapes"]}
                             for m in s["per_mesh"]}
    return r


def main() -> None:
    base, out_path, *names = sys.argv[1:]
    names = names or list(VARIANTS)
    R = {}
    for n in names:
        print(f"== {n}", flush=True)
        R[n] = variant(base, n)
        c = R[n].get("convert") or {}
        print(json.dumps({"seconds": c.get("seconds"), "status": c.get("success"), "error": c.get("error"),
                          "after": {k: v for k, v in (c.get("after") or {}).items() if k != "per_mesh"},
                          "fbx": R[n].get("fbx")}, indent=1), flush=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(R, f, indent=2)
    R["reload_base"] = run_job("spike_load_project", {"path": base}).get("result")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(R, f, indent=2)


if __name__ == "__main__":
    main()
