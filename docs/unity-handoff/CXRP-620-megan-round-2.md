# CXRP-620: Megan round 2 (handoff to the Unity agent)

These are the fixes from the owner's second Animation Review (2026-10-09). Everything is under
`D:\Business\Code\art\characters\megan\`. You copy as usual. File names are unchanged.

## 1. Re-copy these clips

Each folder has a rollback copy, `unity_pre_620\`, next to it. The manifests in the same folders are updated.

| Folder | Clips |
|---|---|
| `exports\library_v0\unity\` | Posture_Sitting_Idle, Posture_Sitting_StandToSit, Posture_Sitting_SitToStand, Actions_PointingAtPhone, Conversation_chat_anim_2, Conversation_LoweringHead, Conversation_anger_anim_5, Gesture_FrustratedPosture + `library_v0_manifest.json` |
| `exports\library_v1\unity\` | AD_emotion_timid_stand + `library_v1_manifest.json` |
| `exports\beat\unity\` | BEAT_fear, BEAT_happy + `megan_beat_manifest.json` |

Each changed clip has a `cxrp620` line in its manifest entry that says what changed.

### Seated (§1)

**Posture_Sitting_Idle** is now a chair sit for Megan's body. It is still the open-leg loop, under the same name.
- **Legs:** knee centres 15 cm apart (her hip joints are 22 cm apart). The knees sit over the feet, shins vertical, feet flat on the floor.
- **Hands:** resting on her thighs, palms flat, fingertips toward the knees.
- **Lean:** she leans about 18° forward and the head stays level. Without the lean her arms can't reach the knees: shoulder to knee is 61 cm, her arm 49 cm.
- **Seat:** built for the 45 cm standard seat, `seat_contact_cm` 44.1 (as before). Her thighs slope about 17° down to the knee on that seat. Level thighs would need a 33 cm seat, which is the "too low" look the owner disliked on Posture_Sitting. On the 61 cm stool: lift her in the portal as now; her feet hang.

**StandToSit / SitToStand**
- **StandToSit:** her hands brace on her thighs while she sits down, from frame 26 to 82.
- **SitToStand:** they push on her thighs as she gets up, from frame 76 to 116. Before, they hovered 10–35 cm off her legs.
- **Unchanged:** the crossed-leg end of StandToSit and the crossed-leg start of SitToStand, so the SitTalk seams are exactly as before.

### Per-clip fixes (§4)

| Clip | Fix | Planted slide (cm/s) |
|---|---|---|
| Conversation_chat_anim_2 | **The "knee jitter" was a loop pop.** The source's first 3 frames are a ramp-in (hand 24 cm, foot 7 cm in one frame), played on every loop. They are dropped and the clip re-looped (148 frames now). | 0.46 |
| Actions_PointingAtPhone | The knee jitter came from our foot lock: its on/off edges are now smoothed (peak knee acceleration 4.9 → 1.9 cm/frame²). | 0.81 |
| Conversation_LoweringHead | **The hands come out of the sweater.** The fingers were up to 3.8 cm in on the hips. Now ≤ 0.5 cm. | 0.21 |
| Conversation_anger_anim_5 | **No more dead stop.** It stopped dead 9 frames after the slam, on its last frame. It is now 0.4 s longer: after the slam she settles into a hold (79 frames). | 0.05 |
| Gesture_FrustratedPosture | **Right wrist.** Its 63° bend at the end, tucked under the left arm, is eased to about 38°. | 0.54 |
| AD_emotion_timid_stand | **First-frame pop.** It had the same pop (right hand 10 cm, first frame not fitted). Dropped, re-looped. | 0.91 |
| BEAT_fear / BEAT_happy | **Feet planted for real.** See below. | **1.01 / 0.51** |

**BEAT fear / happy:** your 3.9 / 3.7 cm/s came from three things our ball-only metric missed.
- The planted foot pivoted on its held ball, so the heel slid.
- The 1.5 s loop blend at the end dragged both feet back at about 30 cm/s.
- Each foot was pitched toes-down, 3–4 cm into the floor.

What changed:
- **Heading hold:** a planted foot now keeps its heading as well as its position.
- **Steps instead of slides:** when the body wanders more than 6 cm off a held foot, the foot takes a small step (lifted 2.5 cm over 8 frames), and the feet alternate.
- **Toe pitch:** the toes are lifted out of the floor.

Counting heel and toe like your tool: fear 1.66 / 0.91 cm/s (left / right foot), happy 0.59 / 0.72. **Please measure fear on your import**; it's the one near the 1.5 target.

### Floor (your per-clip offsets)

The re-copied standing clips are marked `floor_at_0: true` in their manifest entries: Megan's floor, with the heel joint at 6.2 cm and the ball at 2.4 cm, as in her own CC4 idle. **Drop your floor offset for exactly these clips:**
- PointingAtPhone, chat_anim_2, LoweringHead, anger_anim_5 and FrustratedPosture: they were raised 2.1–2.3 cm (chat_anim_2 already was at the floor);
- BEAT_fear and BEAT_happy: the toes were lifted, the heels were already right.

Every other clip keeps your offset for now. The seated clips are placed by the seat, as before.

## 2. Megan's model: no skin at the crotch (§3)

- **What changed:** the skin under the jeans is pushed 2 cm into the body (S4 `skin_inset`, as for the shoulders in 548).
- **Measured:** with Quest's 2 bone weights, skin through the jeans when seated went from 3 vertices / 1.85 cm (groin, open-leg sit) to 0.
- **What we couldn't reproduce:** visible skin at the crotch, in any of our renders, before or after.
- **Please tell us which clip, frame and view showed it** if it's still there after this. We'll fix that pose.
- **Files:** `blender\megan.fbx` (+ `megan.json`, `.fbm` unchanged). Validate PASS. Rollback: `characters\megan\blender_pre_620\`.

**Copied (2026-10-14, owner OK):** `deliver_unity.py --apply` put `megan.fbx` + `megan.json` into `Assets\_CraftXR\Art\Models\Avatars\Megan`. All 70 files are byte-identical to the art side.

## 3. Face words `crying` and `cough` (§6): `face\megan_vocab.json` v1.2

The owner approved both from CC4 renders on 2026-10-14. Crying's lips were softened on review.
- **`crying`**: grief brows, squeezed eyes, chin up, a soft down-turned mouth. Pair it with `Megan_AD_emotion_crying_contained`.
- **`cough`**: eyes screwed shut, brows down, nose wrinkled, jaw open with the lips pulled back. **Pulse it on each cough** of `Megan_AD_unwell_cough_and_sneeze` instead of holding it.
- **`shape_meshes`** gains 9 shapes: Mouth_Chin_Up, Mouth_Down_Lower_L/R, Mouth_Tighten_L/R, Nose_Crease_L/R, and **Eyelid_Outer_Down_L/R**. The eyelid pair was already used by `guarded` in v1.1 but was missing from the table. If your loader sets shapes only through `shape_meshes`, guarded's lowered outer lids were not showing until now.
- All the shapes are in the delivered `megan.fbx`. Rollback: `face\vocab_v0\megan_vocab_v1.1_backup.json`.

## 4. Elbows (§2): please check in Unity first, no fix yet

The owner asked us to rule out the Unity side before fixing anything, since the wrist candy-wrap (CXRP-552) turned out to be twist bones plus 2-weight skinning.
- **Skin weights:** not the cause. Frame 162 of thinking with 4 weights and with 2 weights renders the same.
- **Twist bones:** could add to it. 32–41% of the skin within 7 cm of the elbow (body and sweater) is weighted to `upperarm_twist_01_*`. Your TwistDriver turns that bone against the upper arm's roll: in thinking, about +10° (left) and −13° (right). Our offline renders kept it at bind. With your values applied, the elbow point skews slightly.
- **The fold:** it comes from the 140–159° bend itself, with or without the driver.

**Please send:** a screenshot of `Megan_AD_emotion_thinking` at **frame 162**, the deepest bend, at the elbow:
1. as it is now;
2. with the two `upperarm_twist_01` TwistDriver entries at **weight 0**.

What we do next depends on the result:
- **The warp goes away in (2):** we move the elbow skin off the twist bone in the weights, art side.
- **It stays:** it's the bend. We cap it at about 140° in those clips (option A).

## Not in this delivery

- **Seated versions (§5):** not done. They stay off when seated, as you have them.
- **Walk loop "so-so":** no defect named. Unchanged.

## Please check (review tool)

1. **Sitting_Idle:** knees together and over the feet, hands resting on the thighs, no skin at the crotch.
2. **StandToSit / SitToStand:** the hands touch the thighs while she sits and stands, with no hand pop.
3. **chat_anim_2 and PointingAtPhone:** no knee jitter. LoweringHead: fingers outside the sweater. anger_anim_5 end and FrustratedPosture right hand.
4. **BEAT fear / happy:** planted slide ≤ 1.5 cm/s on your import, and the feet on the floor without your offset.
5. **Faces:** `crying` and `cough` play from `megan_vocab.json` v1.2. `guarded` now lowers the outer eyelids.
6. **Elbow:** the two frame-162 screenshots from §4.
