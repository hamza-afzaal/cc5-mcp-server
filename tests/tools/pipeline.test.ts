import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { registerPipelineTools, labelledPath, formatJob } from "../../src/tools/pipeline.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";
import { fixtureAllowlist } from "../helpers/allowlist-fixture.js";
import { sampleCharacterFbx } from "../helpers/fbx-writer.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;
const call = async (tool: string, args: Record<string, unknown> = {}) =>
  (await server.getRegisteredTool(tool)(args)).content;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPipelineTools(server as any, bridge as any, fixtureAllowlist);
});

describe("registerPipelineTools", () => {
  it("registers the Phase 2 pipeline tools", () => {
    expect(server.tool.mock.calls.map((c) => c[0])).toEqual([
      "apply_recipe", "export_recipe", "save_project_as", "convert_lod", "merge_materials", "capture_views",
      "start_export_fbx", "get_export_status", "check_export_license", "export_motions",
    ]);
  });
});

describe("labelledPath", () => {
  it("appends the LOD label once", () => {
    expect(labelledPath("camila.fbx", "LOD0")).toBe("camila_LOD0.fbx");
    expect(labelledPath("camila_LOD0.fbx", "LOD0")).toBe("camila_LOD0.fbx");
    expect(labelledPath("C:/out/camila.fbx", "LOD1")).toBe(path.join("C:/out", "camila_LOD1.fbx"));
    expect(labelledPath("camila.fbx")).toBe("camila.fbx");
  });
});

describe("start_export_fbx", () => {
  beforeEach(() => bridge.startExportFbx.mockResolvedValue({ job_id: "job_7", status: "queued" }));

  it("always uses the Unity preset + JSON sidecar, with hidden mesh / tearline removal and mesh-only on by default", async () => {
    const [{ text }] = await call("start_export_fbx", { path: "camila", lod_label: "LOD0", texture_size_cap: 2048 });
    expect(bridge.startExportFbx).toHaveBeenCalledWith("camila_LOD0.fbx", {
      target_tool: "Unity", export_json: true, delete_hidden_faces: true, remove_tearline_occlusion: true,
      export_motion: false, sub_d_level: 0, texture_size: 2048,
    });
    expect(text).toContain('get_export_status("job_7")');
  });

  it("lets flags be turned off", async () => {
    await call("start_export_fbx", { path: "x.fbx", remove_hidden_mesh: false, remove_tearline_occlusion: false, mesh_only: false });
    expect(bridge.startExportFbx.mock.calls[0][1]).toMatchObject({ delete_hidden_faces: false, remove_tearline_occlusion: false, export_motion: true });
  });

  it("resolves an included motion through the allowlist", async () => {
    await call("start_export_fbx", { path: "x.fbx", include_motion: "allowlist:motion/female_idle_1" });
    expect(bridge.startExportFbx.mock.calls[0][1]).toMatchObject({ include_motion_path: "D:/T/Motion/Female Idle_1.rlMotion", export_motion: true });
  });

  it("refuses non-motion refs and traversal", async () => {
    expect((await call("start_export_fbx", { path: "x.fbx", include_motion: "allowlist:clothes/basic_tshirt" }))[0].text).toContain("Refused");
    expect((await call("start_export_fbx", { path: "../x.fbx" }))[0].text).toContain("traversal");
    expect(bridge.startExportFbx).not.toHaveBeenCalled();
  });
});

