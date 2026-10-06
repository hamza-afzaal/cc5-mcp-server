# New avatar: end-to-end checklist

One page for taking a new character from brief to Unity and the web. The details are in the two `CLAUDE.md` files:
this repo (CC4 side) and `..\blender-pipeline\CLAUDE.md` (S4).

**Worked example:** Megan (2026-10-01..05), with Kevin and Camila brought to the same standard on 2026-10-05. Follow
her route, not the older Kevin/Camila one.

`<id>` is the recipe id, lower-case with dashes (e.g. `susan`). It names the folder under `characters\` and every file.

**Tracking:** one Huly epic per avatar on CXRP. Tickets use the `huly-pm-coach` format; write-ups go in Huly
"Engineering Docs".

**Who does what:** Claude does the steps unmarked. **[you]** marks a step you do yourself. **[OK]** marks a step
Claude doesn't start until you say yes in chat. **[Unity]** marks work for the Unity agent, which Claude hands you as a
paste-ready message.

## 1. Recipe (CC4 content, S1)

1. **[you]** Brief: role in the scene, gender, age, body (BMI), look, clothing, posture.
2. Check that every part (base, hair, clothes, shoes, skin and make-up presets, motion) is in `assets\allowlist.json`
   with `verified: true`.
   - **[you]** Anything new: confirm the Standard license before it goes on the list. Run `check_export_license` too.
   - Garments that aren't CC4 content go through the garment-intake lane (as `.ccCloth`), never through S4.
   - Run `python tools\preset_refs.py <preset>` on new SkinGen and make-up presets; it lists missing textures.
3. Write `..\cc4-recepies\recipes\<id>.json` in the format of `megan.json`. Schema 0.2 covers `skin.layers`,
   `texture_colors`, `remove_base_items` (the underwear) and morph ids.
   - `apply_recipe` runs `fix_eye_element` after the morphs. When shaping by hand with `set_morphs`, call it after the
     last slider change; the Human Anatomy sliders otherwise leave an eyelid crescent.

## 2. CC4 (S2–S3)

4. **[you]** Start CC4 in dev mode (`scripts\start-cc4-dev.ps1`).
5. `set_character <id>` → `apply_recipe` → `capture_views` (include the `profile` view for chin, jaw and neck).
   - SkinGen and make-up leave CC4 in SkinGen mode; `apply_recipe` exits by saving and reopening a copy.
   - A second preset of the same kind is answered **Add** by silent mode.
   - `node tools\replay_check.mjs ..\cc4-recepies\recipes\<id>.json` must replay identically.
6. **[you] Gate 1:** approve the renders, or give feedback and repeat step 5.
7. `save_project_as <id>_gamebase` (an irreversible step follows, so work on a copy).
8. **[you]** In CC4: **Convert to Game Base** with Single Material, separate eyelash and 2048 textures. Then click OK
   on the dialogs and save as `<id>_gamebase_converted`.
   - This step stays manual: `ConvertTo` from Python gives 6 body materials.
9. `start_export_fbx` named `<id>`, with the defaults: Reset Bone Scale, the `format_directory` texture layout, and no
   `_LOD0` suffix.
   - Then `get_export_status` must show the counts and the budget check. Output goes to `characters\<id>\exports\`.
   - To re-export later without converting again, use `open_project <id>_gamebase_converted`.

## 3. Blender stage (S4)

10. Write `..\blender-pipeline\params\<id>.json` like `megan.json`:
    - `character`, `input: exports/<id>.fbx`, `decimate: auto`, the `hero-conversation` profile and `unity_folder`;
    - keep-list **`keep-lists/cc4-full-expressions.json`**: the brows keep every expression shape, which the face pose
      library needs;
    - `material_values`: `Roughness_Value` per cloth material (cotton 0.85, denim 0.8–0.9, knit 0.9, shoes 0.6–0.8).
      CCiC otherwise makes cloth look wet (smoothness 0.9);
    - `drop_meshes` for always-hidden underwear, if `remove_base_items` didn't already remove it;
    - `texture_edits` only for reviewed look fixes: `reduce_redness` (blush), `match_mean` (brow base),
      `flatten_highlights` (satin-looking painted highlights), `uv_fill` (opacity).
11. Run `python tools\run_s4.py params\<id>.json`. It must show validate **PASS**; then review the clip report and the
    before/after sheets in `blender\renders\`.
    - Output: `blender\<id>.fbx` + `.json` + `.fbm\` + `textures\<id>\` for Unity, and `blender\web\<id>.fbx`
      (textures embedded) for the web.
12. **Clothes in motion:** run `tools\cloth_check.py` on the S4 output with seated and standing clips, with
    `FBX_SKIN_MAX_INFLUENCES=2` (Quest).
    - New garments go into `GARMENT_ORDER`, outermost first.
    - If skin comes through a garment, add `skin_inset` with the garment plus margin / ramp / depth in cm (the
      T-shirt on Kevin/Camila used 2 / 2 / 3, Megan's sweater 4 / 3 / 1.5).
    - Rerun S4, then re-check with `--cover-from` pointing at the pre-inset FBX. `cloth_render.py` shows close-ups.
13. **Face library:** run `python tools\face_poses.py for-character`, then three paths in order:
    1. `..\characters\megan\face\megan_face_library.json`
    2. `..\characters\<id>\blender\reports\<id>_shapes.json`
    3. `..\characters\<id>\face\<id>_face_library.json`

    It must report `missing []`.

## 4. Animation (per-body fit)

14. In CC4, from `<id>_gamebase_converted`:
    - `export_motions` with stand talk, prefix `<id>`, gives `<id>_female_stand_talk_motion.fbx` (the clip template);
    - `start_export_fbx <id>_idle1_full.fbx` with `include_motion` idle 1 and **`remove_hidden_mesh: false`**. The fit
      body needs the skin under the clothes; without it every overlap reads 0 cm.
15. `python tools\spikes\library_v0.py --character <id>` (about 2 h): the 21 library clips, retargeted from Megan's
    source snapshot with a leg-scaled pelvis, fitted, loop-blended where Unity loops them, and trimmed.
    - Then `python tools\clip_manifest.py <unity dir> <Name> --base <Megan's manifest> --extra <run summary>`.
    - Standing clips should be within about 1 cm; seated clips at 5–6 cm are contact. Render anything worse with
      `cloth_render --body-only`.
    - Delivered clips have a clean frame 0 and end at the clip (`clip_trim`, which runs `fit_takes`). Unity reads the
      manifest's `playback` / `root`.

