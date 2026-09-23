/**
 * Asset loading and export tools for CC4.
 */

import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { bridgeCall } from "../util.js";

const ALLOWED_ASSET_EXTENSIONS = new Set([
  ".iavatar", ".ccavatar", ".ccproject", ".ccm",
  ".iclothes", ".ihair", ".iprop", ".ccfbx",
  ".iclothing", ".ishoe", ".iaccessory", ".ibody", ".iskin",
]);

function validateAssetPath(filePath: string): string | null {
  if (filePath.includes("..")) {
    return "Path traversal ('..') is not allowed";
  }
  const normalized = path.resolve(filePath);
  const ext = path.extname(normalized).toLowerCase();
  // Accept the explicit list OR any CC / iClone content family (.cc*/.i*) —
  // browse_content returns .cc* content files (e.g. .ccCloth) that load_asset accepts.
  if (!ALLOWED_ASSET_EXTENSIONS.has(ext) && !ext.startsWith(".cc") && !ext.startsWith(".i")) {
    return `Disallowed file extension: ${ext}`;
  }
  return null;
}

function validateExportPath(filePath: string): string | null {
  if (filePath.includes("..")) {
    return "Path traversal ('..') is not allowed";
  }
  const normalized = path.resolve(filePath);
  const ext = path.extname(normalized).toLowerCase();
  if (ext !== ".fbx") {
    return `Export path must end with .fbx, got: ${ext}`;
  }
  return null;
}

export function registerAssetTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "load_asset",
    "Load a CC4 asset file into the scene: characters (.ccAvatar/.ccProject/.iAvatar), clothing, hair, accessories and other CC/iClone content (.cc*/.i*).",
    {
      file_path: z.string().describe("Absolute path to the CC4 asset file (e.g., 'C:/Assets/MyChar.iAvatar')"),
    },
    async ({ file_path }) => {
      const pathError = validateAssetPath(file_path);
      if (pathError) {
        return { content: [{ type: "text" as const, text: pathError }] };
      }
      return bridgeCall(
        () => bridge.loadAsset(file_path),
        (result) => result.success ? `Asset loaded: ${file_path}` : `Failed to load asset: ${result.error}`,
      );
    }
  );

  server.tool(
    "export_fbx",
    "Export the current avatar as an FBX file, mirroring the CC4 'Export FBX' dialog (target tool preset, mesh+motion, subdivision, texture size, JSON sidecar). A bare filename (no directory) exports into %USERPROFILE%\\CC4Export (override via the CC4_EXPORT_DIR env var on the CC4 side). Unity/CCiC call: target_tool='Unity', export_json=true, sub_d_level=0, delete_hidden_faces=true, remove_tearline_occlusion=true.",
    {
      output_path: z.string().describe("Path for the exported FBX file. A bare filename (e.g. 'character.fbx') exports into %USERPROFILE%\\CC4Export; an absolute path is used as-is."),
      target_tool: z.enum(["UE5", "Default", "Maya", "Unity", "Unreal"]).optional()
        .describe("Target Tool Preset. 'UE5'/'Unreal' applies Unreal-friendly flags (Y-up, UE bone axis)."),
      sub_d_level: z.number().int().min(0).max(2).optional()
        .describe("HD Character Subdivision Level (0/1/2). Applied via SetExportLevel (no scene mutation). Higher = smoother mesh."),
      include_current_pose: z.boolean().optional()
        .describe("If true, keep current pose (do NOT force T-pose on motion first frame)."),
      delete_hidden_faces: z.boolean().optional()
        .describe("If true, removes hidden mesh faces from the exported FBX (EExportFbxOptions_RemoveHiddenMesh)."),
      use_smooth_mesh: z.boolean().optional()
        .describe("If true, uses CC4's 'Use Smooth Mesh' option (RExportFbxSetting.EnableBakeSubdivision)."),
      remove_eyelash: z.boolean().optional()
        .describe("If true, removes eyelash mesh (EExportFbxOptions_RemoveEyelash)."),
      remove_tearline_occlusion: z.boolean().optional()
        .describe("If true, removes tear line + eye occlusion meshes (EExportFbxOptions_RemoveTearLineAndOcclusion). Recommended for Quest budgets (design §4)."),
      embed_textures: z.boolean().optional()
        .describe("Texture Settings 'Embed Textures': bundle textures into the FBX."),
      export_motion: z.boolean().optional()
        .describe("FBX Options: true = 'Mesh and Motion' (default), false = 'Mesh' (mesh only)."),
      fps: z.number().int().positive().optional()
        .describe("Include Motion 'Frame Rate' (e.g. 30). Maps to RLPy.RFps.Fps{n}; unsupported values are skipped with a note."),
      motion_range: z.tuple([z.number().int(), z.number().int()]).optional()
        .describe("Include Motion frame range [start, end]. Omit for 'All' (the dialog default)."),
      convert_image_format: z.boolean().optional()
        .describe("Texture Settings 'Convert Image Format' (TIF -> PNG)."),
      texture_size: z.union([z.literal(0), z.literal(256), z.literal(512), z.literal(1024), z.literal(2048), z.literal(4096)]).optional()
        .describe("Texture Settings 'Max Texture Size' in pixels: 256/512/1024/2048/4096, or 0 = original."),
      export_json: z.boolean().optional()
        .describe("Write the .json material sidecar next to the FBX (EExportFbxOptions3_ExportJson). Required by CCiC Unity Tools."),
      options: z.number().int().optional()
        .describe("Raw EExportFbxOptions bitmask (advanced; usually leave 0)."),
    },
    async (args) => {
      const { output_path, options, ...extra } = args;
      const pathError = validateExportPath(output_path);
      if (pathError) {
        return { content: [{ type: "text" as const, text: pathError }] };
      }
      return bridgeCall(
        () => bridge.exportFbx(output_path, options ?? 0, extra as import("../types.js").ExportFbxOptions),
        (result) => {
          if (!result.success) return `Export failed: ${result.error}${result.notes ? `\nNotes: ${result.notes.join("; ")}` : ""}`;
          const notes = result.notes && result.notes.length ? `\nNotes: ${result.notes.join("; ")}` : "";
          const json = result.json_exists === undefined ? "" : `, json sidecar: ${result.json_exists ? "yes" : "MISSING"}`;
          return `FBX exported to: ${result.path ?? output_path} (target=${result.target_tool ?? "default"}${json})${notes}`;
        },
      );
    }
  );
}
