# Phase 1b spike results (CC4 4.70.5323, Python 3.8.8)

Run through the live bridge on 2026-09-23. Test character: the **CC4 Camila template** (`D:/Business/Reallusion/Reallusion Templates/Actor/Character/CC4 Camila.ccAvatar`, underwear only, no hair). For spikes 5, 3 and 6 she also wore Basic T-shirts, Biker_Jeans and Canvas Shoes. Raw outputs are in `spikes-output/` (git-ignored); the scripts are in `tools/spikes/`. Triangle and material counts come from the exported FBX via `tools/fbx_stats.py`.

Status: **Phase 1b complete.** All spikes are done except spike 2, which is partial (deferred: no known iContent item to test with; confirm on the go).

---

## Spike 0: smoke batch

| Check | Result | Decision |
|---|---|---|
| Plugin auto-load with `rl_plugin_info = {"ap": "iClone", "ap_version": "8.0"}` | ✅ bridge up 8–20 s after launch | keep as is |
| Hot reload + token auth | ✅ wrong token gets 403 | — |
| `RFileIO.LoadFile` of a `.ccAvatar` | ✅ 4.4 s; replaces the default scene avatar | recipe base load |
| **Avatar loaded too soon after CC4 starts** | ❌ shaping catalog shows only 3 "Actor Parts" categories (180 IDs); the avatar's own sliders read 0 | Reloading the same avatar later gives **123 categories / 2,778 IDs** with correct values. `apply_recipe` must check catalog size after loading the base and reload if it's short. Whether opening the Modify › Morph tab matters is **still untested** (it was open during the successful reload). |
| `GetShapingMorphMinMax` | returns `FloatPair` with `.first/.second`; 0..1 for ~90% of sampled IDs, −1..1 for the rest | **Not enforced**: −0.5 on a "0..1" morph (Nose Width) was accepted and read back. `set_morphs` hard-clamps to [−1, 1] and **warns** outside the reported range instead of clamping. |
| ⚠️ **`FloatPair` iteration** | `__getitem__` is `index % 2` and never raises `IndexError`, so `list(pair)` never ends. It hung CC4 at 35 GB. | Fixed; rule added to `.claude/rules/cc4-dev.md`; regression test in `tests/bridge`. |
| Undo grouping | ✅ one `Undo` reverts a whole `BeginAction` batch of morphs | `set_morphs` = one undo step |
| `.ccCloth` / `.ccShoes` load, `RScene.RemoveObject` | ✅ 1.9 s load; remove works | `load_item` / `remove_item` |
| Hair content | Templates are **`.rlHair` / `.rlHairStyle`** (Smart Hair), not `.ccHair` | allowlist + `load_item` accept `.rlHair`. **Verified later (2026-09-23):** Lite Hair Plus styles load in ~1.6 s as 1 mesh / 1 material, and the scene name equals the file stem |
| `SetCameraLocation(Front/Face/All)` + `RenderImage` @ 1280×720 | ✅ well framed (fixes the ~10% framing seen in probe 1) | `capture_views` full = Front, head = Face; three_quarter still needs a camera transform |
| `SaveProject(path)` | ✅ 0.35 s, 119 MB `.ccProject`; **current project switches to the copy** | the `convert_lod` guard (current path == saved-as path) works |
| Export Unity + `ExportJson` as a job | ✅ 4–6.5 s; `.json` sidecar written next to the FBX | — |
| **GIL during export** | ✅ `/health` answered 22/22 pings (max 0.59 s); job status observed `running` | job polling works as designed |

## Spike 2: license check (partial; deferred)

`RFileIO.CheckExportFbxHasLicense(obj) -> bool` is callable on the avatar and on each clothing object. It returned `true` for Camila, Bra and Underwear_Bottoms. **Deferred:** no iContent item was known to test with. `check_export_license` ships labelled "only observed returning true", and the first non-exportable item met in S0 allowlist work completes this spike.

## Spike 3: ActorBUILD conversion (bakeExpression=True, bakeTexture=True, pose=Default)

