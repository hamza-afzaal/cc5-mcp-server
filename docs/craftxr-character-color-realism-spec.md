# Character Color & Realism Spec

**Companion to:** `craftxr-character-pipeline-design.md` (v0.3)
**Scope:** how characters stay color-accurate from CC4 to the Quest 3 display, how clinical signs look correct on every skin tone, and the small realism details that separate a believable patient from a mannequin.

Items tagged **[M2]** are hypotheses to verify on device during the golden-path milestone. Everything else is a working rule.

---

## Part A: Color management chain

Color accuracy is a chain; one wrong link (a texture flag, a gamut setting, a crushed shadow) breaks it. Each stage below says what owns it and how it's checked.

| # | Stage | Rule | Checked by |
|---|---|---|---|
| A1 | **Authoring** | Look-dev only on a calibrated monitor. CC4's viewport is a preview, not ground truth. | Monitor calibration log |
| A2 | **Texture encoding** | Albedo, base color, and emissive are sRGB-encoded. Normal, roughness, metallic, AO, and masks are linear (sRGB off). CCiC Unity Tools applies sRGB correction for metallic, roughness, and AO; never override it by hand. | `AvatarBudgetValidator` checks import flags per texture role |
| A3 | **Albedo plausibility** | Non-metal albedo lives roughly between **~50 and ~240 sRGB**. Coal is around 59 and fresh snow around 236. Nothing on a character is darker than coal or brighter than snow, including the darkest skin tones and black hair. | Validator samples albedo luminance per material and flags outliers |
| A4 | **Unity rendering** | Linear color space, URP, no post-processing on characters. There's no tonemapper to rescue clipped highlights, so light intensities in the character lab must keep skin highlights unclipped. | Character lab lighting preset |
| A5 | **Output gamut** | Explicitly set the app's color space to match what the assets were authored in. Meta's rule: don't reinterpret sRGB content as P3, which oversaturates and clips. CC textures are sRGB-authored. **[M2]** A/B test `OVRManager → Color Gamut` settings in headset against the calibration kit (A8), then lock the winner. A known symptom of a mismatch is a reddish-pink, oversaturated cast, which shows on skin first. | Gate 3 color check |
| A6 | **Display limits** | Quest headsets are LCD. They can't meaningfully separate output values below about **13/255 sRGB** (0.0015 linear), and 100% white is about 100 nits. Shadow detail on dark skin, black hair, and dark clothing must stay above that floor under the lab lighting, or it turns to mud in the headset. | Gate 3 on MST 9–10 characters |
| A7 | **Review medium** | Color sign-off happens only inside the headset. The Camera app and MQDH captures are composed as sRGB, and mirrored outputs may not be color-accurate, so screenshots can't approve color. | Gate 3 procedure |
| A8 | **Calibration kit** | The character lab has, at the patient position and under the same light-probe setup: a virtual 24-patch ColorChecker (published reference values), an 18% grey card, and a 10-swatch Monk Skin Tone strip. Every Gate 3 review starts by checking the kit before the character. | Gate 3 checklist, step 1 |

## Part B: Skin tone coverage

- **Use the Monk Skin Tone (MST) scale** for coverage and QA, not Fitzpatrick. Fitzpatrick was built to predict skin-cancer risk in lighter-skinned people, and an IEEE study found it poorly predicts skin tone and under-represents darker shades. MST is an open 10-shade scale.
- **Coverage rule:** the archetype library spans light (MST 1–3), medium (4–6), and dark (7–10) groups.
- **Presentation rule:** every clinical presentation is validated on at least three characters, one per group (e.g. MST 2, 5, 9), before it ships in a scenario.
- **MST swatches are appearance references, not albedo values.** Match a character's *rendered* skin under the lab lighting to the swatch strip. Don't paste swatch hex values into albedo textures (A3 still applies).
- **Dark skin carries its form through specular and sheen**, not just diffuse shading. If a dark-skinned character looks flat, fix roughness and specular before brightening albedo.

## Part C: Clinical color as physiology, not RGB tints

### C1. Principle

Skin color comes from chromophores: melanin, blood concentration and oxygenation, bilirubin, carotene, and epidermal thickness. Lips, for example, look different because the epidermis is thinner and blood concentration higher.

