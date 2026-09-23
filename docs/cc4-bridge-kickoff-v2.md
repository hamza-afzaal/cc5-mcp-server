# Kickoff v2: CC4 MCP bridge for the CraftXR character pipeline

Paste this into Claude Code, opened in the forked `cc5-mcp-server` repo. It supersedes kickoff v1.

## Context: read these first

- `docs/craftxr-character-pipeline-design.md` (v0.3): the pipeline, budgets, gates, and recipe schema. This session builds stages **S0–S3** only.
- `docs/craftxr-character-color-realism-spec.md`: color and realism rules. They affect export flags and texture caps.
- `docs/probe1.json` and `docs/probe2.json`: verified API facts from CC4 on this machine.
- Skills available: `character-color-calibration`, `color-expert`.

Work in phases. Commit at the end of each phase. **Stop for my review after Phase 0, after Phase 2, and after Phase 3.**

## Verified environment

| Item | Value |
|---|---|
| Character Creator | 4.70.5323, embedded Python 3.8.8, PySide2. Plugins auto-load from `C:\Program Files\Reallusion\Character Creator 4\Bin64\OpenPlugin\` |
| Unity (downstream, not this session) | 6000.3.15f1 (Unity 6.3), URP 17.3.0, Quest 3, Meta XR All-in-One SDK, SALSA, CCiC Unity Tools |
| Test character | "Camila", StandardSeries, 11 meshes, **24 materials**, clothes (3) + hair (1) |

### Proven working in CC4

Shaping morphs (120 categories, 2,798 internal IDs; set and read back OK), materials, clothes/hair/accessory lists, Unity-preset FBX export via `RExportFbxSetting` (base character in about 10 s), `RenderImage`, and the HTTP thread → queue → QTimer main-thread pattern.

### Available in the Python API (probe 2; call signatures still to verify)

- **LOD conversion:** `avatar.ConvertTo(level, bakeExpression, bakeTexture, reduceBonePose)`, where level is `EConvertCharacterLevel_ActorBuild` / `_LOD1` / `_LOD2`. **Irreversible:** only ever run it on a saved copy.
- **Export options (`EExportFbxOptions_`):** `RemoveHiddenMesh` (32768), `RemoveTearLineAndOcclusion` (262144), `RemoveUnusedMorph` (65536; risky for SALSA, keep off by default), `EmbedTexture`, `AutoSkinRigidMesh`
- **Export options (`EExportFbxOptions2_`):** `UnityPreset` (33554432), `InstaLodPreset` (134217728; behavior unknown)
- **Export options (`EExportFbxOptions3_`):** `ExportJson` (1; **required** so CCiC Unity Tools gets its JSON)
- **`RExportFbxSetting` methods:** `SetTextureSize` (256–4096, one cap per export), `SetTextureFormat`, `EnableBakeDiffuseFromSkinColor`, `EnableBakeSubdivision`, `SetExportLevel`, `EnableBasicBindPose`, `EnableExportMotion`, `SetExportMotionFps/Range`, `SetIncludeMotionPath`
- **License check:** `RLPy.RFileIO_CheckExportFbxHasLicense` (signature unknown; S0 automation depends on it)
- **Facial:** `avatar.GetFacialProfileComponent()` → `GetProfileType()` (enum values: CC4Extended=2, CC4Standard=3, Traditional=4), `GetExpressionCategoryNames`, `GetExpressionSliderNames`; `avatar.GetVisemeComponent().GetVisemeNames()`; 15 viseme IDs (`EVisemeID_*`)
- **Other:** `GetPhysicsComponent`, `SetRenderSubdivMeshLevel`, `UpdateWrinkle`

### Known gaps and differences

- **InstaLOD** material merge, polygon reduction, and remeshing are **not exposed** to Python beyond the `InstaLodPreset` export flag.
- `RISkeletonComponent.GetMotionBones` **doesn't exist in CC4**; use `GetSkinBones`.
- `RScene.SetHDSubdivisionLevel` doesn't exist; use `RExportFbxSetting.SetExportLevel`.
- **Facial blendshapes aren't mesh morphs** before export (`GetMorphComponent` only returns hair morphs). Get the expression and viseme inventory from the facial profile and viseme components instead.
- **Morph IDs are internal strings.** Always resolve them from display names via `GetShapingMorphDisplayNames(category)`.

## Phase 0: Plan (stop for review)

Read the whole repo and all docs. Produce:
1. A keep / modify / drop table for every existing tool.
2. Every CC5-specific assumption in the code.
3. Python 3.8 runtime risks.
4. The Phase 2 tool list mapped to verified APIs, with each tool marked **verified / needs spike / manual-checklist fallback**.
5. The spike plan (Phase 1b).

## Phase 1a: Port and harden

- **Rename:** CC5 → CC4 everywhere (env vars `CC4_*`, plugin folder `CC4_MCP_Bridge`, install script, README).
- **Compatibility:** stay Python 3.8-compatible; keep `from __future__ import annotations`.
- **Remove:**
  - `execute_python` / `execute_rlpy` and the `/exec/*` endpoints
  - the Win32 `EnumWindows`/`SendInput` dialog automation and the PowerShell screenshot fallback
  - the MetaHuman and ActorMIXER tools
  - `SetHDSubdivisionLevel` and `GetMotionBones` calls
- **Add `diagnostics(query)`:** a *fixed allowlist* of read-only introspection queries (API symbol search, method lists, facial profile type, viseme names, expression slider names, skin bone count, material count per mesh, avatar type). This replaces arbitrary code execution during development.
- **Defaults:** `DEV_MODE` off. When dev mode is on, `/reload` requires `RELOAD_SECRET`. The export directory is configurable and defaults under my user profile.
- **Attribution:** keep the MIT LICENSE and credit the original author.
- **Manual step:** tell me exactly when to run the admin install script and launch CC4.

## Phase 1b: Spikes (run through the bridge, report results in `docs/spikes.md`)

1. **InstaLOD preset:** I'll configure *Merge Materials by type* once in CC4's export dialog. Export Camila via Python with and without `InstaLodPreset`, then compare material counts in the FBX. The result decides whether material merging is automatable.
2. **License check:** discover the call signature of `RFileIO_CheckExportFbxHasLicense`, then test it on an owned exportable item and on a non-exportable one if available.
3. **LOD conversion:** `save_project_as` → `ConvertTo(ActorBuild)` on the copy. Record time, resulting mesh and material counts, and whether facial expressions survive. Reload the original afterwards.
4. **Facial inventory:** profile type, viseme names, and expression category/slider names for Camila. Save them to `docs/facial-inventory.json`.
5. **Hidden overlays:** export with `RemoveHiddenMesh | RemoveTearLineAndOcclusion` and record material and triangle deltas.
6. **ActorBUILD game-ready parameters:** on saved copies, run `ConvertTo(ActorBuild, bakeExpression, bakeTexture, pose)` with `bakeTexture` both true and false. Record material count, texture sizes, triangle count, and whether facial expressions and visemes survive. Target: find out whether ActorBUILD can be the **hero LOD0** for Quest, since it keeps facial blendshapes.
7. **Custom profile reuse:** I'll save one *Custom* profile in Optimize & Decimate (clothing and hair reduction, texture size) through the UI. Check whether any Python path (ConvertTo arguments, diagnostics symbol search for "Profile", "Decimate", "GameBase", "Custom") can apply a saved profile. If none, record it as a one-time manual step per archetype.
8. **Game Base single material:** check whether CC4 4.70 still offers "Convert to Game Base → Single Material" in the UI and whether anything in RLPy reaches it. Record it only; don't use it on a production character yet (it merges the tongue into the body mesh, which may break SALSA OneClick binding).

## Phase 2: Tool set (stop for review)

| Tool | Notes |
|---|---|
| `check_connection`, `get_avatar_info` | Info includes facial profile type, skin bone count, material count |
| `diagnostics(query)` | Fixed allowlist only |
| `search_morphs(query, category?, limit=25)` | Matches display names; returns `{id, display_name, category, min, max}` |
| `set_morphs([{display_name or id, value}])` | Batch, clamped via `GetShapingMorphMinMax`, one undoable action. Unknown names fail loudly. |
| `list_items`, `load_item(path)`, `remove_item(name)` | Clothes, hair, accessories. `load_item` refuses paths not in `assets/allowlist.json`. |
| `set_color(target, rgb)` | Eyes, hair |
| `apply_recipe(recipe)`, `export_recipe()` | Recipe schema per design doc §6 |
| `save_project_as(path)` | Required before any irreversible operation |
| `convert_lod(level)` | Refuses to run unless the current project was saved-as in this session |
| `capture_views(presets=["full","head","three_quarter"], w=1280, h=720)` | Camera framed to the avatar's bounds |
| `start_export_fbx(path, lod_label, texture_size_cap, remove_hidden_mesh=true, remove_tearline_occlusion=true, mesh_only, include_motion_paths?)` | Always sets `UnityPreset` + `ExportJson`. Returns `job_id`. Uses `InstaLodPreset` only if spike 1 proved it useful. |
| `get_export_status(job_id)` | Answered from a thread-safe job table in the HTTP thread, not the main-thread queue |
| `check_export_license(item)` | Only if spike 2 succeeded |
| `undo` | |

## Phase 3: Install, test, register (stop for review)

- **Tests:** vitest for the TypeScript side, plus a PowerShell smoke test hitting every endpoint.
- **Register:** `claude mcp add --scope user --transport stdio cc4 -- node <abs path>\build\index.js`
- **End-to-end check in a fresh session:**
  1. Apply a sample recipe to a new avatar.
  2. Capture the three views.
  3. Save-as, then export LOD0 with `ExportJson`.
  4. Poll until done.
  5. Report material and triangle counts against design doc §4.

## Phase 4: `CLAUDE.md`

Include:
- the verified environment and API facts above, updated with spike results
- how to hot-reload
- the manual steps
- an empty **Morph recipes** section (display names per archetype)
- the working **export profile** for Unity
- a link to the design docs

Never commit exported assets.
