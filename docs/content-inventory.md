# Owned CC4 content: inventory

What's in `D:\Business\Reallusion\Reallusion Templates`, what we own, and what it's for. Updated 2026-10-01 (SkinGen, poses and motions downloads).

## Keeping this in sync

`docs/content-snapshot.json` records the library by folder: the file count by type, plus how many SkinGen presets in that folder have their textures installed.

- `python tools/content_scan.py` lists what changed since the snapshot.
- A **SessionStart hook** (`.claude/settings.json`) runs it at the start of every session and tells Claude when the library changed. It stays silent when nothing changed.
- When it reports changes: catalog them here (what they are, what they're for, what's usable), run `python tools/content_scan.py --write`, and commit both files.

## Ownership rule

Being in the template folder doesn't mean you own it. Some items are previews with a cloud badge; AC Fiona, for example, gave "DRM Missing" and "Buy Now". **Before an item is used or marked `verified` in `assets/allowlist.json`, apply or load it and run `check_export_license`.** "Exportable" is the gate.

## Shaping sliders (in the morph catalog; `search_morphs` / `set_morphs`)

Owned, checked 2026-09-30: one slider from each pack was applied to Camila, and `check_export_license` returned exportable.

| Pack | Sliders | Useful for |
|---|---|---|
| CC Embed Morphs (CC4 built-in) | 585 | Body Fat B, Abdomen Depth/Scale, Hip Love Handles, Upper Arm Scale, Neck Scale, jaw/chin, seated and arm correctives |
| **Essential Body Morphs** | 90 | Body Size, Voluptuous, Muffin Top, Potbelly 1/2, Stomach Down, Stomach Lower Depth, Waistline, Bust Weight/Size, Glutes, Thigh Tone, Pregnant |
| **Essential Head Morphs** | 169 | face proportions |
| **Headshot Morph 1000+** | 1,329 | Neck Double Chin, Chin Double, Cheek Jowls, jaw, face lower width, cheek fullness (309 embed + 1,020 pack) |
| **Ultimate Morphs** | 222 | Arm Fat, Leg Fat, Hand/Foot Fat, Abdomen Width, Armpit Width/Front/Back, Eye Bag Upper/Lower/Height/Curve (tiredness), eyelash shaping, body-type presets (female heavy/athletic/old/asian) |
| Human Anatomy (`Body/Head HA Female Heavy`, …) | per type | whole-body realistic types: Female Heavy, Athletic, Asian, Old; male equivalents |
| Wrinkle Essentials | 48 | expression wrinkles (check the Unity/Quest cost before using) |

Sliders load into the catalog by themselves once downloaded. The bridge caches the catalog per avatar, so a download made mid-session shows up after the next `load_item` of the base.

## Characters

- Bases (allowlisted): CC4 Camila, Kevin, Susan.
- Human Anatomy: `Actor/Character/Human Anatomy/` has Female Heavy, Female Athletic, Female Asian, Female Old, Baby and male types. They're reference bodies; the same shapes exist as sliders.
- ActorCore Crowd (Casual_F/M, Kid; `.iAvatar`) and Party characters: pre-made, for background characters.
- **Not owned:** AC Fiona 8K / AC Fiona makeup (skins included).

## Skin and make-up (SkinGen presets)

Applied with `load_item` (types `makeup` and `skin`), then `save_project_as` and `open_project` to leave SkinGen mode; see the CLAUDE.md traps. Fine layer editing (strength, placement) is still done by hand in the Appearance Editor.

- Skin bases: Default Female, Realistic Human Skin (Female Asian, Female Old), Female/Male Old full skins.

### Texture check (run before applying or allowlisting any preset)

