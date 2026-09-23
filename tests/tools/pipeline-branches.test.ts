/**
 * Branch coverage for pipeline/content tool formatting and failure paths.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { registerPipelineTools, formatApplyReport, formatJob, labelledPath } from "../../src/tools/pipeline.js";
import { registerContentTools, formatItems } from "../../src/tools/content.js";
import { setLastAppliedRecipe } from "../../src/recipe.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";
import { fixtureAllowlist } from "../helpers/allowlist-fixture.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;
const run = async (tool: string, args: Record<string, unknown> = {}) =>
  (await server.getRegisteredTool(tool)(args)).content;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  setLastAppliedRecipe(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPipelineTools(server as any, bridge as any, fixtureAllowlist);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerContentTools(server as any, bridge as any, fixtureAllowlist);
});

describe("formatApplyReport", () => {
  it("marks failed steps and lists warnings", () => {
    const text = formatApplyReport({
      recipe_id: "x", ok: false, warnings: ["w1"],
      steps: [{ step: "load_base", ok: true }, { step: "morphs", ok: false, detail: "unknown display name" }],
    });
    expect(text).toBe('Recipe x: FAILED\n  ✓ load_base\n  ✗ morphs: "unknown display name"\nWarnings:\n  - w1');
  });
});

describe("formatJob", () => {
  it("handles queued jobs, exports without a path, unreadable FBX and non-export results", () => {
    expect(formatJob({ job_id: "job_1", action: "export_fbx", status: "queued", submitted_at: 1 })).toBe("Job job_1 (export_fbx): queued");
    expect(formatJob({ job_id: "job_2", action: "export_fbx", status: "done", submitted_at: 1, result: {} })).toContain("File: undefined");
    const missing = path.join(os.tmpdir(), "definitely-missing.fbx");
    expect(formatJob({ job_id: "job_3", action: "export_fbx", status: "done", submitted_at: 1, result: { success: true, path: missing } }))
      .toContain("Could not read FBX stats");
    expect(formatJob({ job_id: "job_4", action: "convert_lod", status: "done", submitted_at: 1, started_at: 1, finished_at: 3, result: { level: "lod1" } }))
      .toContain('"level": "lod1"');
    expect(formatJob({ job_id: "job_5", action: "save_project_as", status: "failed", submitted_at: 1 })).toContain("Error: unknown");
  });

  it("labels paths without an extension", () => {
    expect(labelledPath("camila", "LOD2")).toBe("camila_LOD2.fbx");
  });
});

describe("tool failure paths", () => {
  it("export_recipe prints notes when items are unmapped", async () => {
    bridge.getAvatarInfo.mockResolvedValue({ name: "Stranger", id: 1, active_morphs: [] });
    bridge.listItems.mockResolvedValue({ avatar: "Stranger", clothes: [{ name: "Mystery Hat", meshes: [] }], hair: [], accessories: [] });
    const [{ text }] = await run("export_recipe");
    expect(text).toContain('"item": "allowlist:base/UNKNOWN"');
    expect(text).toContain("Notes:");
    expect(text).toContain("Mystery Hat");
  });

  it("set_character reports the folder", async () => {
    bridge.setCharacter.mockResolvedValue({ root: "D:/art/characters", character: null, folder: "D:/art/characters/_testbench" });
    expect((await run("set_character"))[0].text).toBe("Output now goes to D:/art/characters/_testbench");
    expect(bridge.setCharacter).toHaveBeenCalledWith("");
  });

  it("save_project_as and check_export_license report failures", async () => {
    bridge.saveProjectAs.mockResolvedValue({ success: false, error: "Refusing to write outside the workspace" });
    expect((await run("save_project_as", { path: "C:/x" }))[0].text).toContain("Failed: Refusing");
    bridge.checkExportLicense.mockResolvedValue({ success: false, error: "Item not found on avatar: Hat" });
    expect((await run("check_export_license", { item: "Hat" }))[0].text).toBe("Failed: Item not found on avatar: Hat");
    bridge.checkExportLicense.mockResolvedValue({ item: "Coat", exportable: false });
    expect((await run("check_export_license", { item: "Coat" }))[0].text).toBe("Coat: NOT exportable");
  });

  it("capture_views reports per-view failures, warnings and bridge errors", async () => {
    bridge.captureViews.mockResolvedValue({ success: false, views: [
      { preset: "full", success: false, error: "No camera" },
      { preset: "three_quarter", success: true, path: "C:/r/tq.png", warning: "camera did not move" },
    ] });
    const content = await run("capture_views", { presets: ["full", "three_quarter"] });
    expect(content.map((c) => c.text)).toEqual(["full: failed: No camera", "three_quarter: C:/r/tq.png (camera did not move)"]);
    bridge.captureViews.mockResolvedValue({ success: false, error: "Need an avatar and a camera" });
    expect((await run("capture_views"))[0].text).toBe("No views rendered: Need an avatar and a camera");
    bridge.captureViews.mockRejectedValue(new Error("timeout"));
    expect((await run("capture_views"))[0].text).toBe("CC4 bridge error: timeout");
  });

  it("export_motions reports failed and erroring jobs", async () => {
    bridge.startExportFbx.mockResolvedValueOnce({ job_id: "job_1", status: "queued" });
    bridge.getJobStatus.mockResolvedValueOnce({ job_id: "job_1", action: "export_fbx", status: "failed", submitted_at: 1, result: { success: false, error: "Motion file not found" } });
    let [{ text }] = await run("export_motions", { clips: ["allowlist:motion/female_idle_1"] });
    expect(text).toBe("✗ motion/female_idle_1: failed Motion file not found");
    bridge.startExportFbx.mockRejectedValueOnce(new Error("bridge down"));
    [{ text }] = await run("export_motions", { clips: ["allowlist:motion/female_idle_1"] });
    expect(text).toBe("✗ motion/female_idle_1: bridge down");
  });

  it("apply_recipe prints the report for a successful replay", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cc4-apply-"));
    bridge.setCharacter.mockResolvedValue({ root: os.tmpdir(), character: "x", folder });
    bridge.getAvatars.mockResolvedValue([]);
    bridge.loadItem.mockResolvedValue({ success: true, avatar: "Camila", added: { clothes: [], hair: [], accessories: [] } });
    bridge.getMorphStatus.mockResolvedValue({ ready: true, categories: 123, morphs: 2778 });
    bridge.getAvatarInfo.mockResolvedValue({ name: "Camila", id: 1, active_morphs: [] });
    bridge.listItems.mockResolvedValue({ avatar: "Camila", clothes: [], hair: [], accessories: [] });
    const [{ text }] = await run("apply_recipe", { recipe: { recipe_version: "0.1", id: "x", archetype: "a", base: { item: "allowlist:base/cc4_camila" } } });
    expect(text).toContain("Recipe x: applied");
    expect(fs.existsSync(path.join(folder, "recipe.applied.json"))).toBe(true);
    fs.rmSync(folder, { recursive: true, force: true });
  });
});

describe("content formatting", () => {
  it("formats hair and accessories, with and without the allowlist", () => {
    const items = {
      avatar: "Camila", clothes: [],
      hair: [{ name: "Short Grey", meshes: [] }],
      accessories: [{ name: "Glasses", meshes: ["Glasses"] }],
    };
    expect(formatItems(items)).toContain("Short Grey  meshes: -");
    const joined = formatItems(items, fixtureAllowlist());
    expect(joined).toContain("Short Grey  [allowlist:hair/short_grey]");
    expect(joined).toContain("Glasses  [not in allowlist]");
  });

  it("remove_item and browse_content report failures and empty results", async () => {
    bridge.removeItem.mockResolvedValue({ success: false, error: "Item not found: Hat" });
    expect((await run("remove_item", { name: "Hat" }))[0].text).toBe("Failed: Item not found: Hat");
    bridge.browseContent.mockResolvedValue([]);
    expect((await run("browse_content", { folder_type: "gloves" }))[0].text).toBe("No content found for gloves.");
  });

  it("load_item reports a failed load and verified items without the license note", async () => {
    bridge.loadItem.mockResolvedValue({ success: false, error: "Unsupported item type" });
    expect((await run("load_item", { item: "allowlist:hair/short_grey" }))[0].text).toBe("Failed to load hair/short_grey: Unsupported item type");
    bridge.loadItem.mockResolvedValue({ success: true, added: { clothes: [], hair: ["Short Grey"], accessories: [] } });
    const text = (await run("load_item", { item: "allowlist:hair/short_grey" }))[0].text;
    expect(text).toBe("Loaded hair/short_grey in ? s. Added: Short Grey");
  });
});
