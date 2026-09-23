import { describe, it, expect, beforeEach } from "vitest";
import { registerColorTools } from "../../src/tools/color.js";
import { createMockBridge, type MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerColorTools(server as any, bridge as any);
});

describe("set_color", () => {
  it("is the only color tool (no skin or lip color)", () => {
    expect(server.tool.mock.calls.map((c) => c[0])).toEqual(["set_color"]);
  });

  it("tints the target materials", async () => {
    bridge.setColor.mockResolvedValue({ success: true, applied_to: ["CC_Base_Eye/Std_Eye_R", "CC_Base_Eye/Std_Eye_L"] });
    const text = (await server.getRegisteredTool("set_color")({ target: "eyes", rgb: [0.28, 0.22, 0.16] })).content[0].text;
    expect(bridge.setColor).toHaveBeenCalledWith("eyes", 0.28, 0.22, 0.16);
    expect(text).toBe("eyes color set to [0.28, 0.22, 0.16] on: CC_Base_Eye/Std_Eye_R, CC_Base_Eye/Std_Eye_L");
  });

  it("reports failures", async () => {
    bridge.setColor.mockResolvedValue({ success: false, error: "Could not find hair materials" });
    const text = (await server.getRegisteredTool("set_color")({ target: "hair", rgb: [0.1, 0.1, 0.1] })).content[0].text;
    expect(text).toBe("Failed: Could not find hair materials");
  });
});
