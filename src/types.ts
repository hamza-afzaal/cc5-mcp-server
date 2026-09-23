/**
 * Type definitions for CC4 MCP Server.
 */

export interface CC4Avatar {
  name: string;
  id: string;
  type: string;
}

export interface MorphEntry {
  id: string;
  display_name: string;
}

export interface MorphCatalog {
  [category: string]: MorphEntry[];
}

export interface MorphSetRequest {
  morph_id: string;
  /** Morph blend weight. Valid range: -1..1 (negative values shrink the feature, positive enlarge it). */
  value: number;
}

export interface ActiveMorph {
  id: string;
  display_name: string;
  category: string;
  value: number;
}

export interface AvatarInfo {
  name: string;
  id: string | number;
  avatar_type?: number;
  generation?: number;
  /** "CC4Standard" | "CC4Extended" | "Traditional" | "None" | raw value. */
  facial_profile?: string | null;
  skin_bone_count?: number;
  subdiv_level?: number;
  materials?: { total: number; per_mesh: Record<string, number> };
  items?: { clothes: string[]; hair: string[]; accessories: string[] };
  active_morphs?: ActiveMorph[];
  /** Per-field read failures (the rest of the info is still valid). */
  errors?: Record<string, string>;
}

export interface CC4Response<T = unknown> {
  result?: T;
  error?: string;
}

export interface OperationResult {
  success: boolean;
  error?: string;
}

export interface CreateAvatarResult extends OperationResult {
  name?: string;
}

export interface DeleteAvatarResult extends OperationResult {
  removed?: string[];
}

export interface CaptureResult extends OperationResult {
  warning?: string;
  path?: string;
  base64?: string;
}

export interface CameraInfo {
  name: string;
  position: { x: number; y: number; z: number };
  focal_length: number;
  error?: string;
}

export interface FocalLengthResult extends OperationResult {
  focal_length?: number;
}

export interface LightInfo {
  name: string;
  id: number;
  type: string;
}

export interface LightColorResult extends OperationResult {
  light?: string;
}

export interface LightDetailInfo {
  name: string;
  type: string;
  color: { r: number; g: number; b: number } | null;
  multiplier: number | null;
  active?: boolean | null;
  cast_shadow?: boolean | null;
  darken_shadow_strength?: number | null;
  range?: number | null;
  error?: string;
}

export interface LightMultiplierResult extends OperationResult {
  light?: string;
  multiplier?: number;
}

export interface LightActiveResult extends OperationResult {
  light?: string;
  active?: boolean;
}

export interface LightShadowResult extends OperationResult {
  light?: string;
  cast_shadow?: boolean;
  darken_shadow_strength?: number;
}

export interface VisualSettings extends OperationResult {
  ambient?: { r: number; g: number; b: number } | null;
  ibl_enabled?: boolean | null;
}

export interface SetAmbientResult extends OperationResult {
  ambient?: { r: number; g: number; b: number };
}

export interface SetIblResult extends OperationResult {
  ibl_enabled?: boolean;
  loaded_image?: string | null;
}

export interface ExpressionInfo {
  [group: string]: string[];
}

export interface ResetMorphsResult extends OperationResult {
  reset_count?: number;
}

export interface MaterialInfo {
  success?: boolean;
  meshes: Record<string, string[]>;
}

export interface DiffuseColor {
  r: number;
  g: number;
  b: number;
  error?: string;
}

export interface SetDiffuseColorResult extends OperationResult {
  mesh?: string;
  material?: string;
}

export interface ShaderParameters extends OperationResult {
  mesh?: string;
  material?: string;
  shader?: string | null;
  parameters?: Record<string, number[]>;
}

export interface SetShaderParameterResult extends OperationResult {
  mesh?: string;
  material?: string;
  parameter?: string;
  values?: number[];
}

// --- Content Management (Tier 1) ---

export interface ClothingItem {
  name: string;
  id: number;
  type: string;
}

export interface HairItem {
  name: string;
  id: number;
  type: string;
}

export interface AccessoryItem {
  name: string;
  id: number;
}

export interface RemoveItemResult extends OperationResult {
  removed?: string;
}

// --- Convenience Color Shortcuts (Tier 3) ---

export interface ColorResult extends OperationResult {
  applied_to?: string[];
}

// --- FBX export ---

export interface ExportFbxOptions {
  target_tool?: "UE5" | "Default" | "Maya" | "Unity" | "Unreal";
  sub_d_level?: 0 | 1 | 2;
  include_current_pose?: boolean;
  delete_hidden_faces?: boolean;
  use_smooth_mesh?: boolean;
  remove_eyelash?: boolean;
  remove_tearline_occlusion?: boolean;
  /** "Embed Textures" — bundle textures into the FBX. */
  embed_textures?: boolean;
  /** FBX Options: true = "Mesh and Motion" (default), false = "Mesh" only. */
  export_motion?: boolean;
  /** Include Motion frame rate (e.g. 30). Maps to RLPy.RFps.Fps{n}. */
  fps?: number;
  /** Include Motion frame range [start, end]. Omit for "All". */
  motion_range?: [number, number];
  /** "Convert Image Format" (TIF -> PNG). */
  convert_image_format?: boolean;
  /** "Max Texture Size" in pixels (0 = original). */
  texture_size?: number;
  /** EExportFbxOptions3_ExportJson — the JSON sidecar CCiC Unity Tools needs. */
  export_json?: boolean;
}

export interface ExportFbxResult extends OperationResult {
  path?: string;
  flags?: number;
  flags2?: number;
  flags3?: number;
  size_bytes?: number;
  notes?: string[];
  target_tool?: string;
  /** HD Character Subdivision Level actually applied (SetExportLevel). */
  export_level?: number;
  /** Whether motion was included ("Mesh and Motion"). */
  export_motion?: boolean;
  /** Motion frame rate actually applied. */
  fps?: number;
  /** Motion frame range actually applied. */
  motion_range?: [number, number];
  /** Max texture size actually applied. */
  texture_size?: number;
  /** Whether textures were embedded. */
  embed_textures?: boolean;
  /** Whether image format conversion was applied. */
  convert_image_format?: boolean;
  /** Whether the .json sidecar exists next to the FBX (only when export_json was requested). */
  json_exists?: boolean;
}

// --- Diagnostics ---

export const DIAGNOSTIC_QUERIES = [
  "symbol_search",
  "method_list",
  "signature",
  "enum_values",
  "avatar_type",
  "facial_profile_type",
  "viseme_names",
  "expression_slider_names",
  "skin_bone_count",
  "materials_per_mesh",
  "morph_minmax",
  "content_files",
  "project_path",
] as const;

export type DiagnosticQuery = (typeof DIAGNOSTIC_QUERIES)[number];

// --- Jobs ---

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobInfo<T = unknown> {
  job_id: string;
  action: string;
  status: JobStatus;
  submitted_at: number;
  started_at?: number;
  finished_at?: number;
  result?: T;
}

