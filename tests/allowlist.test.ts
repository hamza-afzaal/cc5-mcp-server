import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { loadAllowlist, parseAllowlist, refId, defaultAllowlistPath } from "../src/allowlist.js";
import { ALLOWLIST_FIXTURE, fixtureAllowlist } from "./helpers/allowlist-fixture.js";

describe("allowlist schema", () => {
  it("accepts the repo's starter allowlist", () => {
    const list = loadAllowlist(path.resolve("assets/allowlist.json"));
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((i) => i.exportable)).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const dup = { ...ALLOWLIST_FIXTURE, items: [ALLOWLIST_FIXTURE.items[0], ALLOWLIST_FIXTURE.items[0]] };
    expect(() => parseAllowlist(dup)).toThrow(/Duplicate allowlist id/);
  });

  it("rejects malformed ids and unknown fields", () => {
    const badId = { ...ALLOWLIST_FIXTURE, items: [{ ...ALLOWLIST_FIXTURE.items[0], id: "Camila" }] };
    expect(() => parseAllowlist(badId)).toThrow();
    const extra = { ...ALLOWLIST_FIXTURE, items: [{ ...ALLOWLIST_FIXTURE.items[0], exportble: true }] };
    expect(() => parseAllowlist(extra)).toThrow();
  });

  it("reports a missing file clearly", () => {
    expect(() => loadAllowlist(path.join(os.tmpdir(), "no-such-allowlist.json"))).toThrow(/Allowlist not found/);
  });

  it("honours CC4_ALLOWLIST", () => {
    const tmp = path.join(os.tmpdir(), `allowlist-${process.pid}.json`);
    fs.writeFileSync(tmp, JSON.stringify(ALLOWLIST_FIXTURE));
    process.env.CC4_ALLOWLIST = tmp;
    try {
      expect(defaultAllowlistPath()).toBe(tmp);
      expect(loadAllowlist().items).toHaveLength(ALLOWLIST_FIXTURE.items.length);
    } finally {
      delete process.env.CC4_ALLOWLIST;
      fs.unlinkSync(tmp);
    }
  });
});

describe("AllowlistIndex.resolve", () => {
  const index = fixtureAllowlist();

  it("resolves allowlist refs", () => {
    expect(index.resolve("allowlist:clothes/basic_tshirt").path).toBe("D:/T/Cloth/Basic T-shirts.ccCloth");
  });

  it("resolves allowlisted paths regardless of slashes and case", () => {
    expect(index.resolve("d:\\t\\cloth\\basic t-shirts.cccloth").id).toBe("clothes/basic_tshirt");
  });

  it("refuses unknown ids and paths", () => {
    expect(() => index.resolve("allowlist:clothes/nope")).toThrow(/Unknown allowlist id/);
    expect(() => index.resolve("C:/Downloads/pirated.ccCloth")).toThrow(/not in the allowlist/);
  });

  it("refuses non-exportable items (design §10)", () => {
    expect(() => index.resolve("allowlist:clothes/icontent_coat")).toThrow(/not exportable/);
  });

  it("refuses the wrong type", () => {
    expect(() => index.resolve("allowlist:motion/female_idle_1", ["clothes"])).toThrow(/is a motion, expected clothes/);
  });
});

describe("AllowlistIndex.bySceneName", () => {
  const index = fixtureAllowlist();

  it("matches declared scene names", () => {
    expect(index.bySceneName("Basic T-shirts")?.id).toBe("clothes/basic_tshirt");
  });

  it("falls back to the file stem, ignoring case, spaces and underscores", () => {
    expect(index.bySceneName("Canvas_shoes")?.id).toBe("shoes/canvas_shoes");
  });

  it("filters by type", () => {
    expect(index.bySceneName("Camila", ["clothes"])).toBeUndefined();
    expect(index.bySceneName("Camila", ["base"])?.id).toBe("base/cc4_camila");
  });
});

describe("refId", () => {
  it("strips the prefix or returns null", () => {
    expect(refId("allowlist:hair/short_grey")).toBe("hair/short_grey");
    expect(refId("D:/x.ccCloth")).toBeNull();
  });
});
