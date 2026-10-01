r"""
Keep our record of the CC4 content library in sync with what's actually downloaded.

  python tools\content_scan.py            # what changed since docs\content-snapshot.json (read-only)
  python tools\content_scan.py --write    # ...and update the snapshot (commit it with the inventory edits)
  python tools\content_scan.py --hook     # SessionStart hook: silent when nothing changed

The snapshot holds, per folder of the template library, the file count by type, and for SkinGen/make-up presets
how many have all their textures installed (tools\preset_refs.py). It's the machine-readable twin of
docs\content-inventory.md: when this reports changes, catalog them in the inventory (what they're for, what's
usable) and run --write. ~5 s for ~7k files.
"""

import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import preset_refs  # noqa: E402

TEMPLATES = preset_refs.TEMPLATES
SNAPSHOT = os.path.join(os.path.dirname(HERE), "docs", "content-snapshot.json")


def scan(templates=TEMPLATES):
    folders = {}
    for d, _, files in os.walk(templates):
        if not files:
            continue
        rel = os.path.relpath(d, templates).replace("\\", "/")
        types = {}
        presets = ok = 0
        for f in files:
            ext = os.path.splitext(f)[1].lower() or "(none)"
            types[ext] = types.get(ext, 0) + 1
            if ext == ".ccskingenpreset":
                presets += 1
                ok += preset_refs.check(os.path.join(d, f), templates)["ok"]
        entry = {"files": dict(sorted(types.items()))}
        if presets:
            entry["presets_textures_ok"] = [ok, presets]
        folders[rel] = entry
    return {"templates": templates, "scanned": time.strftime("%Y-%m-%d %H:%M"), "folders": dict(sorted(folders.items()))}


def total(folders):
    return sum(sum(e["files"].values()) for e in folders.values())


def diff(old, new):
    """Human-readable change lines between two snapshots' folder maps."""
    lines = []
    for k in sorted(set(old) | set(new)):
        a, b = old.get(k), new.get(k)
        if a == b:
            continue
        if a is None:
            lines.append("+ {}  {}".format(k, _fmt(b)))
        elif b is None:
            lines.append("- {}  (gone)".format(k))
        else:
            lines.append("~ {}  {} -> {}".format(k, _fmt(a), _fmt(b)))
    return lines


def _fmt(e):
    s = ", ".join("{} {}".format(n, ext) for ext, n in e["files"].items())
    if "presets_textures_ok" in e:
        s += "; textures ok {}/{}".format(*e["presets_textures_ok"])
    return s


def main(argv):
    new = scan()
    old = json.load(open(SNAPSHOT, encoding="utf-8")) if os.path.isfile(SNAPSHOT) else {"folders": {}, "scanned": "never"}
    changes = diff(old["folders"], new["folders"])
    if "--hook" in argv:
        if changes:
            print("CC4 content library changed since the snapshot of {} ({} -> {} files, {} folders differ). "
                  "Catalog the changes in docs/content-inventory.md, then run "
                  "`python tools/content_scan.py --write` (cc5-mcp-server). First lines:".format(
                      old["scanned"], total(old["folders"]), total(new["folders"]), len(changes)))
            print("\n".join(changes[:25]) + ("\n..." if len(changes) > 25 else ""))
        return 0
    print("snapshot {}: {} files; now {} files; {} folders differ".format(
        old["scanned"], total(old["folders"]), total(new["folders"]), len(changes)))
    print("\n".join(changes))
    if "--write" in argv:
        with open(SNAPSHOT, "w", encoding="utf-8", newline="\n") as f:
            json.dump(new, f, indent=1)
            f.write("\n")
        print("wrote", SNAPSHOT)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
