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

  server.tool(
    "fix_eye_element",
    "Run CC4's Fix Eye Element: refit the eyelid/eye elements to the current head shape. Use after shaping sliders that move the eyelids (the Human Anatomy 'Body/Head HA' sliders otherwise leave a dark crescent above the upper lids). One undo step, no dialog. apply_recipe runs it automatically after the morphs.",
    {},
    async () => bridgeCall(
      () => bridge.fixEyeElement(),
      (r) => r.success ? `Fix Eye Element applied to ${r.avatar ?? "the avatar"}.` : `Fix Eye Element failed: ${r.error}`,
    )
  );

  server.tool(
    "set_face_pose",
    "Key an expression pose on the avatar's face at time 0, e.g. a pose from the face pose library (CXRP-553), then capture_views renders it. Weights by expression slider name (diagnostics expression_slider_names), 0..1 (CC4 allows -1.5..1.5). With clear (default) every other expression is set to 0, so the pose replaces what the face showed. Reads the weights back. Reopen the project to remove it.",
    {
      weights: z.record(z.string().regex(/^[A-Za-z0-9_]{1,64}$/), z.number().min(-1.5).max(1.5)).describe("{expression name: weight}"),
      clear: z.boolean().optional().describe("Zero every other expression (default true)"),
    },
    async ({ weights, clear }) => {
      if (!Object.keys(weights).length) return { content: [{ type: "text" as const, text: "weights is empty" }] };
      return bridgeCall(
        () => bridge.setFacePose(weights, clear ?? true),
        (r) => r.success
          ? `Face pose keyed (${r.keyed} expressions; read-back max error ${r.max_error}).`
          : `Face pose failed: ${r.error ?? `read-back max error ${r.max_error}`}`,
      );
    }
  );
}
