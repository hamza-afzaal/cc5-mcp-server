import { describe, it, expect, beforeEach } from "vitest";
import { registerMorphTools, MorphValueSchema } from "../../src/tools/morph.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMorphTools(server as any, bridge as any);
});

describe("registerMorphTools", () => {
  it("registers the morph tools", () => {
    expect(server.tool.mock.calls.map((c) => c[0])).toEqual(
      ["search_morphs", "set_morphs", "fix_eye_element", "export_obj", "create_morph_slider", "set_face_pose"]);
  });
});

describe("export_obj", () => {
  it("defaults to z-up and reports the file", async () => {
    bridge.exportObj.mockResolvedValue({ success: true, path: "D:/c/bald/exports/src.obj", size_bytes: 10, axis: "z", seconds: 1 });
    const text = (await server.getRegisteredTool("export_obj")({ path: "src" })).content[0].text;
    expect(bridge.exportObj).toHaveBeenCalledWith("src", {});
    expect(text).toContain("src.obj");
  });

  it("reports failure", async () => {
    bridge.exportObj.mockResolvedValue({ success: false, error: "No avatar in scene" });
    const text = (await server.getRegisteredTool("export_obj")({ path: "src" })).content[0].text;
    expect(text).toContain("No avatar in scene");
  });
});

describe("create_morph_slider", () => {
  const run = (args: unknown) => server.getRegisteredTool("create_morph_slider")(args);

  it("passes the checksum and options and reports the slider", async () => {
    bridge.createMorphSlider.mockResolvedValue({ success: true, name: "Bald Head", category: "head", ids: ["x_bald head"], avatar: "Kevin", seconds: 3 });
    const text = (await run({ target_path: "t.obj", checksum_path: "t.ObjKey", name: "Bald Head", category: "head" })).content[0].text;
    expect(bridge.createMorphSlider).toHaveBeenCalledWith("t.obj", "t.ObjKey", "Bald Head", { category: "head" });
    expect(text).toContain("Slider 'Bald Head' (head, id x_bald head) created and applied to Kevin");
  });

  it("reports failure", async () => {
    bridge.createMorphSlider.mockResolvedValue({ success: false, error: "CreateSlider returned Success but no slider named 'x' exists" });
    expect((await run({ target_path: "t.obj", checksum_path: "t.ObjKey", name: "x" })).content[0].text).toContain("no slider named");
  });
});

describe("set_face_pose", () => {
  const run = (args: unknown) => server.getRegisteredTool("set_face_pose")(args);

  it("keys the pose and reports the read-back", async () => {
    bridge.setFacePose.mockResolvedValue({ success: true, keyed: 164, read_back: { Mouth_Smile_L: 0.4 }, max_error: 0 });
    const text = (await run({ weights: { Mouth_Smile_L: 0.4 } })).content[0].text;
    expect(bridge.setFacePose).toHaveBeenCalledWith({ Mouth_Smile_L: 0.4 }, true);
    expect(text).toBe("Face pose keyed (164 expressions; read-back max error 0).");
  });

  it("passes clear=false and reports failures", async () => {
    bridge.setFacePose.mockResolvedValue({ success: false, error: "Unknown expression names: Nope" });
    const text = (await run({ weights: { Nope: 1 }, clear: false })).content[0].text;
    expect(bridge.setFacePose).toHaveBeenCalledWith({ Nope: 1 }, false);
    expect(text).toContain("Unknown expression names: Nope");
  });

  it("reports a read-back mismatch and refuses an empty pose", async () => {
    bridge.setFacePose.mockResolvedValue({ success: false, max_error: 0.3 });
    expect((await run({ weights: { Mouth_Smile_L: 0.4 } })).content[0].text).toContain("read-back max error 0.3");
    expect((await run({ weights: {} })).content[0].text).toBe("weights is empty");
  });
});

describe("search_morphs", () => {
  it("lists display name, category, range and id", async () => {
    bridge.searchMorphs.mockResolvedValue({
      results: [{ id: "cc embed morphs/embed_nose7", display_name: "Nose Width", category: "Actor", min: -1, max: 1 }],
      total_matches: 8,
    });
    const text = (await server.getRegisteredTool("search_morphs")({ query: "nose", limit: 1 })).content[0].text;
    expect(bridge.searchMorphs).toHaveBeenCalledWith("nose", undefined, 1);
    expect(text).toContain("1 of 8 match(es)");
    expect(text).toContain("Nose Width [Actor] range -1..1  (id: cc embed morphs/embed_nose7)");
  });

  it("says when nothing matches", async () => {
    bridge.searchMorphs.mockResolvedValue({ results: [], total_matches: 0 });
    const text = (await server.getRegisteredTool("search_morphs")({ query: "eye size" })).content[0].text;
    expect(text).toBe("No morphs match 'eye size'.");
  });
});

describe("set_morphs", () => {
  it("reports applied values and warnings as one undo step", async () => {
    bridge.setMorphs.mockResolvedValue({
      success: true,
      applied: [
        { id: "a", display_name: "Body Thin", requested: 1.4, value: 1.0, warning: "clamped to 1.0 (hard limit ±1.0)" },
        { id: "b", display_name: "Nose Width", requested: -0.3, value: -0.30000001192092896 },
      ],
    });
    const morphs = [{ display_name: "Body Thin", value: 1.4 }, { display_name: "Nose Width", value: -0.3 }];
    const text = (await server.getRegisteredTool("set_morphs")({ morphs })).content[0].text;
    expect(bridge.setMorphs).toHaveBeenCalledWith(morphs);
    expect(text).toContain("Applied 2 morph(s) as one undo step");
    expect(text).toContain("Body Thin = 1  (clamped to 1.0 (hard limit ±1.0))");
    expect(text).toContain("Nose Width = -0.3");
  });

  it("shows the problems when nothing was applied", async () => {
    bridge.setMorphs.mockResolvedValue({
      success: false,
      error: "1 morph entry could not be resolved; nothing applied",
      problems: [{ index: 2, display_name: "Nope Morph", error: "unknown display name" }],
    });
    const text = (await server.getRegisteredTool("set_morphs")({ morphs: [{ display_name: "Nope Morph", value: 0.2 }] })).content[0].text;
    expect(text).toContain("Nothing applied");
    expect(text).toContain("Nope Morph");
  });

  it("returns bridge errors as text", async () => {
    bridge.setMorphs.mockRejectedValue(new Error("CC4 bridge error (400): Morph catalog not ready"));
    const text = (await server.getRegisteredTool("set_morphs")({ morphs: [{ id: "x", value: 0 }] })).content[0].text;
    expect(text).toContain("Morph catalog not ready");
  });

  it("requires a display name or id per entry", () => {
    expect(MorphValueSchema.safeParse({ value: 0.1 }).success).toBe(false);
    expect(MorphValueSchema.safeParse({ id: "x", value: 0.1 }).success).toBe(true);
  });
});