describe("get_export_status", () => {
  const tmp = path.join(os.tmpdir(), `cc4-test-${process.pid}.fbx`);

  it("adds FBX stats and a budget check for finished exports", async () => {
    fs.writeFileSync(tmp, sampleCharacterFbx());
    try {
      bridge.startExportFbx.mockResolvedValue({ job_id: "job_9", status: "queued" });
      await call("start_export_fbx", { path: "x", lod_label: "LOD2" });
      bridge.getJobStatus.mockResolvedValue({
        job_id: "job_9", action: "export_fbx", status: "done", submitted_at: 1, started_at: 2, finished_at: 6.5,
        result: { success: true, path: tmp, json_exists: true },
      });
      const [{ text }] = await call("get_export_status", { job_id: "job_9" });
      expect(text).toContain("done in 4.5 s");
      expect(text).toContain("json sidecar: yes");
      expect(text).toContain("2 meshes, 7 tris, 3 material slots");
      expect(text).toContain("Budget LOD2 (design §4): FAIL");
      expect(text).toContain("✗ material_slots (≈ draw calls): 3 / 2");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("reminds about CC4's dialogs while a conversion runs", () => {
    const text = formatJob({ job_id: "job_3", action: "convert_lod", status: "running", submitted_at: 1 });
    expect(text).toContain("click OK in CC4");
  });

  it("shows job failures", () => {
    const text = formatJob({ job_id: "job_4", action: "merge_materials", status: "failed", submitted_at: 1, result: { success: false, error: "Refusing: not a saved copy" } });
    expect(text).toContain("Error: Refusing: not a saved copy");
  });
});

describe("convert_lod / merge_materials / save_project_as / license", () => {
  it("starts a conversion job and tells the user about the dialogs", async () => {
    bridge.startConvertLod.mockResolvedValue({ job_id: "job_2", status: "queued" });
    const [{ text }] = await call("convert_lod", { level: "actorbuild" });
    expect(bridge.startConvertLod).toHaveBeenCalledWith("actorbuild");
    expect(text).toContain("two CC4 dialogs");
  });

  it("starts a merge job", async () => {
    bridge.startMergeMaterials.mockResolvedValue({ job_id: "job_5", status: "queued" });
    await call("merge_materials", { texture_size: 1024 });
    expect(bridge.startMergeMaterials).toHaveBeenCalledWith(undefined, 1024);
  });

  it("reports save-as", async () => {
    bridge.saveProjectAs.mockResolvedValue({ success: true, path: "C:/p/x.ccProject", size_bytes: 119_000_000, is_current: true });
    const [{ text }] = await call("save_project_as", { path: "x" });
    expect(text).toContain("Saved C:/p/x.ccProject (119 MB). Current project is now the copy: true.");
  });

  it("reports license checks", async () => {
    bridge.checkExportLicense.mockResolvedValue({ item: "Camila", exportable: true });
    expect((await call("check_export_license"))[0].text).toBe("Camila: exportable");
  });
});

describe("capture_views", () => {
  it("returns an image per view plus its path", async () => {
    bridge.captureViews.mockResolvedValue({ success: true, views: [
      { preset: "full", success: true, path: "C:/r/full.png", base64: "AAA" },
      { preset: "three_quarter", success: true, path: "C:/r/tq.png", base64: "BBB", method: "avatar turned 35 degrees, then restored" },
    ] });
    const content = await call("capture_views", { prefix: "camila" });
    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
    expect(content.map((c) => c.text).filter(Boolean)).toEqual(["full: C:/r/full.png", "three_quarter: C:/r/tq.png"]);
  });
});

describe("apply_recipe / export_recipe tools", () => {
  it("reports refusal for bad references without touching CC4", async () => {
    const recipe = {
      recipe_version: "0.1", id: "x", archetype: "a",
      base: { item: "allowlist:base/cc4_camila" }, clothes: ["allowlist:clothes/icontent_coat"],
    };
    const [{ text }] = await call("apply_recipe", { recipe });
    expect(text).toContain("Recipe not applied");
    expect(bridge.getAvatars).not.toHaveBeenCalled();
  });
});

describe("export_motions", () => {
  it("exports each clip as a motion-only job and waits for it", async () => {
    bridge.startExportFbx.mockResolvedValue({ job_id: "job_11", status: "queued" });
    bridge.getJobStatus.mockResolvedValue({ job_id: "job_11", action: "export_fbx", status: "done", submitted_at: 1, result: { success: true, path: "C:/e/p_female_idle_1_motion.fbx" } });
    const [{ text }] = await call("export_motions", { clips: ["allowlist:motion/female_idle_1"], prefix: "p" });
    expect(bridge.startExportFbx).toHaveBeenCalledWith("p_female_idle_1_motion.fbx", {
      target_tool: "Unity", export_motion: true, motion_only: true, include_motion_path: "D:/T/Motion/Female Idle_1.rlMotion", fps: 30,
    });
    expect(text).toBe("✓ motion/female_idle_1 → C:/e/p_female_idle_1_motion.fbx");
  });

  it("refuses non-motion clips before exporting anything", async () => {
    const [{ text }] = await call("export_motions", { clips: ["allowlist:clothes/basic_tshirt"] });
    expect(text).toContain("Refused");
    expect(bridge.startExportFbx).not.toHaveBeenCalled();
  });
});
