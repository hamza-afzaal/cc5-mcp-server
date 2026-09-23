# CC4 MCP Bridge: project context

An MCP server that lets Claude drive **Character Creator 4.70** for the CraftXR character pipeline, stages S0–S3 of the design: allowlisted content → recipe authoring → optimization on saved copies → Unity FBX export for Quest 3. It's a fork of the CC5 bridge by macka (mackatwentytsuru/cc5-mcp-server), ported and hardened.

```
Claude ⇄ stdio ⇄ src/ (Node/TS MCP server) ⇄ HTTP 127.0.0.1:5101 ⇄ cc4-plugin/ (Python 3.8 inside CC4) ⇄ RLPy ⇄ CC4
```

**Design docs:** [pipeline design v0.3](docs/craftxr-character-pipeline-design.md) · [color & realism spec](docs/craftxr-character-color-realism-spec.md) · [kickoff v2](docs/cc4-bridge-kickoff-v2.md) · [Phase 0 plan + decisions](docs/phase0-plan.md) · [spike results](docs/spikes.md) · [Phase 3 report](docs/phase3-report.md) · [CC4 RLPy reference](docs/rlpy-api-reference.md) · [facial inventory](docs/facial-inventory.json)

## Where things live

Everything stays under `D:\Business\Code\art`:

