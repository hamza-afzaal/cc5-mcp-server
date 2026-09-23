/**
 * Shaping morph tools for CC4: search by display name, set in one undoable batch.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import type { SetMorphsResult } from "../types.js";
import { bridgeCall } from "../util.js";

export const MorphValueSchema = z.object({
  display_name: z.string().min(1).max(256).optional().describe("Slider display name as shown in CC4, e.g. 'Nose Width'"),
  id: z.string().min(1).max(256).optional().describe("Internal morph ID (from search_morphs) when the display name is ambiguous"),
  category: z.string().max(256).optional().describe("Category prefix to disambiguate a display name, e.g. 'Actor'"),
  value: z.number().describe("Slider value; clamped to [-1, 1]"),
}).refine((m) => m.display_name || m.id, { message: "each morph needs display_name or id" });

export function formatSetMorphs(result: SetMorphsResult): string {
  if (!result.success) {
    const problems = (result.problems ?? []).map((p) => `  - ${JSON.stringify(p)}`).join("\n");
    return `Nothing applied: ${result.error}${problems ? `\n${problems}` : ""}`;
  }
  const lines = (result.applied ?? []).map((m) =>
    `  ${m.display_name} = ${Math.round(m.value * 1e4) / 1e4}${m.warning ? `  (${m.warning})` : ""}`);
  return `Applied ${lines.length} morph(s) as one undo step:\n${lines.join("\n")}`;
}

export function registerMorphTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "search_morphs",
    "Search CC4 shaping morphs by display name (then internal ID). Exact matches rank first. Returns id, display_name, category and CC4's reported min/max. The min/max is only the UI default range: CC4 accepts values outside it.",
    {
      query: z.string().min(1).max(256).describe("Words from the slider name, e.g. 'nose width', 'body thin', 'jaw'"),
      category: z.string().max(256).optional().describe("Optional category prefix, e.g. 'Actor' or 'Actor/Body'"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default 25)"),
    },
    async ({ query, category, limit }) => bridgeCall(
      () => bridge.searchMorphs(query, category, limit),
      (r) => r.results.length === 0
        ? `No morphs match '${query}'.`
        : `${r.results.length} of ${r.total_matches} match(es):\n` + r.results
          .map((m) => `- ${m.display_name} [${m.category}] range ${m.min}..${m.max}  (id: ${m.id})`).join("\n"),
    )
  );

  server.tool(
    "set_morphs",
    "Set several shaping morphs at once, by display name (preferred) or id, as ONE undoable action. Every entry is resolved first: an unknown or ambiguous name fails the whole call and nothing is applied. Values are clamped to [-1, 1]; values outside CC4's reported UI range are applied with a warning.",
    {
      morphs: z.array(MorphValueSchema).min(1).max(500).describe("Morph values to set"),
    },
    async ({ morphs }) => bridgeCall(() => bridge.setMorphs(morphs), formatSetMorphs)
  );
}
