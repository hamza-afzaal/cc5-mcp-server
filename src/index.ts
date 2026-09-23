#!/usr/bin/env node

/**
 * CC4 MCP Server - Entry Point
 *
 * MCP Server for Reallusion Character Creator 4 (fork of mackatwentytsuru/cc5-mcp-server).
 * Enables AI-powered character creation via natural language.
 *
 * Architecture:
 *   LLM <-> MCP Server (this) <-> HTTP <-> CC4 Plugin (http.server) <-> RLPy API <-> CC4
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CC4Bridge } from "./cc4-bridge.js";
import { registerMorphTools } from "./tools/morph.js";
import { registerSceneTools } from "./tools/scene.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerEditTools } from "./tools/edit.js";
import { registerCameraTools } from "./tools/camera.js";
import { registerLightTools } from "./tools/light.js";
import { registerExpressionTools } from "./tools/expression.js";
import { registerMaterialTools } from "./tools/material.js";
import { registerContentTools } from "./tools/content.js";
import { registerColorTools } from "./tools/color.js";
import { registerDiagnosticsTools } from "./tools/diagnostics.js";
import { registerMorphResources } from "./resources/morphs.js";

async function main() {
  const server = new McpServer({
    name: "cc4-mcp-server",
    version: "2.0.0",
  });

  // Bridge to CC4's Python plugin HTTP server
  const bridge = new CC4Bridge(process.env.CC4_BRIDGE_URL);

  // Register all tools
  registerMorphTools(server, bridge);
  registerSceneTools(server, bridge);
  registerPipelineTools(server, bridge);
  registerEditTools(server, bridge);
  registerCameraTools(server, bridge);
  registerLightTools(server, bridge);
  registerExpressionTools(server, bridge);
  registerMaterialTools(server, bridge);
  registerContentTools(server, bridge);
  registerColorTools(server, bridge);
  registerDiagnosticsTools(server, bridge);

  // Register resources
  registerMorphResources(server, bridge);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[CC4 MCP] Server started on stdio transport");
}

main().catch((error) => {
  console.error("[CC4 MCP] Fatal error:", error);
  process.exit(1);
});
