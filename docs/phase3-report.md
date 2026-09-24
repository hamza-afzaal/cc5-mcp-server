# Phase 3 report: install, test, register

Date: 2026-09-23 · CC4 4.70.5323 · branch `cc4-port`

## Install

- `install-plugin.ps1` (run once as admin) links `…\Character Creator 4\Bin64\OpenPlugin\CC4_MCP_Bridge` → `cc5-mcp-server\cc4-plugin` as a directory **junction**. CC4 auto-loads the plugin through it; `diagnostics plugin_path` reports the junction path.
- All output stays in the workspace `D:\Business\Code\art\characters` (`<recipe id>\` or `_testbench\`). A save-as to the Desktop is refused (checked live and in the smoke test).

## Tests

| Suite | Result |
|---|---|
| vitest (`npm test`) | **431 passed**. Coverage: statements 97.7%, **branches 88.2%**, functions 97.6%, lines 99.2% (gate 80%) |
| Python bridge tests (`npm run test:py`, stub RLPy) | **28 passed**, including Python 3.8 syntax, security, jobs, workspace containment and the FloatPair regression |
| TS ↔ Python route agreement | every route the TS client calls is registered in `cc4_api.py` (part of vitest) |
| PowerShell smoke test (`scripts\smoke-test.ps1`, live CC4) | **58 PASS, 0 FAIL, 1 SKIP**. All 47 endpoints listed by `/api` exercised; `convert_lod` skipped because it needs a person to click OK |

## Registration

```
claude mcp add --scope user --transport stdio cc4 -- node D:\Business\Code\art\cc5-mcp-server\build\index.js
```
`claude mcp get cc4` → **Connected** (45 tools).

## End-to-end check in a fresh session

A separate headless Claude Code session (`claude -p`, started in `D:\Business\Code\art`, allowed only the `cc4` tools and `Read`) ran the kickoff steps on `cc4-recepies/recipes/sample-camila-01.json`. Transcripts: `characters\_testbench\e2e\`.

| Step | Result |
|---|---|
| 1. Apply sample recipe to a new avatar | ✓ 8 steps: set_character, clear_scene, load_base (catalog ready, 123 categories / 2,778 morphs), 3 morphs, 3 clothing items, eye color |
| 2. Capture three views | ✓ full / head / three-quarter in `characters\sample-camila-01\renders\` |
| 3. Save-as, then export LOD0 with ExportJson | ✓ `projects\sample-camila-01_e2e_run2_lod0.ccProject`; job started |
| 4. Poll until done | ✓ done in 6.6 s |
| 5. Counts vs design §4 | see below |

**LOD0 export** (`exports\sample-camila-01_e2e_run2_LOD0.fbx`, JSON sidecar present, textures capped at 2048):

| Metric | Value | LOD0 budget | |
|---|---|---|---|
| Triangles | 42,224 | ≤ 60,000 | ✓ |
| Material slots (≈ draw calls) | 19 | ≤ 8 | ✗ |
| Bones | 101 | CC standard | — |
| Blendshapes | 382 | SALSA visemes + emotes | — |
| Meshes / textures | 9 / 37 | — | — |

This export is the authored character **before** S2 optimization (no ActorBUILD, no clothing atlas). From the spikes: ActorBUILD brings triangles to ~29.7k, and `merge_materials` cuts unique materials and texture memory but **not** material slots, because meshes stay separate (spike 9). Getting to ≤ 8 slots needs mesh merging (Blender S4) or a revised budget: an M2 decision.

## Defect found and fixed during Phase 3

- **capture_views framed only the feet** in the first fresh-session run. CC4's camera presets frame the *selected* object, and after `apply_recipe` the last loaded item (the shoes) was selected. `capture_views` now selects the avatar first; the rerun confirmed head-to-feet framing in full and three-quarter views.
- `apply_recipe` now parses the recipe inside the handler, so schema defaults apply whoever calls it (found by a unit test).

## Open items for M2 (not bridge defects)

- Material slots 19 vs ≤ 8 (above).
- SALSA with `CC_Game_Body` after ActorBUILD; LOD1 has no facial blendshapes (spikes 3/6).
- Motion FBX contains a second, date-named animation stack (the scene timeline).
- T-shirt hem shows black patches in renders (clothing/underwear clipping); look-dev.
- The full-body view fills only ~12% of the 16:9 frame width; a portrait size (e.g. 720×1280) may suit Gate 1 better.
- ~~Allowlist licenses are all `verified: false` until confirmed.~~ **Resolved after this report (PR #2):** the owner confirmed commercial use, all entries are `verified: true`, and 20 purchased Lite Hair Plus styles were added.
