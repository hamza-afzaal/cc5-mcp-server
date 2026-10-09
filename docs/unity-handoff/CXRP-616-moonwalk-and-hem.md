# CXRP-616: Megan's feet no longer slide; full shirt hem back (handoff to the Unity agent)

Two deliveries for Megan, 2026-10-09.

## 1. Body clips re-exported: pelvis travel kept, planted feet locked

**Re-copy** these folders under `D:\Business\Code\art\characters\megan\exports\` (files keep their names; you
remain the only writer on the Unity side):

| Folder | What changed |
|---|---|
| `library_v1\unity\` | all 25 `Megan_AD_*` + `library_v1_manifest.json` |
| `beat\unity\` | all 10 `Megan_BEAT_*` + `megan_beat_manifest.json` |
| `library_v0\unity\` | the 16 standing clips, `Megan_Posture_SittingAva` (hand jump), `library_v0_manifest.json` |

Unchanged: the walks and Sit / StandToSit / SitToStand. Rollback: `unity_pre_616\` next to each folder.

**Cause (your measurement was right).** Our `in_place` step smoothed the pelvis travel away, so each weight shift
was done by the feet instead. The CC4 sources do rock and shift; Bashful's pelvis moves 14.6 cm with the left
foot planted, and every source loop closes (pelvis 0.0 cm between first and last frame).

**Now:**
- The clips keep the pelvis's own travel and sway. You bake it into the pose ("Original"), so her transform never
  moves; there is still no root motion.
- **Planted feet are locked.** From touchdown the foot is held where it landed (at most 6 cm of correction), and
  the leg follows. Shuffle steps that barely leave the floor get a small arc, so they read as steps.
- **One-frame arm glitches are smoothed:** SittingAva's 15 cm left-hand jump at **6.87 s (frame 206)**, and the
  smaller ones at frames 234 and 383. Real fast motion, like the anger_anim_5 slam, is left alone.

**Planted-foot slide (cm/s), measured the way your review tool does** (our numbers match yours within ~1 cm/s on
every clip you listed):

| Clip | Before | Now |
|---|---|---|
| ashamed / bashful_stand / crying_contained / awkward_stand | 5.7 / 4.8 / 3.4 / 2.9 | 0.10 / 0.27 / 0.00 / 0.00 |
| fidgeting_stand / dizzy_stand / stroppy_stand / worried | 19.0 / 16.5 / 10.9 / 11.7 | 0.76 / 0.00 / 0.14 / 0.93 |
| thinking / cough_and_sneeze / tummy_pains | 10.8 / 9.6 / 7.4 | 0.31 / 0.17 / 0.00 |
| BEAT happy / fear / sad | 9.0 / 8.5 / 6.9 | 0.67 / **1.60** / 0.40 |
| Conversation_PointingForward / chat_anim_2 | 8.9 / 5.2 | 0.00 / 0.00 |
| Conversation_anger_anim_2 | 9.9 | **4.94** |

- **All 25 Awesome Dog clips are 0.00–0.99** and all their loops close (pelvis 0.0 cm).
- **The v0 standing clips are 0.00–0.96, except anger_anim_2 (4.94).** Its right foot pivots and scuffs forward
  during the poke; a full fix needs hand cleanup in iClone. It's a one-shot, so tell us if it still reads badly.
- **BEAT fear is 1.60,** just over the 1.5 target.
- **Pelvis travel is now large on some clips:** fidgeting 31.6 cm, worried 28.9, BEAT fear 37.6, BEAT happy 33.2.
  It's the actor's own rocking or wandering, always back to the start on loops. If a clip drifts too far for its
  spot, tell us which one.
- **One-shots with a step:** PointingForward (29.5 cm) and PointingAtPhone (24.9 cm) end where the step took her.
  Crossfade back to the idle as before.

**Manifests:**
- `root_travel_m` / `root` are re-measured.
- `rules.root` is rewritten: the travel is kept and baked by you, with no root motion.
- New per-clip `foot_slide_cms`.

## 2. Full shirt hem (Megan's model)

- **The owner reverted the French tuck,** so CC4's full hem is back at the front.
- **Without it, a strip of belly skin showed whenever she stood or walked.** We measured from 54 eye positions:
  - before (no front hem): skin seen from about half of them;
  - now: none, except 2 vertices from an eye 30 cm off the floor.
- **Seated, no skin showed either way.** So the owner's seated screenshot, with her hands spread at her hips, is
  probably a standing clip layered over the sitting legs (spine straightened). **Which clip and layer were
  playing?** We'll reproduce and fix that pose.
- **The model is copied into your folder by us** (`deliver_unity.py`, with the owner's OK):
  - `Avatars\Megan\megan.fbx`
  - `megan.json`
  - `megan.fbm\Layered_sweater_Opacity.jpg`
- **Re-import Megan** with the usual CCiC + CC4OpacityPack step.

## Please check (review tool, Standing mode)

1. Slide ≤ 1.5 cm/s on the standing loops. Ashamed, bashful, awkward and crying_contained visibly shift weight.
2. SittingAva: no hand pop at 6.87 s.
3. Megan standing and walking: no skin between the sweater and the jeans. Seated: does the gap still show, and in
   which clip?
