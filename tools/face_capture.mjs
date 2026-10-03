#!/usr/bin/env node
/**
 * CXRP-553 face pose library, capture step: apply each allowlisted facial clip (.iTalk) to a character and read its
 * expression weights straight from CC4 (diagnostics face_weights: RIFaceComponent.GetExpressionWeights, every 2nd
 * frame). Builds nothing; blender-pipeline tools/face_poses.py turns the samples into poses.
 *
 *   node tools/face_capture.mjs <project path> <out dir> <allowlist id> [<allowlist id> ...]
 *   node tools/face_capture.mjs D:/.../megan_eyefix_v1.ccProject D:/.../characters/megan/face/samples --all-expr
 *
 * Per clip: open the project (clean state), apply the clip at time 0, sample, write <out dir>/<clip>.json.
 * **The owner clicks "ExPlus" in CC4 for every clip.** CC4's clips were made for another facial profile and CC4 asks
 * how to map them (Traditional / ExPlus). Silent mode answers with the first button, Traditional, which loses the
 * mouth and most of the brows (Happy Hi: smile 0 instead of 0.45; 2026-10-02), so this runs interactive.
 * Clips already captured are skipped, so a run can be resumed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CC4Bridge } = await import(pathToFileURL(path.join(root, "build", "cc4-bridge.js")).href);
const { AllowlistIndex, loadAllowlist } = await import(pathToFileURL(path.join(root, "build", "allowlist.js")).href);

const [project, outDir, ...rest] = process.argv.slice(2);
if (!project || !outDir || !rest.length) {
  console.error("usage: node tools/face_capture.mjs <project path> <out dir> <allowlist id>... | --all-expr");
  process.exit(2);
}
const allowlist = new AllowlistIndex(loadAllowlist());
const ids = rest[0] === "--all-expr"
  ? loadAllowlist().items.filter((i) => i.id.startsWith("motion/expr_")).map((i) => i.id)
  : rest;
const bridge = new CC4Bridge(process.env.CC4_BRIDGE_URL);
const base = (process.env.CC4_BRIDGE_URL ?? "http://127.0.0.1:5101").replace(/\/$/, "");
fs.mkdirSync(outDir, { recursive: true });

async function post(route, body, timeoutMs) {
  const res = await fetch(`${base}${route}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${route} ${res.status}: ${JSON.stringify(json)}`);
  return json.result ?? json;
}

let failed = 0;
for (const [n, id] of ids.entries()) {
  const out = path.join(outDir, `${id.split("/")[1]}.json`);
  if (fs.existsSync(out)) {
    console.log(`skip ${id} (captured)`);
    continue;
  }
  const item = allowlist.resolve(`allowlist:${id}`, ["motion"]);
  const opened = await bridge.openProject(project);
  if (!opened.success) throw new Error(`open_project ${project}: ${opened.error}`);
  console.log(`[${n + 1}/${ids.length}] ${id}: click ExPlus in CC4 …`);
  const t0 = Date.now();
  // interactive: the mapping dialog waits for the owner (up to 15 min per clip)
  const applied = await post("/motion/apply", { file_path: item.path, interactive: true }, 15 * 60_000);
  if (!applied.success) {
    failed++;
    console.log(`FAIL ${id}: apply ${JSON.stringify(applied)}`);
    continue;
  }
  const samples = await post("/diagnostics", { query: "face_weights", arg: "2" }, 120_000);
  if (!samples.names) {
    failed++;
    console.log(`FAIL ${id}: ${JSON.stringify(samples)}`);
    continue;
  }
  const mouth = samples.names.map((nm, i) => (nm.startsWith("Mouth_") ? i : -1)).filter((i) => i >= 0);
  const peakMouth = Math.max(0, ...samples.weights.flatMap((w) => mouth.map((i) => w[i])));
  fs.writeFileSync(out, JSON.stringify({ id, source: item.path, project, captured: new Date().toISOString(),
    mapping: "ExPlus (owner click)", ...samples }));
  // a Traditional mapping (wrong click) leaves the mouth near 0; flag it so the clip can be re-captured
  const warn = peakMouth < 0.05 ? "  ← mouth near 0: Traditional clicked? delete the file and re-run" : "";
  console.log(`OK   ${id} (${((Date.now() - t0) / 1000).toFixed(0)} s, ${samples.frames.length} samples, `
    + `peak mouth ${peakMouth.toFixed(2)})${warn}`);
}
process.exitCode = failed ? 1 : 0;
