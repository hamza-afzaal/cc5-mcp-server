/**
 * HTTP client for communicating with the CC4 Python bridge plugin.
 */

import type {
  CC4Avatar,
  CC4Response,
  MorphCatalog,
  AvatarInfo,
  OperationResult,
  CreateAvatarResult,
  DeleteAvatarResult,
  CaptureResult,
  MorphSetRequest,
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
  ResetMorphsResult,
  MaterialInfo,
  DiffuseColor,
  SetDiffuseColorResult,
  ShaderParameters,
  SetShaderParameterResult,
  ClothingItem,
  HairItem,
  AccessoryItem,
  RemoveItemResult,
  ColorResult,
  ExportFbxOptions,
  ExportFbxResult,
  DiagnosticQuery,
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

  async searchMorphs(query: string, category?: string): Promise<Array<{ id: string; display_name: string; category: string }>> {
    return this.request<Array<{ id: string; display_name: string; category: string }>>("/morphs/search", "POST", {
      query,
      category: category ?? "",
    });
  }

  async getMorphCatalog(): Promise<MorphCatalog> {
    return this.request<MorphCatalog>("/morphs/catalog");
  }

  async getMorphValue(
    morphId: string,
  ): Promise<{ success: boolean; morph_id?: string; value?: number; error?: string }> {
    return this.request("/morph/get", "POST", {
      morph_id: morphId,
    });
  }

  async setMorph(morphId: string, value: number): Promise<OperationResult> {
    return this.request<OperationResult>("/morph/set", "POST", {
      morph_id: morphId,
      value,
    });
  }

  async setMultipleMorphs(
    morphs: MorphSetRequest[]
  ): Promise<OperationResult> {
    return this.request<OperationResult>("/morphs/set", "POST", { morphs });
  }

  async createDefaultAvatar(): Promise<CreateAvatarResult> {
    return this.request<CreateAvatarResult>("/avatar/create", "POST", {}, LONG_REQUEST_TIMEOUT_MS);
  }

  async deleteAvatar(name: string): Promise<DeleteAvatarResult> {
    return this.request<DeleteAvatarResult>("/avatar/delete", "POST", { name });
  }

  async loadAsset(filePath: string): Promise<OperationResult> {
    return this.request<OperationResult>("/asset/load", "POST", {
      file_path: filePath,
    }, LONG_REQUEST_TIMEOUT_MS);
  }

  async exportFbx(
    outputPath: string,
    options: number = 0,
    extra: ExportFbxOptions = {},
  ): Promise<ExportFbxResult> {
    const body: Record<string, unknown> = {
      output_path: outputPath,
      options,
    };
    if (extra.target_tool !== undefined) body.target_tool = extra.target_tool;
    if (extra.sub_d_level !== undefined) body.sub_d_level = extra.sub_d_level;
    if (extra.include_current_pose !== undefined) body.include_current_pose = extra.include_current_pose;
    if (extra.delete_hidden_faces !== undefined) body.delete_hidden_faces = extra.delete_hidden_faces;
    if (extra.use_smooth_mesh !== undefined) body.use_smooth_mesh = extra.use_smooth_mesh;
    if (extra.remove_eyelash !== undefined) body.remove_eyelash = extra.remove_eyelash;
    if (extra.remove_tearline_occlusion !== undefined) body.remove_tearline_occlusion = extra.remove_tearline_occlusion;
    if (extra.embed_textures !== undefined) body.embed_textures = extra.embed_textures;
    if (extra.export_motion !== undefined) body.export_motion = extra.export_motion;
    if (extra.fps !== undefined) body.fps = extra.fps;
    if (extra.motion_range !== undefined) body.motion_range = extra.motion_range;
    if (extra.convert_image_format !== undefined) body.convert_image_format = extra.convert_image_format;
    if (extra.texture_size !== undefined) body.texture_size = extra.texture_size;
    if (extra.export_json !== undefined) body.export_json = extra.export_json;
    return this.request<ExportFbxResult>("/export/fbx", "POST", body, LONG_REQUEST_TIMEOUT_MS);
  }

  async captureViewport(outputPath?: string, width?: number, height?: number): Promise<CaptureResult> {
    const body: Record<string, unknown> = {};
    if (outputPath) body.output_path = outputPath;
    if (width !== undefined) body.width = width;
    if (height !== undefined) body.height = height;
    return this.request<CaptureResult>("/viewport/capture", "POST", body, LONG_REQUEST_TIMEOUT_MS);
  }

  // --- Undo / Redo ---

  async undo(): Promise<OperationResult> {
    return this.request<OperationResult>("/undo", "POST", {});
  }

  async redo(): Promise<OperationResult> {
    return this.request<OperationResult>("/redo", "POST", {});
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

  // --- Reset Morphs ---

  async resetAllMorphs(avatarName?: string): Promise<ResetMorphsResult> {
    const body: Record<string, unknown> = {};
    if (avatarName) body.avatar_name = avatarName;
    return this.request<ResetMorphsResult>("/morphs/reset", "POST", body);
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

  // --- Content Management (Tier 1) ---

  async listClothes(): Promise<ClothingItem[]> {
    return this.request<ClothingItem[]>("/clothes");
  }

  async listHair(): Promise<HairItem[]> {
    return this.request<HairItem[]>("/hair");
  }

  async listAccessories(): Promise<AccessoryItem[]> {
    return this.request<AccessoryItem[]>("/accessories");
  }

  async removeSceneItem(itemName: string): Promise<RemoveItemResult> {
    return this.request<RemoveItemResult>("/item/remove", "POST", {
      item_name: itemName,
    });
  }

  async browseContent(folderType: string): Promise<string[]> {
    return this.request<string[]>("/content/browse", "POST", {
      folder_type: folderType,
    });
  }

  // --- Convenience Color Shortcuts (Tier 3) ---

  async setEyeColor(r: number, g: number, b: number): Promise<ColorResult> {
    return this.request<ColorResult>("/color/eye", "POST", { r, g, b });
  }

  async setHairColor(r: number, g: number, b: number): Promise<ColorResult> {
    return this.request<ColorResult>("/color/hair", "POST", { r, g, b });
  }

}
