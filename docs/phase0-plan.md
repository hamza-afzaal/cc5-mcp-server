# Phase 0 — CC4 bridge porting plan

**Status:** for review. Nothing in the code has changed yet.
**Inputs read:** the whole repo (plugin `cc5-plugin/*.py`, the TS server `src/**`, tests, scripts, install/launch files, README/SETUP/CLAUDE.md, existing docs), `docs/cc4-bridge-kickoff-v2.md`, the design v0.3, the color & realism spec, `probe1.json`, and `probe2.json`.
**Extra evidence gathered:** CC4 4.70's SWIG wrapper `C:\Program Files\Reallusion\Character Creator 4\Bin64\RLPy.py` (23,245 lines) is on this machine. I checked signatures in it **statically**; CC4 was not running. "Static ✓" below means the symbol and signature exist in CC4's wrapper but haven't been called at runtime.

Legend for Phase 2 status: **verified** = proven at runtime on CC4 by probe 1/2 · **needs spike** = exists (probe or static ✓) but behavior is unproven · **manual-checklist fallback** = no Python path; becomes a human step.

---

## 0. Findings that change the plan

1. **CC4 exposes more than probe 2 found.** Statically present in CC4 4.70:
   - `RFileIO.SaveProject(path)`, `RFileIO.LoadProject(path)`, `RApplication.GetCurrentProjectPath()` → `save_project_as` and "reload the original" are plausible over Python.
   - `RFileIO.CheckExportFbxHasLicense(RIObjectPtr) -> bool` → spike 2's signature is already known; only its semantics are left.
   - `RIAvatar.ConvertTo(level, bBakeExpression=True, bBakeTexture=True, eReduceBonePose=Default) -> RStatus` → spikes 3/6 can start straight away.
   - `RIAvatarShapingComponent.GetShapingMorphMinMax(id) -> FloatPair` → clamping in `set_morphs` is possible.
   - `RICamera.SetCameraLocation(ECameraLocationType_{Face,Front,All,Focus,...})`, `RGlobal.GetRenderExportImageParameter()`, and `RIObject.GetBounds(max, center, min)` → `capture_views` building blocks.
   - **`RIMaterialComponent.MergeMaterialUV(meshNames, nTextureSize=256, eFormat=Bmp, nGutterSize=2)`**: a possible Python route to **material merging** that probe 2 missed. I've added it as spike 9.
   - A static search for `Decimat|GameBase|InstaLod|Optimiz|SingleMaterial` finds only the `InstaLodPreset` export flag and the read-only `EAvatarGeneration_CC_Game_Base_*` enums. So spikes 7/8 will very likely end as **manual-checklist** items; they still get a runtime check.
2. **The original repo has no `LICENSE` file**, although the README badge and `package.json` both say MIT. Phase 1a has to *add* one rather than keep it (see Q1).
3. **The dispatch table exists twice.** `server.py` `ACTION_MAP/ROUTES/REQUIRED_PARAMS` and `cc5_api._auto_patch_server()` hold two hand-synced copies of about 60 entries. Phase 1a will collapse them into one registry that the API module owns.
4. **Security holes beyond what the kickoff lists.** `DEV_MODE` defaults on, and:
   - the server checks neither `Origin` nor `Content-Type`, so any web page open in a browser on this PC can `POST /exec/python` with a `text/plain` body (a CSRF / DNS-rebinding style attack)
   - `/reload` is an unauthenticated **GET** when no secret is set
   - the TS `capture_viewport` has its own PowerShell full-screen screenshot fallback, separate from the Python one

   All of this goes away in 1a.
5. **The HTTP server is single-threaded** (`HTTPServer`, not `ThreadingHTTPServer`). One request waiting up to 30 s blocks `/health` and every other call. That has to change before `get_export_status` can answer "from the HTTP thread".
6. **Expression tools write keyframes.** `set_expression`/`reset_expression` call `AddExpressionKeys` at the current time, which leaves facial keys on the timeline that can end up in an FBX export. That conflicts with D4 (SALSA owns the face), so both tools are dropped.

---

## 1. Keep / modify / drop: every existing tool

56 MCP tools, 1 MCP resource, plus 9 bridge-only routes.

