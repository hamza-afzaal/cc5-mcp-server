/**
 * Every CC4Bridge method hits the route the plugin registers (cc4-plugin/cc4_api.py
 * GET_ROUTES / POST_ROUTES) with the expected method and body.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import { CC4Bridge } from "../src/cc4-bridge.js";

const BASE = "http://127.0.0.1:5101";

function stubFetch(result: unknown = { success: true }) {
  const fn = vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: () => Promise.resolve({ result }),
    text: () => Promise.resolve(JSON.stringify({ result })),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const b = new CC4Bridge(BASE);

const CASES: Array<[string, () => Promise<unknown>, "GET" | "POST", string, unknown?]> = [
  ["getAvatars", () => b.getAvatars(), "GET", "/avatars"],
  ["getAvatarInfo", () => b.getAvatarInfo(), "GET", "/avatar/info"],
  ["getMorphCatalog", () => b.getMorphCatalog(), "GET", "/morphs/catalog"],
  ["createDefaultAvatar", () => b.createDefaultAvatar(), "POST", "/avatar/create", {}],
  ["deleteAvatar", () => b.deleteAvatar("Camila"), "POST", "/avatar/delete", { name: "Camila" }],
  ["undo", () => b.undo(), "POST", "/undo", {}],
  ["redo", () => b.redo(), "POST", "/redo", {}],
  ["getWorkspace", () => b.getWorkspace(), "GET", "/workspace"],
  ["setCharacter", () => b.setCharacter("sample-camila-01"), "POST", "/workspace/character", { character: "sample-camila-01" }],
  ["getCameraInfo", () => b.getCameraInfo(), "GET", "/camera/info"],
  ["setCameraFocalLength", () => b.setCameraFocalLength(50), "POST", "/camera/focal", { focal_length: 50 }],
  ["frameCamera", () => b.frameCamera("face"), "POST", "/camera/frame", { view: "face" }],
  ["getLights", () => b.getLights(), "GET", "/lights"],
  ["setLightColor", () => b.setLightColor("Key", 1, 0.5, 0), "POST", "/light/color", { light_name: "Key", r: 1, g: 0.5, b: 0 }],
  ["getLightInfo", () => b.getLightInfo("Key"), "POST", "/light/info", { light_name: "Key" }],
  ["setLightMultiplier", () => b.setLightMultiplier("Key", 2), "POST", "/light/multiplier", { light_name: "Key", multiplier: 2 }],
  ["setLightActive", () => b.setLightActive("Key", false), "POST", "/light/active", { light_name: "Key", active: false }],
  ["setLightShadow", () => b.setLightShadow("Key", true, null), "POST", "/light/shadow", { light_name: "Key", cast_shadow: true, darken_strength: null }],
  ["getVisualSettings", () => b.getVisualSettings(), "GET", "/visual/settings"],
  ["setAmbient", () => b.setAmbient(0.1, 0.2, 0.3), "POST", "/visual/ambient", { r: 0.1, g: 0.2, b: 0.3 }],
  ["setIbl", () => b.setIbl("D:/hdr/a.hdr", true), "POST", "/visual/ibl", { image_path: "D:/hdr/a.hdr", enable: true }],
  ["getExpressionInfo", () => b.getExpressionInfo(), "GET", "/expressions"],
  ["getMaterialInfo", () => b.getMaterialInfo(), "POST", "/material/info", {}],
  ["getMaterialInfo(name)", () => b.getMaterialInfo("Camila"), "POST", "/material/info", { avatar_name: "Camila" }],
  ["getDiffuseColor", () => b.getDiffuseColor("CC_Base_Eye", "Std_Eye_R"), "POST", "/material/color/get", { mesh_name: "CC_Base_Eye", material_name: "Std_Eye_R" }],
  ["setDiffuseColor", () => b.setDiffuseColor("CC_Base_Teeth", "Std_Upper_Teeth", 0.9, 0.88, 0.8), "POST", "/material/color/set",
    { mesh_name: "CC_Base_Teeth", material_name: "Std_Upper_Teeth", r: 0.9, g: 0.88, b: 0.8 }],
  ["getShaderParameters", () => b.getShaderParameters("CC_Base_Body", "Std_Skin_Head"), "POST", "/material/shader/get", { mesh_name: "CC_Base_Body", material_name: "Std_Skin_Head" }],
  ["setShaderParameter", () => b.setShaderParameter("CC_Base_Body", "Std_Skin_Head", "Micro Roughness Scale", [0.4]), "POST", "/material/shader/set",
    { mesh_name: "CC_Base_Body", material_name: "Std_Skin_Head", parameter_name: "Micro Roughness Scale", values: [0.4] }],
  ["browseContent", () => b.browseContent("shoes"), "POST", "/content/browse", { folder_type: "shoes" }],
];

describe("CC4Bridge routes", () => {
  it.each(CASES)("%s", async (_name, fn, method, route, body) => {
    const fetchFn = stubFetch();
    await fn();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}${route}`);
    expect(init.method).toBe(method);
    if (body !== undefined) expect(JSON.parse(init.body as string)).toEqual(body);
    else expect(init.body).toBeUndefined();
  });

  it("healthCheck is true when /health answers and false when it doesn't", async () => {
    stubFetch({ status: "ok", service: "cc4-mcp-bridge" });
    expect(await b.healthCheck()).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await b.healthCheck()).toBe(false);
  });
});

describe("TS client and Python plugin agree on routes", () => {
  const py = fs.readFileSync(path.resolve("cc4-plugin/cc4_api.py"), "utf-8");
  const table = (name: string) => {
    const block = py.slice(py.indexOf(`${name}: dict[str, str] = {`));
    const body = block.slice(0, block.indexOf("\n}"));
    return new Set([...body.matchAll(/"(\/[^"]+)":\s*"[a-z_]+"/g)].map((m) => m[1]));
  };
  const GET = new Set([...table("GET_ROUTES"), "/health", "/api"]);
  const POST = new Set([...table("POST_ROUTES"), "/job/start", "/job/status", "/reload"]);
  const src = fs.readFileSync(path.resolve("src/cc4-bridge.ts"), "utf-8");
  const calls = [...src.matchAll(/this\.request(?:<[^>]*>)?\(\s*"(\/[^"]+)"(?:,\s*"(GET|POST)")?/g)]
    .map((m) => ({ route: m[1], method: m[2] ?? "GET" }));

  it("finds the client's calls", () => {
    expect(calls.length).toBeGreaterThan(40);
  });

  it.each(calls.map((c) => [`${c.method} ${c.route}`, c] as const))("%s is registered in cc4_api.py", (_label, c) => {
    expect((c.method === "GET" ? GET : POST).has(c.route)).toBe(true);
  });
});
