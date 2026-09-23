/**
 * Minimal binary FBX (v7400) writer for tests: just enough structure for fbx-stats.
 */

import zlib from "node:zlib";

type Prop =
  | { t: "L"; v: bigint } | { t: "S"; v: string } | { t: "i"; v: number[]; zip?: boolean }
  | { t: "Y" | "I" | "F" | "D"; v: number } | { t: "C"; v: boolean } | { t: "R"; v: Buffer }
  | { t: "f" | "d"; v: number[]; zip?: boolean } | { t: "l"; v: bigint[]; zip?: boolean } | { t: "b"; v: boolean[]; zip?: boolean };

let WIDE = false;

interface Node {
  name: string;
  props: Prop[];
  children?: Node[];
}

function scalar(t: string, size: number, write: (b: Buffer) => void): Buffer {
  const b = Buffer.alloc(1 + size);
  b.write(t, 0, "latin1");
  write(b);
  return b;
}

function array(t: string, size: number, n: number, write: (b: Buffer, i: number) => void, zip?: boolean): Buffer {
  let data = Buffer.alloc(n * size);
  for (let i = 0; i < n; i++) write(data, i);
  if (zip) data = zlib.deflateSync(data);
  const head = Buffer.alloc(13);
  head.write(t, 0, "latin1");
  head.writeUInt32LE(n, 1);
  head.writeUInt32LE(zip ? 1 : 0, 5);
  head.writeUInt32LE(data.length, 9);
  return Buffer.concat([head, data]);
}

function encodeProp(p: Prop): Buffer {
  switch (p.t) {
    case "Y": return scalar("Y", 2, (b) => b.writeInt16LE(p.v, 1));
    case "C": return scalar("C", 1, (b) => b.writeUInt8(p.v ? 1 : 0, 1));
    case "I": return scalar("I", 4, (b) => b.writeInt32LE(p.v, 1));
    case "F": return scalar("F", 4, (b) => b.writeFloatLE(p.v, 1));
    case "D": return scalar("D", 8, (b) => b.writeDoubleLE(p.v, 1));
    case "R": {
      const head = Buffer.alloc(5);
      head.write("R", 0, "latin1");
      head.writeUInt32LE(p.v.length, 1);
      return Buffer.concat([head, p.v]);
    }
    case "f": return array("f", 4, p.v.length, (b, i) => b.writeFloatLE(p.v[i], i * 4), p.zip);
    case "d": return array("d", 8, p.v.length, (b, i) => b.writeDoubleLE(p.v[i], i * 8), p.zip);
    case "l": return array("l", 8, p.v.length, (b, i) => b.writeBigInt64LE(p.v[i], i * 8), p.zip);
    case "b": return array("b", 1, p.v.length, (b, i) => b.writeUInt8(p.v[i] ? 1 : 0, i), p.zip);
    case "i": if (p.zip) return array("i", 4, p.v.length, (b, i) => b.writeInt32LE(p.v[i], i * 4), true); break;
    default: break;
  }
  if (p.t === "L") {
    const b = Buffer.alloc(9);
    b.write("L", 0, "latin1");
    b.writeBigInt64LE(p.v, 1);
    return b;
  }
  if (p.t === "S") {
    const data = Buffer.from(p.v, "utf8");
    const head = Buffer.alloc(5);
    head.write("S", 0, "latin1");
    head.writeUInt32LE(data.length, 1);
    return Buffer.concat([head, data]);
  }
  const head = Buffer.alloc(13);
  head.write("i", 0, "latin1");
  head.writeUInt32LE(p.v.length, 1);
  head.writeUInt32LE(0, 5); // raw, not zlib
  head.writeUInt32LE(p.v.length * 4, 9);
  const data = Buffer.alloc(p.v.length * 4);
  p.v.forEach((x, i) => data.writeInt32LE(x, i * 4));
  return Buffer.concat([head, data]);
}

const nullRecord = () => Buffer.alloc(WIDE ? 25 : 13);

function encodeNode(node: Node, offset: number): Buffer {
  const props = Buffer.concat(node.props.map(encodeProp));
  const name = Buffer.from(node.name, "latin1");
  const fixed = WIDE ? 25 : 13;
  const headerLen = fixed + name.length;
  let cursor = offset + headerLen + props.length;
  const kids: Buffer[] = [];
  for (const c of node.children ?? []) {
    const enc = encodeNode(c, cursor);
    kids.push(enc);
    cursor += enc.length;
  }
  if (node.children?.length) {
    const nul = nullRecord();
    kids.push(nul);
    cursor += nul.length;
  }
  const head = Buffer.alloc(fixed);
  if (WIDE) {
    head.writeBigUInt64LE(BigInt(cursor), 0);
    head.writeBigUInt64LE(BigInt(node.props.length), 8);
    head.writeBigUInt64LE(BigInt(props.length), 16);
    head.writeUInt8(name.length, 24);
  } else {
    head.writeUInt32LE(cursor, 0);
    head.writeUInt32LE(node.props.length, 4);
    head.writeUInt32LE(props.length, 8);
    head.writeUInt8(name.length, 12);
  }
  return Buffer.concat([head, name, props, ...kids]);
}

