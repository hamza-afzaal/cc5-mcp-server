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
| Human Anatomy (`Body/Head HA Female Heavy`, …) | per type | **avoid on hero characters: they distort the eyelids (see blender-pipeline docs/body-proportions.md)**; whole-body realistic types: Female Heavy, Athletic, Asian, Old; male equivalents |
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

### SkinGen library: complete (2026-10-01 evening; 697 Skin + Makeup presets, 696 with all textures)

The owner installed the whole packs through CC4's Content Manager (Realistic Human Skin, Makeup & SFX, SkinGen resources, Human Anatomy). Earlier, the presets had been downloaded one by one, which leaves pack textures out (441 failed). The only remaining failure is one `Body Hair/Realistic Human Skin/Torso` preset (missing `SkinGen/4_Range/Hair/Body/Body`); we don't need it.

- **Base presets** (folder roots): all of Skin Base, Body Hair (Scalp: Base Male, Basic_Light, Basic_Heavy, Hairline), Skin Details, Blemish, Normal Effects, Acquired, Nails, and every make-up root.
- **Realistic Human Skin** (the fix for the "clean potato" look). These are textured, realistic skin layers:
  - Skin Base: Female Heavy, Female Athletic, Female Asian, Female African, Female Old, Baby, and male types. Full Skin: Female Heavy/Athletic/Old/Thin and male. `Skin/Overall/Realistic Human Skin` (`.ccSkin`): the same types as whole skins.
  - Skin Details: Coloration (Dull Skin Eye/Large/Chest…, **Obesity Pattern**, Uneven Face/Forehead/2 Colors), Roughness (Dry Full, **Oily T Part**, Oily Forehead, Oily Full), Face Decal F1–F4.
  - Normal Effects: **Fat Creases Fat F 1Light / 2Medium / 3Heavy**, Aged Wrinkle, Facial Wrinkle 01–10 (+ Facial Part), Muscle, Sinew, Vascular.
  - Blemish (Freckle, Mole, Acne, Suntan), Body Hair (Arm, Leg, Torso, Scalp variants), Nails/Manicure.
- **Makeup & SFX**: eyeliner, eyeshadow, brows (incl. Male, Trimmed), mascara, contour, highlight, lip, full looks (Daily, Party, Special, Warrior), misc (Camouflage, Scar, Tribe Paint). **Human Anatomy brows** are now complete.
- **Megan candidates** (BMI 28, tired, early 30s): Skin Base **Female Heavy** (texture source `BaseSkin/FatFemale01|02`), Coloration **Dull Skin Eye** (tired under-eyes) + Uneven Face, Roughness **Oily T Part**, Normal Effects **Fat F 2Medium** (belly and side creases), a light Face Decal F*.
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

## Media library (2026-10-01, evening)

This is CC4's general **Media** content (`Media/`), not SkinGen. It doesn't fix the missing skin textures.

- `Media/Material` (`.imtl`): PBR 61, SSS 32, Traditional 13. Material presets for props and clothing.
- `Media/Texture`:
  - PBR sets: bricks, ground, wood, stone, concrete, fabric (jeans, leather), wall, metal, roof, tiles.
  - Bump 42, Displacement 31, Opacity 33, Glow 43, Weight Map 28, Reflection 9, LUTs 30.
  - **HDRI 24**: Office Window, Light Room, Scan Room 1–3, Studio 01–04, Reading Room, … Useful as **render lighting for Gate 1 reviews** (an office-like light for a doctor's-office character).
- `Media/IES` 18 light profiles; `Media/Sound`, `Media/Video`, `Media/Substance`: not needed.
- `Cloth/Others`: +20 male underwear (`M_Underwear_A1…J2`). Not needed for Megan.
- Later the same evening:
  - `Media/Material Plus` (`.imtlplus`): ActorCore casual/party materials, Kevin ActorSCAN, DorothyJean ShortHair001, Turntable.
  - `Props` (`.iprop`): 3D blocks, light tools, physics and cloth templates, billboards.
  - `Media/iModel/Samples`, horse motions, water and image-layer videos.
  - Not needed for avatars. The light tools and blocks could stage review renders.

## Hair

- Lite Hair Plus Female/Male Vol.1: 20 styles in the approved list (plain PBR card hair, cheap in VR).
- New: DorothyJean RealisticHairV3 `Short_Style_001.cchair`. Check its triangles, transparency layers and license before using it.

## Clothing

No new clothing was downloaded. The owned library is 129 `.ccCloth` + 27 `.ccShoes` items (see `Cloth/`). Casual women's options include Fit shirts, Layered sweater, Turtleneck sweater, Rolled sleeves shirt, Slim Jeans, Slim fit pants, Knee length skirt, Sport sneakers, and coats. **Run the license check on each before use.**