So **clinical signs are modelled as physiological parameters applied to region masks**, never as a flat whole-body color multiply. A whole-body blue tint is wrong on every skin tone and dangerously wrong on dark skin, where the real signs show up elsewhere.

### C2. Runtime parameters (driven by the sim state graph)

| Parameter | Range | Drives |
|---|---|---|
| `perfusion` | 0 (shock) → 1 (normal) | Pallor: loss of red-pink blood tone |
| `oxygenation` | 0 → 1 | Cyanosis: shift toward deoxygenated blood tone |
| `bilirubin` | 0 → 1 | Jaundice: yellowing, sclera first |
| `diaphoresis` | 0 → 1 | Sweat: roughness down, specular up, droplet normal detail |
| `flush` | 0 → 1 | Erythema or flushing |
| `mottling` | 0 → 1 | Livedo-pattern mask on knees and extremities |

- **Region masks:** lips and circumoral area, nail beds, palms and soles, sclera, conjunctiva (inner lower lid), tongue, gums and buccal mucosa, ears and nose tip, and knees and extremities. They map to CC4 material slots (nails, eye/sclera, teeth/tongue) plus painted masks on the head and body skin UVs.
- **[M2]** CC3+ base characters share topology and UVs, so masks authored once should carry across the whole library. Verify on two different archetypes.
- **Pigment attenuation:** each region's effect strength depends on that region's pigmentation. The same `oxygenation = 0.4` reads as blue lips on MST 2 but as grey circumoral skin and a grey buccal mucosa on MST 9.
- **Transitions are gradual** (seconds to minutes, per the scenario), never instant snaps.

### C3. Appearance reference across skin tones

This table is for the **rendering target** and was compiled from clinical nursing and physiotherapy education sources. Clinical validity is owned by the `healthcare-sim-designer` skill and a clinical reviewer.

| Sign | Lighter skin | Darker skin | Where to look first (all tones) |
|---|---|---|---|
| **Pallor** | Pale skin and nail beds | Ashen or grey; can look yellowish in brown skin. Palms and soles may still look pale. | Conjunctiva, oral mucosa, nail beds |
| **Cyanosis** | Bluish lips and nail beds | Grey or whitish around the mouth; grey buccal mucosa; bluish conjunctiva or palms; maroon-tinged nail beds | Lips/circumoral, mucosa, conjunctiva, nail beds |
| **Jaundice** | Yellow skin, sclera, mucous membranes | Much less evident on skin; visible in sclera and oral mucosa | Sclera, hard palate, palms |
| **Inflammation / erythema** | Red | Darker than surrounding skin, or purplish ("eggplant"), not red | Compare with contralateral side |
| **Bruising** | Red-blue to purple | Dark purple or black | n/a |

Rendering traps from the same sources:
- **Normal variant:** some darker-skinned people, particularly of Mediterranean descent, normally have bluish lips and mucous membranes. Bluish lips alone must not be the only cyanosis cue on those archetypes.
- **Clothing confound:** yellow clothing interferes with jaundice assessment. **Wardrobe rule:** no yellow or yellow-green garments at the neckline for jaundice-capable archetypes.
- **Blanching:** dark skin rarely shows a visible blanch response, so capillary-refill cues on dark skin should use nail beds.

### C4. Perception rules (where color theory earns its keep)

- **Simultaneous contrast:** surrounding colors shift perceived skin hue. Saturated clothing, bedding, or a saturated environment next to the face will push perceived skin toward the complementary hue. Keep near-face wardrobe desaturated unless the scenario calls for otherwise.
- **Color cast from bounce:** under light probes, a strongly colored garment tints the face's ambient. Validate presentations in the character lab *and* in the target environment (environment contract).
- **Measure deltas perceptually:** when tuning how strong a sign looks, measure the change between normal and presenting states in a perceptual space (OKLab / CIEDE2000) rather than RGB distance. The goal is "just noticeable at 1 m in the headset", not "technically changed".
- **Color vision deficiency:** some learners have color vision deficiency. Real patients don't compensate for that, so render faithfully, but assessment design must never rely on color alone (pair with SpO₂, cap refill, and patient report). Flag this to `healthcare-sim-designer`.

