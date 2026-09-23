/**
 * Scene and avatar management tools for CC4.
 */

import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import type { AvatarInfo } from "../types.js";
import { bridgeCall } from "../util.js";

function validateCapturePath(filePath: string): string | null {
  if (filePath.includes("..")) {
    return "Path traversal ('..') is not allowed";
  }
  const normalized = path.resolve(filePath);
  if (!normalized.toLowerCase().endsWith(".png")) {
    return "Output path must end with .png";
  }
  return null;
}

export function formatAvatarInfo(info: AvatarInfo | null): string {
  if (!info) return "No avatar in the scene.";
  const lines = [`Avatar: ${info.name} (ID: ${info.id})`];
  if (info.avatar_type !== undefined) lines.push(`Type: ${info.avatar_type}, generation: ${info.generation ?? "?"}`);
  if (info.facial_profile !== undefined) lines.push(`Facial profile: ${info.facial_profile ?? "none"}`);
  if (info.skin_bone_count !== undefined) lines.push(`Skin bones: ${info.skin_bone_count}`);
  if (info.subdiv_level !== undefined) lines.push(`Subdivision level: ${info.subdiv_level}`);
  if (info.materials) {
    lines.push(`Materials: ${info.materials.total}`);
    for (const [mesh, count] of Object.entries(info.materials.per_mesh)) {
      lines.push(`  ${mesh}: ${count}`);
    }
  }
  if (info.items) {
    lines.push(`Clothes: ${info.items.clothes.join(", ") || "none"}`);
    lines.push(`Hair: ${info.items.hair.join(", ") || "none"}`);
    lines.push(`Accessories: ${info.items.accessories.join(", ") || "none"}`);
  }
  const morphs = info.active_morphs ?? [];
  lines.push(`Active morphs (${morphs.length}):`);
  for (const m of morphs) {
    lines.push(`  ${m.display_name} [${m.category}] = ${m.value}  (id: ${m.id})`);
  }
  if (info.errors && Object.keys(info.errors).length > 0) {
    lines.push("Fields that could not be read:");
    for (const [field, err] of Object.entries(info.errors)) {
      lines.push(`  ${field}: ${err}`);
    }
  }
  return lines.join("\n");
}

export function registerSceneTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "list_avatars",
    "List all avatars (characters) currently in the CC4 scene.",
    {},
    async () => bridgeCall(
      () => bridge.getAvatars(),
      (avatars) => avatars.length > 0
        ? `Found ${avatars.length} avatar(s):\n${avatars.map(a => `- ${a.name} (ID: ${a.id})`).join("\n")}`
        : "No avatars in the current scene.",
    )
  );

  server.tool(
    "get_avatar_info",
    "Get detailed information about the current avatar: type/generation, facial profile, skin bone count, material counts per mesh, clothes/hair/accessories, and all non-zero shaping morphs by display name.",
    {},
    async () => bridgeCall(
      () => bridge.getAvatarInfo(),
      formatAvatarInfo,
    )
  );

  server.tool(
    "check_connection",
    "Check that Character Creator 4 is running and the bridge plugin is answering.",
    {},
    async () => {
      const health = await bridge.getHealth();
      const text = health
        ? `CC4 bridge is connected (${health.service} v${health.version}, Python ${health.python}, dev mode ${health.dev_mode ? "on" : "off"}, queue depth ${health.queue_depth}).`
        : "CC4 bridge is NOT responding. Make sure Character Creator 4 is running with the CC4 MCP Bridge plugin loaded.";
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "create_avatar",
    "Create a new NEUTRAL base avatar in the CC4 scene (additive). WARNING: this base has no skin/eye textures, eyebrows, eyelashes or hair — it renders like a pale, blank-eyed mannequin. For a real, textured human, load a character template (e.g. Camila) with load_asset. Use delete_avatar first to replace the current avatar.",
    {},
    async () => bridgeCall(
      () => bridge.createDefaultAvatar(),
      (result) => result.success
        ? `Created neutral avatar '${result.name ?? "Unknown"}' (untextured — see description for a textured base)`
        : `Failed: ${result.error}`,
    )
  );

  server.tool(
    "delete_avatar",
    "Delete an avatar from the scene by name, or ALL avatars if name is omitted. Useful to clear the scene before loading a character template.",
    {
      name: z.string().max(256).optional().describe("Avatar name to delete (from list_avatars). Omit to delete all avatars."),
    },
    async ({ name }) => bridgeCall(
      () => bridge.deleteAvatar(name ?? ""),
      (result) => result.success
        ? `Deleted avatar(s): ${(result.removed ?? []).join(", ")}`
        : `Failed: ${result.error}`,
    )
  );

  server.tool(
    "capture_viewport",
    "Render the CC4 viewport to a PNG (RenderImage) and return the image. Use frame_camera first to choose the view.",
    {
      output_path: z.string().optional().describe("Output PNG file path. Defaults to a temp file if omitted."),
      width: z.number().int().min(16).max(7680).optional().describe("Image width in px (default 1280)."),
      height: z.number().int().min(16).max(4320).optional().describe("Image height in px (default 720)."),
    },
    async ({ output_path, width, height }) => {
      if (output_path) {
        const pathError = validateCapturePath(output_path);
        if (pathError) {
          return { content: [{ type: "text" as const, text: pathError }] };
        }
      }
      try {
        const result = await bridge.captureViewport(output_path, width, height);
        if (!result.success) {
          return { content: [{ type: "text" as const, text: `Failed: ${result.error}` }] };
        }
        const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];
        if (result.base64) {
          content.push({ type: "image" as const, data: result.base64, mimeType: "image/png" });
          content.push({ type: "text" as const, text: `Viewport captured: ${result.path ?? "temp file"}` });
        } else {
          content.push({
            type: "text" as const,
            text: `Viewport rendered to ${result.path ?? "?"} but not embedded${result.warning ? `: ${result.warning}` : "."}`,
          });
        }
        return { content };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `CC4 bridge error: ${message}` }] };
      }
    }
  );
}
