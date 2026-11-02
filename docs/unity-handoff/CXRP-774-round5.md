# CXRP-774 round 5: your 2026-11-03 round-4 check (handoff to the Unity agent)

Thanks for the re-check. Same delivery as before: same names and paths, all replacements (36 files), byte-identical copies. No model changes.

## Your open items

| # | Item | Fix |
|---|---|---|
| 1 | Megan `Actions_PointingAtPhone_Seated`, ~2.67 s left-hand hitch (118 m/s², others 42–57) | **Our bug.** In round 4, the step that gives Megan's standing clips a shared foot placement also picked up her `_Seated` files from your folders. It re-stanced them, which put her seated feet on her standing stance, and overwrote the slowed seated phone with the round-3 version, so hers never got the 2× slow-down. The step now skips seated clips. **All 23 of Megan's seated clips are rebuilt** from her current standing clips on her seated base. Her seated phone now has the slow-down (135 frames, like the others), and its peak left-hand acceleration is the lowest of the three bodies we compared (ours 18 m/s², Kevin's 26 and Camila's 19 on the same measure). Please also re-check her seated feet: they are back on the seated pose. |
| 2 | `emotion_sad_stand_Seated`, `unwell_fidget_stand_Seated`, `emotion_ashamed_Seated` barely move (hands 2–4 cm/s), all five | **Cause:** a seated arm only follows the clip when the clip's hand rises above the lap. These three keep their hands low, so seated they sat on the resting pose. **Fix:** the clip's own arm movement is now layered onto the seated resting arm (relative to a 1 s running average, capped). Where that carried the hands into the lap, the added motion is scaled back, measured frame by frame. **Hands now move 4.4–10.7 cm/s**; a standing ashamed only moves 8–10. The arms go more than 3 cm into the thighs on 0–6% of frames on Kevin, Camila and the bald man, 3–7% on Megan, and 9–15% on Carter, whose seated base pose already sits 2.2 cm into her thighs. Loops close at 0.00 cm; pops ≤ 1.9. Head motion is unchanged: it was already carried from the clip. |

Owner notes received: stroppy cut, dizzy cut from seated, fidgeting standing plays rarely. Nothing changed for those here. Seated `oh_wow` (all) and `bashful` (Megan, Carter) stay held back.

## Every changed file

| File | Item |
|---|---|
| `MeganAnimationsLibraryV0Megan_Actions_HandingAppointmentCard_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV0Megan_Actions_PointingAtPhone_Seated.fbx` | 1 |
| `MeganAnimationsLibraryV0library_v0_manifest.json` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_ashamed_Seated.fbx` | 2 |
| `MeganAnimationsLibraryV1Megan_AD_emotion_awkward_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_crying_contained_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_depressed_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_disappointed_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_giggle_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_puzzled_scratch_head_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_relief_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_sad_stand_Seated.fbx` | 2 |
| `MeganAnimationsLibraryV1Megan_AD_emotion_thinking_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_timid_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_emotion_worried_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_afraid_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_cold_shiver_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_cough_and_sneeze_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_feeling_faint_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_fidget_stand_Seated.fbx` | 2 |
| `MeganAnimationsLibraryV1Megan_AD_unwell_fidgeting_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_its_too_hot_sweating_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_pity_stand_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `MeganAnimationsLibraryV1Megan_AD_unwell_tummy_pains_Seated.fbx` | 1 (Megan's seated set rebuilt: feet back on the seated pose) |
| `KevinAnimationsLibraryV1Kevin_AD_emotion_ashamed_Seated.fbx` | 2 |
| `KevinAnimationsLibraryV1Kevin_AD_emotion_sad_stand_Seated.fbx` | 2 |
| `KevinAnimationsLibraryV1Kevin_AD_unwell_fidget_stand_Seated.fbx` | 2 |
| `CamilaAnimationsLibraryV1Camila_AD_emotion_ashamed_Seated.fbx` | 2 |
| `CamilaAnimationsLibraryV1Camila_AD_emotion_sad_stand_Seated.fbx` | 2 |
| `CamilaAnimationsLibraryV1Camila_AD_unwell_fidget_stand_Seated.fbx` | 2 |
| `BaldGuyAnimationsLibraryV1Bald_AD_emotion_ashamed_Seated.fbx` | 2 |
| `BaldGuyAnimationsLibraryV1Bald_AD_emotion_sad_stand_Seated.fbx` | 2 |
| `BaldGuyAnimationsLibraryV1Bald_AD_unwell_fidget_stand_Seated.fbx` | 2 |
| `CarterV2AnimationsLibraryV1Carter_AD_emotion_ashamed_Seated.fbx` | 2 |
| `CarterV2AnimationsLibraryV1Carter_AD_emotion_sad_stand_Seated.fbx` | 2 |
| `CarterV2AnimationsLibraryV1Carter_AD_unwell_fidget_stand_Seated.fbx` | 2 |