## Part D: Realism quirks catalogue

Each quirk is a small, cheap detail. **Tier 1** items go into the M2 golden path; **Tier 2** items come later.

### D1. Eyes (Tier 1)

- **Sclera:** never pure white. Slightly warm, faint vessels, darker toward the corners.
- **Catchlight:** a specular highlight on the cornea, since eyes without one look dead. If light probes don't produce one, add a small catchlight via the eye shader or a local reflection probe.
- **Lid shadow and wet line:** eye-occlusion shadow at the lid line and a subtle wet line. Baked if the overlay meshes are removed for budget (design §4).
- **Motion:** blinks, micro-saccades, and gaze toward the learner's head, with the eyes leading and the head following with a delay. Configure via SALSA Eyes.
- **Pupils as a clinical parameter:** `pupil_size_L/R` plus a constriction response when the learner shines a penlight. Paramedics assess pupils (e.g. for equal and reactive), so this is realism *and* assessable behavior.

### D2. Mouth (Tier 1)

- **Teeth:** off-white with variation, never pure white.
- **Interior depth:** the inner mouth darkens with depth (mouth-occlusion gradient) so open-mouth lip-sync doesn't show a lit cavity.
- **Assessment regions:** tongue, gums, and mucosa use the Part C masks, so a learner checking the mouth sees the sign.

### D3. Skin surface (Tier 1)

- **Roughness variation:** the T-zone is shinier, cheeks rougher. Uniform roughness looks plastic.
- **Diaphoresis:** a dynamic roughness, specular, and droplet-normal change driven by `diaphoresis`, not a separate material swap.
- **Thin-skin translucency:** an approximate warm tint on ear rims and the nose tip when backlit. Mobile has no real subsurface scattering, so it's faked with a thickness mask.
- **Asymmetry:** add slight facial asymmetry through morphs in every recipe. Perfect symmetry reads as synthetic.

### D4. Breathing and body (Tier 1)

- **Breathing rate:** chest and abdomen motion driven by the sim's `respiratory_rate` and `work_of_breathing`, not a generic idle loop. Learners count respirations.
- **Work of breathing:** accessory muscle use and tripod positioning as animation states for distress scenarios.
- **Hands:** keep LOD0 hand detail (nails, knuckles, skin folds). Pulse and cap-refill checks put the learner's face 30 cm from the patient's hands.
- **Scale:** real-world heights. Validate at kneeling eye level, where paramedic students actually are.

### D5. Voice and sound (Tier 1)

- **Mouth position:** attach the voice AudioSource to the head bone at mouth position and spatialize it. Voice from the character's root or pelvis is immediately noticeable in VR.
- **Physiological sounds:** breathing, wheeze, and moan layers tied to the same state parameters as the visuals, so audio and visuals never disagree.

### D6. Digital moulage (Tier 2)

- **Wounds and blood:** a decal layer, atlased to protect the draw-call budget.
- **Blood color:** fresh arterial blood is bright red, venous darker red, and dried blood brown. Blood is never a single "red".
- **Other fluids:** sweat, vomit, and dirt use the same decal system. Clothing takes staining where fluids would reach.
- **State-driven:** moulage appears progressively, driven by the sim state.

### D7. Hair (Tier 2)

- **Black hair:** "black" hair albedo stays above the A3 floor, and highlights carry the color.
- **Variation:** vary root-to-tip value; uniform strands look like a helmet.
- **Clinical context:** in supine scenarios, hair spreads on the surface rather than keeping its standing shape. Approximate with a pose-specific hair variant rather than simulation.

### D8. Stereo and temporal stability (Tier 1)

- **Both eyes:** every effect must render in both eyes with correct disparity. One-eye effects appear to flicker or float at the wrong depth.
- **Specular aliasing:** control it on skin, hair, and wet surfaces with normal-map mip filtering and roughness anti-aliasing. Shimmer on a sweaty forehead at 50 cm is a classic presence breaker.
- **Hero LOD lock:** disable LOD transitions for the hero patient inside 1.5 m.
