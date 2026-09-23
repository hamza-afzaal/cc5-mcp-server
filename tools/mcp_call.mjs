#!/usr/bin/env node
/**
 * Call the built CC4 MCP server's tools over stdio, like Claude Code does.
 *
 *   node tools/mcp_call.mjs list
 *   node tools/mcp_call.mjs <tool> '<json args>' [<tool> '<json args>' ...]
 *   node tools/mcp_call.mjs --file steps.json      # [{"tool": "...", "args": {...}}, ...]
 *
 * Images in results are saved to <art>/characters/_testbench/mcp_call/ and replaced by their path.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imgDir = path.join(root, "..", "characters", "_testbench", "mcp_call");

function parseSteps(argv) {
  if (argv[0] === "--file") return JSON.parse(fs.readFileSync(argv[1], "utf-8"));
  const steps = [];
  for (let i = 0; i < argv.length; i += 2) steps.push({ tool: argv[i], args: argv[i + 1] ? JSON.parse(argv[i + 1]) : {} });
  return steps;
}

const client = new Client({ name: "cc4-mcp-call", version: "1.0.0" });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "build", "index.js")],
  env: { ...process.env },
  stderr: process.env.MCP_CALL_STDERR ? "inherit" : "ignore",
}));

try {
  const argv = process.argv.slice(2);
  if (argv[0] === "list") {
    const { tools } = await client.listTools();
    console.log(`${tools.length} tools:\n${tools.map((t) => `- ${t.name}`).join("\n")}`);
  } else {
    let n = 0;
    for (const step of parseSteps(argv)) {
      const t0 = Date.now();
      const res = await client.callTool({ name: step.tool, arguments: step.args ?? {} }, undefined, { timeout: 600_000 });
      console.log(`\n=== ${step.tool} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      for (const c of res.content) {
        if (c.type === "image") {
          fs.mkdirSync(imgDir, { recursive: true });
          const f = path.join(imgDir, `img_${Date.now()}_${n++}.png`);
          fs.writeFileSync(f, Buffer.from(c.data, "base64"));
          console.log(`[image saved: ${f}]`);
        } else {
          console.log(c.text);
        }
      }
      const out = res.content.map((c) => c.text ?? "").join("\n");
      if (!step.optional && /^(Recipe not applied|Refused|Failed|CC4 bridge error)|: FAILED/m.test(out)) {
        console.error(`\nStopping: step '${step.tool}' failed (mark it "optional": true to continue).`);
        process.exitCode = 1;
        break;
      }
      if (step.wait_job) {
        const id = /job_\d+/.exec(res.content.map((c) => c.text ?? "").join(" "))?.[0];
        for (;;) {
          const st = await client.callTool({ name: "get_export_status", arguments: { job_id: id } });
          const text = st.content[0].text;
          if (!/: (queued|running)/.test(text.split("\n")[0])) { console.log(`--- ${text}`); break; }
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
} finally {
  await client.close();
}