export function writeFbx(nodes: Node[], version = 7400): Buffer {
  WIDE = version >= 7500;
  const header = Buffer.alloc(27);
  header.write("Kaydara FBX Binary  \u0000", 0, "latin1");
  header.writeUInt8(0x1a, 21);
  header.writeUInt8(0x00, 22);
  header.writeUInt32LE(version, 23);
  const parts: Buffer[] = [header];
  let offset = 27;
  for (const n of nodes) {
    const enc = encodeNode(n, offset);
    parts.push(enc);
    offset += enc.length;
  }
  parts.push(nullRecord());
  return Buffer.concat(parts);
}

const L = (v: number): Prop => ({ t: "L", v: BigInt(v) });
const S = (v: string): Prop => ({ t: "S", v });

/**
 * A character: one body mesh (2 quads + 1 triangle = 5 tris, 2 materials, 3 blendshape
 * channels), one shirt (1 quad = 2 tris, 1 material), and 4 bones.
 */
export function sampleCharacterFbx(version = 7400): Buffer {
  const obj = (name: string, id: number, label: string, kind: string, children: Node[] = []): Node =>
    ({ name, props: [L(id), S(`${label}\u0000\u0001${name}`), S(kind)], children });
  const objects: Node[] = [
    obj("Model", 1, "CC_Base_Body", "Mesh"),
    obj("Geometry", 2, "CC_Base_Body", "Mesh", [
      { name: "PolygonVertexIndex", props: [{ t: "i", v: [0, 1, 2, -4, 4, 5, 6, -8, 8, 9, -11], zip: true }] },
      { name: "Vertices", props: [{ t: "d", v: [0, 0, 0, 1, 0, 0], zip: true }] },
      { name: "Weights", props: [{ t: "f", v: [0.5, 0.5] }] },
      { name: "Ids", props: [{ t: "l", v: [1n, 2n] }] },
      { name: "Flags", props: [{ t: "b", v: [true, false] }] },
      { name: "Props70", props: [], children: [
        { name: "P", props: [S("Scalars"), { t: "Y", v: 3 }, { t: "C", v: true }, { t: "I", v: 7 }, { t: "F", v: 1.5 }, { t: "D", v: 2.5 }, { t: "R", v: Buffer.from([1, 2]) }] },
      ] },
    ]),
    obj("Material", 3, "Std_Skin_Head", ""),
    obj("Material", 4, "Std_Skin_Body", ""),
    obj("Deformer", 5, "Body_Shapes", "BlendShape"),
    obj("Deformer", 6, "Brow_Raise", "BlendShapeChannel"),
    obj("Deformer", 7, "Jaw_Open", "BlendShapeChannel"),
    obj("Deformer", 8, "V_Open", "BlendShapeChannel"),
    obj("Model", 10, "Shirt", "Mesh"),
    obj("Geometry", 11, "Shirt", "Mesh", [{ name: "PolygonVertexIndex", props: [{ t: "i", v: [0, 1, 2, -4] }] }]),
    obj("Material", 12, "Shirt_Mat", ""),
    obj("Model", 20, "CC_Base_Hip", "LimbNode"),
    obj("Model", 21, "CC_Base_Spine01", "LimbNode"),
    obj("Model", 22, "CC_Base_Head", "LimbNode"),
    obj("Model", 23, "CC_Base_JawRoot", "LimbNode"),
    obj("Texture", 30, "Std_Skin_Head_Diffuse", ""),
  ];
  const c = (child: number, parent: number): Node => ({ name: "C", props: [S("OO"), L(child), L(parent)] });
  const connections: Node[] = [
    c(2, 1), c(3, 1), c(4, 1), c(5, 2), c(6, 5), c(7, 5), c(8, 5),
    c(11, 10), c(12, 10),
  ];
  return writeFbx([
    { name: "FBXHeaderExtension", props: [], children: [{ name: "FBXVersion", props: [L(version)] }] },
    { name: "Objects", props: [], children: objects },
    { name: "Connections", props: [], children: connections },
  ], version);
}