A preset only stores paths to its textures (CC3-template-relative, installed here under `Others\Skin Textures\`). When one is missing, CC4 opens a "texture failed to load" dialog that waits for OK.

```bash
python tools/preset_refs.py "D:/Business/Reallusion/Reallusion Templates/Skin" --json ../characters/_testbench/preset_refs.json
```

It was calibrated on 2026-10-01: it flags the Human Anatomy brow preset that opened the dialog, and passes the five presets that applied cleanly.

### SkinGen library (downloaded 2026-10-01; 693 Skin + Makeup presets, 475 missing textures after the second download)

The second download (2026-10-01, afternoon) added more presets but **no texture images**: nothing new arrived in `Others\Skin Textures` or `Texture\SkinTextures`. The pack textures are still to find. Base presets still pass.

- **The base presets (folder roots) are complete.** All of `Skin/Skin Base`, `Body Hair` (incl. `Scalp`: Base Male, Basic_Light, Basic_Heavy, Hairline; `Beard`: 4), `Skin Details` (Skin Decal 10, Skin Noise 2, Coloration 5, Capillary 7, Roughness 2), `Blemish` (Mole, Acne, Suntan: 2 each), `Normal Effects` (Facial Wrinkle 2 + Facial Part 4, Body 2, Noise 3, Levels 13), `Acquired` (Dirt, Scar, Tattoo, Liquid, Scales), `Nails` 5, and every make-up root folder.
- **The add-on pack presets are mostly missing their textures:** 441 of 639 fail. The preset files arrived but the pack textures didn't (missing folders such as `SkinGen\4_Range\Wrinkle_*`, `SkinGen\1_Source\Muscle`, `MakeUp\4_Range\Eyelash|Eyeshadow|Eyeliner`, `MakeUp\1_Source\Eyebrow\Female`).
  - `Realistic Human Skin`: 0–2 per folder, apart from Scalp (Edge Smooth, Receding), Liquid 4/8, Acne 3/7, Manicure 6/18.
  - `Makeup & SFX`: 0 per folder, apart from Lip 20/28.
  - `Human Anatomy` brows: 0/11.
  - Ask the owner whether the packs have a separate texture/resource download before using any of them.
- Useful for patients: Scalp Hairline (bare parting under card hair), Skin Details Coloration/Capillary (redness, tired skin), Normal Effects Levels (face/body), Blemish Mole/Acne. **Fat Creases and Aged Wrinkle (Body) are pack presets with missing textures.**
- `Skin/SkinGen Tools/UV Transfer` (Daz G8.1/G9, `.ccSkinGenTool`): for importing Daz skins; not needed.
- Make-up (Makeup & SFX and others): Full Makeup (Cordial, Enchanting, Intellectual…), Foundation (foundation 5, contour 17, blush 7, highlight 17), Eye (eyeliner 27, eyeshadow 31+28), Lip (11 looks + 28), Eyebrow (36 + Human Anatomy 11), Eyelash (mascara and natural sets).
- SkinGen tools (Decal, Part, Specific: Lip, Eyeshadow, Eyebrow, Scar…).

## Motions, poses and props (2026-10-01)

These are for agenda A (deformation checks) and seated renders. The bridge can't apply motions or poses yet.

- `Animation/Motion/2.Human Female/Perform` (`.rlMotion`): **Sit Talk, Stand to Sit, Sit to Stand**, Stand Talk, Change Pose, Twirl Hair, Viewing Mirror, Catwalk, plus dances. The seated sequence for the doctor's office is now complete.
- `Animation/Motion Plus/Actor Group/Embed` (`.iMotionPlus`): female/male standing idles (Wait, Chest Wait, Hair, Mobile, Calling) and 2-person stands. Motion Plus may carry facial animation; check what CC4 exports.
- `Animation/Pose/Samples` (60 `.rlPose`): seated ones useful for clipping checks: **Sit Talk 5, Sit Call_1, Sit Text 2, Sitting Look On**, Sitting Shushing R. Also Stretch, Wave, Explain 2, Use Phone R, Carry Idle; the rest are action poses.
- `Accessory/Arm/Actor Group` (`.iAcc`): cup and phone held left or right (F/M). `Accessory/Arm/Samples`: 30 more.
- `Avatar Preset` (`.ccAvatarPreset`): body, head and full-body morph presets for CC4 Camila, Kevin and CC3+ Neutral F/M; Head Morph Skin (Human Anatomy, SkinGen, SkinGen Bonus Baby); Nail (PBR Manicure, SSS Natural, Realistic Human Skin).
- `Actor/Expression Wrinkles/Wrinkle Essentials/Realistic/4K` (`.rlWrinkle`): 4K expression wrinkles. Check the Quest cost before using.

## Hair

- Lite Hair Plus Female/Male Vol.1: 20 styles in the approved list (plain PBR card hair, cheap in VR).
- New: DorothyJean RealisticHairV3 `Short_Style_001.cchair`. Check its triangles, transparency layers and license before using it.

## Clothing

No new clothing was downloaded. The owned library is 129 `.ccCloth` + 27 `.ccShoes` items (see `Cloth/`). Casual women's options include Fit shirts, Layered sweater, Turtleneck sweater, Rolled sleeves shirt, Slim Jeans, Slim fit pants, Knee length skirt, Sport sneakers, and coats. **Run the license check on each before use.**
