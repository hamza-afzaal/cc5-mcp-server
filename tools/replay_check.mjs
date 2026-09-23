#!/usr/bin/env node
/**
 * M1 exit check: a recipe replays identically.
 *
 *   node tools/replay_check.mjs ../cc4-recepies/recipes/sample-camila-01.json
 *
 * apply → export (A); apply again → export (B); apply A → export (C). Passes when
 * A, B and C are identical. Talks to the built MCP server over stdio.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipe = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));

const client = new Client({ name: "cc4-replay-check", version: "1.0.0" });
await client.connect(new StdioClientTransport({
  command: process.execPath, args: [path.join(root, "build", "index.js")], env: { ...process.env }, stderr: "ignore",
}));

const text = (res) => res.content.map((c) => c.text ?? "").join("\n");
async function apply(r) {
  const out = text(await client.callTool({ name: "apply_recipe", arguments: { recipe: r } }, undefined, { timeout: 600_000 }));
  if (!out.includes(": applied")) throw new Error(`apply_recipe failed:\n${out}`);
}
async function exportIt() {
  const out = text(await client.callTool({ name: "export_recipe", arguments: {} }));
  return JSON.parse(out.split("\n\nNotes:")[0]);
}
const canon = (r) => JSON.stringify({ ...r, morphs: [...r.morphs].sort((a, b) => a.display_name.localeCompare(b.display_name)) }, null, 2);

try {
  await apply(recipe);
  const a = await exportIt();
  await apply(recipe);
  const b = await exportIt();
  await apply(a);
  const c = await exportIt();
  const same = canon(a) === canon(b) && canon(a) === canon(c);
  console.log(canon(a));
  console.log(same ? "\nREPLAY CHECK: PASS (A == B == C)" : "\nREPLAY CHECK: FAIL");
  if (!same) {
    console.log("--- B\n" + canon(b));
    console.log("--- C\n" + canon(c));
    process.exitCode = 1;
  }
} finally {
  await client.close();
}
