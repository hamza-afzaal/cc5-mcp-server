# CXRP-551: Megan's fitted stance clips (handoff to the Unity agent)

Continues CXRP-550 (Megan import, replaces Ava). These clips are CC4 female motions **fitted offline to Megan's BMI-28
body**: the limbs no longer sink into each other, and the poses keep their meaning.

## 1. Delivered

`Assets/_CraftXR/Art/Models/Avatars/Megan/Animations/`. All new and **untracked**: put them on Megan's branch with the
avatar files, with LFS for the FBX.

| File | Source motion | Use for layer |
|---|---|---|
| `Megan_StandIdle.fbx` | CC4 Female Idle_1 | **StandIdle** |
| `Megan_StandTalk.fbx` | CC4 Stand Talk | **StandTalk** |
| `Megan_SitTalk.fbx` | CC4 Female Sit Talk (legs crossed, right over left) | **SitTalk**, and **SitIdle** (cut, see §3) |

These are motion-only FBX on Megan's GameBase skeleton (same bone names as `megan.fbx`). They're exported with Reset
Bone Scale at 30 fps. **Frame 0 of each clip is CC4's T-pose: start each clip at frame 1.**

## 2. Import

1. Rig: **Humanoid, with Megan's Avatar** ("Copy From Other Avatar" → MeganPrefab's Avatar), so the clips retarget
   exactly onto her.
2. Clip: start frame 1 (drops the T-pose), Loop Time on, Root Transform rotation/position Y/XZ baked as in your
   existing stance clips.
3. The clips carry no facial or blendshape curves that matter here (CC4's motion export). The face stays with
   SALSA / the face system.

## 3. Controller: Megan's own variant (no code)

`AvatarBasicAnimationController` resolves layers **by name**. So give Megan a copy of `FemalePatientStanceController`
(e.g. `MeganStanceController`) with the same 6 layers, and swap only the clips:

| Layer | Clip |
|---|---|
| StandIdle | `Megan_StandIdle` |
| StandTalk | `Megan_StandTalk` |
| SitIdle | `Megan_SitTalk`, **cut to ~2.7–12.4 s**: the calm stretch where her hands rest on her crossed knee. Loop it; trim the in/out points to matching poses. |
| SitTalk | `Megan_SitTalk` (full) |
| SitBreathe, Base | unchanged (keep your breathing overlay) |

Also add the **TwistDriver** from CXRP-552 to MeganPrefab if it isn't there yet. These clips don't drive the twist bones.

## 4. What was corrected (so you know what to look for)

Measured frame by frame on Megan's real mesh, with Unity-accurate skinning:

- **Sit Talk.** The stock clip pushed her thighs **5+ cm** into each other where the legs cross. Fit:
  - the crossing thigh sits higher, by about 15°;
  - the lower thigh eases out, by about 6–10°;
  - the elbows swing out slightly.
  - **Kept:** the cross itself (right over left on every frame), and her **hand resting on the knee**: the arm follows the knee.
  - **Remaining:** typically about 1.3 cm of thigh contact, and 2–3 cm in a few frames, inside the jeans.
- **Stand Talk:** the arms sank up to **6.6 cm** into her sides. Now **≤1.1 cm**: the arms rest a few degrees out from the body.
- **Standing idle:** the arms sank 2.8 cm into her sides. Now **≤1.0 cm**: arms about 9–10° out from the body.

## 5. Please check in the A/B (Quest, with stills)

1. **Seated:** the hips are at the chair (CXRP-325) and the legs read as crossed. Check that no jeans leg passes visibly through
   the other at the knee, and that the hand rests on the knee.
2. **Standing:** no sleeve sinks into the sweater at the sides, and the arm stance reads natural, not stiff.
3. The loop seams of SitIdle (your cut) and the two standing clips.
4. Breathing overlay plus these clips together, on device at 72 fps.
