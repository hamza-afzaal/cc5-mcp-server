/**
 * Shared mock factory for CC4Bridge.
 * Returns a vi.fn()-backed partial mock that satisfies the CC4Bridge interface.
 */

import { vi } from "vitest";
import type { CC4Bridge } from "../../src/cc4-bridge.js";
import type {
  CC4Avatar,
  AvatarInfo,
  MorphCatalog,
  OperationResult,
  CreateAvatarResult,
  DeleteAvatarResult,
  CaptureResult,
  CameraInfo,
  FocalLengthResult,
  LightInfo,
  LightColorResult,
  LightDetailInfo,
  LightMultiplierResult,
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
} from "../../src/types.js";

export type MockBridge = {
  [K in keyof CC4Bridge]: ReturnType<typeof vi.fn>;
};

export function createMockBridge(): MockBridge {
  return {
    healthCheck: vi.fn<[], Promise<boolean>>(),
    getHealth: vi.fn(),
    diagnostics: vi.fn(),
    startJob: vi.fn(),
    getJobStatus: vi.fn(),
    getMorphStatus: vi.fn(),
    getWorkspace: vi.fn(),
    setCharacter: vi.fn(),
    searchMorphs: vi.fn(),
    setMorphs: vi.fn(),
    listItems: vi.fn(),
    loadItem: vi.fn(),
    removeItem: vi.fn(),
    setColor: vi.fn(),
    saveProjectAs: vi.fn(),
    checkExportLicense: vi.fn(),
    captureViews: vi.fn(),
    startExportFbx: vi.fn(),
    startConvertLod: vi.fn(),
    startMergeMaterials: vi.fn(),
    browseContent: vi.fn(),
    getAvatars: vi.fn<[], Promise<CC4Avatar[]>>(),
    getAvatarInfo: vi.fn<[], Promise<AvatarInfo | null>>(),
    getMorphCatalog: vi.fn<[], Promise<MorphCatalog>>(),
    createDefaultAvatar: vi.fn<[], Promise<CreateAvatarResult>>(),
    deleteAvatar: vi.fn<[string], Promise<DeleteAvatarResult>>(),
    undo: vi.fn<[], Promise<OperationResult>>(),
    redo: vi.fn<[], Promise<OperationResult>>(),
    getCameraInfo: vi.fn<[], Promise<CameraInfo>>(),
    setCameraFocalLength: vi.fn<[number], Promise<FocalLengthResult>>(),
    frameCamera: vi.fn<[string], Promise<{ success: boolean; view?: string; camera?: string; error?: string }>>(),
    getLights: vi.fn<[], Promise<LightInfo[]>>(),
    setLightColor: vi.fn<[string, number, number, number], Promise<LightColorResult>>(),
    getLightInfo: vi.fn<[string], Promise<LightDetailInfo>>(),
    setLightMultiplier: vi.fn<[string, number], Promise<LightMultiplierResult>>(),
    setLightActive: vi.fn<[string, boolean], Promise<{ success: boolean; light?: string; active?: boolean; error?: string }>>(),
    setLightShadow: vi.fn<[string, boolean | null, number | null], Promise<{ success: boolean; light?: string; cast_shadow?: boolean; darken_shadow_strength?: number; error?: string }>>(),
    getVisualSettings: vi.fn<[], Promise<VisualSettings>>(),
    setAmbient: vi.fn<[number, number, number], Promise<SetAmbientResult>>(),
    setIbl: vi.fn<[string, boolean], Promise<SetIblResult>>(),
    getExpressionInfo: vi.fn<[], Promise<ExpressionInfo>>(),
    getMaterialInfo: vi.fn<[string?], Promise<MaterialInfo>>(),
    getDiffuseColor: vi.fn<[string, string], Promise<DiffuseColor>>(),
    setDiffuseColor: vi.fn<[string, string, number, number, number], Promise<SetDiffuseColorResult>>(),
    getShaderParameters: vi.fn<[string, string], Promise<ShaderParameters>>(),
    setShaderParameter: vi.fn<[string, string, string, number[]], Promise<SetShaderParameterResult>>(),
  };
}

export const SUCCESS: OperationResult = { success: true };
export const FAILURE: OperationResult = { success: false, error: "operation failed" };
export const CREATE_SUCCESS: CreateAvatarResult = { success: true, name: "Default Character" };
export const CAPTURE_SUCCESS: CaptureResult = { success: true, path: "C:/temp/capture.png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
