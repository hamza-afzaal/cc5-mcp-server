import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { applyRecipe, exportRecipe, RecipeSchema, resolveRecipe, setLastAppliedRecipe, type Recipe } from "../src/recipe.js";
import { createMockBridge, type MockBridge } from "./helpers/mock-bridge.js";
import { fixtureAllowlist } from "./helpers/allowlist-fixture.js";

const RAW = {
  recipe_version: "0.1",
  id: "patient-older-adult-f-01",
  archetype: "older_adult_female",
  mst: 5,
  clinical_presentation: ["pallor"],
  base: { item: "allowlist:base/cc4_camila", gender: "female" },
  morphs: [{ display_name: "Body Thin", value: 0.35 }, { display_name: "Nose Width", category: "Actor", value: -0.2 }],
  skin: { tint: { pallor: 0.4 } },
  hair: "allowlist:hair/short_grey",
  clothes: ["allowlist:clothes/basic_tshirt", "allowlist:shoes/canvas_shoes"],
  colors: { eyes: [0.28, 0.22, 0.16] },
  motions: ["allowlist:motion/female_idle_1"],
};
const recipe = (over: Record<string, unknown> = {}): Recipe => RecipeSchema.parse({ ...RAW, ...over });

const CHAR_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cc4-char-"));

const EMPTY_ITEMS = { avatar: "Camila", clothes: [], hair: [], accessories: [] };

function happyBridge(): MockBridge {
  const b = createMockBridge();
  b.setCharacter.mockResolvedValue({ root: os.tmpdir(), character: RAW.id, folder: CHAR_DIR });
  b.getAvatars.mockResolvedValue([{ id: "1", name: "Default", type: "1" }]);
  b.deleteAvatar.mockResolvedValue({ success: true, removed: ["Default"] });
  b.loadItem.mockImplementation(async (p: string) => ({
    success: true, path: p, avatar: "Camila",
    added: p.endsWith(".rlHair") ? { clothes: [], hair: ["Short Grey"], accessories: [] }
      : p.includes("Cloth") ? { clothes: [p.split("/").pop()], hair: [], accessories: [] }
        : { clothes: [], hair: [], accessories: [] },
  }));
  b.getMorphStatus.mockResolvedValue({ ready: true, categories: 123, morphs: 2778 });
  b.listItems.mockResolvedValue({ ...EMPTY_ITEMS, clothes: [{ name: "Bra", meshes: ["Bra"] }] });
  b.setMorphs.mockResolvedValue({ success: true, applied: [
    { id: "a", display_name: "Body Thin", requested: 0.35, value: 0.35 },
    { id: "b", display_name: "Nose Width", requested: -0.2, value: -0.2, warning: "outside the UI default range [0, 1] (applied anyway)" },
  ] });
  b.setColor.mockResolvedValue({ success: true, applied_to: ["CC_Base_Eye/Std_Eye_R"] });
  return b;
}

beforeEach(() => setLastAppliedRecipe(null));
afterAll(() => fs.rmSync(CHAR_DIR, { recursive: true, force: true }));

describe("RecipeSchema", () => {
  it("parses the design §6 shape with defaults", () => {
    const r = RecipeSchema.parse({ recipe_version: "0.1", id: "x", archetype: "a", base: { item: "allowlist:base/cc4_camila" } });
    expect(r.morphs).toEqual([]);
    expect(r.clothes).toEqual([]);
  });

  it("rejects typos in field names (strict)", () => {
    expect(() => RecipeSchema.parse({ ...RAW, clothing: [] })).toThrow();
  });

  it("rejects refs without the allowlist: prefix and morphs without a name or id", () => {
    expect(() => recipe({ hair: "D:/hair.rlHair" })).toThrow();
    expect(() => recipe({ morphs: [{ value: 0.2 }] })).toThrow();
  });

  it("bounds MST to 1–10 and colors to 0–1", () => {
    expect(() => recipe({ mst: 11 })).toThrow();
    expect(() => recipe({ colors: { eyes: [1.2, 0, 0] } })).toThrow();
  });
});

