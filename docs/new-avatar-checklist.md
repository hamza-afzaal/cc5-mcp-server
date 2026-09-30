# New avatar: end-to-end checklist

One page for taking a new character from brief to Unity and the web. The details are in the two `CLAUDE.md` files: this repo (CC4 side) and `..\blender-pipeline\CLAUDE.md` (S4). Kevin and Camila (2026-09-30) are the worked examples. `<id>` is the recipe id, lower-case with dashes (e.g. `susan`). It names the folder under `characters\` and every file.

**Who does what:** Claude does the steps unmarked. **[you]** marks a step you do yourself. **[OK]** marks a step Claude doesn't start until you say yes in chat. **[Unity]** marks work for the Unity agent, which Claude hands you as a paste-ready command.

## 1. Recipe (CC4 content, S1)

1. **[you]** Brief: role in the scene, gender, age, look, clothing.
2. Check that every part (base, hair, clothes, shoes, motion) is in `assets\allowlist.json` with `verified: true`.
   - **[you]** Anything new: confirm the Standard license before it goes on the list.
   - Garments that aren't CC4 content go through the garment-intake lane (as `.ccCloth`), never through S4.
3. Write `..\cc4-recepies\recipes\<id>.json` in the format of `kevin.json`. Morphs are matched by display name; record the verified names in the CLAUDE.md morph table.

## 2. CC4 (S2–S3)

4. **[you]** Start CC4 (dev mode if bridge code may change) and open an empty scene.
5. `set_character <id>` → `apply_recipe` → `capture_views`.
6. **[you] Gate 1:** approve the renders, or give feedback and repeat step 5.
7. `save_project_as <id>_gamebase` (an irreversible step follows, so work on a copy).
8. **[you]** In CC4: **Convert to Game Base** with Single Material, separate eyelash and 2048 textures. Then click OK on the dialogs and save as `<id>_gamebase_converted`.
   - This step stays manual: `ConvertTo` from Python gives 6 body materials.
9. `start_export_fbx` named `<id>`, with the defaults: Reset Bone Scale, the `format_directory` texture layout, and no `_LOD0` suffix.
   - Then `get_export_status` must show the counts and the budget check. Output goes to `characters\<id>\exports\`.
   - To re-export later without converting again, use `open_project <id>_gamebase_converted`.

## 3. Blender stage (S4)

10. Write `..\blender-pipeline\params\<id>.json` like `kevin.json`. It holds `character`, `input: exports/<id>.fbx`, the keep-list, `decimate: auto`, the `hero-conversation` profile and `unity_folder` (e.g. `Susan`).
11. Run `python tools\run_s4.py params\<id>.json`. It must show validate **PASS**; then review the clip report and the before/after sheets in `blender\renders\`.
    - Output: `blender\<id>.fbx` + `.json` + `.fbm\` + `textures\<id>\` for Unity, and `blender\web\<id>.fbx` (textures embedded) for the web.
    - A new garment type (skirt, jacket, tucked shirt) hasn't been through S4 yet, so expect one extra Unity review round.

## 4. Unity and web

12. Run `python tools\deliver_unity.py params\<id>.json`, a dry run. Show the plan (new / changed / kept / blendshape changes).
13. **[OK]** Then run `... --apply`, which copies and checks every file is byte-identical. The tool never deletes anything or touches `.meta` files. It refuses a blendshape change on an FBX that already has a SALSA prefab.
14. **[Unity]** Command for the Unity agent:
    - import per its `HANDOFF.md` §3 (label `CC4OpacityPack` first, then CCiC with Ava's settings, no hand fixes);
    - build the SALSA prefab (§3.4);
    - run the A/B at about 25 px/deg. **This is the acceptance test**, not Claude's renders;
    - add the addressable `avatar_<backendId>` and the catalog row.
15. **[you]** Upload `characters\<id>\blender\web\<id>.fbx` to the web.
16. **[you]** Do a headset look check.

## 5. Record

17. Commit and push `recipes\<id>.json` in `cc4-recepies`, and commit `params\<id>.json` in `blender-pipeline`. Never commit exports, projects, FBX files or textures.
