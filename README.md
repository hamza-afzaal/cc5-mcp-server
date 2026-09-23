# CC4 MCP Bridge

An MCP server that lets Claude drive **Reallusion Character Creator 4 (4.70)** for the CraftXR character pipeline: author a character from a recipe, render review views, and export Unity-ready FBX + JSON for Quest 3.

It's a fork of [mackatwentytsuru/cc5-mcp-server](https://github.com/mackatwentytsuru/cc5-mcp-server) (the CC5 bridge, by macka), ported to CC4 and trimmed/hardened for this pipeline. See `docs/phase0-plan.md` for what changed and why.

## Architecture

```
Claude ⇄ stdio ⇄ MCP server (Node/TS, src/) ⇄ HTTP 127.0.0.1:5101 ⇄ CC4 plugin (Python 3.8, cc4-plugin/) ⇄ RLPy ⇄ CC4
```

RLPy is not thread-safe. The plugin's HTTP threads queue each action, and a QTimer runs it on CC4's main thread. Long actions can also run as jobs whose status is answered straight from the HTTP thread.

## Setup

1. Build the MCP server: `npm install && npm run build`
2. Link the plugin into CC4 (Administrator PowerShell, CC4 closed; once):
   `powershell -ExecutionPolicy Bypass -File install-plugin.ps1`
   This makes `...\Character Creator 4\Bin64\OpenPlugin\CC4_MCP_Bridge` a directory junction to `cc4-plugin/`. No code is copied into Program Files, and `-Uninstall` removes the link.
3. Launch CC4. The bridge starts with the plugin: `curl http://127.0.0.1:5101/health`
4. Register with Claude Code:
   `claude mcp add --scope user --transport stdio cc4 -- node <abs path>\build\index.js`

## Where files go

Everything stays under `D:\Business\Code\art`:

```
art\
  cc5-mcp-server\     this repo: bridge code, tests, docs, assets\allowlist.json
  cc4-recepies\       recipes repo (git@github.com:CraftXR/cc4-recepies.git), small JSON only
  characters\         workspace, not in git
    <recipe id>\      recipe.applied.json, projects\, exports\, renders\, reports\
    _testbench\       spikes, E2E runs, anything without a character
```

`apply_recipe` selects the recipe's folder; `set_character` does it by hand. Bare file names go to the current character's folder, and the bridge **refuses to write outside the workspace**. Program Files holds only the plugin junction.

## Tools (45)

| Area | Tools |
|---|---|
| Connection & scene | `check_connection`, `list_avatars`, `get_avatar_info`, `create_avatar`, `delete_avatar`, `set_character`, `undo`, `redo` |
| Recipes (S1, design §6) | `apply_recipe`, `export_recipe`; recipes live in `..\cc4-recepies` (sample: `recipes/sample-camila-01.json`) |
| Morphs | `search_morphs` (display name → id, min/max), `set_morphs` (batch, one undo, fails loudly on unknown names) |
| Content (S0 allowlist) | `list_items`, `get_inventory`, `load_item` (allowlisted only), `remove_item`, `browse_content`, `set_color` |
| Review (Gate 1) | `capture_views` (full / head / three-quarter) |
| Optimize (S2, on saved copies) | `save_project_as`, `convert_lod` (ActorBUILD / LOD1 / LOD2; two CC4 OK dialogs), `merge_materials` (clothing atlas) |
| Export (S3) | `start_export_fbx` (Unity + JSON, hidden/tearline removal, texture cap, LOD label), `get_export_status` (FBX counts + design §4 budget check), `export_motions`, `check_export_license` |
| Introspection | `diagnostics` (fixed read-only allowlist) |
| Look-dev (kept) | `get_camera_info`, `set_camera_focal_length`, `frame_camera`, lights (`get_lights`, `get_light_info`, `set_light_color/multiplier/active/shadow`), `get_visual_settings`, `set_ambient`, `set_ibl`, `get_material_info`, `get/set_diffuse_color`, `get_shader_parameters`, `set_shader_parameter`, `get_expression_info` |

`assets/allowlist.json` lists every item recipes and `load_item` may use (`CC4_ALLOWLIST` overrides the path). What CC4 can and can't automate is recorded in `docs/spikes.md`.

Helper scripts: `node tools/mcp_call.mjs <tool> '<json>'` calls tools through a real MCP client; `node tools/replay_check.mjs <recipe.json>` checks that a recipe replays identically; `python tools/fbx_stats.py <file.fbx>` prints budget stats.

## Configuration

Set these in the environment of the process that launches CC4 (plugin side) or the MCP server (Node side).

| Variable | Side | Default | Purpose |
|---|---|---|---|
| `CC4_BRIDGE_URL` | Node | `http://127.0.0.1:5101` | Bridge URL (loopback only) |
| `CC4_ALLOWLIST` | Node | `<repo>/assets/allowlist.json` | Asset allowlist (S0) |
| `CC4_REQUEST_TIMEOUT_MS` | Node | `30000` | Default request timeout (export/load/render use 310 s) |
| `CC4_BRIDGE_PORT` | CC4 | `5101` | Bridge port |
| `CC4_WORKSPACE` | CC4 | `<art>\characters` | Workspace root; the bridge never writes outside it |
| `CC4_DEV_MODE` | CC4 | `0` | `1` enables `POST /reload` (hot reload of `cc4_api.py`) |
| `CC4_RELOAD_SECRET` | CC4 | *(empty)* | Required `X-Reload-Token` for `/reload`; reload is refused while empty |
| `CC4_ROOT` | CC4 | auto | CC4 install folder if auto-detection fails |

## Security

- The bridge binds to 127.0.0.1 only. It rejects browser-origin requests (`Origin` / `Sec-Fetch-Site`), non-loopback `Host` headers (DNS rebinding), and POSTs that aren't `application/json`.
- There is no code-execution endpoint. `diagnostics` answers only read-only allowlisted queries.
- `/reload` is off unless dev mode is on **and** a secret is set.
- Request bodies are capped at 1 MB; paths are checked for traversal and extension on both the TS and Python sides.

## Development

- `npm test`: TypeScript unit tests (vitest)
- `npm run test:py`: offline Python tests for the bridge (stub RLPy; also checks Python 3.8 syntax)
- `python tools/gen_rlpy_reference.py`: regenerate `docs/rlpy-api-reference.md` from CC4's `RLPy.py`
- Rules for changing the plugin: `.claude/rules/cc4-dev.md`

## Docs

- `docs/cc4-bridge-kickoff-v2.md`: build plan (phases)
- `docs/phase0-plan.md`: porting plan and decisions
- `docs/craftxr-character-pipeline-design.md`, `docs/craftxr-character-color-realism-spec.md`: pipeline design
- `docs/probe1.json`, `docs/probe2.json`: verified CC4 API facts

## Credits & license

Original CC5 bridge by macka ([mackatwentytsuru/cc5-mcp-server](https://github.com/mackatwentytsuru/cc5-mcp-server)), published as MIT. CC4 port for CraftXR.