| Path | What | In git |
|---|---|---|
| `cc5-mcp-server\` | this repo: bridge code, tests, docs, `assets\allowlist.json` | yes (`cc4-port` branch) |
| `cc4-recepies\` | recipes, `recipes\<id>.json` (git@github.com:CraftXR/cc4-recepies.git) | yes, small JSON only |
| `characters\<recipe id>\` | `recipe.applied.json`, `projects\`, `exports\`, `renders\`, `reports\` | **no** |
| `characters\_testbench\` | spikes (`phase1b-spikes\`), E2E transcripts, smoke tests, scratch | **no** |
| `C:\Program Files\…\Character Creator 4\Bin64\OpenPlugin\CC4_MCP_Bridge` | a **junction** to `cc4-plugin\`, nothing else | — |
| `D:\Business\Reallusion\Reallusion Templates\` | CC4's own content library (read-only for us) | — |

The bridge **refuses to write outside `characters\`** (`CC4_WORKSPACE`). Never write to the user profile, `%TEMP%` or Program Files. Don't touch Unity from here; ask the user for Unity-side status.

## Verified environment (spikes, 2026-09-23)

| Item | Value |
|---|---|
| Character Creator | 4.70.5323, embedded Python 3.8.8, PySide2 |
| Plugin loading | `rl_plugin_info = {"ap": "iClone", "ap_version": "8.0"}` + `initialize_plugin()` auto-load; bridge up 8–20 s after launch |
| Unity (downstream, not this repo) | 6000.3.15f1, URP 17.3.0, Quest 3, Meta XR SDK, SALSA, CCiC Unity Tools |
| Test character | CC4 Camila template: CC4Extended facial profile, 15 visemes (+None), 164 expression sliders / 17 categories, 102 skin bones (101 in FBX), 21 materials bare / 24 clothed |

### What works from Python (verified at runtime)

- Morphs: 123 categories / 2,778 IDs; set/read by ID; one `BeginAction` batch = one undo step.
- Content: `RFileIO.LoadFile` for `.ccAvatar` (replaces the scene avatar, ~4 s), `.ccCloth`/`.ccShoes` (~2 s); `RScene.RemoveObject`.
- `RFileIO.SaveProject(path)`: 0.35 s, ~119 MB, and the **current project switches to the copy** (the save-as guard relies on this). `LoadProject` works.
- Export: `ExportFbxFile(avatar, path, RExportFbxSetting)` 4–7 s; `ExportJson` writes the `.json` sidecar; `SetTextureSize` caps textures; `RemoveHiddenMesh` + `RemoveTearLineAndOcclusion` cut −22% triangles; `SetIncludeMotionPath` + `RemoveAllMesh` gives a motion-only FBX.
- Jobs: `/health` and job status stay responsive during exports (the GIL is not held).
- Renders: `SetCameraLocation(Front/Face)` + `RenderImage` at any size. Presets frame the **selected** object, so select the avatar first. The Preview Camera has no Transform control, so three-quarter views turn the avatar and restore it.
- `RIAvatar.ConvertTo(ActorBuild | LOD1 | LOD2, bakeExpression, bakeTexture, pose)` works on copies, but **shows two modal OK dialogs** (semi-automatic). `bakeTexture=False` has no observable effect.
- `RIMaterialComponent.MergeMaterialUV(meshes, size, Png, 2)`: shared atlas, no dialog, ~40 s; reduces materials, not draw calls.
- `RFileIO.CheckExportFbxHasLicense(obj) -> bool`: callable; only ever seen returning `true`.

### Traps (each one bit us)

- **Never iterate SWIG `FloatPair`** (e.g. `GetShapingMorphMinMax`): `__getitem__` never raises `IndexError`, so `list(pair)` hangs CC4 (it reached 35 GB). Use `.first/.second`.
- **Morph catalog not ready:** an avatar loaded right after CC4 starts shows only 3 "Actor Parts" categories and its sliders read 0. Reload the avatar (`apply_recipe` does this automatically).
- `GetShapingMorphMinMax` is only the UI default range and **isn't enforced**; it also differed between sessions. Clamp to ±1 and warn instead.
- ActorBUILD renames `CC_Base_Body` → `CC_Game_Body` (SALSA OneClick binds by mesh name). LOD1/LOD2 are remeshed into one mesh with **no facial blendshapes**.
- `GetMotionBones` and `RScene.SetHDSubdivisionLevel` don't exist in CC4. Facial blendshapes aren't mesh morphs before export; use the facial profile/viseme components.
- The `InstaLodPreset` export flag does nothing from Python.
- A SWIG call with a wrong argument type can crash CC4. Check signatures in CC4's `RLPy.py` / `docs/rlpy-api-reference.md` first.

### UI-only (manual checklist steps)

InstaLOD *Merge Materials by type* (export dialog) · Optimize & Decimate **Custom** (no saved profiles; per conversion) · Convert to Game Base → Single Material (don't use on production; merges the tongue) · clicking OK on `ConvertTo` dialogs.

## Tools (45) and the S1–S3 flow

`apply_recipe` → `capture_views` (Gate 1) → `save_project_as` → optional `convert_lod` / `merge_materials` → `start_export_fbx` (+ `lod_label`) → `get_export_status` (FBX counts + design §4 budget check) → `export_motions`. Plus `search_morphs`, `set_morphs`, `list_items`, `get_inventory`, `load_item` (allowlisted only), `remove_item`, `set_color`, `set_character`, `export_recipe`, `check_export_license`, `diagnostics` (read-only allowlist), `undo`/`redo`, and the kept look-dev tools (lights, camera, materials/shader, expression info). There's no code-execution tool.

## Unity export profile (working)

`start_export_fbx` sets this; it matches what `get_export_status` validated.

| Setting | Value |
|---|---|
| Preset | `EExportFbxOptions2_UnityPreset \| YUp` (flags2 = 33554434) |
| Options | `AutoSkinRigidMesh \| TPoseOnMotionFirstFrame \| RemoveHiddenMesh \| RemoveTearLineAndOcclusion` (flags = 295176) |
| JSON sidecar | `EExportFbxOptions3_ExportJson` (flags3 = 1), required by CCiC Unity Tools |
| Subdivision | `SetExportLevel(0)` (base mesh) |
| Motion | `EnableExportMotion(false)` for LOD meshes ("mesh only") |
| Texture cap | 2048 LOD0 · 1024 LOD1 · 512 LOD2 (`SetTextureSize`) |
| Not used | `EmbedTexture`, `InstaLodPreset` (no effect), `RemoveUnusedMorph` (risky for SALSA) |
| Motion clips | separate FBX per clip: `SetIncludeMotionPath(clip)` + `RemoveAllMesh`, 30 fps (`export_motions`) |

Measured on clothed Camila: authored LOD0 42.2k tris / 19 material slots; ActorBUILD 29.7k / 19; LOD1 7.0k / 1 (54 bones); LOD2 800 / 1 (22 bones). Material slots vs the ≤ 8 LOD0 budget is open for M2.

## Morph recipes

Verified display names per archetype, filled in during M1/M2 from real CC4 data. Morphs are matched by **display name** (plus `category` if ambiguous); an unknown name fails the whole `set_morphs` batch.

| Archetype | Display names (value range used) | Notes |
|---|---|---|
| older adult (M) | | |
| older adult (F) | | |
| middle-aged adult (M) | | |
| middle-aged adult (F) | | |
| young adult | | |
| bystander template | | |

## Manual steps

1. **Install / repair the plugin link** (Administrator PowerShell, CC4 closed): `powershell -ExecutionPolicy Bypass -File install-plugin.ps1` (`-Uninstall` removes the junction only).
2. **Launch CC4.** For hot reload, launch it with `CC4_DEV_MODE=1` and `CC4_RELOAD_SECRET=<secret>` in its environment. Plain launches run with dev mode off.
3. **Click OK** on CC4's two dialogs whenever `convert_lod` runs, then poll `get_export_status`.
4. **Allowlist upkeep:** add owned Standard-license items to `assets/allowlist.json` (type, path, license, `exportable`, `scene_names`) and set `verified: true` once the license is confirmed. Hair templates are `.rlHair`.
5. **Unity side (M2):** CCiC import, SALSA OneClick, validator. Ask the user; nothing in this repo touches Unity.

## Development

- Build/test: `npm run build` · `npm test` (vitest, coverage gate 80%) · `npm run test:py` (offline bridge tests with stub RLPy; checks Python 3.8 syntax).
- Live checks (CC4 running): `powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1` (every endpoint) · `node tools\replay_check.mjs ..\cc4-recepies\recipes\<id>.json` (recipe replays identically) · `node tools\mcp_call.mjs <tool> '<json>'` (call tools through a real MCP client) · `python tools\fbx_stats.py <file.fbx>`.
- **Hot reload** (`cc4_api.py` only, dev mode): `curl -X POST -H "Content-Type: application/json" -H "X-Reload-Token: %CC4_RELOAD_SECRET%" -d "{}" http://127.0.0.1:5101/reload`. Changes to `server.py`, `main.py` or `bridge_state.py` need a CC4 restart; the junction means no reinstall.
- Health: `curl -s http://127.0.0.1:5101/health`; routes: `curl -s http://127.0.0.1:5101/api`.
- Adding an action: see `.claude/rules/cc4-dev.md` (registry in `cc4_api.py`, TS client → tool → tests; the route-agreement test catches drift).
- Registered with Claude Code as `cc4` (user scope): `claude mcp add --scope user --transport stdio cc4 -- node D:\Business\Code\art\cc5-mcp-server\build\index.js`.

## Never commit

Exported FBX/JSON/textures, `.ccProject` copies, renders, or anything from `characters\`. Recipes go to `cc4-recepies`, not this repo.
