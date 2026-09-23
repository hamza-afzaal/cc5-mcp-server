/**
 * Unit tests for CC4Bridge HTTP client.
 * All HTTP calls are mocked via vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CC4Bridge } from "../src/cc4-bridge.js";
import type {
  CC4Response,
  CC4Avatar,
  AvatarInfo,
  MorphCatalog,
  OperationResult,
  CreateAvatarResult,
  CaptureResult,
  MaterialInfo,
  DiffuseColor,
  SetDiffuseColorResult,
} from "../src/types.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function mockFetch<T>(data: CC4Response<T>, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  );
}

function mockFetchError(message: string): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(message)));
}

function mockFetchHttpError(status: number, body: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.reject(new Error("not json")),
      text: () => Promise.resolve(body),
    })
  );
}

// ── setup ─────────────────────────────────────────────────────────────────────

let bridge: CC4Bridge;

beforeEach(() => {
  bridge = new CC4Bridge("http://localhost:5101");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── constructor ───────────────────────────────────────────────────────────────

describe("CC4Bridge constructor", () => {
  it("accepts localhost URLs", () => {
    expect(() => new CC4Bridge("http://localhost:9999")).not.toThrow();
  });

  it("accepts 127.0.0.1 URLs", () => {
    expect(() => new CC4Bridge("http://127.0.0.1:5101")).not.toThrow();
  });

  it("accepts ::1 (IPv6 loopback) URLs", () => {
    expect(() => new CC4Bridge("http://[::1]:5101")).not.toThrow();
  });

  it("rejects non-localhost URLs", () => {
    expect(() => new CC4Bridge("http://example.com:9999")).toThrow(
      "CC4_BRIDGE_URL must point to localhost, got: example.com"
    );
  });

  it("rejects remote IP addresses", () => {
    expect(() => new CC4Bridge("http://192.168.1.100:5101")).toThrow(
      "CC4_BRIDGE_URL must point to localhost"
    );
  });

  it("rejects completely invalid URLs", () => {
    expect(() => new CC4Bridge("not-a-url")).toThrow("Invalid CC4_BRIDGE_URL");
  });

  it("falls back to CC4_BRIDGE_URL env variable when localhost", () => {
    const original = process.env.CC4_BRIDGE_URL;
    process.env.CC4_BRIDGE_URL = "http://localhost:1234";
    const b = new CC4Bridge();
    expect((b as unknown as { baseUrl: string }).baseUrl).toBe("http://localhost:1234");
    process.env.CC4_BRIDGE_URL = original;
  });

  it("falls back to default URL when no env var is set", () => {
    const original = process.env.CC4_BRIDGE_URL;
    delete process.env.CC4_BRIDGE_URL;
    const b = new CC4Bridge();
    expect((b as unknown as { baseUrl: string }).baseUrl).toBe("http://127.0.0.1:5101");
    process.env.CC4_BRIDGE_URL = original;
  });

  it("stores the provided base URL", () => {
    const b = new CC4Bridge("http://127.0.0.1:9999");
    expect((b as unknown as { baseUrl: string }).baseUrl).toBe("http://127.0.0.1:9999");
  });
});

// ── healthCheck ───────────────────────────────────────────────────────────────

describe("CC4Bridge.healthCheck", () => {
  it("returns true when the bridge responds successfully", async () => {
    mockFetch<{ status: string }>({ result: { status: "ok" } });
    const result = await bridge.healthCheck();
    expect(result).toBe(true);
  });

  it("returns false when fetch throws a network error", async () => {
    mockFetchError("ECONNREFUSED");
    const result = await bridge.healthCheck();
    expect(result).toBe(false);
  });

  it("returns false when the server returns a non-200 status", async () => {
    mockFetchHttpError(503, "Service Unavailable");
    const result = await bridge.healthCheck();
    expect(result).toBe(false);
  });

  it("returns false when the response contains an error field", async () => {
    mockFetch({ error: "CC4 not ready" });
    const result = await bridge.healthCheck();
    expect(result).toBe(false);
  });

  it("calls GET /health", async () => {
    mockFetch<{ status: string }>({ result: { status: "ok" } });
    await bridge.healthCheck();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/health",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ── getAvatars ────────────────────────────────────────────────────────────────

describe("CC4Bridge.getAvatars", () => {
  it("returns an array of avatars on success", async () => {
    const avatars: CC4Avatar[] = [
      { id: "a1", name: "Hero", type: "character" },
      { id: "a2", name: "Villain", type: "character" },
    ];
    mockFetch<CC4Avatar[]>({ result: avatars });
    const result = await bridge.getAvatars();
    expect(result).toEqual(avatars);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when there are no avatars", async () => {
    mockFetch<CC4Avatar[]>({ result: [] });
    const result = await bridge.getAvatars();
    expect(result).toEqual([]);
  });

  it("throws when the bridge returns an error field", async () => {
    mockFetch({ error: "scene not ready" });
    await expect(bridge.getAvatars()).rejects.toThrow("CC4 error: scene not ready");
  });

  it("throws when the HTTP status is not OK", async () => {
    mockFetchHttpError(500, "Internal Server Error");
    await expect(bridge.getAvatars()).rejects.toThrow("CC4 bridge error (500)");
  });

  it("throws on network failure", async () => {
    mockFetchError("fetch failed");
    await expect(bridge.getAvatars()).rejects.toThrow("fetch failed");
  });

  it("calls GET /avatars", async () => {
    mockFetch<CC4Avatar[]>({ result: [] });
    await bridge.getAvatars();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/avatars",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ── getAvatarInfo ─────────────────────────────────────────────────────────────

describe("CC4Bridge.getAvatarInfo", () => {
  const sampleInfo: AvatarInfo = {
    id: "av1",
    name: "Test Avatar",
    active_morphs: { Fat: 0.3, Muscular: 0.5 },
  };

  it("returns avatar info on success", async () => {
    mockFetch<AvatarInfo>({ result: sampleInfo });
    const result = await bridge.getAvatarInfo();
    expect(result).toEqual(sampleInfo);
  });

  it("returns null when result is null", async () => {
    mockFetch<null>({ result: null });
    const result = await bridge.getAvatarInfo();
    expect(result).toBeNull();
  });

  it("throws when the bridge returns an error field", async () => {
    mockFetch({ error: "no avatar" });
    await expect(bridge.getAvatarInfo()).rejects.toThrow("CC4 error: no avatar");
  });

  it("calls GET /avatar/info", async () => {
    mockFetch<AvatarInfo>({ result: sampleInfo });
    await bridge.getAvatarInfo();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/avatar/info",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ── getMorphCatalog ───────────────────────────────────────────────────────────

describe("CC4Bridge.getMorphCatalog", () => {
  const catalog: MorphCatalog = {
    Body: [
      { id: "Fat", display_name: "Fat" },
      { id: "Muscular", display_name: "Muscular" },
    ],
    Head: [{ id: "Head Scale", display_name: "Head Scale" }],
  };

  it("returns the morph catalog on success", async () => {
    mockFetch<MorphCatalog>({ result: catalog });
    const result = await bridge.getMorphCatalog();
    expect(result).toEqual(catalog);
    expect(result.Body).toHaveLength(2);
    expect(result.Head).toHaveLength(1);
  });

  it("throws on HTTP error", async () => {
    mockFetchHttpError(404, "Not Found");
    await expect(bridge.getMorphCatalog()).rejects.toThrow("CC4 bridge error (404)");
  });

  it("calls GET /morphs/catalog", async () => {
    mockFetch<MorphCatalog>({ result: catalog });
    await bridge.getMorphCatalog();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/morphs/catalog",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ── createDefaultAvatar ───────────────────────────────────────────────────────

describe("CC4Bridge.createDefaultAvatar", () => {
  it("returns CreateAvatarResult on success", async () => {
    const created: CreateAvatarResult = { success: true, name: "Default Character" };
    mockFetch<CreateAvatarResult>({ result: created });
    const result = await bridge.createDefaultAvatar();
    expect(result.success).toBe(true);
    expect(result.name).toBe("Default Character");
  });

  it("sends POST /avatar/create with empty body", async () => {
    mockFetch<CreateAvatarResult>({ result: { success: true } });
    await bridge.createDefaultAvatar();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/avatar/create",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      })
    );
  });

  it("sends POST to the correct /avatar/create endpoint", async () => {
    mockFetch<CreateAvatarResult>({ result: { success: true } });
    await bridge.createDefaultAvatar();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/avatar/create",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not include any age field in the request body", async () => {
    mockFetch<CreateAvatarResult>({ result: { success: true } });
    await bridge.createDefaultAvatar();
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const body = (callArgs[1] as RequestInit).body as string;
    expect(JSON.parse(body)).not.toHaveProperty("age");
  });

  it("returns failure when CC4 cannot create avatar", async () => {
    mockFetch<CreateAvatarResult>({ result: { success: false, error: "scene locked" } });
    const result = await bridge.createDefaultAvatar();
    expect(result.success).toBe(false);
    expect(result.error).toBe("scene locked");
  });

  it("throws on HTTP error", async () => {
    mockFetchHttpError(500, "CC4 crashed");
    await expect(bridge.createDefaultAvatar()).rejects.toThrow("CC4 bridge error (500)");
  });

  it("throws on network error", async () => {
    mockFetchError("connection refused");
    await expect(bridge.createDefaultAvatar()).rejects.toThrow("connection refused");
  });
});

// ── request internals ─────────────────────────────────────────────────────────

describe("CC4Bridge internal request handling", () => {
  it("sends Content-Type: application/json header", async () => {
    mockFetch<CC4Avatar[]>({ result: [] });
    await bridge.getAvatars();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("does not include body on GET requests", async () => {
    mockFetch<CC4Avatar[]>({ result: [] });
    await bridge.getAvatars();
    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeUndefined();
  });

  it("throws CC4 bridge error with status code when response is not OK", async () => {
    mockFetchHttpError(422, "Unprocessable Entity");
    await expect(bridge.getAvatars()).rejects.toThrow("CC4 bridge error (422): Unprocessable Entity");
  });

  it("throws CC4 error message from response body error field", async () => {
    mockFetch({ error: "RLPy not initialized" });
    await expect(bridge.getAvatarInfo()).rejects.toThrow("CC4 error: RLPy not initialized");
  });

  it("throws when result field is undefined in the response", async () => {
    mockFetch({});
    await expect(bridge.getAvatars()).rejects.toThrow("CC4 bridge returned empty result");
  });
});

// ── getMaterialInfo ───────────────────────────────────────────────────────────

describe("CC4Bridge.getMaterialInfo", () => {
  const sampleInfo: MaterialInfo = {
    meshes: {
      CC_Base_Body: ["Std_Skin_Body", "Std_Skin_Arm"],
      CC_Base_Eye: ["Std_Eye_R", "Std_Eye_L"],
    },
  };

  it("returns material info on success", async () => {
    mockFetch<MaterialInfo>({ result: sampleInfo });
    const result = await bridge.getMaterialInfo();
    expect(result).toEqual(sampleInfo);
    expect(Object.keys(result.meshes)).toHaveLength(2);
  });

  it("returns an empty object when no meshes exist", async () => {
    mockFetch<MaterialInfo>({ result: { meshes: {} } });
    const result = await bridge.getMaterialInfo();
    expect(result).toEqual({ meshes: {} });
  });

  it("sends POST /material/info with empty body when no avatar_name provided", async () => {
    mockFetch<MaterialInfo>({ result: {} });
    await bridge.getMaterialInfo();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/material/info",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      })
    );
  });

  it("sends avatar_name in body when provided", async () => {
    mockFetch<MaterialInfo>({ result: sampleInfo });
    await bridge.getMaterialInfo("Hero");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/material/info",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ avatar_name: "Hero" }),
      })
    );
  });

  it("throws on bridge error field", async () => {
    mockFetch({ error: "no avatar selected" });
    await expect(bridge.getMaterialInfo()).rejects.toThrow("CC4 error: no avatar selected");
  });

  it("throws on HTTP error", async () => {
    mockFetchHttpError(503, "Service Unavailable");
    await expect(bridge.getMaterialInfo()).rejects.toThrow("CC4 bridge error (503)");
  });

  it("throws on network failure", async () => {
    mockFetchError("connection refused");
    await expect(bridge.getMaterialInfo()).rejects.toThrow("connection refused");
  });
});

// ── getDiffuseColor ───────────────────────────────────────────────────────────

describe("CC4Bridge.getDiffuseColor", () => {
  const sampleColor: DiffuseColor = { r: 0.8, g: 0.6, b: 0.4 };

  it("returns DiffuseColor on success", async () => {
    mockFetch<DiffuseColor>({ result: sampleColor });
    const result = await bridge.getDiffuseColor("CC_Base_Body", "Std_Skin_Body");
    expect(result).toEqual(sampleColor);
    expect(result.r).toBe(0.8);
    expect(result.g).toBe(0.6);
    expect(result.b).toBe(0.4);
  });

  it("returns DiffuseColor with error field when material not found", async () => {
    const colorWithError: DiffuseColor = { r: 0, g: 0, b: 0, error: "material not found" };
    mockFetch<DiffuseColor>({ result: colorWithError });
    const result = await bridge.getDiffuseColor("Bad_Mesh", "Bad_Mat");
    expect(result.error).toBe("material not found");
  });

  it("sends POST /material/color/get with mesh and material names", async () => {
    mockFetch<DiffuseColor>({ result: sampleColor });
    await bridge.getDiffuseColor("CC_Base_Body", "Std_Skin_Body");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/material/color/get",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mesh_name: "CC_Base_Body", material_name: "Std_Skin_Body" }),
      })
    );
  });

  it("throws on bridge error field", async () => {
    mockFetch({ error: "mesh not found" });
    await expect(bridge.getDiffuseColor("Mesh", "Mat")).rejects.toThrow("CC4 error: mesh not found");
  });

  it("throws on HTTP error", async () => {
    mockFetchHttpError(400, "Bad Request");
    await expect(bridge.getDiffuseColor("Mesh", "Mat")).rejects.toThrow("CC4 bridge error (400)");
  });

  it("throws on network failure", async () => {
    mockFetchError("timeout");
    await expect(bridge.getDiffuseColor("Mesh", "Mat")).rejects.toThrow("timeout");
  });
});

// ── setDiffuseColor ───────────────────────────────────────────────────────────

describe("CC4Bridge.setDiffuseColor", () => {
  const successResult: SetDiffuseColorResult = {
    success: true,
    mesh: "CC_Base_Body",
    material: "Std_Skin_Body",
  };

  it("returns SetDiffuseColorResult on success", async () => {
    mockFetch<SetDiffuseColorResult>({ result: successResult });
    const result = await bridge.setDiffuseColor("CC_Base_Body", "Std_Skin_Body", 0.9, 0.7, 0.5);
    expect(result.success).toBe(true);
    expect(result.mesh).toBe("CC_Base_Body");
    expect(result.material).toBe("Std_Skin_Body");
  });

  it("returns failure result when CC4 cannot set the color", async () => {
    const failure: SetDiffuseColorResult = { success: false, error: "material locked" };
    mockFetch<SetDiffuseColorResult>({ result: failure });
    const result = await bridge.setDiffuseColor("Mesh", "Mat", 0.5, 0.5, 0.5);
    expect(result.success).toBe(false);
    expect(result.error).toBe("material locked");
  });

  it("sends POST /material/color/set with all required fields", async () => {
    mockFetch<SetDiffuseColorResult>({ result: successResult });
    await bridge.setDiffuseColor("CC_Base_Body", "Std_Skin_Body", 0.9, 0.7, 0.5);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/material/color/set",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mesh_name: "CC_Base_Body",
          material_name: "Std_Skin_Body",
          r: 0.9,
          g: 0.7,
          b: 0.5,
        }),
      })
    );
  });

  it("handles boundary RGB values of 0 and 1", async () => {
    mockFetch<SetDiffuseColorResult>({ result: { success: true } });
    const result = await bridge.setDiffuseColor("Mesh", "Mat", 0, 1, 0);
    expect(result.success).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ mesh_name: "Mesh", material_name: "Mat", r: 0, g: 1, b: 0 }),
      })
    );
  });

  it("throws on bridge error field", async () => {
    mockFetch({ error: "no avatar" });
    await expect(bridge.setDiffuseColor("M", "N", 0, 0, 0)).rejects.toThrow("CC4 error: no avatar");
  });

  it("throws on HTTP error", async () => {
    mockFetchHttpError(500, "server error");
    await expect(bridge.setDiffuseColor("M", "N", 0, 0, 0)).rejects.toThrow("CC4 bridge error (500)");
  });

  it("throws on network failure", async () => {
    mockFetchError("ECONNREFUSED");
    await expect(bridge.setDiffuseColor("M", "N", 0, 0, 0)).rejects.toThrow("ECONNREFUSED");
  });
});

// ── health / diagnostics / jobs ──────────────────────────────────────────────

describe("CC4Bridge.getHealth", () => {
  it("returns the health payload", async () => {
    mockFetch({ result: { status: "ok", service: "cc4-mcp-bridge", version: "2.0.0", dev_mode: false, python: "3.8.8", queue_depth: 0, port: 5101 } });
    const health = await bridge.getHealth();
    expect(health?.service).toBe("cc4-mcp-bridge");
  });

  it("returns null when the bridge is down", async () => {
    mockFetchError("ECONNREFUSED");
    expect(await bridge.getHealth()).toBeNull();
  });
});

describe("CC4Bridge.diagnostics", () => {
  it("POSTs /diagnostics with query and arg", async () => {
    mockFetch({ result: { path: "C:/p.ccProject" } });
    await bridge.diagnostics("project_path");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/diagnostics",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ query: "project_path", arg: "" }) }),
    );
  });
});

describe("CC4Bridge jobs", () => {
  it("startJob POSTs /job/start with action and params", async () => {
    mockFetch({ result: { job_id: "job_1", status: "queued" } });
    const started = await bridge.startJob("export_fbx", { output_path: "a.fbx" });
    expect(started.job_id).toBe("job_1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:5101/job/start",
      expect.objectContaining({ body: JSON.stringify({ action: "export_fbx", params: { output_path: "a.fbx" } }) }),
    );
  });

  it("getJobStatus POSTs /job/status and returns the job", async () => {
    mockFetch({ result: { job_id: "job_1", action: "export_fbx", status: "done", submitted_at: 1, result: { success: true } } });
    const job = await bridge.getJobStatus("job_1");
    expect(job.status).toBe("done");
  });
});


// ── Phase 2 endpoints ────────────────────────────────────────────────────────

describe("CC4Bridge Phase 2 endpoints", () => {
  const body = () => JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
  const url = () => vi.mocked(fetch).mock.calls[0][0];

  it("searchMorphs sends query, category and limit", async () => {
    mockFetch({ result: { results: [], total_matches: 0 } });
    await bridge.searchMorphs("nose", undefined, 5);
    expect(url()).toBe("http://localhost:5101/morphs/search");
    expect(body()).toEqual({ query: "nose", category: "", limit: 5 });
  });

  it("setMorphs posts the batch", async () => {
    mockFetch({ result: { success: true, applied: [] } });
    await bridge.setMorphs([{ display_name: "Body Thin", value: 0.3 }]);
    expect(url()).toBe("http://localhost:5101/morphs/set");
    expect(body()).toEqual({ morphs: [{ display_name: "Body Thin", value: 0.3 }] });
  });

  it("getMorphStatus and listItems are GETs", async () => {
    mockFetch({ result: { ready: true, categories: 123, morphs: 2778 } });
    expect((await bridge.getMorphStatus()).ready).toBe(true);
    expect(url()).toBe("http://localhost:5101/morphs/status");
    mockFetch({ result: { avatar: "Camila", clothes: [], hair: [], accessories: [] } });
    await bridge.listItems();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("http://localhost:5101/items");
  });

  it("loadItem, removeItem, setColor, saveProjectAs, checkExportLicense hit their routes", async () => {
    const cases: Array<[() => Promise<unknown>, string, unknown]> = [
      [() => bridge.loadItem("D:/a.ccCloth"), "/item/load", { file_path: "D:/a.ccCloth" }],
      [() => bridge.removeItem("Bra"), "/item/remove", { item_name: "Bra" }],
      [() => bridge.setColor("eyes", 0.1, 0.2, 0.3), "/color", { target: "eyes", r: 0.1, g: 0.2, b: 0.3 }],
      [() => bridge.saveProjectAs("copy"), "/project/save_as", { path: "copy" }],
      [() => bridge.checkExportLicense(), "/license/check", { item: "" }],
    ];
    for (const [fn, route, expected] of cases) {
      mockFetch({ result: { success: true } });
      await fn();
      expect(url()).toBe(`http://localhost:5101${route}`);
      expect(body()).toEqual(expected);
      vi.unstubAllGlobals();
    }
  });

  it("captureViews only sends given options", async () => {
    mockFetch({ result: { success: true, views: [] } });
    await bridge.captureViews(["head"], undefined, undefined, "camila");
    expect(url()).toBe("http://localhost:5101/views/capture");
    expect(body()).toEqual({ presets: ["head"], prefix: "camila" });
  });

  it("export/convert/merge start jobs", async () => {
    mockFetch({ result: { job_id: "job_1", status: "queued" } });
    await bridge.startExportFbx("a.fbx", { target_tool: "Unity", export_json: true });
    expect(body()).toEqual({ action: "export_fbx", params: { output_path: "a.fbx", target_tool: "Unity", export_json: true } });
    vi.unstubAllGlobals();
    mockFetch({ result: { job_id: "job_2", status: "queued" } });
    await bridge.startConvertLod("lod1");
    expect(body()).toEqual({ action: "convert_lod", params: { level: "lod1" } });
    vi.unstubAllGlobals();
    mockFetch({ result: { job_id: "job_3", status: "queued" } });
    await bridge.startMergeMaterials(["Shirt", "Jeans"], 1024);
    expect(body()).toEqual({ action: "merge_materials", params: { mesh_names: ["Shirt", "Jeans"], texture_size: 1024 } });
  });
});
