/**
 * Unit tests for the read-only diagnostics tool.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { registerDiagnosticsTools } from "../../src/tools/diagnostics.js";
import { createMockBridge } from "../helpers/mock-bridge.js";
import type { MockBridge } from "../helpers/mock-bridge.js";
import { createMockServer } from "../helpers/mock-server.js";

let bridge: MockBridge;
let server: ReturnType<typeof createMockServer>;

beforeEach(() => {
  bridge = createMockBridge();
  server = createMockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerDiagnosticsTools(server as any, bridge as any);
});

describe("diagnostics tool", () => {
  it("registers exactly 1 tool named diagnostics", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
    expect(server.tool.mock.calls[0][0]).toBe("diagnostics");
  });

  it("only accepts allowlisted queries", () => {
    // The zod shape is the 3rd argument; the query enum must reject anything else.
    const shape = server.tool.mock.calls[0][2] as { query: { safeParse: (v: unknown) => { success: boolean } } };
    expect(shape.query.safeParse("symbol_search").success).toBe(true);
    expect(shape.query.safeParse("exec_python").success).toBe(false);
  });

  it("passes query and arg through and pretty-prints the result", async () => {
    bridge.diagnostics.mockResolvedValue({ count: 1, symbols: ["RExportFbxSetting"] });
    const result = await server.getRegisteredTool("diagnostics")({ query: "symbol_search", arg: "ExportFbx" });
    expect(bridge.diagnostics).toHaveBeenCalledWith("symbol_search", "ExportFbx");
    expect(result.content[0].text).toContain("\"RExportFbxSetting\"");
  });

  it("returns bridge error text when bridge throws", async () => {
    bridge.diagnostics.mockRejectedValue(new Error("CC4 bridge error (400): Unknown query"));
    const result = await server.getRegisteredTool("diagnostics")({ query: "project_path" });
    expect(result.content[0].text).toContain("Unknown query");
  });
});
