/**
 * Convenience color shortcut tools for CC4.
 * Provides easy-to-use tools for setting eye and hair colors
 * without needing to know specific mesh/material names.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { bridgeCall } from "../util.js";

export function registerColorTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "set_eye_color",
    "Set the diffuse color of the eye materials. RGB floats 0.0-1.0. NOTE: CC eyes are PBR/texture-driven (the iris is a texture, with a reflective cornea on top), so a diffuse color may NOT visibly change the iris color on the standard base — verify with frame_camera('face') + capture_viewport. For a real iris-color change, swap the iris texture or use CC4's eye/SkinGen tools.",
    {
      r: z.number().min(0).max(1).describe("Red component (0.0-1.0)"),
      g: z.number().min(0).max(1).describe("Green component (0.0-1.0)"),
      b: z.number().min(0).max(1).describe("Blue component (0.0-1.0)"),
    },
    async ({ r, g, b }) => bridgeCall(
      () => bridge.setEyeColor(r, g, b),
      (result) => result.success
        ? `Eye color set to RGB(${r}, ${g}, ${b}). Applied to: ${result.applied_to?.join(", ") ?? "eye materials"}`
        : `Failed: ${result.error}`,
    )
  );

  server.tool(
    "set_hair_color",
    "Set the hair color of the current avatar. RGB values are floats 0.0-1.0. This is a convenience shortcut that automatically finds all hair materials.",
    {
      r: z.number().min(0).max(1).describe("Red component (0.0-1.0)"),
      g: z.number().min(0).max(1).describe("Green component (0.0-1.0)"),
      b: z.number().min(0).max(1).describe("Blue component (0.0-1.0)"),
    },
    async ({ r, g, b }) => bridgeCall(
      () => bridge.setHairColor(r, g, b),
      (result) => result.success
        ? `Hair color set to RGB(${r}, ${g}, ${b}). Applied to: ${result.applied_to?.join(", ") ?? "hair materials"}`
        : `Failed: ${result.error}`,
    )
  );

}