| Existing tool | Decision | Becomes / why |
|---|---|---|
| `check_cc5_connection` | **modify** | `check_connection`; also reports bridge version, dev-mode flag, CC version |
| `list_avatars` | drop | folded into `get_avatar_info` (list plus detail on the first avatar) |
| `get_avatar_info` | **modify** | adds facial profile type, skin bone count, material count (total and per mesh), avatar type/generation, subdiv level; active morphs returned by **display name** |
| `create_avatar` | drop as a tool | the base-loading step moves inside `apply_recipe` (`base.project_template` → allowlisted `.ccProject`/`.ccAvatar`). The CC5 neutral-avatar path doesn't exist in CC4. |
| `delete_avatar` | drop as a tool | kept as an internal helper of `apply_recipe` (clean scene before replay) |
| `describe_character` | drop | free-text summary; recipes replace it |
| `get_scene_objects` | drop | not needed for S0–S3 |
| `search_morphs` | **modify** | adds `limit=25`, `category?`, returns `{id, display_name, category, min, max}`, ranks display-name matches first |
| `adjust_morph` | drop | → `set_morphs` |
| `adjust_multiple_morphs` | **modify** | → `set_morphs([{display_name \| id, value}])`: resolve all entries first, fail loudly on any unknown, clamp via `GetShapingMorphMinMax`, one `BeginAction` |
| `get_morph_value` | drop | covered by `get_avatar_info` / `export_recipe` |
| `reset_morphs` | drop as a tool | internal to `apply_recipe` (zero all morphs before replay, so it's idempotent) |
| `apply_body_preset` | drop | hard-coded CC5 morph IDs; recipes replace presets |
| resource `cc5://morphs/catalog` | **modify** | `cc4://morphs/catalog` with display names (recipe authoring aid) |
| `list_clothes` / `list_hair` / `list_accessories` | **modify** | merged into `list_items`; each item annotated with its allowlist ID if matched |
| `remove_scene_item` | **modify** | → `remove_item(name)` |
| `browse_content` | drop as a tool | becomes a `diagnostics` query (`content_files`) to help you author `assets/allowlist.json` in S0 |
| `load_asset` | **modify** | → `load_item(path \| allowlist_id)`; refuses anything not in `assets/allowlist.json` or marked non-exportable |
| `set_eye_color` / `set_hair_color` | **modify** | → `set_color(target: "eyes"\|"hair", rgb)` |
| `set_lip_color` | drop | CC base has no lip material (fails by design); lip/clinical tint is runtime physiology (spec C) |
| `set_skin_color` | drop | a flat diffuse multiply on skin violates spec A3/C1; skin comes from an allowlisted SkinGen preset |
| `get_material_info` | drop as a tool | folded into `get_avatar_info` and `diagnostics` |
| `get/set_diffuse_color`, `get_material_properties`, `set_material_{opacity,glossiness,specular}`, `get/set_shader_parameter(s)` | drop | ad-hoc material edits aren't in the recipe schema and break reproducibility (D5). They could return later as recipe fields if M2 shows a need. |
| `get_camera_info`, `set_camera_focal_length`, `frame_camera` | drop as tools | folded into `capture_views` |
| `get_lights`, `get_light_info`, `set_light_{color,multiplier,active,shadow}`, `get_visual_settings`, `set_ambient`, `set_ibl` | drop | the CC4 viewport isn't ground truth (spec A1); Gate 1 renders use one fixed default lighting state |
| `get_expression_info` | drop as a tool | → `diagnostics` (`expression_slider_names`) and the facial inventory |
| `set_expression`, `reset_expression` | drop | they write facial keys (finding 6); SALSA owns the face |
| `set_item_visible` | drop | hidden-mesh handling is done at export (`RemoveHiddenMesh`) |
| `export_fbx` | **modify** | → `start_export_fbx` + `get_export_status` (job model, Unity preset + `ExportJson` forced) |
| `capture_viewport` | **modify** | → `capture_views`; RenderImage only, **no** screenshot fallback (Python *and* TS fallbacks removed) |
| `set_subdivision_level` | drop | Quest targets base mesh; `SetExportLevel(0)` at export. CC4 lacks `SetHDSubdivisionLevel`. |
| `undo` | keep | |
| `redo` | drop | not in the Phase 2 list |
| `exec_python` (+ `/exec/python`) | drop | replaced by `diagnostics` allowlist |
| `bake_skin_textures`, `export_head_metahuman` | drop | MetaHuman pipeline |
| `create_actor_mixer` | drop | ActorMIXER |
| bridge-only: `silent_install_filter / trigger_dialog / configure_and_click / finalize`, MH `get_export_status`, `get_mixer_status` | drop | Win32 `EnumWindows`/`SendInput` and Qt dialog automation |

Scripts: drop `scripts/cc5-restart.ps1` (SendKeys dialog automation), `copy_to_installed.ps1` and `grant_write_access.ps1` (hard-coded `macka` paths and ACL grants), `launch_cc5_for_test.ps1` (CC5 "AI Studio" chooser). Rewrite `install-plugin.ps1` and `start_bridge.py`. Replace `live_smoke_test.py` with the Phase 3 PowerShell smoke test. Delete `cc5-plugin/requirements.txt` (lists Flask, which isn't used).

Tests: of the 449 vitest cases, the ones covering dropped tools are deleted along with those tools. Phase 3 writes new cases for the new tool set.

---

## 2. CC5-specific assumptions in the code

| Where | Assumption | CC4 action |
|---|---|---|
| `install-plugin.ps1`, `start_bridge.py`, `cc5_api._get_cc5_root`, `main.py` docstring | `C:\Program Files\Reallusion\Character Creator 5\…\OpenPlugin\CC5_MCP_Bridge` | `Character Creator 4\Bin64\OpenPlugin\CC4_MCP_Bridge`; root from `RApplication.GetProgramPath()` (static ✓), env `CC4_ROOT` fallback |
| `install-plugin.ps1`, `claude-mcp-config.json`, `scripts/*` | hard-coded `C:\Users\macka\…` source paths | install script resolves its own directory (`$PSScriptRoot`) |
| `cc5_api.CC5_EXPORT_DIR` | default `D:\CC5Export` | `CC4_EXPORT_DIR`, default `%USERPROFILE%\CC4Export` |
| `main.py` | `rl_plugin_info = {"ap": "iClone", "ap_version": "8.0"}` | **unverified for CC4.** The probes ran via *Script > Load Python*, not as an auto-loaded plugin. Spike 0 checks auto-load; if it doesn't load, try `{"ap": "CC4", "ap_version": "4.0"}`. |
| `create_default_avatar` | `Program\CCBaseData\NeutralAvatar\RL_CC3_Plus.ccAvatar` | not used; recipe base is an allowlisted project/avatar file |
| `browse_content` | CC5.1 content model (`RContentManager` gone, `.cc*` extensions) | CC4 has `GetDefaultContentFolder/GetCustomContentFolder/GetContentFilesInFolder` and all referenced `EContentRootFolder_*` enums (static ✓) |
| `frame_camera` | `ECameraLocationType_*` + `SetCameraLocation` | present in CC4 (static ✓) |
| `capture_viewport` | `GetRenderExportImageParameter().kCommon.nOutputSize*` | getter exists in CC4 (static ✓); field names need spike 0 |
| `set_subdivision_level`, `export_fbx` fallback | `RScene.SetHDSubdivisionLevel` legacy path | removed (probe 1: absent) |
| `export_fbx` | `SetTextureSize(int)`; `RFps.Fps{n}`; `RRangePair` | `SetTextureSize(eSize)` takes the enum, whose values equal the pixel sizes (probe 2); `RFps.Fps30` and `RRangePair` exist (static ✓) |
| `export_head_metahuman` | `EFacialProfile_CC5MetaHuman`, Mesh-to-MetaHuman menu | dropped |
| ActorMIXER code | `RUi.GetMainWindow`, `IsTrialContentMode`, ActorMIXER PRO plugin | dropped |
| `set_skin/eye/hair` targets | CC5 material names (`Std_Eye_R`, …) | CC4 Camila has `CC_Base_Eye` with 4 materials (probe 2); exact names from `diagnostics` in spike 0 |
| CLAUDE.md, `.claude/rules/cc5-dev.md` | CC5 5.07+/5.1 notes, welcome/AI-Studio dialogs, 3-stage capture fallback | replaced (rules in 1a, CLAUDE.md in Phase 4) |
| `docs/rlpy-api-reference.md` | generated from **CC5**'s RLPy.py | regenerate offline from CC4's `RLPy.py` (no CC4 run needed) and replace |
| TS: `CC5Bridge`, `cc5://`, `CC5_*` env, `cc5-mcp-server` package/bin | naming | `CC4Bridge`, `cc4://`, `CC4_*`, `cc4-mcp-server`; `cc5-plugin/` → `cc4-plugin/`, `cc5_api.py` → `cc4_api.py` |

---

## 3. Python 3.8 runtime risks

Checks done: `ast.parse(feature_version=(3, 8))` passes for every `.py` in the repo. There are no runtime-evaluated `list[...]`/`dict[...]`/`X | Y`, no `removeprefix`, `match`, `zip(strict=)` or `functools.cache`. `server.py` and `cc5_api.py` already have `from __future__ import annotations`; `main.py` doesn't (harmless today, added in 1a). Syntax is fine. The real risks are at runtime:

1. **SWIG signature drift, CC5 → CC4.** For example `GetAccessories(bAll)`, `GetMeshNames(bAll)`, `AddDiffuseKey`, and camera/render parameter structs. A wrong argument type can segfault CC4, not just raise. *Mitigation:* every call in the new tool set is checked against CC4's `RLPy.py` docstrings before it's written, and exercised once in spike 0.
2. **The GIL during long SWIG calls.** SWIG releases the GIL only if the module was built with `-threads`. If `ExportFbxFile` (~10 s) or `ConvertTo` hold it, the HTTP thread freezes and `get_export_status` can't answer *during* an export, whatever the job table does. *Spike 0 measures this.* If the GIL is held, the TS side treats a status-poll timeout as `running` and keeps polling with backoff.
3. **Main-thread blocking and 30 s timeouts.** Today a long action outlives `_execute_sync`'s 30 s wait: the client gets a 504 while the action keeps running, and its result is dropped. The job model (start → `job_id`, then status) fixes that for export and `ConvertTo`.
4. **Modal dialogs.** `SaveProject`, `LoadProject`, `ConvertTo` and loading licensed content may open Qt modals that block the main thread. Per the kickoff, dialog automation is out. *Mitigation:* spikes record which calls open modals; those calls get a timeout that reports "manual action required in CC4" instead of hanging.
5. **Irreversible operations.** `ConvertTo` has no undo. The guard is bridge state: `convert_lod` refuses unless `save_project_as` succeeded in this process **and** `GetCurrentProjectPath()` equals that saved path.
6. **Qt/plugin lifecycle.** Timers must stay module globals (already true). `/reload` reloads only the API module; a change to `server.py` still needs a CC4 restart.
7. **Unicode paths.** RLPy takes `std::wstring`, and the Windows user profile path may contain non-ASCII characters. Test the export directory once.

---

## 4. Phase 2 tool list mapped to APIs

| Tool | CC4 APIs | Status |
|---|---|---|
| `check_connection` | bridge `/health`, `RApplication.GetProductVersion`-style info (probe 1 read version) | **verified** |
| `get_avatar_info` | `RScene.GetAvatars`, `GetAvatarType`/`GetGeneration` (probe 2), material counts (probe 2: 24), `GetFacialProfileComponent().GetProfileType()`, `GetSkeletonComponent().GetSkinBones()` | **verified** except profile-type value and bone count, which were never read → **needs spike 0** (read-only, trivial) |
| `diagnostics(query)` | fixed allowlist: `symbol_search`, `method_list(class)`, `facial_profile_type`, `viseme_names`, `expression_slider_names`, `skin_bone_count`, `materials_per_mesh`, `avatar_type`, `content_files(folder)`, `project_path`. Read-only `dir()`/getter calls only; no `eval`/`exec`. | **verified** (pure introspection) |
| `search_morphs` | `GetShapingMorphCatergoryNames/IDs/DisplayNames` (probe 1: 120 categories / 2,798 IDs); `GetShapingMorphMinMax` → FloatPair (static ✓) | **verified**; min/max unpacking → **needs spike 0** |
| `set_morphs` | `SetShapingMorphWeight` (probe 1 round-trip OK), `BeginAction/EndAction` | **verified**; undo grouping on CC4 → **needs spike 0** |
| `list_items` | `GetClothes/GetHairs/GetAccessories` (probe 2) | **verified** |
| `load_item` | `RFileIO.LoadFile` (probe 1 hasattr) + allowlist gate | **needs spike 0**: does loading a `.ccCloth`/`.ccHair` attach to the avatar, or does the avatar need to be selected first (`RScene.SelectObject`, static ✓)? |
| `remove_item` | `RScene.RemoveObject` (static ✓) | **needs spike 0** |
| `set_color` | `RIMaterialComponent.AddDiffuseKey` on eye/hair materials | **needs spike 0**: exact CC4 material names; whether diffuse tint reads correctly over the eye texture |
| `apply_recipe` / `export_recipe` | composite: base load → reset morphs → `set_morphs` → skin preset load → hair → clothes → colors; the reverse reads morph weights (display names) and item names, then maps them back via the allowlist | composite of the above; **needs spike 0** for skin-preset loading (SkinGen preset file type) |
| `save_project_as` | `RFileIO.SaveProject(path)`, `RApplication.GetCurrentProjectPath()` (static ✓) | **needs spike 3** (dialogs? does the current path switch to the copy?) |
| `convert_lod` | `avatar.ConvertTo(EConvertCharacterLevel_*, bakeExpression, bakeTexture, EReduceBonePose_*)` (static ✓) | **needs spikes 3 & 6** |
| `capture_views` | `SetCameraLocation(ECameraLocationType_Front/Face/All)`, `GetBounds`, `GetRenderExportImageParameter`/`SetRenderExportParameter`, `RenderImage` (probe 1) | full/head → **needs spike 0**. `three_quarter` has no preset, so it needs camera transform control → **needs spike 0**; fallback is `Front` + a fixed camera yaw |
| `start_export_fbx` | `RExportFbxSetting` + `ExportFbxFile(avatar, path, setting)` (probe 1: Unity preset, 9.8 s); flags `UnityPreset` + `ExportJson` + `RemoveHiddenMesh` + `RemoveTearLineAndOcclusion` (probe 2 values); `SetTextureSize`, `EnableExportMotion(False)` for mesh-only, `SetIncludeMotionPath` | export **verified**. `ExportJson` output and flag effects → **needs spike 5**; GIL → **needs spike 0** |
| `get_export_status` | bridge-internal thread-safe job table | **verified** by design (subject to the GIL finding) |
| `check_export_license` | `RFileIO.CheckExportFbxHasLicense(obj) -> bool` (static ✓) | **needs spike 2**; ships only if the spike succeeds |
| `undo` | `RGlobal.Undo` (probe 1) | **verified** |
| *(§11)* `get_inventory` | `list_items` joined against the allowlist | **verified** (composite) — see Q3 |
| *(§11)* `export_motions` | `RFileIO.LoadMotion`, `EnableExportMotion`, `SetExportMotionFps/Range` | **needs spike** — see Q3 |
| *(§11)* `merge_materials` | `MergeMaterialUV` (static ✓) or `InstaLodPreset` | **needs spikes 1 & 9**; otherwise **manual-checklist fallback** |
| *(S2)* Optimize & Decimate profile, Game Base single material | none found statically | expected **manual-checklist fallback** (spikes 7/8 confirm) |

---

## 5. Spike plan (Phase 1b)

**Ground rules**
- Every spike runs through the bridge's `diagnostics` endpoint or a dedicated **dev-only spike action**. Spike actions are removed after 1b and there is no arbitrary exec.
- Anything irreversible runs on a copy under `%USERPROFILE%\CC4Export\spikes\` via `SaveProject`.
- Results go to `docs/spikes.md`: one section per spike with the call, the raw result, timing, and a **decision** line.
- Exported FBX files stay out of git.

| # | Spike | Procedure | Measures / pass criteria | Decides |
|---|---|---|---|---|
| **0** | **Smoke batch** (new) | Confirm the plugin auto-loads on CC4 launch (`rl_plugin_info`). Then read `GetProfileType`, skin bone count, material names, and `GetShapingMorphMinMax` for 3 IDs. Round-trip `SaveProject` → `GetCurrentProjectPath`. Undo after a 3-morph batch. Load and remove one owned clothing item. Call `SetCameraLocation` ×3 + `RenderImage` at 1280×720. Ping `/health` every 250 ms during a 10 s export. | Every call returns without a crash; the undo reverts all 3 morphs; any modal dialogs noted; health pings answered / not answered during export | readiness of every "needs spike 0" row above; GIL strategy |
| 4 | Facial inventory | profile type, 15 visemes, expression categories → slider names for Camila | written to `docs/facial-inventory.json` | SALSA mapping, S2 pruning list (design Q1) |
| 2 | License check | `CheckExportFbxHasLicense` on the avatar and on each clothing/hair object; on a non-exportable item if you have one | a bool that differs between a Standard item and an iContent item | whether `check_export_license` ships, and S0 automation |
| 5 | Hidden overlays | Export Camila twice (baseline vs `RemoveHiddenMesh \| RemoveTearLineAndOcclusion`), both with `UnityPreset \| ExportJson`; count materials and triangles in each FBX with a small offline FBX reader (Python `fbx`-free ASCII/binary parse, or Blender headless if you prefer) | material Δ, triangle Δ, JSON present | default export flags |
| 1 | InstaLOD preset | **You** set InstaLOD *Merge Materials → by type* once in the export dialog. I export with and without `InstaLodPreset` and compare material counts. | count drops from ~24 toward ≤ 8 | whether material merge is automatable |
| 9 | `MergeMaterialUV` (new) | On a saved copy, call it on the clothing meshes only (not `CC_Base_Body`, to protect SALSA), 1024, PNG; then read material counts and export | fewer materials, textures written, blendshapes intact | a second route for `merge_materials` |
| 3 | LOD conversion | `save_project_as` copy → `ConvertTo(ActorBuild)` → time, meshes, materials, whether expression sliders survive → `LoadProject(original)` | original reloads unchanged | `convert_lod` workflow |
| 6 | ActorBUILD hero LOD0 | `ConvertTo(ActorBuild, True, bakeTexture=True/False, Default)` on two copies; export each | materials, texture sizes, triangles, visemes/expressions intact | whether ActorBUILD can be Quest LOD0 |
| 7 | Custom profile reuse | **You** save one *Custom* profile in Optimize & Decimate. I search symbols (`Profile`, `Decimate`, `GameBase`, `Custom`) and ConvertTo argument variants. | expected: no Python path | a one-time manual step per archetype |
| 8 | Game Base single material | Check that the UI still offers it; `diagnostics` symbol search. **Record only.** | expected: UI-only | recorded; not used in production |

**Order:** 0 → 4 → 2 → 5 → 1 → 9 → 3 → 6 → 7/8. The reads come first, then reversible exports, then the irreversible conversions on copies. You're needed at spike 0 (launch CC4 with Camila loaded, and have one iContent item handy if possible), at spike 1, and at spike 7.

**Not touched:** Unity. Nothing in Phases 0–3 needs it. When the spikes or the Phase 3 report need a Unity-side fact (such as CCiC import behavior), I'll ask you.

---

## 6. Phase 1a additions beyond the kickoff text

These close the Section 0 findings. They're flagged here so you can veto any of them.
- One action registry (removes the duplication in finding 3), hot-reloaded as a whole.
- `ThreadingHTTPServer`; a job table guarded by a lock for export and convert.
- Rejects any request carrying an `Origin` header; POST requires `Content-Type: application/json`; `/reload` becomes **POST**, is available only when `CC4_DEV_MODE=1`, and needs `X-Reload-Token == CC4_RELOAD_SECRET` (refused when the secret is empty).
- `CC4_EXPORT_DIR` defaults to `%USERPROFILE%\CC4Export`; bare filenames resolve there; exports outside it are refused unless the path is absolute and under the user profile.
- `assets/allowlist.json` schema and loader (S0), with an empty starter file. You fill in real items.
- Regenerate `docs/rlpy-api-reference.md` from CC4's `RLPy.py`.
- `.gitignore`: `*.fbx`, `*.ccProject` copies, export and spike directories.

## 7. Questions for you

1. **LICENSE.** The upstream repo has no LICENSE file. I plan to add MIT text with `Copyright (c) 2026 macka (github.com/mackatwentytsuru)` for the original work, add a line for your fork, and put a credit in the README. OK? Should I also check the upstream GitHub repo for the author's preferred name?
2. **Drop list.** Are you OK with removing all light, material-edit, shader, expression, and camera tools rather than keeping them behind a flag?
3. **§11 extras.** Should `get_inventory` (trivial) join the Phase 2 set? And `export_motions`: include it in Phase 2 after a small spike, or defer to M2?
4. **Rename depth.** Should I also rename the repo folder, package, and bin to `cc4-mcp-server` (the GitHub repo name stays under your control)?