describe("resolveRecipe", () => {
  it("collects every bad reference into one error", () => {
    const r = recipe({
      clothes: ["allowlist:clothes/icontent_coat", "allowlist:clothes/nope"],
      hair: "allowlist:clothes/basic_tshirt",
    });
    let message = "";
    try {
      resolveRecipe(r, fixtureAllowlist());
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/3 unresolved reference\(s\)/);
    expect(message).toMatch(/clothes\[0\]: .*not exportable/);
    expect(message).toMatch(/clothes\[1\]: Unknown allowlist id/);
    expect(message).toMatch(/hair: .*expected hair/);
  });
});

describe("applyRecipe", () => {
  it("replays base → morphs → hair → clothes → colors in order", async () => {
    const b = happyBridge();
    const report = await applyRecipe(b as never, fixtureAllowlist(), recipe());
    expect(report.ok).toBe(true);
    expect(report.steps.map((s) => s.step)).toEqual([
      "set_character", "clear_scene", "load_base", "morphs", "load_hair", "load_clothes", "load_clothes", "color_eyes",
    ]);
    expect(b.setCharacter).toHaveBeenCalledWith(RAW.id);
    expect(JSON.parse(fs.readFileSync(path.join(CHAR_DIR, "recipe.applied.json"), "utf-8")).id).toBe(RAW.id);
    expect(b.loadItem.mock.calls.map((c) => c[0])).toEqual([
      "D:/T/Actor/CC4 Camila.ccAvatar", "D:/T/Hair/Short Grey.rlHair",
      "D:/T/Cloth/Basic T-shirts.ccCloth", "D:/T/Cloth/Canvas Shoes.ccShoes",
    ]);
    expect(b.setMorphs).toHaveBeenCalledWith(RAW.morphs);
    expect(b.setColor).toHaveBeenCalledWith("eyes", 0.28, 0.22, 0.16);
  });

  it("surfaces morph warnings, unverified licenses, tint and motions", async () => {
    const report = await applyRecipe(happyBridge() as never, fixtureAllowlist(), recipe());
    const w = report.warnings.join("\n");
    expect(w).toMatch(/Nose Width: outside the UI default range/);
    expect(w).toMatch(/License not yet verified for: clothes\/basic_tshirt/);
    expect(w).toMatch(/skin.tint not applied/);
    expect(w).toMatch(/export_motions/);
  });

  it("does not touch CC4 when a reference is bad", async () => {
    const b = happyBridge();
    await expect(applyRecipe(b as never, fixtureAllowlist(), recipe({ clothes: ["allowlist:clothes/icontent_coat"] })))
      .rejects.toThrow(/not exportable/);
    expect(b.getAvatars).not.toHaveBeenCalled();
    expect(b.loadItem).not.toHaveBeenCalled();
  });

  it("reloads the base once when the morph catalog is not ready (spike 0)", async () => {
    const b = happyBridge();
    b.getMorphStatus
      .mockResolvedValueOnce({ ready: false, categories: 3, morphs: 180 })
      .mockResolvedValueOnce({ ready: true, categories: 123, morphs: 2778 });
    const report = await applyRecipe(b as never, fixtureAllowlist(), recipe(), { catalogRetryDelayMs: 0 });
    expect(report.ok).toBe(true);
    expect(b.loadItem.mock.calls.filter((c) => String(c[0]).endsWith(".ccAvatar"))).toHaveLength(2);
    expect(report.warnings.join()).toMatch(/base was reloaded/);
  });

  it("fails when the catalog never becomes ready", async () => {
    const b = happyBridge();
    b.getMorphStatus.mockResolvedValue({ ready: false, categories: 3, morphs: 180 });
    const report = await applyRecipe(b as never, fixtureAllowlist(), recipe(), { catalogRetryDelayMs: 0 });
    expect(report.ok).toBe(false);
    expect(report.steps.at(-1)?.step).toBe("load_base");
    expect(b.setMorphs).not.toHaveBeenCalled();
  });

  it("reports the failing step when the bridge throws (e.g. unknown morph → HTTP 400)", async () => {
    const b = happyBridge();
    b.setMorphs.mockRejectedValue(new Error("CC4 bridge error (400): unknown display name"));
    const report = await applyRecipe(b as never, fixtureAllowlist(), recipe());
    expect(report.ok).toBe(false);
    expect(report.steps.at(-1)).toMatchObject({ step: "morphs", ok: false });
    expect(b.setColor).not.toHaveBeenCalled();
  });

  it("warns when an item loads but adds nothing", async () => {
    const b = happyBridge();
    b.loadItem.mockResolvedValue({ success: true, avatar: "Camila", added: { clothes: [], hair: [], accessories: [] } });
    const report = await applyRecipe(b as never, fixtureAllowlist(), recipe({ hair: null }));
    expect(report.warnings.join()).toMatch(/clothes\/basic_tshirt loaded but added no new scene item/);
  });
});

