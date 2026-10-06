# CXRP-554 / 561: BEAT pilot v2 (handoff to the Unity agent)

Your three fixes from the Quest check are done. Same five clips, same names, a drop-in replacement.

**Copy from:** `D:\Business\Code\art\characters\megan\exports\beat\unity\`
- `Megan_BEAT_conversation_a.fbx`, `Megan_BEAT_conversation_b.fbx`, `Megan_BEAT_fear.fbx`, `Megan_BEAT_happy.fbx`,
  `Megan_BEAT_sad.fbx`
- `megan_beat_manifest.json` (new): `playback` (loop / one_shot) and `root` (in_place / travel) per clip, as asked.

Unchanged: Megan's GameBase skeleton, 30 fps, clean frame 0 (clip_trim, no rest-pose frame), Humanoid import.

## What changed

| Clip | Head yaw off front (mean) | Root travel (max) | Loop seam (last vs first frame) | Arm overlap |
|---|---|---|---|---|
| conversation_a | 87° → **22°** | 0.9 → 0.3 cm | 38° → **0.5°** | 1.07 cm |
| conversation_b | 90° → **22°** | 6 → 1.5 cm | 53° → **0°** | 1.24 cm |
| fear | already front (unchanged) | 38 → **5 cm** | 100° → **0°** | 1.43 cm |
| happy | already front (unchanged) | 36 → **4 cm** | 71° → **0.9°** | 1.22 cm |
| sad | already front (unchanged) | 23 → **2 cm** | 63° → **1°** | 1.34 cm |

1. **Facing the learner (your point 1):** on conversation A/B the head and neck are re-aimed toward the front (+Z).
   - The correction keeps 15% of any turn beyond 10°, spread over chest, neck and head (20/40/40%).
   - Natural glances survive; the long 90° stare to the side is gone.
2. **Loops (point 2):** the last 1.5 s of every curve, fingers included, eases into the first frame, so the last
   frame equals the first. All five are `playback: loop`. Turn Loop Time on; Loop Pose isn't needed.
3. **Root drift (point 3):** the hips keep their sway but not their travel (horizontal position minus its 1 s moving
   average).
   - All are `root: in_place`, except fear at 5.2 cm, which is just over our 5 cm line; that's weight-shift sway, not
     travel.
   - Bake Into Pose for XZ is fine either way.
4. **Seated (point 4):** as you said, use the upper-body layer over the sitting legs. Nothing changed for that.

Clipping after the changes: the loop blend moved the arms, so each clip got one more fit pass. Arm-to-torso overlap is
back to 1.0–1.4 cm, about the same as the v1 clips you checked.

## Please check on Quest

- Conversation A/B: does she now read as talking to the learner? If 22° still feels turned away, or too stiff, tell
  us and we'll change the 15% setting.
- Loop the five clips for about a minute each and watch the seam, especially the fingers.
- Feet stay planted, with no slide/snap.

**Rollback:** v1 is in `characters\megan\exports\beat\unity_v1\`.

## Also coming (CXRP-559, separate note)

The 21 library clips for Megan (refreshed), Kevin and Camila.
- Your talk stances `chat_anim_1` (StandTalk) and `chat_anim_2` (SitTalk) don't loop cleanly as they are: the
  fingers are 39–57° apart between the last and first frame, so they likely pop on Ava and the bald character today too.
- The library versions get the same loop blend, and the library manifest gets the same `playback` / `root` fields.

## v2.1 (2026-10-05): conversation A/B face the learner

Your Editor check: A/B held the head 18–23° to her left with the chest forward (head-vs-chest ≈ 32°), which read as a
glance aside. The cause: v2 also turned the chest by 20% of the correction, which pushed it past front.

v2.1 corrects the neck and head only; the chest stays where the actor had it (−3 to −5°). The head now targets
within 5° of front.

| Clip | Head yaw (mean / max) | Head vs chest | Loop seam | Arm overlap |
|---|---|---|---|---|
| conversation_a | **5° / 6°** (v2: 22°) | 2° | 0.5° | 1.03 cm |
| conversation_b | **5° / 5.7°** (v2: 22°) | 1° | 0° | 1.24 cm |

- **Copy:** `Megan_BEAT_conversation_a.fbx`, `Megan_BEAT_conversation_b.fbx` and the updated `megan_beat_manifest.json`
  from `characters\megan\exports\beat\unity\`.
- **Unchanged:** fear, happy and sad (same files as v2).
- **Kept:** natural head tilts and nods.
- **Rollback:** v2 is in `beat\unity_v2\`.
