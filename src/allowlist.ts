/**
 * S0 asset allowlist (design §5 S0, §10).
 *
 * Every item a recipe or load_item may use must be listed in assets/allowlist.json
 * with its license and whether it may be exported. The file is re-read on every
 * call so edits take effect without restarting the MCP server.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const ITEM_TYPES = ["base", "clothes", "shoes", "hair", "accessory", "skin", "motion"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const AllowlistItemSchema = z.object({
  /** Stable ID used in recipes as "allowlist:<id>", e.g. "clothes/basic_tshirt". */
  id: z.string().regex(/^[a-z0-9_]+\/[a-z0-9_.-]+$/, "id must look like 'type/name' (lowercase, _ . -)"),
  type: z.enum(ITEM_TYPES),
  /** Absolute path of the CC4 content file. */
  path: z.string().min(3),
  /** Where the license comes from, e.g. "cc4-bundled", "standard", "icontent". */
  license: z.string().min(1),
  /** Only exportable (Standard License) items may be loaded (design §10). */
  exportable: z.boolean(),
  /** Names the item shows in the CC4 scene, used to map scene items back to IDs. */
  scene_names: z.array(z.string()).default([]),
  /** True once someone confirmed the license terms; unverified items still load, with a warning. */
  verified: z.boolean().default(false),
  notes: z.string().optional(),
}).strict();

export const AllowlistSchema = z.object({
  version: z.literal(1),
  notes: z.string().optional(),
  items: z.array(AllowlistItemSchema),
}).strict();

export type AllowlistItem = z.infer<typeof AllowlistItemSchema>;
export type Allowlist = z.infer<typeof AllowlistSchema>;

const REF_PREFIX = "allowlist:";

export function defaultAllowlistPath(): string {
  if (process.env.CC4_ALLOWLIST) return process.env.CC4_ALLOWLIST;
  // build/allowlist.js or src/allowlist.ts -> <repo>/assets/allowlist.json
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "assets", "allowlist.json");
}

export function parseAllowlist(raw: unknown): Allowlist {
  const list = AllowlistSchema.parse(raw);
  const seen = new Set<string>();
  for (const item of list.items) {
    if (seen.has(item.id)) throw new Error(`Duplicate allowlist id: ${item.id}`);
    seen.add(item.id);
  }
  return list;
}

export function loadAllowlist(filePath: string = defaultAllowlistPath()): Allowlist {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Allowlist not found at ${filePath} (set CC4_ALLOWLIST or create assets/allowlist.json)`);
  }
  return parseAllowlist(JSON.parse(text));
}

function normPath(p: string): string {
  return path.normalize(p).replace(/\\/g, "/").toLowerCase();
}

/** Strip the "allowlist:" prefix; returns null for strings that are not refs. */
export function refId(ref: string): string | null {
  return ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : null;
}

export class AllowlistIndex {
  constructor(readonly list: Allowlist) {}

  get(id: string): AllowlistItem | undefined {
    return this.list.items.find((i) => i.id === id);
  }

  byPath(filePath: string): AllowlistItem | undefined {
    const n = normPath(filePath);
    return this.list.items.find((i) => normPath(i.path) === n);
  }

  /** Map a CC4 scene item name back to an allowlist entry (scene_names, then file stem). */
  bySceneName(name: string, types?: readonly ItemType[]): AllowlistItem | undefined {
    const pool = types ? this.list.items.filter((i) => types.includes(i.type)) : this.list.items;
    const loose = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
    return pool.find((i) => i.scene_names.includes(name))
      ?? pool.find((i) => loose(path.parse(i.path).name) === loose(name));
  }

  /**
   * Resolve "allowlist:<id>" (or a bare path that is allowlisted) to an item that may be loaded.
   * Throws with a specific reason otherwise.
   */
  resolve(refOrPath: string, expected?: readonly ItemType[]): AllowlistItem {
    const id = refId(refOrPath);
    const item = id !== null ? this.get(id) : this.byPath(refOrPath);
    if (!item) {
      throw new Error(id !== null
        ? `Unknown allowlist id '${id}'`
        : `Path is not in the allowlist: ${refOrPath}`);
    }
    if (expected && !expected.includes(item.type)) {
      throw new Error(`'${item.id}' is a ${item.type}, expected ${expected.join(" or ")}`);
    }
    if (!item.exportable) {
      throw new Error(`'${item.id}' is not exportable (license: ${item.license}); only exportable items may be used`);
    }
    return item;
  }
}
