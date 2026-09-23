/**
 * Pipeline tools (design §5 S1–S3, §11): recipes, save-as, LOD conversion,
 * material merge, review renders, export jobs, license check, motion export.
 */

import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { applyRecipe, exportRecipe, RecipeSchema, type ApplyReport } from "../recipe.js";
import { checkBudget, fbxStatsFromFile, LOD_BUDGETS, type LodLabel } from "../fbx-stats.js";
import type { ExportFbxOptions, ExportFbxResult, JobInfo } from "../types.js";
import { bridgeCall } from "../util.js";
import { defaultAllowlistProvider, type AllowlistProvider } from "./content.js";

type ToolText = { content: Array<{ type: "text"; text: string }> };
const text = (t: string): ToolText => ({ content: [{ type: "text" as const, text: t }] });

/** Exports started in this session: job id -> label, so status can check the right budget. */
const exportJobs = new Map<string, { lod?: LodLabel; kind: "export" | "convert" | "merge" }>();

export function formatApplyReport(r: ApplyReport): string {
  const lines = [`Recipe ${r.recipe_id}: ${r.ok ? "applied" : "FAILED"}`];
  for (const s of r.steps) lines.push(`  ${s.ok ? "✓" : "✗"} ${s.step}${s.detail !== undefined ? `: ${JSON.stringify(s.detail)}` : ""}`);
  if (r.warnings.length) lines.push("Warnings:", ...r.warnings.map((w) => `  - ${w}`));
  return lines.join("\n");
}

/** Put the LOD label into the file name unless it is already there. */
export function labelledPath(outputPath: string, lod?: string): string {
  if (!lod) return outputPath;
  const parsed = path.parse(outputPath);
  if (parsed.name.toUpperCase().endsWith(`_${lod.toUpperCase()}`)) return outputPath;
  const name = `${parsed.name}_${lod}${parsed.ext || ".fbx"}`;
  return parsed.dir ? path.join(parsed.dir, name) : name;
}

