# CXRP-586: body clip fixes, re-tags and sit/stand transitions (handoff to the Unity agent)

From the owner's review of every body clip (2026-10-07). **Re-copy these folders:** the files keep their names, and you
remain the only writer on the Unity side.

| Avatar | Folder | What changed |
|---|---|---|
| Megan | `D:\Business\Code\art\characters\megan\exports\library_v0\unity\` | all 21 clips (fingers, eyes), SittingAva re-fit, **2 new clips**, manifest |
| Megan BEAT | `D:\Business\Code\art\characters\megan\exports\beat\unity\` | all 5 clips (fingers) |
| Kevin | `D:\Business\Code\art\characters\kevin\exports\library_v0\unity\` | all 21 clips (fingers, eyes), manifest |
| Camila | `D:\Business\Code\art\characters\camila\exports\library_v0\unity\` | all 21 clips (fingers, eyes), manifest |

Rollback: each folder's sibling `unity_pre_586\` holds the previous files.

## Fixes

1. **Fingers bent backwards.**
   - The BEAT motion capture bent finger middle joints back by 32–52°, worst in BEAT happy.
   - Every clip now limits backward bend: about 5° for the middle and end finger joints, 25° for the knuckles.
   - Curled fingers are untouched: the anger_anim_1 fist is unchanged.
2. **Eye spin.**
   - `Conversation_chat_anim_2` spun the right eye 360° in 0.4 s (frames 132–144), an Euler wrap in the eye-bone curve.
   - The eye bones are now held still in every body clip, so gaze is entirely yours (procedural).
3. **SittingAva crossed leg.**
   - On Megan the crossed foot rose to 68 cm, floating about 23 cm above her other knee.
   - A second fitting pass was lifting the leg again on top of the first lift. It now stays at 28–40 cm, resting at
     the other knee.
   - Thigh-on-thigh contact is about 5 cm where the legs cross; that's the trade-off.
   - Megan only: Kevin and Camila follow when their seated clips are redone (CXRP-587).
4. **Sit-down transition.**
   - `Posture_Sitting` (1 s) dropped her onto a ~25 cm seat, with knees above hips and feet 13 cm off the floor.
   - It is marked `retired` in the manifest; don't select it.
   - New for Megan:

| Clip | Length | What it does |
|---|---|---|
| `Megan_Posture_Sitting_StandToSit` | 5.1 s, one-shot | sits down and crosses the right leg; ends in SittingAva's pose |
| `Megan_Posture_Sitting_SitToStand` | 5.5 s, one-shot | from SittingAva's pose, uncrosses and stands |

   - Both are CC4's own *Stand to Sit* / *Sit to Stand*, fitted to Megan.
   - They chain: StandIdle → StandToSit → SittingAva (loop) → SitToStand → StandIdle.

**Update (CXRP-582):** the first delivery of the two transitions started with a T-pose frame (a retarget bug for
CC4-exported sources). They are re-fitted; re-copy both files if you already took them.

## Seat height (important for placing her on a chair)

- **All seated clips assume a seat about 36 cm high.** The manifest gives `seat_contact_cm` per seated clip: the lowest
  point of her buttocks above the floor.
- **On a taller chair she sinks into it; on a lower one she floats.**
- Scene chairs vary, so the plan (CXRP-587) is:
  - a 45 cm standard chair;
  - the seated clips re-fitted to 45 cm;
  - you align `seat_contact_cm` to the chair's seat, with leg IK for the remaining ±8 cm.
- **Until then:** use a chair whose seat is about 36 cm, or lower her by (chair seat − 36.5 cm).

## Manifest changes (`library_v0_manifest.json`, all three avatars)

New per-clip fields:
- `use`: `body_language` (pick by emotion for the gesture flag), `stance` (your controllers) or `action` (scripted
  commands only).
- `emotion`: still one word from the agreed vocabulary, so selection by emotion keeps working.
- `emotions`: every vocabulary word the clip fits.
- `meaning`: what the clip actually shows, for humans.
- `requires` (anger_anim_1 only): `surface_in_front`, `surface_height_cm: [88, 95]`. It's a counter slam, so only play
  it when she stands at a counter-height surface.
- `intensity` (anger_anim_4/5): `small` / `big`.
- `retired`: true on `Posture_Sitting`. **Never select a retired clip.**
- `seat_contact_cm`: on seated clips.

Re-tagged (owner-approved):

| Clip | Now |
|---|---|
| Conversation_LoweringHead | frustrated (+ sad): disappointed / exasperated, head shake, hands on hips |
| Conversation_CrossingArms | guarded: refusing / dismissive, head shake "no" |
| Conversation_PointingForward | angry: accusing jab (was "insistent / emphasis") |
| Conversation_anger_anim_1 | angry: counter slam (`requires` a surface) |
| Conversation_anger_anim_2 | angry: accusing finger poke |
| Conversation_anger_anim_3 | angry (+ frustrated): dismissive turn-away |
| Conversation_anger_anim_4 / _5 | angry: tantrum, small / big |
| Gesture_FrustratedPosture | frustrated: head tilt (no eye roll in the clip) |

## Please check on Quest

1. BEAT happy around 4.3 s (frame 130): fingers no longer curve backwards.
2. Megan seated: the crossed foot rests at knee height and doesn't rise.
3. StandToSit → SittingAva → SitToStand plays without a pop at the joins.
4. Reply with your chair's seat height; it decides the CXRP-587 plan.
