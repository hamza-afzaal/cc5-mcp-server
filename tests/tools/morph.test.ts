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
  it("registers search_morphs and set_morphs only", () => {
    expect(server.tool.mock.calls.map((c) => c[0])).toEqual(["search_morphs", "set_morphs"]);
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
