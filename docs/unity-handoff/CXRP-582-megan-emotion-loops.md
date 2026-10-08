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
