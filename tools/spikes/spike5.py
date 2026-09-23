"""Spike 5: effect of RemoveHiddenMesh + RemoveTearLineAndOcclusion on a clothed avatar.

Usage: python tools/spikes/spike5.py <out.json>
Loads a T-shirt, jeans and canvas shoes onto the current avatar, exports a
baseline and an optimized FBX (both Unity preset + JSON, mesh only), and
compares tris/materials with tools/fbx_stats.py. Leaves the clothes on.
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from fbx_stats import stats  # noqa: E402
from spike0 import call  # noqa: E402

T = "D:/Business/Reallusion/Reallusion Templates/Cloth"
CLOTHES = [f"{T}/Shirts/Basic T-shirts.ccCloth", f"{T}/Pants/Biker_Jeans.ccCloth", f"{T}/Shoes/Canvas Shoes.ccShoes"]
OUT_DIR = os.path.join(os.path.expanduser("~"), "CC4Export", "spikes")


def export(name: str, **opts) -> dict:
    params = {"output_path": os.path.join(OUT_DIR, name), "target_tool": "Unity", "export_json": True,
              "export_motion": False, **opts}
    job_id = call("/job/start", {"action": "export_fbx", "params": params})[1]["result"]["job_id"]
    while True:
        job = call("/job/status", {"job_id": job_id})[1]["result"]
        if job["status"] in ("done", "failed"):
            break
        time.sleep(0.5)
    res = job["result"]
    out = {"seconds": round(job["finished_at"] - job["started_at"], 2), "export": res}
    if res.get("success"):
        s = stats(res["path"])
        out["stats"] = {k: s[k] for k in ("meshes", "triangles", "material_slots", "bones", "blendshapes", "textures")}
        out["per_mesh"] = {m["mesh"]: {"tris": m["triangles"], "mats": len(m["materials"])} for m in s["per_mesh"]}
    return out


def main(out_path: str) -> None:
    R: dict = {"loads": {}}
    have = {c["name"] for c in call("/clothes")[1]["result"]}
    for f in CLOTHES:
        stem = os.path.splitext(os.path.basename(f))[0]
        if any(stem.replace("_", " ").lower() in h.replace("_", " ").lower() for h in have):
            R["loads"][f] = "already on"
            continue
        R["loads"][f] = call("/asset/load", {"file_path": f})[1]
    R["clothes"] = [c["name"] for c in call("/clothes")[1]["result"]]
    R["baseline"] = export("spike5_baseline.fbx")
    R["optimized"] = export("spike5_hidden_tearline.fbx", delete_hidden_faces=True, remove_tearline_occlusion=True)
    b, o = R["baseline"].get("stats"), R["optimized"].get("stats")
    if b and o:
        R["delta"] = {k: o[k] - b[k] for k in b}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(R, f, indent=2)
    print(json.dumps({k: R[k] for k in ("clothes", "delta")}, indent=2))
    for label in ("baseline", "optimized"):
        print(label, R[label].get("stats"), R[label]["seconds"], "s")
        for mesh, v in R[label].get("per_mesh", {}).items():
            print(f"   {mesh:<24} {v}")


if __name__ == "__main__":
    main(sys.argv[1])
