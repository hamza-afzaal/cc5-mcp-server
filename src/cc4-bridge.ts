/**
 * HTTP client for communicating with the CC4 Python bridge plugin.
 */

import type {
  CC4Avatar,
  CC4Response,
  MorphCatalog,
  AvatarInfo,
  CreateAvatarResult,
  DeleteAvatarResult,
  CameraInfo,
  FocalLengthResult,
  LightInfo,
  LightColorResult,
  LightDetailInfo,
  LightMultiplierResult,
  LightActiveResult,
  LightShadowResult,
  VisualSettings,
  SetAmbientResult,
  SetIblResult,
  ExpressionInfo,
  MaterialInfo,
  DiffuseColor,
  SetDiffuseColorResult,
  ShaderParameters,
  SetShaderParameterResult,
  DiagnosticQuery,
  OperationResult,
  RemoveItemResult,
  ColorResult,
  ExportFbxOptions,
  MorphSearchResult,
  MorphCatalogStatus,
  MorphValue,
  SetMorphsResult,
  ItemList,
  LoadItemResult,
  SaveProjectResult,
  LicenseResult,
  CaptureViewsResult,
  ViewPreset,
  WorkspaceInfo,
  LodLevel,
  JobInfo,
} from "./types.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:5101";
const _rawTimeout = parseInt(process.env.CC4_REQUEST_TIMEOUT_MS ?? "30000", 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(_rawTimeout) && _rawTimeout > 0 && _rawTimeout <= 300_000
  ? _rawTimeout
  : 30_000;
/** Timeout for calls the bridge itself allows 300 s for (export, load, render). */
export const LONG_REQUEST_TIMEOUT_MS = 310_000;

export interface BridgeHealth {
  status: string;
  service: string;
  version: string;
  dev_mode: boolean;
  python: string;
  queue_depth: number;
  port: number;
}

export class CC4Bridge {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const url = baseUrl ?? process.env.CC4_BRIDGE_URL ?? DEFAULT_BASE_URL;
    try {
      const parsed = new URL(url);
      if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) {
        throw new Error(`CC4_BRIDGE_URL must point to localhost, got: ${parsed.hostname}`);
      }
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(`Invalid CC4_BRIDGE_URL: ${url}`);
      }
      throw e;
    }
    this.baseUrl = url;
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      };

      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `CC4 bridge error (${response.status}): ${errorBody}`
        );
      }

      const data = (await response.json()) as CC4Response<T>;

      if (data.error) {
        throw new Error(`CC4 error: ${data.error}`);
      }

      if (data.result === undefined) {
        throw new Error("CC4 bridge returned empty result");
      }

      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<boolean> {
    return (await this.getHealth()) !== null;
  }

  /** Bridge health details, or null if the bridge is unreachable. */
  async getHealth(): Promise<BridgeHealth | null> {
    try {
      return await this.request<BridgeHealth>("/health");
    } catch (err) {
      console.error("[CC4 Bridge] health check failed:", err);
      return null;
    }
  }

  // --- Diagnostics (fixed allowlist of read-only queries) ---

  async diagnostics(query: DiagnosticQuery, arg?: string): Promise<unknown> {
    return this.request<unknown>("/diagnostics", "POST", { query, arg: arg ?? "" });
  }

  // --- Jobs (long actions answered from the bridge's HTTP thread) ---

  async startJob(action: string, params: Record<string, unknown>): Promise<{ job_id: string; status: string }> {
    return this.request<{ job_id: string; status: string }>("/job/start", "POST", { action, params });
  }

  async getJobStatus<T = unknown>(jobId: string): Promise<JobInfo<T>> {
    return this.request<JobInfo<T>>("/job/status", "POST", { job_id: jobId });
  }

  async getAvatars(): Promise<CC4Avatar[]> {
    return this.request<CC4Avatar[]>("/avatars");
  }

  async getAvatarInfo(): Promise<AvatarInfo | null> {
    return this.request<AvatarInfo | null>("/avatar/info");
  }

  async getMorphCatalog(): Promise<MorphCatalog> {
    return this.request<MorphCatalog>("/morphs/catalog");
  }

  async createDefaultAvatar(): Promise<CreateAvatarResult> {
    return this.request<CreateAvatarResult>("/avatar/create", "POST", {}, LONG_REQUEST_TIMEOUT_MS);
  }

  async deleteAvatar(name: string): Promise<DeleteAvatarResult> {
    return this.request<DeleteAvatarResult>("/avatar/delete", "POST", { name });
  }

  // --- Undo / Redo ---

  async undo(): Promise<OperationResult> {
    return this.request<OperationResult>("/undo", "POST", {});
  }

  async redo(): Promise<OperationResult> {
    return this.request<OperationResult>("/redo", "POST", {});
  }

  // --- Morphs ---

  async getMorphStatus(): Promise<MorphCatalogStatus> {
    return this.request<MorphCatalogStatus>("/morphs/status");
  }

  async searchMorphs(query: string, category?: string, limit?: number): Promise<MorphSearchResult> {
    return this.request<MorphSearchResult>("/morphs/search", "POST", {
      query,
      category: category ?? "",
      limit: limit ?? 25,
    });
  }

  async setMorphs(morphs: MorphValue[]): Promise<SetMorphsResult> {
    return this.request<SetMorphsResult>("/morphs/set", "POST", { morphs });
  }

  // --- Items ---

  async listItems(): Promise<ItemList> {
    return this.request<ItemList>("/items");
  }

  async loadItem(filePath: string): Promise<LoadItemResult> {
    return this.request<LoadItemResult>("/item/load", "POST", { file_path: filePath }, LONG_REQUEST_TIMEOUT_MS);
  }

  async removeItem(itemName: string): Promise<RemoveItemResult> {
    return this.request<RemoveItemResult>("/item/remove", "POST", { item_name: itemName });
  }

  async setColor(target: "eyes" | "hair", r: number, g: number, b: number): Promise<ColorResult> {
    return this.request<ColorResult>("/color", "POST", { target, r, g, b });
  }

  // --- Workspace ---

  async getWorkspace(): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>("/workspace");
  }

  /** Route bare output names to <workspace>/<id>/...; "" selects _testbench. */
  async setCharacter(characterId: string): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>("/workspace/character", "POST", { character: characterId });
  }

  // --- Project / optimize / export ---

  async saveProjectAs(path: string): Promise<SaveProjectResult> {
    return this.request<SaveProjectResult>("/project/save_as", "POST", { path }, LONG_REQUEST_TIMEOUT_MS);
  }

  async checkExportLicense(item?: string): Promise<LicenseResult> {
    return this.request<LicenseResult>("/license/check", "POST", { item: item ?? "" });
  }

  async captureViews(presets?: ViewPreset[], width?: number, height?: number, prefix?: string): Promise<CaptureViewsResult> {
    const body: Record<string, unknown> = {};
    if (presets) body.presets = presets;
    if (width !== undefined) body.width = width;
    if (height !== undefined) body.height = height;
    if (prefix) body.prefix = prefix;
    return this.request<CaptureViewsResult>("/views/capture", "POST", body, LONG_REQUEST_TIMEOUT_MS);
  }

  /** Start an FBX export job; poll with getJobStatus. */
  async startExportFbx(outputPath: string, options: ExportFbxOptions = {}): Promise<{ job_id: string; status: string }> {
    return this.startJob("export_fbx", { output_path: outputPath, ...options });
  }

  /** Start an irreversible ActorBUILD/LOD conversion job (CC4 shows two OK dialogs). */
  async startConvertLod(level: LodLevel): Promise<{ job_id: string; status: string }> {
    return this.startJob("convert_lod", { level });
  }

  async startMergeMaterials(meshNames?: string[], textureSize?: number): Promise<{ job_id: string; status: string }> {
    const params: Record<string, unknown> = {};
    if (meshNames && meshNames.length) params.mesh_names = meshNames;
    if (textureSize !== undefined) params.texture_size = textureSize;
    return this.startJob("merge_materials", params);
  }

  // --- Camera ---

  async getCameraInfo(): Promise<CameraInfo> {
    return this.request<CameraInfo>("/camera/info");
  }

  async setCameraFocalLength(focalLength: number): Promise<FocalLengthResult> {
    return this.request<FocalLengthResult>("/camera/focal", "POST", {
      focal_length: focalLength,
    });
  }

  async frameCamera(
    view: string,
  ): Promise<{ success: boolean; view?: string; camera?: string; error?: string }> {
    return this.request("/camera/frame", "POST", { view });
  }

  // --- Lights ---

  async getLights(): Promise<LightInfo[]> {
    return this.request<LightInfo[]>("/lights");
  }

  async setLightColor(
    lightName: string,
    r: number,
    g: number,
    b: number
  ): Promise<LightColorResult> {
    return this.request<LightColorResult>("/light/color", "POST", {
      light_name: lightName,
      r,
      g,
      b,
    });
  }

  async getLightInfo(lightName: string): Promise<LightDetailInfo> {
    return this.request<LightDetailInfo>("/light/info", "POST", {
      light_name: lightName,
    });
  }

  async setLightMultiplier(
    lightName: string,
    multiplier: number
  ): Promise<LightMultiplierResult> {
    return this.request<LightMultiplierResult>("/light/multiplier", "POST", {
      light_name: lightName,
      multiplier,
    });
  }

  async setLightActive(
    lightName: string,
    active: boolean
  ): Promise<LightActiveResult> {
    return this.request<LightActiveResult>("/light/active", "POST", {
      light_name: lightName,
      active,
    });
  }

  async setLightShadow(
    lightName: string,
    castShadow: boolean | null,
    darkenStrength: number | null
  ): Promise<LightShadowResult> {
    return this.request<LightShadowResult>("/light/shadow", "POST", {
      light_name: lightName,
      cast_shadow: castShadow,
      darken_strength: darkenStrength,
    });
  }

  // --- Environment / Visual Settings ---

  async getVisualSettings(): Promise<VisualSettings> {
    return this.request<VisualSettings>("/visual/settings");
  }

  async setAmbient(r: number, g: number, b: number): Promise<SetAmbientResult> {
    return this.request<SetAmbientResult>("/visual/ambient", "POST", { r, g, b });
  }

  async setIbl(imagePath: string, enable: boolean): Promise<SetIblResult> {
    return this.request<SetIblResult>("/visual/ibl", "POST", {
      image_path: imagePath,
      enable,
    });
  }

  // --- Expressions ---

  async getExpressionInfo(): Promise<ExpressionInfo> {
    return this.request<ExpressionInfo>("/expressions");
  }

  // --- Material / Texture ---

  async getMaterialInfo(avatarName?: string): Promise<MaterialInfo> {
    const body: Record<string, unknown> = {};
    if (avatarName) body.avatar_name = avatarName;
    return this.request<MaterialInfo>("/material/info", "POST", body);
  }

  async getDiffuseColor(meshName: string, materialName: string): Promise<DiffuseColor> {
    return this.request<DiffuseColor>("/material/color/get", "POST", {
      mesh_name: meshName,
      material_name: materialName,
    });
  }

  async setDiffuseColor(
    meshName: string,
    materialName: string,
    r: number,
    g: number,
    b: number
  ): Promise<SetDiffuseColorResult> {
    return this.request<SetDiffuseColorResult>("/material/color/set", "POST", {
      mesh_name: meshName,
      material_name: materialName,
      r,
      g,
      b,
    });
  }

  async getShaderParameters(
    meshName: string,
    materialName: string
  ): Promise<ShaderParameters> {
    return this.request<ShaderParameters>("/material/shader/get", "POST", {
      mesh_name: meshName,
      material_name: materialName,
    });
  }

  async setShaderParameter(
    meshName: string,
    materialName: string,
    parameterName: string,
    values: number[]
  ): Promise<SetShaderParameterResult> {
    return this.request<SetShaderParameterResult>("/material/shader/set", "POST", {
      mesh_name: meshName,
      material_name: materialName,
      parameter_name: parameterName,
      values,
    });
  }

  async browseContent(folderType: string): Promise<string[]> {
    return this.request<string[]>("/content/browse", "POST", {
      folder_type: folderType,
    });
  }

}
