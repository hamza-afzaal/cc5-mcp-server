/**
 * Undo/Redo tools for CC4.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { bridgeCall } from "../util.js";

export function registerEditTools(server: McpServer, bridge: CC4Bridge) {
  server.tool(
    "undo",
    "Undo the last action in CC4. Use this to revert the most recent change.",
    {},
    async () => bridgeCall(
      () => bridge.undo(),
      (result) => result.success ? "Undo successful" : `Undo failed: ${result.error}`,
    )
  );

  server.tool(
    "redo",
    "Redo the last undone action in CC4. Use this to reapply a previously undone change.",
    {},
    async () => bridgeCall(
      () => bridge.redo(),
      (result) => result.success ? "Redo successful" : `Redo failed: ${result.error}`,
    )
  );
}