- ⚠️ **`ConvertTo` opens two modal dialogs** ("Convert base will only override the body's skin weights…" and a clothing follow-up) and blocks the main thread until a human clicks OK. The kickoff rules out dialog automation, so **`convert_lod` is semi-automated**: the bridge starts it as a job and reports `waiting_for_user` until someone clicks OK in CC4.
- The same dialogs very likely appear for LOD1/LOD2 too (the user clicked through them during the batch run without tracking which conversion raised them). The reported time (760 s) includes waiting on the dialogs; the conversion itself is short (to re-measure).
- Result on the copy (clothed Camila):

| | Before | After ActorBUILD |
|---|---|---|
| Generation | 3 | 6 |
| Body mesh name | `CC_Base_Body` | **`CC_Game_Body`** (tongue → `CC_Game_Tongue`) |
| Scene meshes / materials | 12 / 24 | 10 / 20 (tearline and eye occlusion removed) |
| Skin bones | 102 | 102 |
| Facial profile, expression sliders, visemes | CC4Extended, 164, 16 | **unchanged** |
| FBX (Unity, hidden + tearline removed): triangles | 42,224 | **29,712** (body 18,942 → 6,922) |
| FBX material slots | 19 | 19 |
| FBX blendshapes | 382 | 375 (body keeps 152; tongue 48 → 41) |
| Skin textures | original | baked `Ga_Skin_*` at 2048² |

**Reading:** ActorBUILD is geometrically viable as **hero LOD0** (29.7k ≤ 60k) and keeps facial blendshapes, but it doesn't touch materials (19 vs ≤ 8), teeth (4.8k tris) or clothing. **Risk for D4:** SALSA's CC3 OneClick binds to `CC_Base_Body` by name, so check it against `CC_Game_Body` at M2.

## Spike 4: facial inventory ✅

`docs/facial-inventory.json`: profile **CC4Extended**, 15 visemes + None (Open, Explosive, Upper Dental, Tight O, Pucker, Wide, Affricate, Lips Parted, Tongue Up/Raised/Out/Narrow/Lower/Curl-U/Curl-D), 17 expression categories / 164 sliders. Answers design open question 1.

## Spike 5: hidden overlays ✅

Clothed Camila, Unity + JSON, mesh only:

| | Meshes | Triangles | Material slots | Blendshapes | Textures |
|---|---|---|---|---|---|
| Baseline | 12 | 54,334 | 24 | 592 | 46 |
| `RemoveHiddenMesh` + `RemoveTearLineAndOcclusion` | 9 | 42,224 | 19 | 382 | 37 |

Hidden body faces drop by 9,150 triangles, the fully covered Bra is dropped, underwear falls to 20 triangles, and tearline/occlusion (and their 210 blendshapes) are removed. **Decision:** both flags default **on** in `start_export_fbx`, as the kickoff proposed.

## Spike 9: `RIMaterialComponent.MergeMaterialUV` ✅ (works; limited effect on draw calls)

On a saved copy of clothed Camila: `MergeMaterialUV(["Basic_T_shirts", "Biker_Jeans", "Canvas_shoes"], 1024, Png, 2)` took 44 s and opened **no dialog**.

