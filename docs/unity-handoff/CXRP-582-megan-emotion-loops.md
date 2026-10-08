# CXRP-582: Megan's emotion body-language loops (handoff to the Unity agent)

There are 17 new body clips for Megan, from the Awesome Dog MoCap packs we bought (*45 Emotion*, *42 Scared &
Unwell*). Each is fitted to Megan's body. They fill the vocabulary words that had no body language: embarrassed,
worried, relieved, discomfort, nauseous, and more sad / frustrated / surprised.

## Copy from

`D:\Business\Code\art\characters\megan\exports\library_v1\unity\`: `Megan_AD_<clip>.fbx` × 17 +
`library_v1_manifest.json`. You remain the only writer on the Unity side.

- **Same conventions as library_v0:** 30 fps, CC4 GameBase skeleton (Megan), Humanoid import, frame 0 = first motion
  frame. Twist bones stay at bind pose, eye bones are held (gaze is yours), and fingers never bend backwards.
- **Every clip is a seamless loop** (`loop_gap_deg` 0) **and in place.** The recordings walked 6–30 cm; now only
  2–8 cm of natural sway is left, with no net travel.
- **Arm-into-body overlap is about 1 cm on 11 clips, 1.2–2.4 cm on 6** (ashamed, worried, fidgeting, sad, stroppy,
  tummy pains: hands pressed against the thighs or the belly).

## How to use them (phase-1 contract, CXRP-562 brief section 6)

They're **long loops (7–35 s): the emotion's body layer.** While `avatar.emotion` holds one of these words, play a
matching clip in place of the plain talk/idle loop. They aren't 1–6 s accents. The exception is `oh_wow` (2 s), which
works as a surprised accent.

| Emotion word | Clips (`emotion` / `emotions` in the manifest) |
|---|---|
| embarrassed | Ashamed, Awkward Stand, Bashful Stand, Timid Stand |
| worried / anxious | Worried, Fidget Stand, Fidgeting Stand |
| relieved | Relief |
| sad | Sad Stand, Disappointed Stand |
| frustrated | Stroppy Stand (**seated only**) |
| surprised | Oh Wow |
| neutral (variety) | Thinking |
| discomfort / nauseous | Tummy Pains, Feeling Faint, Dizzy Stand (**seated only**), Its Too Hot Sweating |

- **`seated_only: true`** (Stroppy, Dizzy): the owner wants these only with the lower body masked, because the legs
  stamp or sway too much standing.
- **Seated in general:** all 17 are standing clips. The owner skipped the seated packs for now and relies on your
  upper-body-over-sitting-legs layer, so please judge on Quest whether the upper body alone reads well.
- **Several clips fit one word:** pick at random, and don't repeat the same clip back to back.

## Also changed: re-copy these two from library_v0

`characters\megan\exports\library_v0\unity\Megan_Posture_Sitting_StandToSit.fbx` and `..._SitToStand.fbx` (CXRP-586).
The previous files began with **a T-pose frame**, a retarget bug we found while doing this batch. They're re-fitted
now. Every one of the 108 delivered clips (library v0 × 3 avatars, BEAT, library v1) was checked: none starts or ends
in a rest pose.

## Please check on Quest

1. Relief (hand on chest) and Thinking (arm folded across the belly): the hands rest on her surface and don't sink in.
2. Tummy Pains and Feeling Faint, seated: does the upper body alone read as unwell?
3. No pop at the loop seam on the long clips.

---

# Round 2 (2026-10-08): 8 more loops, calm emphasis accents, disgust, two face accents

The owner picked these from a second review sheet. Same conventions as above. Every clip was checked: none starts or
ends in a rest pose.

## 1. Eight more Awesome Dog clips

**Copy from** `characters\megan\exports\library_v1\unity\`: the 8 new `Megan_AD_*.fbx` files below, plus
`library_v1_manifest.json` (now 25 clips).

| Clip | Word (`emotion` / `emotions`) | What it shows |
|---|---|---|
| `Megan_AD_unwell_afraid` | scared (+ anxious) | hunched, hands drawn up to the chest |
| `Megan_AD_emotion_giggle` | happy (+ embarrassed) | hand to the mouth, small laughs |
| `Megan_AD_emotion_crying_contained` | sad | holding back tears, hand to the face |
| `Megan_AD_emotion_depressed` | sad | slumped, head down |
| `Megan_AD_emotion_puzzled_scratch_head` | neutral (+ worried) | scratches her head while thinking |
| `Megan_AD_unwell_cold_shiver_stand` | discomfort | arms wrapped around herself, shivering (fever chills) |
| `Megan_AD_unwell_pity_stand` | worried (+ anxious, sad) | hands clasped at the chest, pleading |
| `Megan_AD_unwell_cough_and_sneeze` | discomfort, **`use: action`** | coughs and sneezes into her hand |

- **Cough & Sneeze is an action**, not body language. Play it only on a scripted cue, never pick it by emotion.
  - It is 24 s long, with several coughs and sneezes.
  - Its manifest `root` is `travel`: her pelvis sways up to 7 cm while she sneezes, then comes back.
- **Giggle and Cold Shiver:** the owner flagged hands sinking into her belly.
  - Giggle went from 7.7 cm to 1.5 cm.
  - Cold Shiver's self-hug went from 8 cm to 1.2 cm.
  - Please check both on Quest.

## 2. BEAT clips (calm emphasis, disgust), and a manifest re-tag

**Copy from** `characters\megan\exports\beat\unity\`: the 5 new files below, plus `megan_beat_manifest.json`.

| Clip | Length | Use |
|---|---|---|
| `Megan_BEAT_emphasis_get` | 3 s, one-shot | calm explaining beat: one open hand turns up toward the listener |
| `Megan_BEAT_emphasis_love` | 3 s, one-shot | calm emphasis: open hand reaches out to the side |
| `Megan_BEAT_emphasis_proper_care` | 3 s, one-shot | one hand offers forward at chest height |
| `Megan_BEAT_emphasis_who` | 3 s, one-shot | both hands open, one sweeps outward |
| `Megan_BEAT_disgust_a` | 15 s, loop | disgusted: talking hands, a hand to the head mid-clip |

- **The emphasis clips are the calm counterpart to the angry pointing / poking clips.**
  - They are `category: accent`, tagged neutral / warm (some also worried, frustrated, happy).
  - They are a good choice for the backend's `gesture: true` when the emotion isn't angry.
  - Blend them over the talk loop like the other short accents.
- **Disgusted had no body language before.** This is now its body layer.
- **Re-tag in the BEAT manifest (it affects clips you already have).**
  - `emotion` / `emotions` / `use` now use the agreed vocabulary.
  - **`Megan_BEAT_fear` is now `scared` (+ anxious)**, so it's found when the backend sends `scared`.
  - happy is also tagged warm.
  - The two conversation clips are `use: stance`, tagged neutral / warm.

## 3. Two face accents (`characters\megan\face\megan_vocab.json`, v1.1)

New `accents` section next to `words`:

| Accent | For | What it is |
|---|---|---|
| `eye_roll` | frustrated, guarded | exasperated eye roll: eyes up and to the side, heavy lids, mouth pressed to one side, head tilts |
| `look_up` | neutral, warm, worried | a glance up while thinking or recalling |

- Each accent has:
  - `weights`: blendshapes, same units as the words, all present on her mesh.
  - `gaze`: degrees up and to the side, for your procedural gaze.
  - `head`: a small tilt or turn, for your head look-at.
- The eyeballs and head turn through bones, so the blendshapes alone only move the lids and skin.
- Timing (in the file's `rule`):
  - blend in over ~0.2 s, hold 0.4–0.8 s, blend out over ~0.3 s;
  - at most one accent per line, with a cool-down.

## Please check on Quest (round 2)

1. Giggle (hand at the mouth and belly) and Cold Shiver (self-hug): the hands rest on her and don't sink in.
2. The emphasis accents blend in and out of the talk loop without a jump.
3. The eye roll reads as exasperated, not as looking at something on the ceiling. The gaze angles are a first guess;
   tune them if needed.
