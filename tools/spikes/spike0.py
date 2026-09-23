"""Spike 0: mutating smoke checks through the live bridge (run on a throwaway scene).

Usage: python tools/spikes/spike0.py <out.json>
Checks: morph min/max shape, undo grouping, cloth load/remove, camera presets +
RenderImage, and whether /health answers while an export runs (GIL behaviour).
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request

B = os.environ.get("CC4_BRIDGE_URL", "http://127.0.0.1:5101")
CLOTH = r"D:/Business/Reallusion/Reallusion Templates/Cloth/Shirts/Basic T-shirts.ccCloth"


def call(path: str, body: dict | None = None, timeout: float = 320) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B + path, data=data, headers={"Content-Type": "application/json"},
                                 method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main(out_path: str) -> None:
    R: dict = {}

    # 1. Morph min/max and undo grouping.
    _, s = call("/morphs/search", {"query": "Body Thin"})
    morphs = s["result"][:1]
    _, s2 = call("/morphs/search", {"query": "Nose Width"})
    _, s3 = call("/morphs/search", {"query": "Eye Size"})
    picks = (morphs + s2["result"][:1] + s3["result"][:1])[:3]
    R["morph_picks"] = picks
    R["minmax"] = [call("/diagnostics", {"query": "morph_minmax", "arg": m["id"]})[1] for m in picks]
    before = [call("/morph/get", {"morph_id": m["id"]})[1]["result"]["value"] for m in picks]
    call("/morphs/set", {"morphs": [{"morph_id": m["id"], "value": 0.42} for m in picks]})
    after_set = [call("/morph/get", {"morph_id": m["id"]})[1]["result"]["value"] for m in picks]
    call("/undo", {})
    after_undo = [call("/morph/get", {"morph_id": m["id"]})[1]["result"]["value"] for m in picks]
    R["undo_grouping"] = {"before": before, "after_set": after_set, "after_one_undo": after_undo,
                          "one_undo_reverts_all": after_undo == before}

    # 2. Cloth load + remove.
    t0 = time.time()
    R["cloth_load"] = call("/asset/load", {"file_path": CLOTH})[1]
    R["cloth_load_seconds"] = round(time.time() - t0, 2)
    R["clothes_after_load"] = call("/clothes")[1]
    new = [c["name"] for c in R["clothes_after_load"].get("result", []) if c["name"] not in ("Bra", "Underwear_Bottoms")]
    R["cloth_remove"] = call("/item/remove", {"item_name": new[0]})[1] if new else "nothing new to remove"
    R["clothes_after_remove"] = [c["name"] for c in call("/clothes")[1].get("result", [])]

    # 3. Camera presets + RenderImage.
    shots = {}
    out_dir = os.path.join(os.path.expanduser("~"), "CC4Export", "spikes")
    for view in ("front", "face", "all"):
        fr = call("/camera/frame", {"view": view})[1]
        cap = call("/viewport/capture", {"output_path": os.path.join(out_dir, f"spike0_{view}.png"), "width": 1280, "height": 720})[1]
        res = cap.get("result", cap)
        shots[view] = {"frame": fr, "path": res.get("path"), "ok": bool(res.get("base64")), "error": res.get("error")}
    R["camera_render"] = shots

    # 4. /health responsiveness during an export job.
    _, started = call("/job/start", {"action": "export_fbx", "params": {
        "output_path": os.path.join(out_dir, "spike0_unity.fbx"), "target_tool": "Unity", "export_json": True, "export_motion": False}})
    job_id = started["result"]["job_id"]
    pings: list = []
    stop = threading.Event()

    def pinger() -> None:
        while not stop.is_set():
            t = time.time()
            try:
                urllib.request.urlopen(B + "/health", timeout=30).read()
                pings.append(round(time.time() - t, 3))
            except Exception as e:  # noqa: BLE001
                pings.append(f"err {e}")
            time.sleep(0.25)

    th = threading.Thread(target=pinger, daemon=True)
    th.start()
    status_samples = []
    while True:
        _, st = call("/job/status", {"job_id": job_id})
        status_samples.append(st["result"]["status"])
        if st["result"]["status"] in ("done", "failed"):
            break
        time.sleep(0.5)
    stop.set()
    th.join()
    job = st["result"]
    numeric = [p for p in pings if isinstance(p, float)]
    R["export_job"] = {
        "status": job["status"],
        "seconds": round(job.get("finished_at", 0) - job.get("started_at", 0), 2),
        "result": {k: v for k, v in (job.get("result") or {}).items() if k != "notes"},
        "notes": (job.get("result") or {}).get("notes"),
        "status_samples": sorted(set(status_samples)),
        "health_pings": len(pings),
        "health_max_latency_s": max(numeric) if numeric else None,
        "health_errors": [p for p in pings if not isinstance(p, float)],
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(R, f, indent=2)
    print(json.dumps(R, indent=2)[:6000])


if __name__ == "__main__":
    main(sys.argv[1])
