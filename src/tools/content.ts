/**
 * Clothes, hair and accessory tools. Loading is gated by assets/allowlist.json (design S0).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CC4Bridge } from "../cc4-bridge.js";
import { AllowlistIndex, loadAllowlist, type AllowlistItem } from "../allowlist.js";
import type { ItemList } from "../types.js";
import { bridgeCall } from "../util.js";

export type AllowlistProvider = () => AllowlistIndex;
export const defaultAllowlistProvider: AllowlistProvider = () => new AllowlistIndex(loadAllowlist());

const LOADABLE_TYPES = ["base", "clothes", "shoes", "hair", "accessory", "skin"] as const;

export function formatItems(items: ItemList, allowlist?: AllowlistIndex): string {
  const lines = [`Avatar: ${items.avatar}`];
  for (const [label, list, types] of [
    ["Clothes", items.clothes, ["clothes", "shoes"]],
    ["Hair", items.hair, ["hair"]],
    ["Accessories", items.accessories, ["accessory"]],
  ] as const) {
    lines.push(`${label} (${list.length}):`);
    for (const item of list) {
      const hit = allowlist?.bySceneName(item.name, types);
      const tag = allowlist ? (hit ? `allowlist:${hit.id}${hit.exportable ? "" : " (NOT exportable)"}` : "not in allowlist") : "";
      lines.push(`  - ${item.name}${tag ? `  [${tag}]` : ""}  meshes: ${item.meshes.join(", ") || "-"}`);
    }
  }
  return lines.join("\n");
}

export function registerContentTools(server: McpServer, bridge: CC4Bridge, getAllowlist: AllowlistProvider = defaultAllowlistProvider) {
  server.tool(
    "list_items",
    "List the clothes, hair and accessories on the current avatar with their scene mesh names.",
    {},
    async () => bridgeCall(() => bridge.listItems(), (items) => formatItems(items)),
  );

  server.tool(
    "get_inventory",
    "List the avatar's clothes, hair and accessories joined against assets/allowlist.json: allowlist ID, exportability, or 'not in allowlist'.",
    {},
    async () => bridgeCall(async () => ({ items: await bridge.listItems(), allowlist: getAllowlist() }),
      ({ items, allowlist }) => formatItems(items, allowlist)),
  );

  server.tool(
    "load_item",
    "Load an allowlisted content item (base avatar, clothing, shoes, hair, accessory or skin preset) into CC4. Takes 'allowlist:<id>' or a path that is listed in assets/allowlist.json. Anything not allowlisted or not exportable is refused.",
    {
      item: z.string().min(1).max(1024).describe("'allowlist:clothes/basic_tshirt' or an allowlisted absolute path"),
    },
    async ({ item }) => {
      let entry: AllowlistItem;
      try {
        entry = getAllowlist().resolve(item, LOADABLE_TYPES);
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Refused: ${(e as Error).message}` }] };
      }
      return bridgeCall(() => bridge.loadItem(entry.path), (r) => {
        const added = r.added ? [...r.added.clothes, ...r.added.hair, ...r.added.accessories] : [];
        const unverified = entry.verified ? "" : `\nNote: license for ${entry.id} not yet verified (${entry.license}).`;
        return r.success
          ? `Loaded ${entry.id} in ${r.seconds ?? "?"} s. Added: ${added.join(", ") || "(no new item; base or skin load)"}${unverified}`
          : `Failed to load ${entry.id}: ${r.error}`;
      });
    },
  );

  server.tool(
    "remove_item",
    "Remove a clothing, hair or accessory item from the current avatar by its scene name (see list_items).",
    {
      name: z.string().min(1).max(256).describe("Scene item name, e.g. 'Basic T-shirts'"),
    },
    async ({ name }) => bridgeCall(() => bridge.removeItem(name),
      (r) => (r.success ? `Removed: ${r.removed ?? name}` : `Failed: ${r.error}`)),
  );

  server.tool(
    "browse_content",
    "Browse CC4's installed content folders (for authoring assets/allowlist.json). Returns up to 200 file paths. Loading still requires an allowlist entry.",
    {
      folder_type: z.enum([
        "cloth_upper", "cloth_lower", "shoes", "accessory_head", "accessory_body", "cloth",
        "pose", "motion", "expression", "props", "light", "camera", "character",
        "project", "gloves", "skin", "skin_head",
      ]).describe("Content folder type"),
    },
    async ({ folder_type }) => bridgeCall(() => bridge.browseContent(folder_type),
      (files) => (files.length ? `${files.length} file(s):\n${files.map((f) => `- ${f}`).join("\n")}` : `No content found for ${folder_type}.`)),
  );
}