## 5. Unity and web

16. **Unity copies files itself (single writer).** Write a handoff note
    `docs\unity-handoff\CXRP-<n>-<topic>.md` covering the paths, what changed, the rollback and what to check on
    Quest, and give the owner a paste-ready message. Always deliver the FBX and JSON together.
    - `python tools\deliver_unity.py params\<id>.json` (dry run) still shows the plan and any blendshape change;
      `--apply` only after an explicit **[OK]**.
17. **[Unity]** Message for the Unity agent:
    - CCiC import, no hand fixes;
    - prefab: fresh SALSA OneClick, the CraftXR components, TwistDriver, skin quality, and the BlendShapeFollower
      (brows follow expressions);
    - a per-avatar stance override controller with the fitted clips (StandIdle = HumanIdleBreathing,
      StandTalk = chat_anim_1, SitIdle / SitTalk = SittingAva);
    - the addressable `avatar_<backendId>` and the catalog row;
    - a Quest check of the avatar, seated and standing. **This is the acceptance test**, not Claude's renders.
18. **[you]** Upload `characters\<id>\blender\web\<id>.fbx` to the web.
19. **[you]** Do a headset look check.

## 6. Record

20. Commit `recipes\<id>.json` in `cc4-recepies` and `params\<id>.json` in `blender-pipeline`. **[you]** Push: Claude's
    `git push` is blocked by the auto-mode check. Never commit exports, projects, FBX files or textures.
