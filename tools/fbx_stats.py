"""Budget stats for a binary FBX (stdlib only; no FBX SDK or Blender needed).

Usage: python tools/fbx_stats.py file.fbx [more.fbx ...] [--json]

Reports per mesh: triangles (polygons fan-triangulated), distinct materials,
blendshape targets; and totals for meshes, triangles, material slots (≈ draw
calls), unique materials, bones (LimbNode), blendshapes, textures. Numbers are
what design §4 budgets are checked against.
"""

from __future__ import annotations

import json
import struct
import sys
import zlib
from typing import Any

_ARRAY_FMT = {"f": "f", "d": "d", "l": "q", "i": "i", "b": "?"}


class Node:
    __slots__ = ("name", "props", "children")

    def __init__(self, name: str, props: list, children: list):
        self.name = name
        self.props = props
        self.children = children

    def child(self, name: str) -> "Node | None":
        return next((c for c in self.children if c.name == name), None)

    def all(self, name: str) -> list["Node"]:
        return [c for c in self.children if c.name == name]


def _read_props(buf: bytes, pos: int, count: int) -> tuple[list, int]:
    props: list = []
    for _ in range(count):
        t = chr(buf[pos]); pos += 1
        if t == "Y":
            props.append(struct.unpack_from("<h", buf, pos)[0]); pos += 2
        elif t == "C":
            props.append(bool(buf[pos])); pos += 1
        elif t == "I":
            props.append(struct.unpack_from("<i", buf, pos)[0]); pos += 4
        elif t == "F":
            props.append(struct.unpack_from("<f", buf, pos)[0]); pos += 4
        elif t == "D":
            props.append(struct.unpack_from("<d", buf, pos)[0]); pos += 8
        elif t == "L":
            props.append(struct.unpack_from("<q", buf, pos)[0]); pos += 8
        elif t in _ARRAY_FMT:
            n, enc, clen = struct.unpack_from("<III", buf, pos); pos += 12
            raw = buf[pos:pos + clen]; pos += clen
            if enc == 1:
                raw = zlib.decompress(raw)
            fmt = _ARRAY_FMT[t]
            props.append(struct.unpack(f"<{n}{fmt}", raw[: n * struct.calcsize(fmt)]))
        elif t in ("S", "R"):
            n = struct.unpack_from("<I", buf, pos)[0]; pos += 4
            data = buf[pos:pos + n]; pos += n
            props.append(data.decode("utf-8", "replace") if t == "S" else data)
        else:
            raise ValueError(f"Unknown FBX property type {t!r} at {pos - 1}")
    return props, pos


def _read_node(buf: bytes, pos: int, wide: bool) -> tuple[Node | None, int]:
    if wide:
        end, nprops, _plen = struct.unpack_from("<QQQ", buf, pos); pos += 24
    else:
        end, nprops, _plen = struct.unpack_from("<III", buf, pos); pos += 12
    name_len = buf[pos]; pos += 1
    if end == 0:
        return None, pos
    name = buf[pos:pos + name_len].decode("ascii", "replace"); pos += name_len
    props, pos = _read_props(buf, pos, nprops)
    children: list[Node] = []
    while pos < end:
        child, pos = _read_node(buf, pos, wide)
        if child is None:
            break
        children.append(child)
    return Node(name, props, children), end


def parse(path: str) -> list[Node]:
    buf = open(path, "rb").read()
    if not buf.startswith(b"Kaydara FBX Binary"):
        raise ValueError(f"{path}: not a binary FBX")
    version = struct.unpack_from("<I", buf, 23)[0]
    wide = version >= 7500
    pos, nodes = 27, []
    while pos < len(buf):
        node, pos = _read_node(buf, pos, wide)
        if node is None:
            break
        nodes.append(node)
    return nodes


def _obj_name(node: Node) -> str:
    return str(node.props[1]).split("\x00")[0] if len(node.props) > 1 else "?"


def stats(path: str) -> dict[str, Any]:
    top = {n.name: n for n in parse(path)}
    objects = top["Objects"].children
    conns = [c.props for c in top["Connections"].all("C")] if "Connections" in top else []

    by_id = {o.props[0]: o for o in objects if o.props}
    parent_of: dict[int, list[int]] = {}
    children_of: dict[int, list[int]] = {}
    for p in conns:
        if len(p) >= 3 and p[0] in ("OO", "OP"):
            parent_of.setdefault(p[1], []).append(p[2])
            children_of.setdefault(p[2], []).append(p[1])

    def kind(o: Node) -> str:
        return str(o.props[2]) if len(o.props) > 2 else ""

    models = {oid: o for oid, o in by_id.items() if o.name == "Model"}
    mesh_models = {oid: o for oid, o in models.items() if kind(o) == "Mesh"}
    bones = [o for o in models.values() if kind(o) == "LimbNode"]
    materials = {oid: o for oid, o in by_id.items() if o.name == "Material"}
    textures = [o for o in by_id.values() if o.name == "Texture"]

    meshes: list[dict[str, Any]] = []
    for mid, model in mesh_models.items():
        geoms = [by_id[c] for c in children_of.get(mid, []) if c in by_id and by_id[c].name == "Geometry"]
        mats = [c for c in children_of.get(mid, []) if c in materials]
        tris = 0
        shapes = 0
        for g in geoms:
            pvi = g.child("PolygonVertexIndex")
            if pvi is not None:
                n = 0
                for v in pvi.props[0]:
                    n += 1
                    if v < 0:
                        tris += max(n - 2, 0)
                        n = 0
            # Geometry <- BlendShape deformer <- BlendShapeChannel(s)
            for d in children_of.get(g.props[0], []):
                if d in by_id and kind(by_id[d]) == "BlendShape":
                    shapes += sum(1 for ch in children_of.get(d, []) if ch in by_id and kind(by_id[ch]) == "BlendShapeChannel")
        meshes.append({
            "mesh": _obj_name(model),
            "triangles": tris,
            "materials": [_obj_name(materials[m]) for m in mats],
            "blendshapes": shapes,
        })

    meshes.sort(key=lambda m: -m["triangles"])
    return {
        "file": path,
        "meshes": len(meshes),
        "triangles": sum(m["triangles"] for m in meshes),
        "material_slots": sum(len(m["materials"]) for m in meshes),
        "unique_materials": len({n for m in meshes for n in m["materials"]}),
        "bones": len(bones),
        "blendshapes": sum(m["blendshapes"] for m in meshes),
        "textures": len(textures),
        "per_mesh": meshes,
    }


def main(argv: list[str]) -> None:
    as_json = "--json" in argv
    files = [a for a in argv if a != "--json"]
    results = [stats(f) for f in files]
    if as_json:
        print(json.dumps(results, indent=2))
        return
    for r in results:
        print(f"{r['file']}\n  meshes {r['meshes']}  triangles {r['triangles']}  material slots {r['material_slots']}"
              f"  unique materials {r['unique_materials']}  bones {r['bones']}  blendshapes {r['blendshapes']}"
              f"  textures {r['textures']}")
        for m in r["per_mesh"]:
            print(f"    {m['mesh']:<28} tris {m['triangles']:>7}  mats {len(m['materials'])}  shapes {m['blendshapes']}")


if __name__ == "__main__":
    main(sys.argv[1:])
