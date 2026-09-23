/**
 * Branch coverage for the kept look-dev tools (lights, visual settings, camera):
 * optional fields present/absent and failure replies.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { registerLightTools } from "../../src/tools/light.js";
import { registerCameraTools } from "../../src/tools/camera.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;
const run = async (tool: string, args: Record<string, unknown> = {}) =>
  (await server.getRegisteredTool(tool)(args)).content[0].text;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerLightTools(server as any, bridge as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCameraTools(server as any, bridge as any);
});

describe("get_light_info", () => {
  it("prints every field that is present", async () => {
    bridge.getLightInfo.mockResolvedValue({
      name: "Key", type: "SpotLight", color: { r: 1, g: 0.5, b: 0.25 }, multiplier: 2,
      active: false, cast_shadow: true, darken_shadow_strength: 0.4, range: 800,
    });
    const text = await run("get_light_info", { light_name: "Key" });
    expect(text).toContain("Color: RGB(1.000, 0.500, 0.250)");
    expect(text).toContain("Multiplier: 2");
    expect(text).toContain("Active: off");
    expect(text).toContain("Cast shadow: yes");
    expect(text).toContain("Shadow darkness: 0.400");
    expect(text).toContain("Range: 800");
  });

  it("skips fields CC4 could not read, and reports errors", async () => {
    bridge.getLightInfo.mockResolvedValue({
      name: "Sun", type: "DirectionalLight", color: null, multiplier: null,
      active: true, cast_shadow: false, darken_shadow_strength: null, range: null,
    });
    const text = await run("get_light_info", { light_name: "Sun" });
    expect(text).toBe("Light 'Sun' (DirectionalLight)\nActive: on\nCast shadow: no");
    bridge.getLightInfo.mockResolvedValue({ name: "x", type: "", error: "Light not found: x" });
    expect(await run("get_light_info", { light_name: "x" })).toBe("Failed: Light not found: x");
  });
});

describe("light setters", () => {
  it("falls back to the requested values and reports failures", async () => {
    bridge.setLightColor.mockResolvedValue({ success: true });
    expect(await run("set_light_color", { light_name: "Key", r: 1, g: 0, b: 0 })).toBe("Light 'Key' color set to RGB(1, 0, 0)");
    bridge.setLightColor.mockResolvedValue({ success: false, error: "nope" });
    expect(await run("set_light_color", { light_name: "Key", r: 1, g: 0, b: 0 })).toBe("Failed: nope");

    bridge.setLightMultiplier.mockResolvedValue({ success: true });
    expect(await run("set_light_multiplier", { light_name: "Key", multiplier: 3 })).toBe("Light 'Key' multiplier set to 3");
    bridge.setLightMultiplier.mockResolvedValue({ success: false, error: "bad" });
    expect(await run("set_light_multiplier", { light_name: "Key", multiplier: 3 })).toBe("Failed: bad");

    bridge.setLightActive.mockResolvedValue({ success: true });
    expect(await run("set_light_active", { light_name: "Key", active: false })).toBe("Light 'Key' turned off");
    bridge.setLightActive.mockResolvedValue({ success: false, error: "gone" });
    expect(await run("set_light_active", { light_name: "Key", active: true })).toBe("Failed: gone");
  });

  it("set_light_shadow sends nulls for omitted options and summarises what changed", async () => {
    bridge.setLightShadow.mockResolvedValue({ success: true, light: "Key" });
    expect(await run("set_light_shadow", { light_name: "Key" })).toBe("Light 'Key' shadow updated");
    expect(bridge.setLightShadow).toHaveBeenCalledWith("Key", null, null);

    bridge.setLightShadow.mockResolvedValue({ success: true, light: "Key", cast_shadow: false, darken_shadow_strength: 0.3 });
    expect(await run("set_light_shadow", { light_name: "Key", cast_shadow: false, darken_strength: 0.3 }))
      .toBe("Light 'Key' shadow updated: cast shadow off, darkness 0.3");

    bridge.setLightShadow.mockResolvedValue({ success: false, error: "Provide cast_shadow and/or darken_strength" });
    expect(await run("set_light_shadow", { light_name: "Key" })).toContain("Failed");
  });
});

describe("visual settings", () => {
  it("get_visual_settings handles full, empty and failed replies", async () => {
    bridge.getVisualSettings.mockResolvedValue({ success: true, ambient: { r: 0.1, g: 0.2, b: 0.3 }, ibl_enabled: false });
    expect(await run("get_visual_settings")).toBe("Ambient: RGB(0.100, 0.200, 0.300)\nIBL: off");
    bridge.getVisualSettings.mockResolvedValue({ success: true, ambient: null, ibl_enabled: null });
    expect(await run("get_visual_settings")).toBe("No visual settings available.");
    bridge.getVisualSettings.mockResolvedValue({ success: false, error: "no component" });
    expect(await run("get_visual_settings")).toBe("Failed: no component");
  });

  it("set_ambient echoes the applied or requested color", async () => {
    bridge.setAmbient.mockResolvedValue({ success: true, ambient: { r: 0.5, g: 0.5, b: 0.5 } });
    expect(await run("set_ambient", { r: 0.5, g: 0.5, b: 0.5 })).toBe("Ambient color set to RGB(0.500, 0.500, 0.500)");
    bridge.setAmbient.mockResolvedValue({ success: true });
    expect(await run("set_ambient", { r: 0.2, g: 0.3, b: 0.4 })).toBe("Ambient color set to RGB(0.2, 0.3, 0.4)");
    bridge.setAmbient.mockResolvedValue({ success: false, error: "x" });
    expect(await run("set_ambient", { r: 0, g: 0, b: 0 })).toBe("Failed: x");
  });

  it("set_ibl reports the loaded image, a plain toggle, or failure", async () => {
    bridge.setIbl.mockResolvedValue({ success: true, ibl_enabled: true, loaded_image: "D:/hdr/studio.hdr" });
    expect(await run("set_ibl", { image_path: "D:/hdr/studio.hdr", enable: true })).toBe("IBL enabled (loaded D:/hdr/studio.hdr)");
    bridge.setIbl.mockResolvedValue({ success: true, ibl_enabled: false, loaded_image: null });
    expect(await run("set_ibl", { enable: false })).toBe("IBL disabled");
    expect(bridge.setIbl).toHaveBeenLastCalledWith("", false);
    bridge.setIbl.mockResolvedValue({ success: false, error: "not found" });
    expect(await run("set_ibl", { enable: true })).toBe("Failed: not found");
  });
});

describe("camera", () => {
  it("frame_camera reports the view or the failure", async () => {
    bridge.frameCamera.mockResolvedValue({ success: true, view: "front", camera: "Preview Camera" });
    expect(await run("frame_camera", { view: "front" })).toBe("Camera framed to 'front' view.");
    bridge.frameCamera.mockResolvedValue({ success: true });
    expect(await run("frame_camera", { view: "face" })).toBe("Camera framed to 'face' view.");
    bridge.frameCamera.mockResolvedValue({ success: false, error: "No camera in scene" });
    expect(await run("frame_camera", { view: "home" })).toBe("Failed: No camera in scene");
  });

  it("set_camera_focal_length falls back to the requested value", async () => {
    bridge.setCameraFocalLength.mockResolvedValue({ success: true });
    expect(await run("set_camera_focal_length", { focal_length: 50 })).toBe("Camera focal length set to 50mm");
  });
});
