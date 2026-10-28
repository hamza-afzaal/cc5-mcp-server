r"""
Review renders for a face vocabulary (CXRP-687): writes an mcp_call steps file that keys every word variant and
accent of <vocab.json> as a face pose on <project> and renders head + three-quarter views.

  python tools\vocab_review_steps.py <vocab.json> <project> <steps.json> [--prefix vocab]
  node tools\mcp_call.mjs --file <steps.json>

<project> is an open_project path (a bare name resolves under the vocab's character). Renders land in
characters\<character>\renders\<prefix>_<word>_<variant>_{head,three_quarter}.png.
"""

import json
import re
import sys

VIEWS = ["head", "three_quarter"]


def poses(vocab):
    yield "neutral", {}
    for word, spec in vocab["words"].items():
        variants = spec.get("variants", [])
        for i, v in enumerate(variants):
            name = word if len(variants) == 1 else "{}_{}".format(word, v.get("name") or i + 1)
            yield name, v.get("weights", {})
    for name, spec in vocab["accents"].items():
        if isinstance(spec, dict) and isinstance(spec.get("weights"), dict):
            yield "accent_" + name, spec["weights"]


def main(argv):
    vocab = json.load(open(argv[0], encoding="utf-8"))
    prefix = argv[argv.index("--prefix") + 1] if "--prefix" in argv else "vocab"
    steps = [{"tool": "set_character", "args": {"character": vocab["character"]}},
             {"tool": "open_project", "args": {"path": argv[1]}}]
    seen = set()
    for name, weights in poses(vocab):
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        if slug in seen:
            continue
        seen.add(slug)
        # set_face_pose keys all expressions; an empty pose needs one explicit zero
        steps.append({"tool": "set_face_pose", "args": {"weights": weights or {"Brow_Raise_Inner_L": 0.0}}})
        steps.append({"tool": "capture_views", "args": {"prefix": "{}_{}".format(prefix, slug), "presets": VIEWS}})
    json.dump(steps, open(argv[2], "w", encoding="utf-8"), indent=1)
    print("STEPS OK", argv[2], len(seen), "poses")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
