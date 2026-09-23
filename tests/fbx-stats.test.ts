import { describe, it, expect } from "vitest";
import { fbxStats, checkBudget, parseFbx } from "../src/fbx-stats.js";
import { sampleCharacterFbx } from "./helpers/fbx-writer.js";

describe("fbxStats", () => {
  const stats = fbxStats(sampleCharacterFbx());

  it("counts meshes, fan-triangulated triangles and material slots", () => {
    expect(stats.meshes).toBe(2);
    expect(stats.triangles).toBe(7); // body: 2 quads (4) + 1 tri (1) = 5; shirt: 1 quad = 2
    expect(stats.material_slots).toBe(3);
    expect(stats.unique_materials).toBe(3);
  });

  it("counts bones, blendshape channels and textures", () => {
    expect(stats.bones).toBe(4);
    expect(stats.blendshapes).toBe(3);
    expect(stats.textures).toBe(1);
  });

  it("reports per-mesh details sorted by triangle count", () => {
    expect(stats.per_mesh.map((m) => m.mesh)).toEqual(["CC_Base_Body", "Shirt"]);
    expect(stats.per_mesh[0]).toMatchObject({ triangles: 5, blendshapes: 3, materials: ["Std_Skin_Head", "Std_Skin_Body"] });
  });

  it("rejects non-binary input", () => {
    expect(() => parseFbx(Buffer.from("; FBX 7.4.0 project file"))).toThrow(/Not a binary FBX/);
  });
});

describe("checkBudget", () => {
  const base = { meshes: 1, unique_materials: 1, blendshapes: 0, textures: 0, per_mesh: [] };

  it("passes LOD0 at the limits (≤ 60k tris, ≤ 8 material slots)", () => {
    const r = checkBudget({ ...base, triangles: 60_000, material_slots: 8, bones: 101 }, "LOD0");
    expect(r.pass).toBe(true);
    expect(r.checks.map((c) => c.metric)).toEqual(["triangles", "material_slots (≈ draw calls)"]);
  });

  it("fails LOD0 on material slots like the spike 3 ActorBUILD export (19)", () => {
    const r = checkBudget({ ...base, triangles: 29_712, material_slots: 19, bones: 101 }, "LOD0");
    expect(r.pass).toBe(false);
    expect(r.checks.find((c) => !c.pass)?.value).toBe(19);
  });

  it("checks bones only for LOD1 (≤ 100)", () => {
    expect(checkBudget({ ...base, triangles: 7000, material_slots: 1, bones: 54 }, "LOD1").pass).toBe(true);
    expect(checkBudget({ ...base, triangles: 7000, material_slots: 1, bones: 120 }, "LOD1").pass).toBe(false);
  });

  it("applies the LOD2 limits (≤ 10k tris, ≤ 2 material slots)", () => {
    expect(checkBudget({ ...base, triangles: 800, material_slots: 1, bones: 22 }, "LOD2").pass).toBe(true);
    expect(checkBudget({ ...base, triangles: 800, material_slots: 3, bones: 22 }, "LOD2").pass).toBe(false);
  });
});
