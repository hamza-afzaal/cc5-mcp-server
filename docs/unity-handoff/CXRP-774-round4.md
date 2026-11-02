# CXRP-774 round 4: your 2026-11-03 list (handoff to the Unity agent)

Same delivery as before: same names and paths, so each file replaces the old one and your links hold. Every copy is
checked byte-identical to the build. **Re-import `BaldGuy\bald.fbx`**. Clips: 119 files, all replacements, none new.

## Your items

| # | Item | Fix | Files |
|---|---|---|---|
| 1 | Bald man: no forearm skin under the rolled sleeve; cuff ~5.5 cm from the forearm centre around a 2.5–4 cm arm | **Cause:** not the export. Our own Blender-stage step that pushes skin hidden under the shirt 3 cm inward (so it can't poke through) treats a garment's openings as its boundary edges. On a rolled sleeve, the boundary is the tuck edge up the arm, not the cuff opening. So the forearm under the roll had sunk from radius ~4.2 to 1.6 cm. **Fix:** forearm skin past 52 cm from the body centre (bind pose) keeps CC4's shape; the elbow stays inset (it came through the sleeve when bent). The sleeve end and cuff are pulled in to 1 cm off the arm skin, measured per direction since the forearm isn't round. Cuff median 5.1–6.4 → 4.7–5.6 cm from the forearm centre. | `BaldGuy\bald.fbx` |
| 2 | Bald man: inner cuff faces on top of the outer ones | The inward-facing copies are now a real layer **3 mm** inside (was 0.6 mm). | same |
| 3 | PointingAtPhone, ~2.7 s, left hand hitch, every avatar | The left hand whips ~30 cm in three frames; that's in the mocap itself. Slowed 2× around frame 81, with smooth speed changes on both sides. Peak left-hand speed 7–10.8 → 3.7–6.0 cm/frame. The clip is **10 frames (0.33 s) longer**; manifests updated. Standing and seated, all five. | `*_Actions_PointingAtPhone.fbx`, `*_Seated.fbx` |
| 4 | Megan's left foot pops in AD_emotion_worried | Two causes. (a) The round-3 re-stance flipped the knee plane frame to frame on near-straight legs, and wrote some leg rotations across ±180° Euler wraps. Your quaternion import spun through those between keys: the ~19 cm foot jump you reverted. (b) The original mocap re-plants the left foot 4.3 cm in one frame at frame 643. **Fix:** worried is back on its original stance (as your revert), with the wraps removed and the re-plant eased over frames 636–650 (now ≤ 0.66 cm/frame). | `Megan\...\LibraryV1\Megan_AD_emotion_worried.fbx` |
| 5 | Megan's feet: BEAT_conversation_b ~20 cm back, BEAT_fear 4–5 cm off | These two step away mid-clip in the mocap. Both feet are now **held on her idle stance** for the whole clip, and the legs reach them. conversation_b holds within 0.05 cm. fear holds within 2–3 cm: on a few frames the pelvis leans past where the legs can reach the idle footprint. Knee ranges are normal (no new overlap). | `Megan\...\BEAT\Megan_BEAT_conversation_b.fbx`, `Megan_BEAT_fear.fbx` |
| 6 | chat_anim_2 seam 0.8 cm; anger 5 and the jab still fast | **Seam:** on every avatar, the first and last frames match exactly (0.00 cm on hands, head, feet and pelvis), and the hands keep a steady speed across the wrap (2.5 → 2.6 cm/frame). We think your 0.8 cm comes from import-side keyframe reduction (animation compression). Could you check with compression Off, or tell us which bone and method you used? **Speed:** the fastest moment in each is 1.5× slower (anger 5: hands 18–19 → 12–13 cm/frame at the slam; jab: 9–10 → 6.4–7.2). Both clips are 4 frames longer. | `*_Conversation_anger_anim_5.fbx`, `*_Conversation_PointingForward.fbx` |

## Also in this delivery

- **Megan's shared stance (item 7), redone.** The knee-plane flip is fixed in the stance tool, so her re-stanced clips no longer pop.
  - We checked the largest one-frame knee movement in every re-stanced clip against the pre-774 original.
  - Nine LibraryV1 clips still came out worse (oh wow, puzzled, thinking, cough and sneeze, dizzy, fidgeting, pity, tummy pains, worried). They stay on their original stance, exactly as your revert has them. Worried changes only as in item 4.
  - Her other standing clips (LibraryV0, LibraryV1, BEAT) get the corrected stance.
- **Euler keys only, 48 clips on other avatars.** The same ±180° wraps existed in clips from earlier rounds. Their rotation keys are rewritten to the equivalent angles nearest the previous key. The pose at every key is identical (checked: 0 cm difference); only the in-between interpolation stops spinning.
- **Held back, as before:** `oh_wow` seated (all five) and `bashful` seated (Megan, Carter).

## Every changed file

`BaldGuy\bald.fbx`: items 1–2.

Clips (119, all under `Avatars\`):

**Megan\Animations\LibraryV0** (19)

| File | Item |
|---|---|
| `Megan_Actions_HandingAppointmentCard.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Actions_HandingAppointmentCard_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_Actions_PointingAtPhone.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Megan_Actions_PointingAtPhone_Seated.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Megan_Conversation_CrossingArms.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_LoweringHead.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_PointingForward.fbx` | 6 (fastest moment slowed 1.5x) |
| `Megan_Conversation_anger_anim_1.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_anger_anim_2.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_anger_anim_3.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_anger_anim_4.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_anger_anim_5.fbx` | 6 (fastest moment slowed 1.5x) |
| `Megan_Conversation_chat_anim_1.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_chat_anim_2.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Conversation_chat_anim_3.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Gesture_FrustratedPosture.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Gesture_HumanIdleBreathing.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_Gesture_NeutralPosture.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `library_v0_manifest.json` | 3, 4, 6 (durations / entries) |

**Megan\Animations\LibraryV1** (39)

| File | Item |
|---|---|
| `Megan_AD_emotion_ashamed.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_ashamed_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_awkward_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_awkward_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_bashful_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_crying_contained.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_crying_contained_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_depressed.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_depressed_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_disappointed_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_disappointed_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_giggle.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_giggle_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_puzzled_scratch_head_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_relief.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_relief_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_sad_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_sad_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_stroppy_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_thinking_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_timid_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_emotion_timid_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_emotion_worried.fbx` | 4 (left-foot pop: Euler wrap + re-plant snap) |
| `Megan_AD_emotion_worried_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_afraid.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_unwell_afraid_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_cold_shiver_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_unwell_cold_shiver_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_cough_and_sneeze_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_feeling_faint.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_unwell_feeling_faint_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_fidget_stand.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_unwell_fidget_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_fidgeting_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_its_too_hot_sweating.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_AD_unwell_its_too_hot_sweating_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_pity_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Megan_AD_unwell_tummy_pains_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v1_manifest.json` | 3, 4, 6 (durations / entries) |

**Megan\Animations\BEAT** (11)

| File | Item |
|---|---|
| `Megan_BEAT_conversation_a.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_conversation_b.fbx` | 5 (feet held on her idle stance) |
| `Megan_BEAT_disgust_a.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_emphasis_get.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_emphasis_love.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_emphasis_proper_care.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_emphasis_who.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_fear.fbx` | 5 (feet held on her idle stance) |
| `Megan_BEAT_happy.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `Megan_BEAT_sad.fbx` | 4/5 (shared stance redone: no knee flips, no Euler wraps) |
| `megan_beat_manifest.json` | 3, 4, 6 (durations / entries) |

**Kevin\Animations\LibraryV0** (8)

| File | Item |
|---|---|
| `Kevin_Actions_HandingAppointmentCard_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Kevin_Actions_PointingAtPhone.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Kevin_Actions_PointingAtPhone_Seated.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Kevin_Conversation_LoweringHead.fbx` | keys only (Euler wraps removed; same poses) |
| `Kevin_Conversation_PointingForward.fbx` | 6 (fastest moment slowed 1.5x) |
| `Kevin_Conversation_anger_anim_5.fbx` | 6 (fastest moment slowed 1.5x) |
| `Kevin_Gesture_HumanIdleBreathing.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v0_manifest.json` | 3, 4, 6 (durations / entries) |

**Kevin\Animations\LibraryV1** (3)

| File | Item |
|---|---|
| `Kevin_AD_emotion_depressed.fbx` | keys only (Euler wraps removed; same poses) |
| `Kevin_AD_emotion_disappointed_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v1_manifest.json` | 3, 4, 6 (durations / entries) |

**Camila\Animations\LibraryV0** (8)

| File | Item |
|---|---|
| `Camila_Actions_HandingAppointmentCard_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Camila_Actions_PointingAtPhone.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Camila_Actions_PointingAtPhone_Seated.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Camila_Conversation_LoweringHead.fbx` | keys only (Euler wraps removed; same poses) |
| `Camila_Conversation_PointingForward.fbx` | 6 (fastest moment slowed 1.5x) |
| `Camila_Conversation_anger_anim_5.fbx` | 6 (fastest moment slowed 1.5x) |
| `Camila_Gesture_HumanIdleBreathing.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v0_manifest.json` | 3, 4, 6 (durations / entries) |

**Camila\Animations\LibraryV1** (3)

| File | Item |
|---|---|
| `Camila_AD_emotion_depressed.fbx` | keys only (Euler wraps removed; same poses) |
| `Camila_AD_emotion_disappointed_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v1_manifest.json` | 3, 4, 6 (durations / entries) |

**BaldGuy\Animations\LibraryV0** (8)

| File | Item |
|---|---|
| `Bald_Actions_HandingAppointmentCard_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Bald_Actions_PointingAtPhone.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Bald_Actions_PointingAtPhone_Seated.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Bald_Conversation_LoweringHead.fbx` | keys only (Euler wraps removed; same poses) |
| `Bald_Conversation_PointingForward.fbx` | 6 (fastest moment slowed 1.5x) |
| `Bald_Conversation_anger_anim_5.fbx` | 6 (fastest moment slowed 1.5x) |
| `Bald_Gesture_HumanIdleBreathing.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v0_manifest.json` | 3, 4, 6 (durations / entries) |

**BaldGuy\Animations\LibraryV1** (4)

| File | Item |
|---|---|
| `Bald_AD_emotion_awkward_stand_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Bald_AD_emotion_depressed.fbx` | keys only (Euler wraps removed; same poses) |
| `Bald_AD_emotion_disappointed_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v1_manifest.json` | 3, 4, 6 (durations / entries) |

**CarterV2\Animations\LibraryV0** (8)

| File | Item |
|---|---|
| `Carter_Actions_HandingAppointmentCard_Seated.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_Actions_PointingAtPhone.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Carter_Actions_PointingAtPhone_Seated.fbx` | 3 (2.7 s left-hand whip slowed 2x) |
| `Carter_Conversation_LoweringHead.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_Conversation_PointingForward.fbx` | 6 (fastest moment slowed 1.5x) |
| `Carter_Conversation_anger_anim_5.fbx` | 6 (fastest moment slowed 1.5x) |
| `Carter_Gesture_HumanIdleBreathing.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v0_manifest.json` | 3, 4, 6 (durations / entries) |

**CarterV2\Animations\LibraryV1** (8)

| File | Item |
|---|---|
| `Carter_AD_emotion_depressed.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_emotion_disappointed_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_emotion_puzzled_scratch_head.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_emotion_relief.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_emotion_sad_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_unwell_its_too_hot_sweating.fbx` | keys only (Euler wraps removed; same poses) |
| `Carter_AD_unwell_pity_stand.fbx` | keys only (Euler wraps removed; same poses) |
| `library_v1_manifest.json` | 3, 4, 6 (durations / entries) |
