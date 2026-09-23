import { describe, it, expect, beforeEach } from "vitest";
import { registerContentTools, formatItems } from "../../src/tools/content.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";
import { fixtureAllowlist } from "../helpers/allowlist-fixture.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;

const ITEMS = {
  avatar: "Camila",
  clothes: [{ name: "Basic T-shirts", meshes: ["Basic_T_shirts"] }, { name: "Bra", meshes: ["Bra"] }],
  hair: [],
  accessories: [],
};

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerContentTools(server as any, bridge as any, fixtureAllowlist);
});

describe("registerContentTools", () => {
  it("registers the item tools", () => {
    expect(server.tool.mock.calls.map((c) => c[0])).toEqual(["list_items", "get_inventory", "load_item", "remove_item", "browse_content"]);
  });
});

describe("list_items / get_inventory", () => {
  it("lists items with meshes", async () => {
    bridge.listItems.mockResolvedValue(ITEMS);
    const text = (await server.getRegisteredTool("list_items")({})).content[0].text;
    expect(text).toContain("Clothes (2):");
    expect(text).toContain("Basic T-shirts  meshes: Basic_T_shirts");
  });

  it("joins items against the allowlist", async () => {
    bridge.listItems.mockResolvedValue(ITEMS);
    const text = (await server.getRegisteredTool("get_inventory")({})).content[0].text;
    expect(text).toContain("Basic T-shirts  [allowlist:clothes/basic_tshirt]");
    expect(text).toContain("Bra  [not in allowlist]");
  });

  it("flags non-exportable allowlist hits", () => {
    const text = formatItems({ ...ITEMS, clothes: [{ name: "Fancy Coat", meshes: [] }] }, fixtureAllowlist());
    expect(text).toContain("allowlist:clothes/icontent_coat (NOT exportable)");
  });
});

describe("load_item", () => {
  it("loads an allowlisted item by ref and reports what was added", async () => {
    bridge.loadItem.mockResolvedValue({ success: true, seconds: 1.9, added: { clothes: ["Basic T-shirts"], hair: [], accessories: [] } });
    const text = (await server.getRegisteredTool("load_item")({ item: "allowlist:clothes/basic_tshirt" })).content[0].text;
    expect(bridge.loadItem).toHaveBeenCalledWith("D:/T/Cloth/Basic T-shirts.ccCloth");
    expect(text).toContain("Loaded clothes/basic_tshirt in 1.9 s. Added: Basic T-shirts");
    expect(text).toContain("license for clothes/basic_tshirt not yet verified");
  });

  it("refuses paths outside the allowlist without calling CC4", async () => {
    const text = (await server.getRegisteredTool("load_item")({ item: "C:/Downloads/pirated.ccCloth" })).content[0].text;
    expect(text).toContain("Refused: Path is not in the allowlist");
    expect(bridge.loadItem).not.toHaveBeenCalled();
  });

  it("refuses non-exportable items and motions", async () => {
    const coat = (await server.getRegisteredTool("load_item")({ item: "allowlist:clothes/icontent_coat" })).content[0].text;
    expect(coat).toContain("not exportable");
    const motion = (await server.getRegisteredTool("load_item")({ item: "allowlist:motion/female_idle_1" })).content[0].text;
    expect(motion).toContain("is a motion");
    expect(bridge.loadItem).not.toHaveBeenCalled();
  });
});

describe("remove_item / browse_content", () => {
  it("removes by scene name", async () => {
    bridge.removeItem.mockResolvedValue({ success: true, removed: "Bra" });
    const text = (await server.getRegisteredTool("remove_item")({ name: "Bra" })).content[0].text;
    expect(text).toBe("Removed: Bra");
  });

  it("lists content files", async () => {
    bridge.browseContent.mockResolvedValue(["D:/T/Shoes/Canvas Shoes.ccShoes"]);
    const text = (await server.getRegisteredTool("browse_content")({ folder_type: "shoes" })).content[0].text;
    expect(text).toContain("1 file(s)");
  });
});
