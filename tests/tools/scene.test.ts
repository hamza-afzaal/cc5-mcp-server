/**
 * Unit tests for registerSceneTools.
 * Tool handlers use bridgeCall, so bridge errors become content text responses.
 * The check_connection handler reports bridge health details.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSceneTools } from "../../src/tools/scene.js";
import {
  createMockBridge,
  SUCCESS,
  FAILURE,
  CREATE_SUCCESS,
  CAPTURE_SUCCESS,
} from "../helpers/mock-bridge.js";
import type { MockBridge } from "../helpers/mock-bridge.js";
import type { CC4Avatar, AvatarInfo, CreateAvatarResult, CaptureResult } from "../../src/types.js";

import { createMockServer } from "../helpers/mock-server.js";

// ── setup ─────────────────────────────────────────────────────────────────────

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSceneTools(server as any, bridge as any);
});

// ── registration ──────────────────────────────────────────────────────────────

describe("registerSceneTools – registration", () => {
  it("registers exactly 5 tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(5);
  });

  it("registers delete_avatar", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "delete_avatar",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("registers list_avatars", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "list_avatars",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("registers get_avatar_info", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_avatar_info",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("registers check_connection", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "check_connection",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("registers create_avatar", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "create_avatar",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

});

// ── list_avatars ──────────────────────────────────────────────────────────────

describe("list_avatars handler", () => {
  it("lists avatars with names and IDs", async () => {
    const avatars: CC4Avatar[] = [
      { id: "a1", name: "Hero", type: "character" },
      { id: "a2", name: "Villain", type: "character" },
    ];
    bridge.getAvatars.mockResolvedValue(avatars);
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].text).toContain("Found 2 avatar(s)");
    expect(result.content[0].text).toContain("Hero");
    expect(result.content[0].text).toContain("a1");
    expect(result.content[0].text).toContain("Villain");
    expect(result.content[0].text).toContain("a2");
  });

  it("shows empty scene message when no avatars exist", async () => {
    bridge.getAvatars.mockResolvedValue([]);
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].text).toBe("No avatars in the current scene.");
  });

  it("handles a single avatar correctly", async () => {
    bridge.getAvatars.mockResolvedValue([{ id: "solo", name: "Solo", type: "character" }]);
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].text).toContain("Found 1 avatar(s)");
  });

  it("returns bridge error text when bridge throws (does not propagate)", async () => {
    bridge.getAvatars.mockRejectedValue(new Error("connection refused"));
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].text).toContain("CC4 bridge error: connection refused");
  });

  it("returns content with type 'text'", async () => {
    bridge.getAvatars.mockResolvedValue([]);
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].type).toBe("text");
  });

  it("formats avatar list with dash prefix per avatar", async () => {
    const avatars: CC4Avatar[] = [
      { id: "x1", name: "Alpha", type: "character" },
    ];
    bridge.getAvatars.mockResolvedValue(avatars);
    const handler = server.getRegisteredTool("list_avatars");
    const result = await handler({});
    expect(result.content[0].text).toContain("- Alpha (ID: x1)");
  });
});

// ── create_avatar ─────────────────────────────────────────────────────────────

describe("create_avatar handler", () => {
  it("returns success message with avatar name on success", async () => {
    bridge.createDefaultAvatar.mockResolvedValue(CREATE_SUCCESS);
    const handler = server.getRegisteredTool("create_avatar");
    const result = await handler({});
    expect(result.content[0].text).toContain("Created neutral avatar");
    expect(result.content[0].text).toContain("Default Character");
  });

  it("uses 'Unknown' as name when result.name is undefined", async () => {
    const noName: CreateAvatarResult = { success: true };
    bridge.createDefaultAvatar.mockResolvedValue(noName);
    const handler = server.getRegisteredTool("create_avatar");
    const result = await handler({});
    expect(result.content[0].text).toContain("Unknown");
  });

  it("returns failure message when operation fails", async () => {
    const failed: CreateAvatarResult = { success: false, error: "scene is locked" };
    bridge.createDefaultAvatar.mockResolvedValue(failed);
    const handler = server.getRegisteredTool("create_avatar");
    const result = await handler({});
    expect(result.content[0].text).toBe("Failed: scene is locked");
  });

  it("calls bridge.createDefaultAvatar with no arguments", async () => {
    bridge.createDefaultAvatar.mockResolvedValue(CREATE_SUCCESS);
    const handler = server.getRegisteredTool("create_avatar");
    await handler({});
    expect(bridge.createDefaultAvatar).toHaveBeenCalledWith();
  });

  it("returns bridge error text when bridge throws (does not propagate)", async () => {
    bridge.createDefaultAvatar.mockRejectedValue(new Error("CC4 not running"));
    const handler = server.getRegisteredTool("create_avatar");
    const result = await handler({});
    expect(result.content[0].text).toContain("CC4 bridge error: CC4 not running");
  });

  it("returns content with type 'text'", async () => {
    bridge.createDefaultAvatar.mockResolvedValue(CREATE_SUCCESS);
    const handler = server.getRegisteredTool("create_avatar");
    const result = await handler({});
    expect(result.content[0].type).toBe("text");
  });
});

// ── delete_avatar ─────────────────────────────────────────────────────────────

describe("delete_avatar handler", () => {
  it("reports the removed avatar names", async () => {
    bridge.deleteAvatar.mockResolvedValue({ success: true, removed: ["Camila"] });
    const handler = server.getRegisteredTool("delete_avatar");
    const result = await handler({ name: "Camila" });
    expect(result.content[0].text).toBe("Deleted avatar(s): Camila");
  });

  it("deletes all avatars when name is omitted (passes empty string)", async () => {
    bridge.deleteAvatar.mockResolvedValue({ success: true, removed: ["A", "B"] });
    const handler = server.getRegisteredTool("delete_avatar");
    const result = await handler({});
    expect(bridge.deleteAvatar).toHaveBeenCalledWith("");
    expect(result.content[0].text).toBe("Deleted avatar(s): A, B");
  });

  it("returns failure message when avatar not found", async () => {
    bridge.deleteAvatar.mockResolvedValue({ success: false, error: "Avatar not found: X" });
    const handler = server.getRegisteredTool("delete_avatar");
    const result = await handler({ name: "X" });
    expect(result.content[0].text).toBe("Failed: Avatar not found: X");
  });

  it("returns bridge error text when bridge throws (does not propagate)", async () => {
    bridge.deleteAvatar.mockRejectedValue(new Error("CC4 not running"));
    const handler = server.getRegisteredTool("delete_avatar");
    const result = await handler({ name: "Camila" });
    expect(result.content[0].text).toContain("CC4 bridge error: CC4 not running");
  });
});

// ── get_avatar_info ───────────────────────────────────────────────────────────

describe("get_avatar_info handler", () => {
  const FULL_INFO: AvatarInfo = {
    name: "Camila",
    id: 7,
    avatar_type: 8,
    generation: 3,
    facial_profile: "CC4Standard",
    skin_bone_count: 181,
    subdiv_level: 0,
    materials: { total: 24, per_mesh: { CC_Base_Body: 6, CC_Base_Eye: 4 } },
    items: { clothes: ["High_Heels"], hair: ["Side part wavy"], accessories: [] },
    active_morphs: [{ id: "cc embed morphs/embed_full_body5", display_name: "Body Thin", category: "Body", value: 0.3 }],
  };

  it("shows the pipeline-relevant fields", async () => {
    bridge.getAvatarInfo.mockResolvedValue(FULL_INFO);
    const text = (await server.getRegisteredTool("get_avatar_info")({})).content[0].text;
    expect(text).toContain("Avatar: Camila (ID: 7)");
    expect(text).toContain("Facial profile: CC4Standard");
    expect(text).toContain("Skin bones: 181");
    expect(text).toContain("Materials: 24");
    expect(text).toContain("CC_Base_Body: 6");
    expect(text).toContain("Hair: Side part wavy");
    expect(text).toContain("Accessories: none");
  });

  it("lists active morphs by display name with their IDs", async () => {
    bridge.getAvatarInfo.mockResolvedValue(FULL_INFO);
    const text = (await server.getRegisteredTool("get_avatar_info")({})).content[0].text;
    expect(text).toContain("Active morphs (1):");
    expect(text).toContain("Body Thin [Body] = 0.3  (id: cc embed morphs/embed_full_body5)");
  });

  it("reports per-field read errors without failing", async () => {
    bridge.getAvatarInfo.mockResolvedValue({ name: "Camila", id: 7, errors: { skin_bone_count: "AttributeError" } });
    const text = (await server.getRegisteredTool("get_avatar_info")({})).content[0].text;
    expect(text).toContain("Active morphs (0):");
    expect(text).toContain("skin_bone_count: AttributeError");
  });

  it("shows a no-avatar message when the bridge returns null", async () => {
    bridge.getAvatarInfo.mockResolvedValue(null);
    const text = (await server.getRegisteredTool("get_avatar_info")({})).content[0].text;
    expect(text).toBe("No avatar in the scene.");
  });

  it("returns bridge error text when bridge throws (does not propagate)", async () => {
    bridge.getAvatarInfo.mockRejectedValue(new Error("timeout"));
    const text = (await server.getRegisteredTool("get_avatar_info")({})).content[0].text;
    expect(text).toContain("CC4 bridge error: timeout");
  });
});

// ── check_connection ──────────────────────────────────────────────────────────

describe("check_connection handler", () => {
  it("reports health details when the bridge answers", async () => {
    bridge.getHealth.mockResolvedValue({
      status: "ok", service: "cc4-mcp-bridge", version: "2.0.0",
      dev_mode: false, python: "3.8.8", queue_depth: 0, port: 5101,
    });
    const text = (await server.getRegisteredTool("check_connection")({})).content[0].text;
    expect(text).toContain("CC4 bridge is connected");
    expect(text).toContain("Python 3.8.8");
    expect(text).toContain("dev mode off");
  });

  it("reports not responding when health is null", async () => {
    bridge.getHealth.mockResolvedValue(null);
    const text = (await server.getRegisteredTool("check_connection")({})).content[0].text;
    expect(text).toContain("NOT responding");
    expect(text).toContain("Character Creator 4");
  });
});
