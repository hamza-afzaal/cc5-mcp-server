r"""
List the textures a CC4 SkinGen / make-up preset (.ccSkinGenPreset) points to, and whether each one is installed.

  python tools\preset_refs.py <preset or folder> [...] [--json out.json]

A preset stores CC3-template-relative paths such as "Texture\SkinTextures\SkinGen\3_Pattern\...\X.jpg". In our
library they live under "<templates>\Others\Skin Textures\...". When one is missing, CC4 opens a "texture failed to
load" dialog that waits for OK (the Human Anatomy brow presets did this on 2026-09-30), so run this before applying
or allowlisting a preset. "Substance\..." entries are .ccTexture tool resources that CC4 keeps internally; they are
listed but not judged.
"""

import json
import os
import re
import sys

TEMPLATES = os.environ.get("CC4_TEMPLATES", r"D:\Business\Reallusion\Reallusion Templates")
# CC3-template-relative prefix -> folder in our template library
PREFIXES = {"texture\\skintextures\\": os.path.join("Others", "Skin Textures")}
UTF16 = re.compile(rb"(?:[\x20-\x7e]\x00){6,}")


def refs(path):
    """Distinct template-relative resource paths stored in the preset (UTF-16 strings)."""
    data = open(path, "rb").read()
    out = set()
    for m in UTF16.findall(data):
        s = m.decode("utf-16le")
        if s.lower().startswith(("texture\\", "substance\\")):
            # strings are length-prefixed; a trailing byte that happens to be printable sneaks in after the extension
            s = re.sub(r"(\.(png|jpg|jpeg|tga|dds|tif|tiff|cctexture))[^.\\]*$", r"\1", s, flags=re.I)
            out.add(s)
    return sorted(out)


def resolve(ref, templates=TEMPLATES):
    """Installed file for a reference, None if missing, "" if we don't judge it (Substance tool resources)."""
    low = ref.lower()
    for prefix, folder in PREFIXES.items():
        if low.startswith(prefix):
            p = os.path.join(templates, folder, ref[len(prefix):])
            return p if os.path.isfile(p) else None
    return ""


def check(path, templates=TEMPLATES):
    rows = [{"ref": r, "file": resolve(r, templates)} for r in refs(path)]
    missing = [r["ref"] for r in rows if r["file"] is None]
    return {"preset": path, "refs": rows, "missing": missing, "ok": not missing}


def presets(target):
    if os.path.isfile(target):
        return [target]
    return sorted(os.path.join(d, f) for d, _, fs in os.walk(target) for f in fs
                  if f.lower().endswith(".ccskingenpreset"))


def main(argv):
    out = None
    if "--json" in argv:
        i = argv.index("--json")
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    results = [check(p) for t in argv for p in presets(t)]
    for r in results:
        print("{}  {}".format("ok     " if r["ok"] else "MISSING", r["preset"]))
        for m in r["missing"]:
            print("           " + m)
    print("{} presets, {} with missing textures".format(len(results), sum(not r["ok"] for r in results)))
    if out:
        json.dump(results, open(out, "w", encoding="utf-8"), indent=1)
    return 0 if all(r["ok"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
