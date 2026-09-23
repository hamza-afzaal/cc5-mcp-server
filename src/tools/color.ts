/**
 * Eye and hair color for recipes (design §6 "colors").
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { bridgeCall } from "../util.js";

export function registerColorTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "set_color",
    "Set the diffuse color of the eye or hair materials. RGB floats 0.0-1.0 (sRGB). Eyes are texture-driven, so a diffuse tint may barely change the iris; check with capture_views. Skin color is NOT set here: skin comes from an allowlisted SkinGen preset, and clinical tints are runtime physiology (spec Part C).",
    {
      target: z.enum(["eyes", "hair"]).describe("Which materials to tint"),
      rgb: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])
        .describe("[r, g, b] in 0.0-1.0"),
    },
    async ({ target, rgb }) => bridgeCall(
      () => bridge.setColor(target, rgb[0], rgb[1], rgb[2]),
      (r) => (r.success
        ? `${target} color set to [${rgb.join(", ")}] on: ${r.applied_to?.join(", ") ?? "?"}`
        : `Failed: ${r.error}`),
    ),
  );
}