export function formatJob(job: JobInfo, lod?: LodLabel): string {
  const secs = job.finished_at && job.started_at ? ` in ${(job.finished_at - job.started_at).toFixed(1)} s` : "";
  const lines = [`Job ${job.job_id} (${job.action}): ${job.status}${secs}`];
  if (job.status === "queued" || job.status === "running") {
    if (job.action === "convert_lod") lines.push("CC4 shows two confirmation dialogs for conversions: click OK in CC4, then poll again.");
    return lines.join("\n");
  }
  const result = (job.result ?? {}) as Record<string, unknown>;
  if (job.status === "failed") {
    lines.push(`Error: ${String(result.error ?? "unknown")}`);
    return lines.join("\n");
  }
  if (job.action === "export_fbx") {
    const r = result as unknown as ExportFbxResult;
    lines.push(`File: ${r.path}${r.json_exists === undefined ? "" : `  (json sidecar: ${r.json_exists ? "yes" : "MISSING"})`}`);
    if (r.path) {
      try {
        const s = fbxStatsFromFile(r.path);
        lines.push(`FBX: ${s.meshes} meshes, ${s.triangles} tris, ${s.material_slots} material slots, ${s.unique_materials} unique materials, ${s.bones} bones, ${s.blendshapes} blendshapes, ${s.textures} textures`);
        for (const m of s.per_mesh) lines.push(`  ${m.mesh}: ${m.triangles} tris, ${m.materials.length} mats, ${m.blendshapes} shapes`);
        if (lod) {
          const b = checkBudget(s, lod);
          lines.push(`Budget ${lod} (design §4): ${b.pass ? "PASS" : "FAIL"}`);
          for (const c of b.checks) lines.push(`  ${c.pass ? "✓" : "✗"} ${c.metric}: ${c.value} / ${c.limit}`);
        }
      } catch (e) {
        lines.push(`(Could not read FBX stats: ${(e as Error).message})`);
      }
    }
  } else {
    lines.push(JSON.stringify(result, null, 2));
  }
  return lines.join("\n");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForJob(bridge: CC4Bridge, jobId: string, timeoutMs: number, pollMs = 1000): Promise<JobInfo> {
  const start = Date.now();
  for (;;) {
    const job = await bridge.getJobStatus(jobId);
    if (job.status === "done" || job.status === "failed") return job;
    if (Date.now() - start > timeoutMs) return job;
    await sleep(pollMs);
  }
}

export function registerPipelineTools(
  server: McpServer,
  bridge: CC4Bridge,
  getAllowlist: AllowlistProvider = defaultAllowlistProvider,
) {
  server.tool(
    "apply_recipe",
    "Replay a character recipe (design §6) into CC4: clear the scene, load the base, set morphs by display name, load skin/hair/clothes/accessories, set eye/hair colors. Every 'allowlist:' reference is resolved first; an unknown, non-exportable or wrong-type item fails before CC4 is touched.",
    { recipe: RecipeSchema.describe("Recipe object, recipe_version '0.1'") },
    async ({ recipe }) => {
      try {
        return text(formatApplyReport(await applyRecipe(bridge, getAllowlist(), recipe)));
      } catch (e) {
        return text(`Recipe not applied: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "export_recipe",
    "Read the current CC4 character back as a recipe: base, active morphs by display name, and allowlisted clothes/hair/accessories. Fields CC4 can't report (colors, MST, clinical presentation) come from the last recipe applied in this session.",
    {},
    async () => bridgeCall(() => exportRecipe(bridge, getAllowlist()), (r) => {
      const notes = r.notes.length ? `\n\nNotes:\n${r.notes.map((n) => `- ${n}`).join("\n")}` : "";
      return `${JSON.stringify(r.recipe, null, 2)}${notes}`;
    }),
  );

  server.tool(
    "save_project_as",
    "Save the current project as a NEW .ccProject; the copy becomes the current project. Required before convert_lod or merge_materials (design D6). A bare name goes to %USERPROFILE%\\CC4Export\\projects. Never overwrites.",
    { path: z.string().min(1).max(1024).describe("File name or absolute path, e.g. 'patient-older-m-01_lod0'") },
    async ({ path: p }) => bridgeCall(() => bridge.saveProjectAs(p),
      (r) => (r.success ? `Saved ${r.path} (${Math.round((r.size_bytes ?? 0) / 1e6)} MB). Current project is now the copy: ${r.is_current}.` : `Failed: ${r.error}`)),
  );

  server.tool(
    "convert_lod",
    "IRREVERSIBLE: convert the avatar to ActorBUILD (hero LOD0), LOD1 or LOD2 on the saved copy. Refused unless the current project came from save_project_as in this CC4 session and the avatar is not already converted. Starts a job: CC4 shows TWO confirmation dialogs that a person must click OK on. Poll with get_export_status.",
    { level: z.enum(["actorbuild", "lod1", "lod2"]).describe("actorbuild = hero LOD0 (keeps facial blendshapes); lod1/lod2 = remeshed single-material LODs") },
    async ({ level }) => bridgeCall(() => bridge.startConvertLod(level), (j) => {
      exportJobs.set(j.job_id, { kind: "convert" });
      return `Started ${level} conversion as ${j.job_id}. Click OK on the two CC4 dialogs, then call get_export_status("${j.job_id}").`;
    }),
  );

  server.tool(
    "merge_materials",
    "Merge the materials of clothing/accessory meshes into one atlas (MergeMaterialUV) on the saved copy. Cuts materials and texture memory, NOT draw calls (meshes stay separate). The body mesh is never merged. Refused unless the current project came from save_project_as. Starts a job.",
    {
      mesh_names: z.array(z.string().min(1)).optional().describe("Meshes to merge (default: all clothing + accessory meshes; see list_items)"),
      texture_size: z.union([z.literal(512), z.literal(1024), z.literal(2048)]).optional().describe("Atlas size (default 1024)"),
    },
    async ({ mesh_names, texture_size }) => bridgeCall(() => bridge.startMergeMaterials(mesh_names, texture_size), (j) => {
      exportJobs.set(j.job_id, { kind: "merge" });
      return `Started material merge as ${j.job_id}. Poll get_export_status("${j.job_id}").`;
    }),
  );

  server.tool(
    "capture_views",
    "Render Gate 1 review views of the current avatar: full body (front), head close-up, three-quarter (the avatar is turned 35° for the shot and restored). Returns the images.",
    {
      presets: z.array(z.enum(["full", "head", "three_quarter"])).min(1).max(3).optional().describe("Default: all three"),
      width: z.number().int().min(256).max(3840).optional().describe("Default 1280"),
      height: z.number().int().min(256).max(2160).optional().describe("Default 720"),
      prefix: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional().describe("File name prefix (e.g. the recipe id)"),
    },
    async ({ presets, width, height, prefix }) => {
      try {
        const r = await bridge.captureViews(presets, width, height, prefix);
        const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];
        for (const v of r.views ?? []) {
          if (v.base64) content.push({ type: "image" as const, data: v.base64, mimeType: "image/png" });
          content.push({ type: "text" as const, text: `${v.preset}: ${v.success ? v.path : `failed: ${v.error}`}${v.warning ? ` (${v.warning})` : ""}` });
        }
        if (!content.length) content.push({ type: "text" as const, text: `No views rendered: ${r.error ?? "unknown error"}` });
        return { content };
      } catch (e) {
        return text(`CC4 bridge error: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "start_export_fbx",
    "Start a Unity FBX export job for the current avatar. Always sets the Unity preset and the JSON sidecar (CCiC Unity Tools). Hidden-mesh and tearline/occlusion removal default ON (spike 5). Poll get_export_status for the result and a design §4 budget check.",
    {
      path: z.string().min(1).max(1024).describe("File name (goes to %USERPROFILE%\\CC4Export) or absolute .fbx path"),
      lod_label: z.enum(["LOD0", "LOD1", "LOD2"]).optional().describe("Appended to the file name and used for the budget check"),
      texture_size_cap: z.union([z.literal(256), z.literal(512), z.literal(1024), z.literal(2048), z.literal(4096)]).optional()
        .describe("One max texture size for the whole export (design §4: 2048 LOD0, 1024 LOD1, 512 LOD2)"),
      remove_hidden_mesh: z.boolean().optional().describe("Default true"),
      remove_tearline_occlusion: z.boolean().optional().describe("Default true"),
      mesh_only: z.boolean().optional().describe("Default true (LOD group members carry no motion)"),
      include_motion: z.string().max(1024).optional().describe("'allowlist:motion/...' exported with the mesh (sets mesh_only false)"),
    },
    async ({ path: p, lod_label, texture_size_cap, remove_hidden_mesh, remove_tearline_occlusion, mesh_only, include_motion }) => {
      const outputPath = labelledPath(p.toLowerCase().endsWith(".fbx") ? p : `${p}.fbx`, lod_label);
      if (outputPath.includes("..")) return text("Path traversal ('..') is not allowed");
      const options: ExportFbxOptions = {
        target_tool: "Unity",
        export_json: true,
        delete_hidden_faces: remove_hidden_mesh ?? true,
        remove_tearline_occlusion: remove_tearline_occlusion ?? true,
        export_motion: !(mesh_only ?? true),
        sub_d_level: 0,
      };
      if (texture_size_cap !== undefined) options.texture_size = texture_size_cap;
      if (include_motion) {
        try {
          options.include_motion_path = getAllowlist().resolve(include_motion, ["motion"]).path;
          options.export_motion = true;
        } catch (e) {
          return text(`Refused: ${(e as Error).message}`);
        }
      }
      return bridgeCall(() => bridge.startExportFbx(outputPath, options), (j) => {
        exportJobs.set(j.job_id, { kind: "export", lod: lod_label });
        return `Started export ${j.job_id} → ${outputPath}. Poll get_export_status("${j.job_id}").`;
      });
    },
  );

  server.tool(
    "get_export_status",
    "Status of a job started by start_export_fbx, convert_lod or merge_materials. Answered by the bridge's HTTP thread, so it responds while CC4 is busy. Finished exports include FBX triangle/material/bone counts and, with a lod_label, a design §4 budget check.",
    { job_id: z.string().regex(/^job_\d+$/).describe("Job id returned when the job started") },
    async ({ job_id }) => bridgeCall(() => bridge.getJobStatus(job_id), (job) => formatJob(job, exportJobs.get(job_id)?.lod)),
  );

  server.tool(
    "check_export_license",
    "Ask CC4 whether the avatar or a named item may be exported to FBX (RFileIO.CheckExportFbxHasLicense). So far only observed returning true (spike 2); treat a true as a hint, and keep the allowlist as the source of truth.",
    { item: z.string().max(256).optional().describe("Scene item name (see list_items); omit for the avatar") },
    async ({ item }) => bridgeCall(() => bridge.checkExportLicense(item),
      (r) => (r.success === false ? `Failed: ${r.error}` : `${r.item}: ${r.exportable ? "exportable" : "NOT exportable"}`)),
  );

  server.tool(
    "export_motions",
    "Export allowlisted motion clips as separate Unity FBX files (skeleton + animation, no meshes) for the scenario's idle/seated/supine clips. Runs one export job per clip and waits for each.",
    {
      clips: z.array(z.string().min(1)).min(1).max(20).describe("'allowlist:motion/...' references"),
      prefix: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional().describe("File name prefix (e.g. the recipe id)"),
      fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional().describe("Default 30"),
    },
    async ({ clips, prefix, fps }) => {
      const allowlist = getAllowlist();
      const resolved = [];
      for (const c of clips) {
        try {
          resolved.push(allowlist.resolve(c, ["motion"]));
        } catch (e) {
          return text(`Refused: ${(e as Error).message}`);
        }
      }
      const lines: string[] = [];
      for (const item of resolved) {
        const name = `${prefix ? `${prefix}_` : ""}${item.id.split("/")[1]}_motion.fbx`;
        try {
          const job = await bridge.startExportFbx(name, {
            target_tool: "Unity", export_motion: true, motion_only: true, include_motion_path: item.path, fps: fps ?? 30,
          });
          const done = await waitForJob(bridge, job.job_id, 300_000);
          const r = (done.result ?? {}) as ExportFbxResult;
          lines.push(done.status === "done" ? `✓ ${item.id} → ${r.path}` : `✗ ${item.id}: ${done.status} ${r.error ?? ""}`);
        } catch (e) {
          lines.push(`✗ ${item.id}: ${(e as Error).message}`);
        }
      }
      return text(lines.join("\n"));
    },
  );
}

export { LOD_BUDGETS };
