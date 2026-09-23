/**
 * Budget stats for a binary FBX, no FBX SDK needed (TypeScript port of tools/fbx_stats.py).
 *
 * Triangles are counted by fan-triangulating each polygon; material slots (one per
 * mesh × material) approximate Unity draw calls for a skinned character.
 */

import fs from "node:fs";
import zlib from "node:zlib";

interface FbxNode {
  name: string;
  props: unknown[];
  children: FbxNode[];
}

const ARRAY_TYPES: Record<string, [number, (b: Buffer, o: number) => number | bigint | boolean]> = {
  f: [4, (b, o) => b.readFloatLE(o)],
  d: [8, (b, o) => b.readDoubleLE(o)],
  l: [8, (b, o) => b.readBigInt64LE(o)],
  i: [4, (b, o) => b.readInt32LE(o)],
  b: [1, (b, o) => b[o] !== 0],
};

function readProps(buf: Buffer, pos: number, count: number): [unknown[], number] {
  const props: unknown[] = [];
  for (let n = 0; n < count; n++) {
    const t = String.fromCharCode(buf[pos]);
    pos += 1;
    switch (t) {
      case "Y": props.push(buf.readInt16LE(pos)); pos += 2; break;
      case "C": props.push(buf[pos] !== 0); pos += 1; break;
      case "I": props.push(buf.readInt32LE(pos)); pos += 4; break;
      case "F": props.push(buf.readFloatLE(pos)); pos += 4; break;
      case "D": props.push(buf.readDoubleLE(pos)); pos += 8; break;
      case "L": props.push(buf.readBigInt64LE(pos)); pos += 8; break;
      case "S":
      case "R": {
        const len = buf.readUInt32LE(pos);
        pos += 4;
        const data = buf.subarray(pos, pos + len);
        pos += len;
        props.push(t === "S" ? data.toString("utf8") : data);
        break;
      }
      default: {
        const spec = ARRAY_TYPES[t];
        if (!spec) throw new Error(`Unknown FBX property type '${t}' at ${pos - 1}`);
        const length = buf.readUInt32LE(pos);
        const encoding = buf.readUInt32LE(pos + 4);
        const clen = buf.readUInt32LE(pos + 8);
        pos += 12;
        let raw = buf.subarray(pos, pos + clen);
        pos += clen;
        if (encoding === 1) raw = zlib.inflateSync(raw);
        const [size, read] = spec;
        const arr = new Array(length);
        for (let i = 0; i < length; i++) arr[i] = read(raw, i * size);
        props.push(arr);
      }
    }
  }
  return [props, pos];
}

function readNode(buf: Buffer, pos: number, wide: boolean): [FbxNode | null, number] {
  let end: number, nprops: number;
  if (wide) {
    end = Number(buf.readBigUInt64LE(pos));
    nprops = Number(buf.readBigUInt64LE(pos + 8));
    pos += 24;
  } else {
    end = buf.readUInt32LE(pos);
    nprops = buf.readUInt32LE(pos + 4);
    pos += 12;
  }
  const nameLen = buf[pos];
  pos += 1;
  if (end === 0) return [null, pos];
  const name = buf.subarray(pos, pos + nameLen).toString("latin1");
  pos += nameLen;
  const [props, afterProps] = readProps(buf, pos, nprops);
  pos = afterProps;
  const children: FbxNode[] = [];
  while (pos < end) {
    const [child, next] = readNode(buf, pos, wide);
    pos = next;
    if (!child) break;
    children.push(child);
  }
  return [{ name, props, children }, end];
}

export function parseFbx(buf: Buffer): FbxNode[] {
  if (buf.subarray(0, 18).toString("latin1") !== "Kaydara FBX Binary") throw new Error("Not a binary FBX");
  const wide = buf.readUInt32LE(23) >= 7500;
  const nodes: FbxNode[] = [];
  let pos = 27;
  while (pos < buf.length) {
    const [node, next] = readNode(buf, pos, wide);
    pos = next;
    if (!node) break;
    nodes.push(node);
  }
  return nodes;
}

export interface MeshStats {
  mesh: string;
  triangles: number;
  materials: string[];
  blendshapes: number;
}

export interface FbxStats {
  meshes: number;
  triangles: number;
  material_slots: number;
  unique_materials: number;
  bones: number;
  blendshapes: number;
  textures: number;
  per_mesh: MeshStats[];
}

