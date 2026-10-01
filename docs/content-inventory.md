# Owned CC4 content: inventory

What's in `D:\Business\Reallusion\Reallusion Templates`, what we own, and what it's for. Updated 2026-09-30, after the owner's big download.

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
- **Still empty:** `Skin/Skin Details`, `Skin/Blemish`, `Skin/Acquired`, `Skin/Normal Effects`. Pores, freckles, redness and tired layers come from these. If SkinGen Premium includes them, they aren't downloaded yet.
- Make-up (Makeup & SFX and others): Full Makeup (Cordial, Enchanting, Intellectual…), Foundation (foundation 5, contour 17, blush 7, highlight 17), Eye (eyeliner 27, eyeshadow 31+28), Lip (11 looks + 28), Eyebrow (36 + Human Anatomy 11), Eyelash (mascara and natural sets).
- SkinGen tools (Decal, Part, Specific: Lip, Eyeshadow, Eyebrow, Scar…).

## Hair

- Lite Hair Plus Female/Male Vol.1: 20 styles in the approved list (plain PBR card hair, cheap in VR).
- New: DorothyJean RealisticHairV3 `Short_Style_001.cchair`. Check its triangles, transparency layers and license before using it.

## Clothing

No new clothing was downloaded. The owned library is 129 `.ccCloth` + 27 `.ccShoes` items (see `Cloth/`). Casual women's options include Fit shirts, Layered sweater, Turtleneck sweater, Rolled sleeves shirt, Slim Jeans, Slim fit pants, Knee length skirt, Sport sneakers, and coats. **Run the license check on each before use.**