- The three clothing meshes now share **one material** (`3_meshes_Merge`) with a single 1024² atlas: diffuse, normal and opacity. In the scene each mesh lists the merged material three times; the FBX shows one slot per mesh (`__meshes_Merge`).
- FBX after hidden/tearline removal: 42,224 triangles, **19 material slots (unchanged)**, 17 unique materials (down from 19), 33 textures (down from 37).
- **Reading:** the merge is automatable and cuts materials and texture memory, but the meshes stay separate, so Unity still issues one draw call per mesh×material. **Design §4 "draw calls (materials) ≤ 8" needs mesh merging too** (InstaLOD, the kickoff's spike 1, or the Blender S4 stage). The body alone contributes 6 slots (head/body/arm/leg skin, nails, eyelash). Merging those means atlasing across the CCiC skin shader's per-region materials, which M2 should decide together with SALSA binding.
- Safe candidate for `merge_materials`: clothing + accessories (+ shoes), never `CC_Base_Body`/`CC_Game_Body` without an M2 check.

## Spike 6: ActorBUILD `bakeTexture` and LOD1/LOD2 ✅

Each run: saved copy of clothed Camila → `ConvertTo` → Unity export (JSON, hidden + tearline removed). Times include the human clicking OK on CC4's dialogs.

| Variant | Time | FBX meshes | Triangles | Material slots | Bones | Blendshapes | Textures |
|---|---|---|---|---|---|---|---|
| ActorBUILD, bakeTexture=True (spike 3) | (760 s incl. dialogs) | 9 | 29,712 | 19 | 101 | 375 | 37 (skin 2048²) |
| ActorBUILD, bakeTexture=**False** | 513 s incl. dialogs | 9 | 29,712 | 19 | 101 | 375 | 37 (skin **still** baked `Ga_Skin_*` 2048²) |
| **LOD1** | 99 s | **1** (`CC3_Base_Plus`, remeshed, clothing merged in) | **7,000** | **1** (`remesh_9_combined_Bake`) | 54 | **1** | 2 (1024² diffuse + normal) |
| **LOD2** | 91 s | **1** | **800** | **1** | 22 | **1** | 2 (512²) |

**Readings**
- `bakeTexture=False` made **no observable difference** for ActorBUILD (same counts, skin still baked to 2K). Treat the argument as a no-op for ActorBUILD.
- **LOD1 and LOD2 meet design §4** on triangles, materials and bones (LOD1 ≤ 25k / ≤ 5 / ≤ ~100; LOD2 ≤ 10k / ≤ 2). They're remeshed into one mesh with one baked atlas, which also solves draw calls for background characters.
- **But LOD1 exports no facial blendshapes** (1 shape), even though the scene still reports the CC4Extended profile with 160 sliders (presumably bone-driven). Design §4 wants "SALSA visemes only" on LOD1, so at M2 check whether SALSA can drive LOD1 through the jaw bone, or use ActorBUILD as LOD1.
- Proposed LOD chain for `convert_lod` / S2: **LOD0 = ActorBUILD** (+ hidden-mesh removal, + `MergeMaterialUV` on clothing), **LOD1/LOD2 = `ConvertTo(LOD1/LOD2)`**, each from its own saved copy of the authored base. Every `ConvertTo` needs a human OK in CC4.

## Spike 1: `EExportFbxOptions2_InstaLodPreset` ❌ (no effect from Python)

The user set InstaLOD **Merge Materials → by type** in CC4's Export FBX dialog and saved it. Exporting the clothed base project via `RExportFbxSetting` with and without `InstaLodPreset` (flags2 33554434 vs 167772162) gave **identical** FBX files: 9 meshes, 42,224 triangles, 19 material slots, 19 unique materials.

**Decision:** Python can't trigger InstaLOD material merging. `merge_materials` uses `MergeMaterialUV` (spike 9) for clothing/accessories; InstaLOD merge-by-type stays a **manual-checklist** step (export from the UI dialog) if M2 needs it.

## Spike 8: Game Base → Single Material ✅ (UI only; superseded by the decimation test below)

The user confirmed CC4 4.70 still offers **Convert to Game Base → Single Material** in the UI. The static RLPy search found no Python entry point (only read-only `EAvatarGeneration_CC_Game_Base_*` enums), and CC4 ships neutral Game Base avatars (`Program/CCBaseData/NeutralAvatar/RL_CharacterCreator_Base_Game_G1_One_UV.ccAvatar`, etc.).

*Original concern (kickoff):* that it merges the tongue into the body and breaks SALSA OneClick. **Measured in the decimation test below, that concern didn't hold:** the tongue stays a separate `CC_Game_Tongue` mesh with 41 blendshapes, the body keeps all 152, and the result is the decided hero route. The remaining SALSA check is binding to the renamed `CC_Game_Body` / `CC_Game_Tongue` meshes in Unity (M2); Ava already uses `CC_Game_Body` with SALSA.

## Spike 7: Optimize & Decimate "Custom" ✅ (UI only; templates can be saved)

**Correction (2026-09-23, decimation test):** the Custom dialog (*Custom LOD Settings*) **does** save reusable templates. Its Template dropdown lists Custom / Default / LOD 1 / LOD 2, and a **+** button saves the current settings as a named template. The dialog has four tabs:
- **Skeleton:** template, e.g. Standard (101); twist/share bones; which face bones to keep.
- **Mesh:** Polygon Reduction by *Optimization* (keeps meshes and materials; recommended / % / face count) or by *Remesher* (one mesh, one material).
- **Texture:** max size, optional bake, channels.
- **Facial.**

Python still has no route to it (`EConvertCharacterLevel` has no Custom). It stays a UI step per character, but the settings are reusable.

## Summary: what this means for Phase 2

| Pipeline step | Automation |
|---|---|
| Base load, morphs, clothing, colors, renders, save-as, export (+ JSON, texture cap, hidden/tearline removal) | **Automated** (verified) |
| Morph catalog readiness | Automated check: reload the base if the catalog shows only "Actor Parts" |
| ActorBUILD / LOD1 / LOD2 | **Semi-automated**: `convert_lod` job + a human clicks OK on two CC4 dialogs |
| Material merge (clothing/accessories) | **Automated** via `MergeMaterialUV` (reduces materials/textures, not draw calls) |
| InstaLOD merge-by-type, Custom decimation, Game Base single material | **Manual checklist** (UI only). Game Base Single Material is the hero route (decimation test) |
| License check | Callable; only ever observed returning `true` so far |

## Decimation test: Game Base vs Custom (2026-09-23, UI conversions, measured via the bridge)

The same character each time, rebuilt from `characters/_testbench/decimation-test/recipe.json`: Camila + morphs + purchased **Soft Waves Lob** hair + T-shirt, jeans and canvas shoes. Unity export profile (hidden mesh + tearline removed, JSON, 2048 cap). The user ran the conversions in CC4's UI on saved copies.

| | Baseline | **Convert to Game Base**: Single Material, separate eyelash, 2048 | **Custom**: Optimization 50%, Standard (101) skeleton, 2048, no bake |
|---|---|---|---|
| Triangles | 44,882 | **32,370** | 28,210 |
| Draw calls (material slots) | 20 | **17** (body 6 → 2) | 21 |
| Bones in FBX | 101 | **73** | 105 |
| Blendshapes | 408 | **401** (body 152, brows 180, tongue 41, hair 26, eyes 2) | **0** ❌ |
| Textures | 40 | 30 | 43 |
| Meshes | 10 | 10 | 11 (hidden-mesh removal no longer applied: Bra/underwear back) |
| Body mesh | `CC_Base_Body` 18,942 | `CC_Game_Body` 6,922 | `CC_Base_Body` 14,044 |
| Clothing / teeth / hair | unchanged | unchanged | all ~50% (shoes 3.3k, shirt 2.3k, jeans 2.3k, teeth 2.4k, hair 1.3k) |
| Face (scene) | CC4Extended, 164 sliders, 15 visemes | same | same in the scene, but **no blendshapes in the FBX** |
| Avatar type after | Standard | StandardSeries, generation 9 | **NonStandard (2)**, generation 10; clothes/hair become "accessories" |

**Readings**
- **Game Base (Single Material) is the best CC4-side hero option.** It gives −28% triangles and −3 draw calls, keeps every blendshape SALSA needs, and matches Ava's build (`CC_Game_Body` ~7–9k). The head render shows darker eye sockets (the eye occlusion looks baked in); check at Gate 1.
- **Custom Optimization at 50% is unusable for a hero:** the export has no blendshapes (so no SALSA), and the character turns NonStandard, which breaks item roles and hidden-mesh removal. **Confirmed cause:** the saved template (`%LOCALAPPDATA%\Reallusion\Character Creator\4.0\4.0\CCBasics\LODTemplates\craftxr-test.ini`) has `qtExpressionMorphCheckBox = false`, and CC4 **greys out "Expression Morphs" whenever Polygon Reduction is on**; it becomes clickable only with reduction off (checked in the UI). So Custom can either reduce polygons (face keeps only bone motion: eye/head rotation, jaw open) or keep expression morphs, never both. That fits background characters, not the hero.
- The decimated shirt no longer covers the bra (black patches on the chest): per-mesh decimation moves overlapping clothing surfaces independently.
- **Hero route decided (CC4 side): Convert to Game Base → Single Material**, then the Blender stage for clothing.
- **Neither route reduces clothing without harm.** Game Base leaves clothing alone, and Custom halves everything, face included. Per-item clothing decimation (shoes 6.7k, shirt/jeans 4.5k) and mesh merging for draw calls belong in the **Blender stage**.
- Draw calls stay 17–21 because every clothing/teeth/eye material is its own slot. For comparison, Unity-measured Ava is 17 draw calls / 51.8k triangles and is known OK at 72 FPS in the reference scene (Unity project baseline, 2026-09-23).
