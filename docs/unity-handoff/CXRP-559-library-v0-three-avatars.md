# CXRP-555 / 559: library v0 for Megan, Kevin and Camila (handoff to the Unity agent)

The 21 artist clips, each fitted to its own avatar's body. **Megan's set replaces the one from 2026-10-03.** A hip-drift
fix applies: clips that turn the root had the pelvis shifted a few mm sideways.

## Copy from

| Avatar | Folder | Files |
|---|---|---|
| Megan | `D:\Business\Code\art\characters\megan\exports\library_v0\unity\` | `Megan_<clip>.fbx` × 21 + `library_v0_manifest.json` |
| Kevin | `D:\Business\Code\art\characters\kevin\exports\library_v0\unity\` | `Kevin_<clip>.fbx` × 21 + `library_v0_manifest.json` |
| Camila | `D:\Business\Code\art\characters\camila\exports\library_v0\unity\` | `Camila_<clip>.fbx` × 21 + `library_v0_manifest.json` |

- Each set is on that avatar's own CC4 GameBase skeleton: Kevin and Camila are not on Megan's rig.
- 30 fps, clean frame 0 (clip_trim, no rest-pose frame), Humanoid import.
- Twist bones stay at bind pose (your TwistDriver drives them).
- Rollback for Megan: `characters\megan\exports\library_v0_delivered_2026-10-03\unity\`.

## Manifest (what you asked for)

Per clip, each manifest has:

- **`playback`:** `loop` when the last frame is within 5° of the first on every bone (twist bones excluded), else
  `one_shot`. `loop_gap_deg` / `loop_gap_bone` give the number.
- **`root`:** `in_place` when the pelvis stays within 5 cm horizontally, else `travel`, with `root_travel_m`. We don't
  lock the root on library clips: the travel is part of those gestures (stepping toward, leaning). Bake it into the pose
  or treat them as one-shots.
- **`fit`:** arm/leg overlap before and after the per-body fit, plus a `note` where it's above 1.5 cm.
- Curated fields as before: category, stance, emotion, tags, source.

## Your stance clips

The clips your stance controllers already use:

| Clip | Use | Megan | Kevin | Camila |
|---|---|---|---|---|
| Gesture_HumanIdleBreathing | StandIdle | loop, 1.0 cm | loop, 1.0 cm | loop, 1.0 cm |
| Conversation_chat_anim_1 | StandTalk (female) | loop, 1.0 cm | loop, 1.0 cm | loop, 1.0 cm |
| Conversation_chat_anim_2 | SitTalk (male) | loop, 1.0 cm | loop, 1.0 cm | loop, 1.0 cm |
| Posture_SittingAva | SitIdle / SitTalk | loop, 5.2 cm (seated contact) | loop, 6.4 cm (seated contact) | loop, 2.4 cm |
| Posture_Sitting_Idle | (seated idle) | loop, 0 cm | loop, 0 cm | loop, 0 cm |

- **chat_anim_1 / chat_anim_2 now loop cleanly** (seam ≤ 0.1°). The originals don't: their fingers are 39–57° apart
  between the last and first frame, so they probably pop on Ava and the bald character today. Worth swapping those
  for these, or turning on Loop Pose.
- So per-avatar **override controllers** (StandIdle / StandTalk / SitIdle / SitTalk → that avatar's fitted clips) are
  all you need for Kevin and Camila, as you said.

## Fit results (arm/leg overlap after the fit; the target is about 1 cm)

- **Megan:** 17 of 21 within about 1 cm. Exceptions:
  - HandingAppointmentCard 2.3 cm: right hand against the thigh while reaching;
  - WalkingCycle 3.3 cm: arms swing through the sides;
  - Sitting 5.9 cm and SittingAva 5.2 cm: seated contact.
- **Kevin:** 18 of 21. Exceptions:
  - WalkingCycle 1.9 cm;
  - Sitting 6.2 cm and SittingAva 6.4 cm: seated contact.
- **Camila:** 16 of 21. Exceptions:
  - HandingAppointmentCard 3.6 cm, anger_anim_2 4.4 cm, NeutralPosture 2.9 cm: the right hand pressing against the
    thigh;
  - Sitting 5.9 cm;
  - SittingAva 2.4 cm.
- **The seated clips** sit at 5–6 cm because the hands rest on the thighs and the thighs press together on the crossed
  legs. They looked fine in our renders, but please look at them on Quest.
- **Kevin's body:** he's the slimmest, so his standing clips start with the least overlap. Leg length scales the pelvis:
  Kevin ×1.11, Camila ×1.04 relative to Megan.

## Please check on Quest

1. Kevin and Camila with their override controllers: stand idle/talk and sit idle/talk loops. Watch for pops at the
   seam and for arms through the body.
2. The seated clips on all three: hands on the thighs, the crossed legs.
3. Camila's three "hand against thigh" clips, if your gesture system will use them.

The gesture system that triggers the other clips is CXRP-326 on your side. The manifest's `playback`, `root` and
`emotion` fields are there for it.
