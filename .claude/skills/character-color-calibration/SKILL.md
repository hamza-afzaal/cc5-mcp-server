---
name: character-color-calibration
description: Color-accurate, clinically faithful rendering of CraftXR VR characters (CC4 → Unity URP → Quest 3). Use whenever work touches character skin, eyes, hair, teeth, or clothing color; texture sRGB/linear import flags; albedo values; OVRManager color gamut or Quest display color; skin tone coverage (Monk scale); or how clinical signs (pallor, cyanosis, jaundice, diaphoresis, erythema, bruising, mottling, moulage/blood) should look on different skin tones. Also use for "why does the character look plastic / pink / washed out / muddy in the headset", color QA and Gate 3 reviews, even if the user never says "color".
---

# Character Color Calibration

Keeps characters color-accurate from authoring to the Quest 3 display, and makes clinical signs look right on every skin tone. Pair with the general `color-expert` skill for perceptual color science (OKLab, CIEDE2000, contrast, CVD simulation). This skill adds the rendering chain and clinical specifics.

Full rules, tables, and rationale: `references/color-realism-spec.md`. Read Part A for pipeline/import work, Parts B–C for skin tone or clinical-sign work, and Part D for realism reviews.

## Non-negotiables

1. **Encoding.** Albedo, base color, and emissive are sRGB. Normal, roughness, metallic, AO, and masks are linear. Don't override CCiC Unity Tools' sRGB corrections.
2. **Albedo range.** Non-metal albedo stays within ~50–240 sRGB. That applies to the darkest skin tones and black hair too. Carry darkness with lighting and specular, not by crushing albedo.
3. **Gamut.** The app color space is set explicitly to match authoring. Never let sRGB content be reinterpreted as P3. A pink or oversaturated cast on skin is the first symptom.
4. **Display floor.** Quest's LCD can't separate output below ~13/255 sRGB. Shadow detail on dark skin, hair, and clothing must stay above it in the character lab.
5. **Review in headset only.** Screenshots, the Camera app, and MQDH captures never approve color.
6. **Clinical signs are physiology on region masks, never whole-body RGB tints.** Parameters: `perfusion`, `oxygenation`, `bilirubin`, `diaphoresis`, `flush`, `mottling`. Their strength is attenuated per region by pigmentation.
7. **Coverage.** Every presentation is validated on one light, one medium, and one dark Monk Skin Tone character before shipping.

## Workflows

### A. "Set up or validate a character's textures and materials"
1. Classify each texture by role and check its sRGB flag against rule 1.
2. Sample albedo luminance per material; report any value outside rule 2 with the material name.
3. Confirm no manual overrides on CCiC-generated metallic, roughness, or AO corrections.
4. Output: a table of material / texture / role / flag OK? / albedo range OK? / fix.

### B. "Make clinical sign X look right"
1. Read spec Part C3 for sign X on light versus dark skin, and where it appears first.
2. Map those sites to region masks (lips/circumoral, nail beds, palms/soles, sclera, conjunctiva, tongue/gums/mucosa, ears/nose, extremities).
3. Define parameter → per-region strength, including pigment attenuation.
4. Tune strength by *perceptual* delta (OKLab / CIEDE2000 via `color-expert`). Target: noticeable at ~1 m in the headset, not cartoonish.
5. Check the confounds: normal bluish lips in some darker-skinned archetypes, yellow garments near the face for jaundice, simultaneous contrast from saturated clothing.
6. Hand clinical validity to `healthcare-sim-designer`. This skill owns appearance, not diagnosis.
7. Output: a mask/parameter table, MST validation plan (e.g. MST 2 / 5 / 9), and a Gate 3 check items list.

### C. "Character looks wrong in the headset"
Diagnose in this order, since cheapest causes come first:
1. Calibration kit wrong too? Then it's global: gamut setting (rule 3) or lab lighting.
2. Kit fine, skin pink or oversaturated? Check the sRGB/P3 interpretation and albedo encoding flags.
3. Plastic or waxy? Uniform roughness, missing roughness variation, or specular too high.
4. Muddy dark areas? The display floor (rule 4): raise lighting or fix specular before touching albedo.
5. Dead eyes? Missing catchlight, pure-white sclera, or no lid shadow (spec Part D1).
6. Shimmer? Specular aliasing on skin, hair, or sweat (spec Part D8).

### D. "Gate 3 color review"
1. Check the calibration kit first: ColorChecker, 18% grey card, MST strip at the patient position.
2. Review the character at 0.5 m, 1.5 m, and kneeling eye level.
3. Step through each active clinical parameter from 0 to its scenario maximum.
4. Record pass/fail per spec Part D Tier 1 items. Screenshots are only for bug reports, never for sign-off.

## Boundaries

- Clinical correctness of a presentation belongs to `healthcare-sim-designer` and a clinical reviewer.
- Frame budgets and cut order belong to `vr-avatar-budgets`.
- Items tagged [M2] in the spec are unverified hypotheses. Say so when relying on them.
