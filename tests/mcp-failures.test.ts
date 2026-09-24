/**
 * tools/mcp_call.mjs stops a scripted run on these failure shapes (PR #2 review).
 * The strings are what the real tools print.
 */

import { describe, it, expect } from "vitest";
// @ts-expect-error plain .mjs helper without type declarations
import { failed } from "../tools/mcp_failures.mjs";
import { formatApplyReport, formatJob } from "../src/tools/pipeline.js";

describe("mcp_call failure detection", () => {
  it.each([
    ["recipe refused", "Recipe not applied: Recipe 'x' has 1 unresolved reference(s)"],
    ["recipe failed mid-way", formatApplyReport({ recipe_id: "x", ok: false, steps: [{ step: "morphs", ok: false }], warnings: [] })],
    ["refusal", "Refused: Path is not in the allowlist: C:/x.ccCloth"],
    ["tool failure", "Failed: Refusing to write outside the workspace"],
    ["bridge error", "CC4 bridge error: CC4 bridge error (400): Unknown query"],
    ["no views", "No views rendered: Need an avatar and a camera"],
    ["one view failed", "full: failed: No camera\nhead: D:/r/head.png"],
    ["polled job failed", formatJob({ job_id: "job_4", action: "export_fbx", status: "failed", submitted_at: 1, result: { success: false, error: "No avatar in scene" } })],
    ["motion clip failed", "✓ motion/a → D:/e/a.fbx\n✗ motion/b: failed Motion file not found"],
  ])("flags %s", (_label, text) => {
    expect(failed(text)).toBe(true);
  });

  it.each([
    ["applied recipe", formatApplyReport({ recipe_id: "x", ok: true, steps: [{ step: "load_base", ok: true }], warnings: [] })],
    ["finished export with a budget FAIL", "Job job_1 (export_fbx): done in 5.0 s\nBudget LOD0 (design §4): FAIL\n  ✗ material_slots (≈ draw calls): 19 / 8"],
    ["running job", "Job job_2 (convert_lod): running"],
    ["rendered views", "full: D:/r/full.png\nthree_quarter: D:/r/tq.png"],
  ])("does not flag %s", (_label, text) => {
    expect(failed(text)).toBe(false);
  });
});
