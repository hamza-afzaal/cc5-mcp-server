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
2. Install the plugin (Administrator PowerShell, CC4 closed):
   `powershell -ExecutionPolicy Bypass -File install-plugin.ps1`
3. Launch CC4. The bridge starts with the plugin: `curl http://127.0.0.1:5101/health`
4. Register with Claude Code:
   `claude mcp add --scope user --transport stdio cc4 -- node <abs path>\build\index.js`

## Tools (Phase 1a set; reshaped in Phase 2)

| Area | Tools |
|---|---|
| Connection & scene | `check_connection`, `list_avatars`, `get_avatar_info`, `create_avatar`, `delete_avatar`, `capture_viewport` |
| Introspection | `diagnostics` (fixed allowlist of read-only queries, replacing code execution) |
| Morphs | `search_morphs`, `adjust_morph`, `adjust_multiple_morphs`, `get_morph_value`, `reset_morphs` |
| Content | `list_clothes`, `list_hair`, `list_accessories`, `remove_scene_item`, `browse_content`, `load_asset` |
| Export | `export_fbx` (Unity preset, `export_json` sidecar, texture cap, hidden-mesh / tearline removal) |
| Look-dev | `set_eye_color`, `set_hair_color`, `get_material_info`, `get/set_diffuse_color`, `get_shader_parameters`, `set_shader_parameter`, `get_expression_info` |
| Camera & lights | `get_camera_info`, `set_camera_focal_length`, `frame_camera`, `get_lights`, `get_light_info`, `set_light_color/multiplier/active/shadow`, `get_visual_settings`, `set_ambient`, `set_ibl` |
| Edit | `undo`, `redo` |

## Configuration

Set these in the environment of the process that launches CC4 (plugin side) or the MCP server (Node side).

| Variable | Side | Default | Purpose |
|---|---|---|---|
| `CC4_BRIDGE_URL` | Node | `http://127.0.0.1:5101` | Bridge URL (loopback only) |
| `CC4_REQUEST_TIMEOUT_MS` | Node | `30000` | Default request timeout (export/load/render use 310 s) |
| `CC4_BRIDGE_PORT` | CC4 | `5101` | Bridge port |
| `CC4_EXPORT_DIR` | CC4 | `%USERPROFILE%\CC4Export` | Where bare export filenames go |
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
