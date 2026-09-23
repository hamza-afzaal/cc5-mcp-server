/**
 * Recipes (design §6, D5): a character is a recipe, not a file.
 *
 * apply_recipe replays a recipe into CC4: base → morphs (by display name) → skin →
 * hair → clothes → accessories → colors. Every allowlist reference is resolved
 * before CC4 is touched, so a bad recipe fails without half-applying.
 */

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CC4Bridge } from "./cc4-bridge.js";
import { AllowlistIndex, refId, type AllowlistItem, type ItemType } from "./allowlist.js";
import type { MorphValue } from "./types.js";

const Ref = z.string().regex(/^allowlist:[a-z0-9_]+\/[a-z0-9_.-]+$/, "must be 'allowlist:<type>/<name>'");
const Rgb = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]);

export const RecipeMorphSchema = z.object({
  display_name: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  category: z.string().optional(),
  value: z.number(),
}).strict().refine((m) => m.display_name || m.id, { message: "morph needs display_name or id" });

export const RecipeSchema = z.object({
  recipe_version: z.literal("0.1"),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase, digits and dashes"),
  archetype: z.string().min(1),
  /** Monk Skin Tone 1–10 (spec Part B coverage checks). */
  mst: z.number().int().min(1).max(10).optional(),
  clinical_presentation: z.array(z.string()).default([]),
  base: z.object({
    item: Ref,
    gender: z.enum(["female", "male"]).optional(),
  }).strict(),
  morphs: z.array(RecipeMorphSchema).default([]),
  skin: z.object({
    preset: Ref.optional(),
    /** Clinical tints are runtime physiology (spec Part C), not baked; recorded only. */
    tint: z.record(z.number()).optional(),
  }).strict().optional(),
  hair: Ref.nullable().optional(),
  clothes: z.array(Ref).default([]),
  accessories: z.array(Ref).default([]),
  colors: z.object({ eyes: Rgb.optional(), hair: Rgb.optional() }).strict().optional(),
  lod_profile: z.string().optional(),
  motions: z.array(Ref).default([]),
  salsa: z.record(z.unknown()).optional(),
}).strict();

export type Recipe = z.infer<typeof RecipeSchema>;

export interface RecipeStep {
  step: string;
  ok: boolean;
  detail?: unknown;
}

export interface ApplyReport {
  recipe_id: string;
  ok: boolean;
  steps: RecipeStep[];
  warnings: string[];
}

interface ResolvedRecipe {
  base: AllowlistItem;
  skin?: AllowlistItem;
  hair?: AllowlistItem;
  clothes: AllowlistItem[];
  accessories: AllowlistItem[];
  motions: AllowlistItem[];
}

/** Resolve every allowlist ref up front; collect all problems into one error. */
export function resolveRecipe(recipe: Recipe, allowlist: AllowlistIndex): ResolvedRecipe {
  const problems: string[] = [];
  const one = (ref: string, types: readonly ItemType[], field: string): AllowlistItem | undefined => {
    try {
      return allowlist.resolve(ref, types);
    } catch (e) {
      problems.push(`${field}: ${(e as Error).message}`);
      return undefined;
    }
  };
  const base = one(recipe.base.item, ["base"], "base.item");
  const skin = recipe.skin?.preset ? one(recipe.skin.preset, ["skin"], "skin.preset") : undefined;
  const hair = recipe.hair ? one(recipe.hair, ["hair"], "hair") : undefined;
  const clothes = recipe.clothes.map((r, i) => one(r, ["clothes", "shoes"], `clothes[${i}]`));
  const accessories = recipe.accessories.map((r, i) => one(r, ["accessory"], `accessories[${i}]`));
  const motions = recipe.motions.map((r, i) => one(r, ["motion"], `motions[${i}]`));
  if (problems.length || !base) {
    throw new Error(`Recipe '${recipe.id}' has ${problems.length} unresolved reference(s):\n- ${problems.join("\n- ")}`);
  }
  return {
    base, skin, hair,
    clothes: clothes as AllowlistItem[],
    accessories: accessories as AllowlistItem[],
    motions: motions as AllowlistItem[],
  };
}