describe("exportRecipe", () => {
  function sceneBridge(): MockBridge {
    const b = happyBridge();
    b.getAvatarInfo.mockResolvedValue({
      name: "Camila", id: 7,
      active_morphs: [{ id: "a", display_name: "Body Thin", category: "Actor", value: 0.350001 }],
    });
    b.listItems.mockResolvedValue({
      avatar: "Camila",
      clothes: [{ name: "Bra", meshes: [] }, { name: "Basic T-shirts", meshes: [] }, { name: "Canvas shoes", meshes: [] }, { name: "Mystery Hat", meshes: [] }],
      hair: [{ name: "Short Grey", meshes: [] }],
      accessories: [],
    });
    return b;
  }

  it("maps scene items and morphs back into recipe form", async () => {
    const out = await exportRecipe(sceneBridge() as never, fixtureAllowlist());
    expect(out.recipe).toMatchObject({
      base: { item: "allowlist:base/cc4_camila" },
      morphs: [{ display_name: "Body Thin", category: "Actor", value: 0.35 }],
      hair: "allowlist:hair/short_grey",
      clothes: ["allowlist:clothes/basic_tshirt", "allowlist:shoes/canvas_shoes"],
    });
    expect(out.unmapped_items).toEqual(["Bra", "Mystery Hat"]);
    expect(RecipeSchema.safeParse(out.recipe).success).toBe(true);
  });

  it("leaves out items the base brought, and carries unreadable fields from the applied recipe", async () => {
    const b = sceneBridge();
    b.listItems.mockResolvedValueOnce({ ...EMPTY_ITEMS, clothes: [{ name: "Bra", meshes: [] }] }); // what the base brought
    b.getAvatarInfo.mockResolvedValueOnce({ name: "Camila", id: 7, active_morphs: [{ id: "base_body", display_name: "CC4 Camila_Body", category: "Actor", value: 1 }] });
    await applyRecipe(b as never, fixtureAllowlist(), recipe());
    b.getAvatarInfo.mockResolvedValueOnce({ name: "Camila", id: 7, active_morphs: [
      { id: "base_body", display_name: "CC4 Camila_Body", category: "Actor", value: 1 },
      { id: "a", display_name: "Body Thin", category: "Actor", value: 0.35 },
    ] });
    const out = await exportRecipe(b as never, fixtureAllowlist());
    expect(out.unmapped_items).toEqual(["Mystery Hat"]);
    expect(out.recipe.morphs).toEqual([{ display_name: "Body Thin", category: "Actor", value: 0.35 }]);
    expect(out.recipe).toMatchObject({ id: RAW.id, mst: 5, colors: RAW.colors, motions: RAW.motions });
  });

  it("fails without an avatar", async () => {
    const b = createMockBridge();
    b.getAvatarInfo.mockResolvedValue(null);
    await expect(exportRecipe(b as never, fixtureAllowlist())).rejects.toThrow(/No avatar/);
  });
});
