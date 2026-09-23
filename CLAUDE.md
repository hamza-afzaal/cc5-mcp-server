# CC4 MCP Bridge — project context (interim)

> Interim file written in Phase 1a. Phase 4 of `docs/cc4-bridge-kickoff-v2.md` replaces it with the full version (spike results, morph recipes, Unity export profile).

## What this is
An MCP server that drives **Character Creator 4.70** (embedded Python 3.8.8, PySide2) for the CraftXR character pipeline (stages S0–S3 of `docs/craftxr-character-pipeline-design.md`). It's a fork of the CC5 bridge by macka (mackatwentytsuru/cc5-mcp-server).

```
Claude ⇄ stdio ⇄ src/ (Node/TS) ⇄ HTTP 127.0.0.1:5101 ⇄ cc4-plugin/ (Python, inside CC4) ⇄ RLPy
```

## Where things are
- Plan and decisions: `docs/phase0-plan.md`. Build phases: `docs/cc4-bridge-kickoff-v2.md`.
- Plugin: `cc4-plugin/main.py` (entry; `initialize_plugin`), `server.py` (HTTP, queue, jobs, security), `cc4_api.py` (all RLPy code **and** the action registry).
- CC4 API reference: `docs/rlpy-api-reference.md`, generated from CC4's own `RLPy.py` with signatures. Verified runtime facts: `docs/probe1.json`, `docs/probe2.json`; spike results go to `docs/spikes.md`.
- Dev rules: `.claude/rules/cc4-dev.md`.

## Key facts
- RLPy calls run only on CC4's main thread (QTimer queue). Mutations go inside `BeginAction/EndAction`.
- Facial blendshapes aren't mesh morphs before export: use the facial profile and viseme components. Morph IDs are internal strings, so resolve them from display names.
- `GetMotionBones` and `RScene.SetHDSubdivisionLevel` don't exist in CC4. Use `GetSkinBones` and `RExportFbxSetting.SetExportLevel`.
- `ConvertTo` (ActorBUILD/LOD) is irreversible: only run it on a saved copy.
- Don't touch Unity from this repo. Ask the user for Unity-side status when needed.

## Commands
- `npm run build`, `npm test` (vitest), `npm run test:py` (offline bridge tests)
- Health: `curl -s http://127.0.0.1:5101/health`; API listing: `curl -s http://127.0.0.1:5101/api`
- Hot reload (only when CC4 was started with `CC4_DEV_MODE=1` and `CC4_RELOAD_SECRET`): `curl -X POST -H "Content-Type: application/json" -H "X-Reload-Token: $CC4_RELOAD_SECRET" -d "{}" http://127.0.0.1:5101/reload`

## Where files go
Everything stays under `D:\Business\Codert`: the repo, and `characters/` as the workspace (`<recipe id>/` folders plus `_testbench/`). The bridge refuses to write outside the workspace. Program Files holds only the plugin junction.

## Never commit
Exported FBX/JSON/textures or saved project copies.