const objName = (n: FbxNode) => String(n.props[1] ?? "?").split("\u0000")[0];
const kind = (n: FbxNode) => String(n.props[2] ?? "");

export function fbxStats(buf: Buffer): FbxStats {
  const top = new Map(parseFbx(buf).map((n) => [n.name, n]));
  const objects = top.get("Objects")?.children ?? [];
  const conns = (top.get("Connections")?.children ?? []).filter((c) => c.name === "C").map((c) => c.props);
  const byId = new Map<bigint, FbxNode>();
  for (const o of objects) if (typeof o.props[0] === "bigint") byId.set(o.props[0] as bigint, o);
  const childrenOf = new Map<bigint, bigint[]>();
  for (const p of conns) {
    if ((p[0] === "OO" || p[0] === "OP") && typeof p[1] === "bigint" && typeof p[2] === "bigint") {
      const list = childrenOf.get(p[2]) ?? [];
      list.push(p[1]);
      childrenOf.set(p[2], list);
    }
  }
  const models = [...byId.entries()].filter(([, o]) => o.name === "Model");
  const bones = models.filter(([, o]) => kind(o) === "LimbNode").length;
  const textures = objects.filter((o) => o.name === "Texture").length;

  const perMesh: MeshStats[] = [];
  for (const [mid, model] of models.filter(([, o]) => kind(o) === "Mesh")) {
    const kids = childrenOf.get(mid) ?? [];
    const geoms = kids.map((k) => byId.get(k)).filter((o): o is FbxNode => o?.name === "Geometry");
    const materials = kids.map((k) => byId.get(k)).filter((o): o is FbxNode => o?.name === "Material").map(objName);
    let triangles = 0;
    let blendshapes = 0;
    for (const g of geoms) {
      const pvi = g.children.find((c) => c.name === "PolygonVertexIndex");
      if (pvi) {
        let n = 0;
        for (const v of pvi.props[0] as number[]) {
          n++;
          if (v < 0) {
            triangles += Math.max(n - 2, 0);
            n = 0;
          }
        }
      }
      for (const d of childrenOf.get(g.props[0] as bigint) ?? []) {
        const deformer = byId.get(d);
        if (deformer && kind(deformer) === "BlendShape") {
          blendshapes += (childrenOf.get(d) ?? []).filter((c) => byId.get(c) && kind(byId.get(c)!) === "BlendShapeChannel").length;
        }
      }
    }
    perMesh.push({ mesh: objName(model), triangles, materials, blendshapes });
  }
  perMesh.sort((a, b) => b.triangles - a.triangles);
  return {
    meshes: perMesh.length,
    triangles: perMesh.reduce((s, m) => s + m.triangles, 0),
    material_slots: perMesh.reduce((s, m) => s + m.materials.length, 0),
    unique_materials: new Set(perMesh.flatMap((m) => m.materials)).size,
    bones,
    blendshapes: perMesh.reduce((s, m) => s + m.blendshapes, 0),
    textures,
    per_mesh: perMesh,
  };
}

export function fbxStatsFromFile(path: string): FbxStats {
  return fbxStats(fs.readFileSync(path));
}

/** Design §4 character budgets per LOD. */
export const LOD_BUDGETS = {
  LOD0: { triangles: 60_000, material_slots: 8, bones: null as number | null },
  LOD1: { triangles: 25_000, material_slots: 5, bones: 100 },
  LOD2: { triangles: 10_000, material_slots: 2, bones: null as number | null },
} as const;
export type LodLabel = keyof typeof LOD_BUDGETS;

export interface BudgetCheck {
  lod: LodLabel;
  checks: Array<{ metric: string; value: number; limit: number; pass: boolean }>;
  pass: boolean;
}

export function checkBudget(stats: FbxStats, lod: LodLabel): BudgetCheck {
  const b = LOD_BUDGETS[lod];
  const checks = [
    { metric: "triangles", value: stats.triangles, limit: b.triangles },
    { metric: "material_slots (≈ draw calls)", value: stats.material_slots, limit: b.material_slots },
    ...(b.bones !== null ? [{ metric: "bones", value: stats.bones, limit: b.bones }] : []),
  ].map((c) => ({ ...c, pass: c.value <= c.limit }));
  return { lod, checks, pass: checks.every((c) => c.pass) };
}
