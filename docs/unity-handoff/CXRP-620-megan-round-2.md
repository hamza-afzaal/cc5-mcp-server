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

**Result:** the twist driver made no difference, and the owner says the problem is a twist, not the bend. Fixed in §5.

## 5. Round 2b: the owner's review fixes (2026-10-14)

Re-copy the clips below. Rollback for the first table: `library_v0\unity_pre_620b\`. Rollback for the elbow table: `unity_pre_620b\` next to each folder, and `exports\unity_clips_pre_620b\`.

| Clip | Fix |
|---|---|
| `Posture_Sitting_Idle` | **Jaw closed:** `CC_Base_JawRoot` held at 180°, as in every other clip. Her jaw was about 10° open in **every** version of this clip back to the CC4 source, not only in round 2; our seat tool didn't drop it. **Hands:** the fingers now follow the forearm onto the thigh. Her wrists bent about 45° outward; now 8–11° sideways and about 20° up or down. Sit, lean and legs are unchanged. |
| `Posture_Sitting_StandToSit` | **Hands stay on the thighs through the leg cross** (frames 26–120). From 108 to 134 they move straight into the knee clasp. Before, they hung beside the lifting knee (frames 88–110), then the left hand went up to her chin. During the sit-down itself (26–82) the hands already touch the jeans (≤ 1 cm). The end pose, and so the SitTalk seam, is unchanged. |
| `Gesture_FrustratedPosture` | **Left wrist eased**, from up to 79° flex / 62° sideways to 46° / 15°. **The right hand is back to the original.** |

### Elbows: arm roll + bend (option A) + elbow skin weights

**Clips (re-copy):**
- `library_v1\unity\`: puzzled_scratch_head, disappointed_stand, worried, its_too_hot_sweating, feeling_faint, crying_contained, thinking, afraid, pity_stand (pity: only a short stretch, 42 keys)
- `library_v0\unity\`: Conversation_anger_anim_5
- `beat\unity\`: BEAT_happy, BEAT_disgust_a
- `exports\unity_clips\`: **Megan_StandTalk** (your "StandTalk", which matches your 9.3 s numbers)

**What the tool does** (`tools\arm_roll.py`), only while the elbow is bent 70–100° or more:
- **Upper-arm roll:** pulled toward about 30° by swivelling the whole arm about the shoulder-wrist line, at most 35°. The hand keeps its position and orientation; the elbow moves on its circle, a little higher and wider.
- **Bend:** capped near 142° (option A). The hand keeps its orientation; the wrist moves a few cm.
- **Forearm roll:** left as the hand pose needs it, as you suggested. With the hand fixed, the swivel moves some roll from the upper arm into the forearm and hand. Only turning the palm would reduce both.

**Measured on our clips during deep bends (≥ 100°).** Upper-arm roll before → after, and the max bend after:

| Clip | Upper-arm roll during deep bends (deg) | Max bend after (L / R) |
|---|---|---|
| puzzled_scratch_head | R 54 → 34 | 127 |
| disappointed_stand | L 49 → 33, R 51 → 33 | 101 |
| worried | L 32 → 29, R 45 → 31 | 139 / 142 (was 142 / 149) |
| its_too_hot_sweating | L 53 → 34, R 60 → 41 | 130 / 134 |
| feeling_faint | L 32 → 29, R 41 → 32 | 127 / 131 |
| crying_contained | L 37 → 31, R 52 → 40 | 141 / 143 (was 144 / 145) |
| thinking | R 41 → 32 | R 143 (was 159) |
| afraid | (already ≤ 23) | 138 / 138 (was 140 / 141) |
| anger_anim_5 | L 50 → 42, R 50 → 40 | 104 / 102 |
| BEAT_happy | L 73 → 51, R 74 → 48 | 137 / 141 (was 138 / 147) |
| BEAT_disgust_a | R 67 → 44 | R 141 (was 147) |
| StandTalk | L 44 → 36, R 43 → 38 | 121 / 124 |

Most clips reach the ~30° target or are close. **BEAT_happy, disgust, anger_anim_5 and its_too_hot** stop at 40–51°: the swivel limit, since more would swing the elbow visibly wide. The hand pose is kept. No new frame-to-frame pops (largest rotation step per bone, against the previous version).

**Megan's model** (`blender\megan.fbx`, copied only after the owner's OK):
- **Elbow skin moved off `upperarm_twist_01` onto `upperarm`:** a smooth ramp from mid upper arm to the elbow (S4 `weight_shift`).
- **Twist bone's share of the skin within 7 cm of the elbow:** 28–41% → about 1% (body and sweater).
- Your TwistDriver now only moves the shoulder-side half of the upper arm, as intended. No other change; validate PASS. Rollback: `characters\megan\blender_pre_620b\`.

**Offline, with your driver simulated:** worried at 19 s, the right elbow's dented, twisted crease becomes a clean, rounded elbow.

**If the forearm still looks twisted at the elbow:** try the Avatar's **Lower Arm Twist at 0**. As we understand it, the Humanoid then keeps hand roll out of the lower-arm bone, and your TwistDriver spreads 50% of it from mid-forearm, so the elbow skin wouldn't roll with the hand. Please confirm in your Avatar settings. Per-bone rolls can't be matched one to one between our clip and your import: the Humanoid has no hand-roll muscle and carries forearm plus hand roll as one Forearm Twist. Your StandTalk forearm −70° is 96° of **hand** roll in our clip, with the forearm at 2°.

### Cough moments for `Megan_AD_unwell_cough_and_sneeze`

These are in its `library_v1_manifest.json` entry. We found them in the motion: quick forward jerks of the head and chest, checked by eye.
- `"cough_frames": [23, 41, 62, 280, 465]`: hunched with a hand on the chest (23, 41, 62), a forward jerk (280), a hand to the mouth (465).
- `"sneeze_frames": [168, 543]`: each follows a head-back wind-up (160, 535). Pulse `cough` on these too, or leave them to the body.

### Your other notes

- **BEAT fear 1 cm under:** keep your 1 cm lift on that clip. Our check puts its heel joints at Megan's floor height (6.2 cm), the same as happy, so we haven't found where the extra centimetre comes from.
- **Planted-foot noise:** it is in our clip. On BEAT fear's planted frames it's about 0.2 mm per frame typical, 0.7–0.9 mm at the 95th percentile. A smoothing pass is a small follow-up if you want it.

## Not in this delivery

- **Seated versions (§5):** not done. They stay off when seated, as you have them.
- **Walk loop "so-so":** no defect named. Unchanged.

## Please check (review tool)

1. **Sitting_Idle:** knees together and over the feet, hands resting on the thighs, no skin at the crotch.
2. **StandToSit / SitToStand:** the hands touch the thighs while she sits and stands, with no hand pop.
3. **chat_anim_2 and PointingAtPhone:** no knee jitter. LoweringHead: fingers outside the sweater. anger_anim_5 end and FrustratedPosture right hand.
4. **BEAT fear / happy:** planted slide ≤ 1.5 cm/s on your import, and the feet on the floor without your offset.
5. **Faces:** `crying` and `cough` play from `megan_vocab.json` v1.2. `guarded` now lowers the outer eyelids.
6. **Round 2b:**
   - Sitting_Idle: mouth closed, wrists straight on the thighs.
   - StandToSit: hands on the thighs through the leg cross, then straight to the knee clasp.
   - FrustratedPosture: left wrist softer, right hand as originally.
   - Elbows: worried at 18–24 s, puzzled at 20.3 s and BEAT_happy, after both the clips **and** `megan.fbx` are copied.
