# CXRP-774: animation list (10 points) and the 2026-11-03 headset findings (handoff to the Unity agent)

Everything is in the Unity project the usual way: same file names and paths, so each fixed clip replaces the old
one in place and your links hold. New clips sit next to the clips they belong with. Every copy was checked
byte-identical to the build.

## Headset findings (your 2026-11-03 note)

| # | Finding | Fix | Changed file |
|---|---|---|---|
| 1 | Bald man: top of the tie knot cut away in a triangle | **Cause:** the Blender stage was cutting the tie down to a quarter of its triangles. At rest the coarse knot looked right, but in motion the shirt collar came through its top by up to 11 mm (chat_anim_2). The CXRP-621 neck change wasn't involved. **Fix:** the tie now keeps all 1,740 triangles, and the collar comes through by at most 0.9 mm, the same as CC4's original. | `BaldGuy\bald.fbx`, `BaldGuy\bald.json` |
| 2 | Bald man: sleeve wall through the rolled cuffs; cuff inside reads grey | The cuff band is pushed out 4–6 mm clear of the sleeve wall under it (CC4's refit had it up to 5 mm inside). The band and the sleeve opening have their own inward-facing faces (same material, UVs and weights), so you don't need a two-sided material. | same `bald.fbx` |
| 3 | Megan: hair at the right of her forehead bends sharply | That band of strands turned from the parting down her temple within two rows of quads (folds up to 107°). Those 42 faces get one smoothed edge-loop level, then the crease is relaxed. The rolled hairline edge and the surrounding hair are untouched. Hair vertices 1,249 → 1,384 (+11%), hair triangles 2,418 → 2,680. Scalp clearance is unchanged. | `Megan\megan.fbx` |

Mesh names, materials and blendshapes are unchanged in both models. Re-import `bald.fbx` and `megan.fbx`.

## The 10-point animation list: what this delivery holds

| # | Item | Status |
|---|---|---|
| 1 | HumanIdleBreathing loop seam | **In.** Hands 0.00 cm apart at the wrap, all five avatars |
| 2 | Posture_SittingAva loop seam | **In.** Seam closed (0.00 cm), hitches smoothed |
| 3 | anger_anim_5 one-frame snap | **In.** The snap is smoothed and the slam kept |
| 4 | PointingForward mid-jab hitch | **In** |
| 5 | Megan's chat_anim_2 / Carter's LoweringHead loop seams | **In.** 0.00 cm; the end now flows into frame 0 at the same speed |
| 6 | PointingAtPhone hitches (~1.5 s, ~2.7 s) | **In.** Softened (worst 5.8 → ~4.9); not fully gone |
| 7 | Megan's feet slide between BEAT and AD clips | **In.** All her standing clips share one foot placement (within 0.6 cm). Clips that take a step still end where the step lands |
| 8 | Body clips for the 12 missing emotion words | **In** (second delivery below). First delivery: The four priority words (worried, anxious, discomfort, sad) as 11 loops on Kevin, Camila, the bald man and Carter (Megan already had them), each with a `_Seated` version (Megan's too). **Still to come:** the other emotion words |
| 9 | Seated HandingAppointmentCard / PointingAtPhone | **In**, all five avatars (`*_Seated.fbx`) |
| 10 | Carter's shoe-opening sliver and back-of-head hair | Already done earlier (CXRP-720 fix rounds 1–2); nothing new here |

Things to look at when you test:
- **Loops:** every new and fixed loop closes with the hands 0.00 cm apart.
- **Seated hand pops:** at most 5.7 (the pop measure loop_check reports), mostly under 3.
- **Seated arm into body (item 8):** Kevin, Camila and the bald man are mostly at 2 cm or less.
  - Carter reaches 3–6 cm on a few hand and finger spots (14–32 vertices) against her belly. Her arms are also 2.2 cm into her thighs, which her seated base pose already does.
  - Megan's seated disappointed reaches 7.3 cm on 15 vertices: her fingers, as the hands drop.
- **Standing cold shiver (the self-hug):** Kevin 1.8 cm, the bald man 3.7 cm in two blips of about 0.1 s, Carter 3.2 cm briefly.
- **Manifests:** built on your live copies, with entries added for the new clips.

## Item 8, second delivery (2026-11-02): the rest of the emotion words

Kevin, Camila, the bald man and Carter now have all 25 of Megan's curated Awesome Dog clips (they had 11). Megan's
manifest marks which emotion words each clip serves (`emotion`, `emotions`); the new manifests for the other bodies
carry the same fields.

| Emotion word | New clips (`<Name>_AD_....fbx`) |
|---|---|
| embarrassed | `emotion_ashamed`, `emotion_awkward_stand`, `emotion_bashful_stand`, `emotion_timid_stand` |
| relieved | `emotion_relief` |
| frustrated | `emotion_stroppy_stand` (seated only, as Megan's) |
| surprised | `emotion_oh_wow` |
| neutral | `emotion_thinking`, `emotion_puzzled_scratch_head` |
| nauseous | `unwell_feeling_faint`, `unwell_dizzy_stand` (seated only, as Megan's) |
| scared | `unwell_afraid` |
| happy | `emotion_giggle` |
| (action) | `unwell_cough_and_sneeze` |

Each has a `_Seated` version on every body (Megan's too), except stroppy and dizzy, and these held back:
- `oh_wow` seated, on all five avatars: the arms went 6–8 cm through the torso and thighs.
- `bashful` seated, on Megan and Carter: 8 cm.

Use the standing clip for those.

Checks:
- Every loop closes with the hands 0.00 cm apart. Worst seated pop 6.9.
- Standing `thinking` needed two extra fit passes on the other bodies: the forearm went 6 cm into the chest when the hand reaches the chin. It is now 1.6 cm or less.

Files (114 under `Avatars\`):
- `Kevin`, `Camila`, `BaldGuy`: `Animations\LibraryV1\`, 14 clips + 11 `_Seated` each.
- `CarterV2`: 14 clips + 10 `_Seated`.
- `Megan`: 10 `_Seated`.
- `library_v1_manifest.json` updated in all five.

## Every changed file (first delivery)

Models: `BaldGuy\bald.fbx`, `BaldGuy\bald.json` (findings 1–2), `Megan\megan.fbx` (finding 3).

Clips (200 files, under `Avatars\`):

**Megan\Animations\LibraryV0** (20)

| File | | Item |
|---|---|---|
| `Megan_Actions_HandingAppointmentCard.fbx` | replaced | 7 |
| `Megan_Actions_HandingAppointmentCard_Seated.fbx` | new | 9 |
| `Megan_Actions_PointingAtPhone.fbx` | replaced | 6, 7 |
| `Megan_Actions_PointingAtPhone_Seated.fbx` | new | 9 |
| `Megan_Conversation_CrossingArms.fbx` | replaced | 7 |
| `Megan_Conversation_LoweringHead.fbx` | replaced | 5, 7 |
| `Megan_Conversation_PointingForward.fbx` | replaced | 4, 7 |
| `Megan_Conversation_anger_anim_1.fbx` | replaced | 7 |
| `Megan_Conversation_anger_anim_2.fbx` | replaced | 7 |
| `Megan_Conversation_anger_anim_3.fbx` | replaced | 7 |
| `Megan_Conversation_anger_anim_4.fbx` | replaced | 7 |
| `Megan_Conversation_anger_anim_5.fbx` | replaced | 3, 7 |
| `Megan_Conversation_chat_anim_1.fbx` | replaced | 7 |
| `Megan_Conversation_chat_anim_2.fbx` | replaced | 5, 7 |
| `Megan_Conversation_chat_anim_3.fbx` | replaced | 7 |
| `Megan_Gesture_FrustratedPosture.fbx` | replaced | 7 |
| `Megan_Gesture_HumanIdleBreathing.fbx` | replaced | 1, 7 |
| `Megan_Gesture_NeutralPosture.fbx` | replaced | 7 |
| `Megan_Posture_SittingAva.fbx` | replaced | 2, 7 |
| `library_v0_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**Megan\Animations\LibraryV1** (37)

| File | | Item |
|---|---|---|
| `Megan_AD_emotion_ashamed.fbx` | replaced | 7 |
| `Megan_AD_emotion_awkward_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_bashful_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_crying_contained.fbx` | replaced | 7 |
| `Megan_AD_emotion_crying_contained_Seated.fbx` | new | 8 |
| `Megan_AD_emotion_depressed.fbx` | replaced | 7 |
| `Megan_AD_emotion_depressed_Seated.fbx` | new | 8 |
| `Megan_AD_emotion_disappointed_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_disappointed_stand_Seated.fbx` | new | 8 |
| `Megan_AD_emotion_giggle.fbx` | replaced | 7 |
| `Megan_AD_emotion_oh_wow.fbx` | replaced | 7 |
| `Megan_AD_emotion_puzzled_scratch_head.fbx` | replaced | 7 |
| `Megan_AD_emotion_relief.fbx` | replaced | 7 |
| `Megan_AD_emotion_sad_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_sad_stand_Seated.fbx` | new | 8 |
| `Megan_AD_emotion_stroppy_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_thinking.fbx` | replaced | 7 |
| `Megan_AD_emotion_timid_stand.fbx` | replaced | 7 |
| `Megan_AD_emotion_worried.fbx` | replaced | 7 |
| `Megan_AD_emotion_worried_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_afraid.fbx` | replaced | 7 |
| `Megan_AD_unwell_cold_shiver_stand.fbx` | replaced | 7 |
| `Megan_AD_unwell_cold_shiver_stand_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_cough_and_sneeze.fbx` | replaced | 7 |
| `Megan_AD_unwell_dizzy_stand.fbx` | replaced | 7 |
| `Megan_AD_unwell_feeling_faint.fbx` | replaced | 7 |
| `Megan_AD_unwell_fidget_stand.fbx` | replaced | 7 |
| `Megan_AD_unwell_fidget_stand_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_fidgeting_stand.fbx` | replaced | 7 |
| `Megan_AD_unwell_fidgeting_stand_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_its_too_hot_sweating.fbx` | replaced | 7 |
| `Megan_AD_unwell_its_too_hot_sweating_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_pity_stand.fbx` | replaced | 7 |
| `Megan_AD_unwell_pity_stand_Seated.fbx` | new | 8 |
| `Megan_AD_unwell_tummy_pains.fbx` | replaced | 7 |
| `Megan_AD_unwell_tummy_pains_Seated.fbx` | new | 8 |
| `library_v1_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**Megan\Animations\BEAT** (11)

| File | | Item |
|---|---|---|
| `Megan_BEAT_conversation_a.fbx` | replaced | 7 |
| `Megan_BEAT_conversation_b.fbx` | replaced | 7 |
| `Megan_BEAT_disgust_a.fbx` | replaced | 7 |
| `Megan_BEAT_emphasis_get.fbx` | replaced | 7 |
| `Megan_BEAT_emphasis_love.fbx` | replaced | 7 |
| `Megan_BEAT_emphasis_proper_care.fbx` | replaced | 7 |
| `Megan_BEAT_emphasis_who.fbx` | replaced | 7 |
| `Megan_BEAT_fear.fbx` | replaced | 7 |
| `Megan_BEAT_happy.fbx` | replaced | 7 |
| `Megan_BEAT_sad.fbx` | replaced | 7 |
| `megan_beat_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**Kevin\Animations\LibraryV0** (10)

| File | | Item |
|---|---|---|
| `Kevin_Actions_HandingAppointmentCard_Seated.fbx` | new | 9 |
| `Kevin_Actions_PointingAtPhone.fbx` | replaced | 6 |
| `Kevin_Actions_PointingAtPhone_Seated.fbx` | new | 9 |
| `Kevin_Conversation_LoweringHead.fbx` | replaced | 5 |
| `Kevin_Conversation_PointingForward.fbx` | replaced | 4 |
| `Kevin_Conversation_anger_anim_5.fbx` | replaced | 3 |
| `Kevin_Conversation_chat_anim_2.fbx` | replaced | 5 |
| `Kevin_Gesture_HumanIdleBreathing.fbx` | replaced | 1 |
| `Kevin_Posture_SittingAva.fbx` | replaced | 2 |
| `library_v0_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**Kevin\Animations\LibraryV1** (23)

| File | | Item |
|---|---|---|
| `Kevin_AD_emotion_crying_contained.fbx` | new | 8 |
| `Kevin_AD_emotion_crying_contained_Seated.fbx` | new | 8 |
| `Kevin_AD_emotion_depressed.fbx` | new | 8 |
| `Kevin_AD_emotion_depressed_Seated.fbx` | new | 8 |
| `Kevin_AD_emotion_disappointed_stand.fbx` | new | 8 |
| `Kevin_AD_emotion_disappointed_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_emotion_sad_stand.fbx` | new | 8 |
| `Kevin_AD_emotion_sad_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_emotion_worried.fbx` | new | 8 |
| `Kevin_AD_emotion_worried_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_cold_shiver_stand.fbx` | new | 8 |
| `Kevin_AD_unwell_cold_shiver_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_fidget_stand.fbx` | new | 8 |
| `Kevin_AD_unwell_fidget_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_fidgeting_stand.fbx` | new | 8 |
| `Kevin_AD_unwell_fidgeting_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_its_too_hot_sweating.fbx` | new | 8 |
| `Kevin_AD_unwell_its_too_hot_sweating_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_pity_stand.fbx` | new | 8 |
| `Kevin_AD_unwell_pity_stand_Seated.fbx` | new | 8 |
| `Kevin_AD_unwell_tummy_pains.fbx` | new | 8 |
| `Kevin_AD_unwell_tummy_pains_Seated.fbx` | new | 8 |
| `library_v1_manifest.json` | new | 7, 8, 9 (entries for this delivery) |

**Camila\Animations\LibraryV0** (10)

| File | | Item |
|---|---|---|
| `Camila_Actions_HandingAppointmentCard_Seated.fbx` | new | 9 |
| `Camila_Actions_PointingAtPhone.fbx` | replaced | 6 |
| `Camila_Actions_PointingAtPhone_Seated.fbx` | new | 9 |
| `Camila_Conversation_LoweringHead.fbx` | replaced | 5 |
| `Camila_Conversation_PointingForward.fbx` | replaced | 4 |
| `Camila_Conversation_anger_anim_5.fbx` | replaced | 3 |
| `Camila_Conversation_chat_anim_2.fbx` | replaced | 5 |
| `Camila_Gesture_HumanIdleBreathing.fbx` | replaced | 1 |
| `Camila_Posture_SittingAva.fbx` | replaced | 2 |
| `library_v0_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**Camila\Animations\LibraryV1** (23)

| File | | Item |
|---|---|---|
| `Camila_AD_emotion_crying_contained.fbx` | new | 8 |
| `Camila_AD_emotion_crying_contained_Seated.fbx` | new | 8 |
| `Camila_AD_emotion_depressed.fbx` | new | 8 |
| `Camila_AD_emotion_depressed_Seated.fbx` | new | 8 |
| `Camila_AD_emotion_disappointed_stand.fbx` | new | 8 |
| `Camila_AD_emotion_disappointed_stand_Seated.fbx` | new | 8 |
| `Camila_AD_emotion_sad_stand.fbx` | new | 8 |
| `Camila_AD_emotion_sad_stand_Seated.fbx` | new | 8 |
| `Camila_AD_emotion_worried.fbx` | new | 8 |
| `Camila_AD_emotion_worried_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_cold_shiver_stand.fbx` | new | 8 |
| `Camila_AD_unwell_cold_shiver_stand_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_fidget_stand.fbx` | new | 8 |
| `Camila_AD_unwell_fidget_stand_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_fidgeting_stand.fbx` | new | 8 |
| `Camila_AD_unwell_fidgeting_stand_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_its_too_hot_sweating.fbx` | new | 8 |
| `Camila_AD_unwell_its_too_hot_sweating_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_pity_stand.fbx` | new | 8 |
| `Camila_AD_unwell_pity_stand_Seated.fbx` | new | 8 |
| `Camila_AD_unwell_tummy_pains.fbx` | new | 8 |
| `Camila_AD_unwell_tummy_pains_Seated.fbx` | new | 8 |
| `library_v1_manifest.json` | new | 7, 8, 9 (entries for this delivery) |

**BaldGuy\Animations\LibraryV0** (10)

| File | | Item |
|---|---|---|
| `Bald_Actions_HandingAppointmentCard_Seated.fbx` | new | 9 |
| `Bald_Actions_PointingAtPhone.fbx` | replaced | 6 |
| `Bald_Actions_PointingAtPhone_Seated.fbx` | new | 9 |
| `Bald_Conversation_LoweringHead.fbx` | replaced | 5 |
| `Bald_Conversation_PointingForward.fbx` | replaced | 4 |
| `Bald_Conversation_anger_anim_5.fbx` | replaced | 3 |
| `Bald_Conversation_chat_anim_2.fbx` | replaced | 5 |
| `Bald_Gesture_HumanIdleBreathing.fbx` | replaced | 1 |
| `Bald_Posture_SittingAva.fbx` | replaced | 2 |
| `library_v0_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**BaldGuy\Animations\LibraryV1** (23)

| File | | Item |
|---|---|---|
| `Bald_AD_emotion_crying_contained.fbx` | new | 8 |
| `Bald_AD_emotion_crying_contained_Seated.fbx` | new | 8 |
| `Bald_AD_emotion_depressed.fbx` | new | 8 |
| `Bald_AD_emotion_depressed_Seated.fbx` | new | 8 |
| `Bald_AD_emotion_disappointed_stand.fbx` | new | 8 |
| `Bald_AD_emotion_disappointed_stand_Seated.fbx` | new | 8 |
| `Bald_AD_emotion_sad_stand.fbx` | new | 8 |
| `Bald_AD_emotion_sad_stand_Seated.fbx` | new | 8 |
| `Bald_AD_emotion_worried.fbx` | new | 8 |
| `Bald_AD_emotion_worried_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_cold_shiver_stand.fbx` | new | 8 |
| `Bald_AD_unwell_cold_shiver_stand_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_fidget_stand.fbx` | new | 8 |
| `Bald_AD_unwell_fidget_stand_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_fidgeting_stand.fbx` | new | 8 |
| `Bald_AD_unwell_fidgeting_stand_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_its_too_hot_sweating.fbx` | new | 8 |
| `Bald_AD_unwell_its_too_hot_sweating_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_pity_stand.fbx` | new | 8 |
| `Bald_AD_unwell_pity_stand_Seated.fbx` | new | 8 |
| `Bald_AD_unwell_tummy_pains.fbx` | new | 8 |
| `Bald_AD_unwell_tummy_pains_Seated.fbx` | new | 8 |
| `library_v1_manifest.json` | new | 7, 8, 9 (entries for this delivery) |

**CarterV2\Animations\LibraryV0** (10)

| File | | Item |
|---|---|---|
| `Carter_Actions_HandingAppointmentCard_Seated.fbx` | new | 9 |
| `Carter_Actions_PointingAtPhone.fbx` | replaced | 6 |
| `Carter_Actions_PointingAtPhone_Seated.fbx` | new | 9 |
| `Carter_Conversation_LoweringHead.fbx` | replaced | 5 |
| `Carter_Conversation_PointingForward.fbx` | replaced | 4 |
| `Carter_Conversation_anger_anim_5.fbx` | replaced | 3 |
| `Carter_Conversation_chat_anim_2.fbx` | replaced | 5 |
| `Carter_Gesture_HumanIdleBreathing.fbx` | replaced | 1 |
| `Carter_Posture_SittingAva.fbx` | replaced | 2 |
| `library_v0_manifest.json` | replaced | 7, 8, 9 (entries for this delivery) |

**CarterV2\Animations\LibraryV1** (23)

| File | | Item |
|---|---|---|
| `Carter_AD_emotion_crying_contained.fbx` | new | 8 |
| `Carter_AD_emotion_crying_contained_Seated.fbx` | new | 8 |
| `Carter_AD_emotion_depressed.fbx` | new | 8 |
| `Carter_AD_emotion_depressed_Seated.fbx` | new | 8 |
| `Carter_AD_emotion_disappointed_stand.fbx` | new | 8 |
| `Carter_AD_emotion_disappointed_stand_Seated.fbx` | new | 8 |
| `Carter_AD_emotion_sad_stand.fbx` | new | 8 |
| `Carter_AD_emotion_sad_stand_Seated.fbx` | new | 8 |
| `Carter_AD_emotion_worried.fbx` | new | 8 |
| `Carter_AD_emotion_worried_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_cold_shiver_stand.fbx` | new | 8 |
| `Carter_AD_unwell_cold_shiver_stand_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_fidget_stand.fbx` | new | 8 |
| `Carter_AD_unwell_fidget_stand_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_fidgeting_stand.fbx` | new | 8 |
| `Carter_AD_unwell_fidgeting_stand_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_its_too_hot_sweating.fbx` | new | 8 |
| `Carter_AD_unwell_its_too_hot_sweating_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_pity_stand.fbx` | new | 8 |
| `Carter_AD_unwell_pity_stand_Seated.fbx` | new | 8 |
| `Carter_AD_unwell_tummy_pains.fbx` | new | 8 |
| `Carter_AD_unwell_tummy_pains_Seated.fbx` | new | 8 |
| `library_v1_manifest.json` | new | 7, 8, 9 (entries for this delivery) |

