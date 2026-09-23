/**
 * Read-only CC4 introspection. Replaces the old exec_python tool: the bridge
 * only answers a fixed allowlist of queries and never runs caller code.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { DIAGNOSTIC_QUERIES } from "../types.js";
import { bridgeCall } from "../util.js";

export function registerDiagnosticsTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "diagnostics",
    "Read-only CC4 introspection from a fixed allowlist. Queries: " +
      "symbol_search(arg=substring of an RLPy name), method_list(arg=RLPy class name, or one of avatar/shaping/facial_profile/face/viseme/skeleton/material/morph/physics), " +
      "signature(arg='Class.Method' — returns the SWIG docstring with the C++ signature), enum_values(arg=enum prefix like 'EExportFbxOptions3_'), " +
      "avatar_type, facial_profile_type, viseme_names, expression_slider_names, skin_bone_count, materials_per_mesh, " +
      "morph_minmax(arg=morph ID), content_files(arg=folder type, e.g. cloth_upper/hair/character/skin), project_path.",
    {
      query: z.enum(DIAGNOSTIC_QUERIES).describe("Which allowlisted query to run"),
      arg: z.string().max(256).optional().describe("Query argument, where the query takes one"),
    },
    async ({ query, arg }) => bridgeCall(
      () => bridge.diagnostics(query, arg),
      (result) => JSON.stringify(result, null, 2),
    )
  );
}