/** The last recipe applied in this MCP session (export_recipe uses it for fields CC4 can't report). */
let lastApplied: Recipe | null = null;
/** Scene items the base avatar itself brought (e.g. Camila's underwear); not recipe items. */
let baseItemNames = new Set<string>();
/** Morph values the base avatar itself carries (e.g. "CC4 Camila_Body" = 1); not recipe morphs. */
let baseMorphValues = new Map<string, number>();
export function getLastAppliedRecipe(): Recipe | null {
  return lastApplied;
}
export function setLastAppliedRecipe(recipe: Recipe | null, baseItems: string[] = [], baseMorphs: Map<string, number> = new Map()): void {
  lastApplied = recipe;
  baseItemNames = new Set(baseItems);
  baseMorphValues = baseMorphs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function applyRecipe(
  bridge: CC4Bridge,
  allowlist: AllowlistIndex,
  recipe: Recipe,
  opts: { catalogRetryDelayMs?: number } = {},
): Promise<ApplyReport> {
  const resolved = resolveRecipe(recipe, allowlist);
  const steps: RecipeStep[] = [];
  const warnings: string[] = [];
  const unverified = [resolved.base, resolved.skin, resolved.hair, ...resolved.clothes, ...resolved.accessories]
    .filter((i): i is AllowlistItem => !!i && !i.verified)
    .map((i) => i.id);
  if (unverified.length) warnings.push(`License not yet verified for: ${unverified.join(", ")}`);

  const fail = (step: string, detail: unknown): ApplyReport => {
    steps.push({ step, ok: false, detail });
    return { recipe_id: recipe.id, ok: false, steps, warnings };
  };
  // The bridge client throws on bridge errors (HTTP 4xx/5xx); turn that into a failed step.
  let current = "set_character";
  try {
    return await replay();
  } catch (e) {
    return fail(current, (e as Error).message);
  }

  async function replay(): Promise<ApplyReport> {

  // 0. Route this character's projects/exports/renders to <workspace>/<recipe id>/.
  current = "set_character";
  const workspace = await bridge.setCharacter(recipe.id);
  steps.push({ step: "set_character", ok: true, detail: workspace.folder });

  // 1. Base: clear the scene, load the base, make sure the morph catalog is bound (spike 0).
  current = "clear_scene";
  const avatars = await bridge.getAvatars();
  if (avatars.length) {
    const del = await bridge.deleteAvatar("");
    steps.push({ step: "clear_scene", ok: del.success, detail: del.removed ?? del.error });
  }
  current = "load_base";
  let base = await bridge.loadItem(resolved.base.path);
  if (!base.success) return fail("load_base", base.error);
  let status = await bridge.getMorphStatus();
  if (!status.ready) {
    await sleep(opts.catalogRetryDelayMs ?? 5000);
    await bridge.deleteAvatar("");
    base = await bridge.loadItem(resolved.base.path);
    status = await bridge.getMorphStatus();
    if (!base.success || !status.ready) {
      return fail("load_base", { error: "Morph catalog never became ready (only 'Actor Parts' bound)", status });
    }
    warnings.push("Morph catalog was not ready on first load; the base was reloaded.");
  }
  const baseInfo = await bridge.getAvatarInfo();
  const baseMorphs = new Map((baseInfo?.active_morphs ?? []).map((m) => [m.id, m.value] as [string, number]));
  const baseItems = await bridge.listItems();
  const baseBrought = [...baseItems.clothes, ...baseItems.hair, ...baseItems.accessories].map((i) => i.name);
  steps.push({ step: "load_base", ok: true, detail: { item: resolved.base.id, avatar: base.avatar, catalog: status, base_items: baseBrought } });

  // 2. Morphs by display name (or id), one undoable action; unknown names fail loudly.
  if (recipe.morphs.length) {
    current = "morphs";
    const morphs = await bridge.setMorphs(recipe.morphs as MorphValue[]);
    if (!morphs.success) return fail("morphs", { error: morphs.error, problems: morphs.problems });
    const morphWarnings = (morphs.applied ?? []).filter((m) => m.warning).map((m) => `${m.display_name}: ${m.warning}`);
    warnings.push(...morphWarnings);
    steps.push({ step: "morphs", ok: true, detail: { applied: morphs.applied?.length ?? 0 } });
  }

  // 3. Skin, hair, clothes, accessories.
  const loads: Array<[string, AllowlistItem]> = [];
  if (resolved.skin) loads.push(["skin", resolved.skin]);
  if (resolved.hair) loads.push(["hair", resolved.hair]);
  for (const c of resolved.clothes) loads.push(["clothes", c]);
  for (const a of resolved.accessories) loads.push(["accessory", a]);
  for (const [kind, item] of loads) {
    current = `load_${kind} (${item.id})`;
    const res = await bridge.loadItem(item.path);
    if (!res.success) return fail(`load_${kind}`, { item: item.id, error: res.error });
    const added = res.added ? [...res.added.clothes, ...res.added.hair, ...res.added.accessories] : [];
    if (kind !== "skin" && added.length === 0) warnings.push(`${item.id} loaded but added no new scene item`);
    steps.push({ step: `load_${kind}`, ok: true, detail: { item: item.id, added } });
  }

  // 4. Colors.
  for (const target of ["eyes", "hair"] as const) {
    const rgb = recipe.colors?.[target];
    if (!rgb) continue;
    current = `color_${target}`;
    const res = await bridge.setColor(target, rgb[0], rgb[1], rgb[2]);
    if (!res.success) return fail(`color_${target}`, res.error);
    steps.push({ step: `color_${target}`, ok: true, detail: res.applied_to });
  }

  // 5. Fields recorded but not applied at authoring time.
  if (recipe.skin?.tint && Object.keys(recipe.skin.tint).length) {
    warnings.push("skin.tint not applied: clinical signs are runtime physiology in Unity (spec Part C).");
  }
  if (recipe.motions.length) warnings.push("motions are exported separately with export_motions, not applied to the scene.");

  setLastAppliedRecipe(recipe, baseBrought, baseMorphs);
  // Keep a copy of exactly what was applied next to the character's artifacts.
  try {
    fs.mkdirSync(workspace.folder, { recursive: true });
    fs.writeFileSync(path.join(workspace.folder, "recipe.applied.json"), `${JSON.stringify(recipe, null, 2)}\n`);
  } catch (e) {
    warnings.push(`Could not write recipe.applied.json: ${(e as Error).message}`);
  }
  return { recipe_id: recipe.id, ok: true, steps, warnings };
  }
}

export interface ExportedRecipe {
  recipe: Record<string, unknown>;
  unmapped_items: string[];
  notes: string[];
}

/** Read the current CC4 character back into recipe form. */
export async function exportRecipe(bridge: CC4Bridge, allowlist: AllowlistIndex): Promise<ExportedRecipe> {
  const info = await bridge.getAvatarInfo();
  if (!info) throw new Error("No avatar in the scene");
  const items = await bridge.listItems();
  const prior = lastApplied;
  const notes: string[] = [];
  const unmapped: string[] = [];

  const baseItem = (prior && refId(prior.base.item) ? allowlist.get(refId(prior.base.item)!) : undefined)
    ?? allowlist.bySceneName(info.name, ["base"]);
  if (!baseItem) notes.push(`Base avatar '${info.name}' is not in the allowlist; set base.item by hand.`);

  const mapItems = (names: string[], types: readonly ItemType[]) =>
    names.flatMap((n) => {
      const hit = allowlist.bySceneName(n, types);
      if (!hit) {
        unmapped.push(n);
        return [];
      }
      return [`allowlist:${hit.id}`];
    });

  // Items the base itself brings (e.g. Camila's underwear) are part of the base, not the recipe.
  const notFromBase = (names: string[]) => names.filter((n) => !baseItemNames.has(n));
  const clothes = mapItems(notFromBase(items.clothes.map((c) => c.name)), ["clothes", "shoes"]);
  const hair = mapItems(notFromBase(items.hair.map((h) => h.name)), ["hair"]);
  const accessories = mapItems(notFromBase(items.accessories.map((a) => a.name)), ["accessory"]);
  if (unmapped.length) {
    notes.push(`Scene items without an allowlist entry (left out): ${unmapped.join(", ")}.`
      + (prior ? "" : " Items that come with the base avatar (e.g. its underwear) also land here when no recipe was applied this session."));
  }

  // Leave out sliders the base itself sets, unless the recipe changed them.
  const morphs = (info.active_morphs ?? []).filter((m) => {
    const baseValue = baseMorphValues.get(m.id);
    return baseValue === undefined || Math.abs(baseValue - m.value) > 1e-4;
  }).map((m) => ({
    display_name: m.display_name,
    category: m.category,
    value: Math.round(m.value * 1e4) / 1e4,
  }));

  if (!prior?.colors) notes.push("Eye/hair colors can't be read back from CC4; carry them over from the source recipe.");

  const recipe: Record<string, unknown> = {
    recipe_version: "0.1",
    id: prior?.id ?? "exported-character",
    archetype: prior?.archetype ?? "unknown",
    ...(prior?.mst ? { mst: prior.mst } : {}),
    clinical_presentation: prior?.clinical_presentation ?? [],
    base: { item: baseItem ? `allowlist:${baseItem.id}` : "allowlist:base/UNKNOWN", ...(prior?.base.gender ? { gender: prior.base.gender } : {}) },
    morphs,
    ...(prior?.skin ? { skin: prior.skin } : {}),
    hair: hair[0] ?? null,
    clothes,
    accessories,
    ...(prior?.colors ? { colors: prior.colors } : {}),
    ...(prior?.lod_profile ? { lod_profile: prior.lod_profile } : {}),
    motions: prior?.motions ?? [],
    ...(prior?.salsa ? { salsa: prior.salsa } : {}),
  };
  return { recipe, unmapped_items: unmapped, notes };
}
