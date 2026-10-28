# CXRP-687 / 693: Camila and Kevin brought to Megan's level (handoff to the Unity agent)

Camila and Kevin now get everything Megan got after library v0 (CXRP-582, 583, 586, 587, 616, 620, 620b):
- the same clip set, 26 clips, each fitted to its own body;
- the same seat and floor rules;
- the same elbow fix;
- an owner-approved face vocabulary.

Megan's embarrassed face also changed (vocab v1.3). File names are unchanged unless listed as new.

## 1. Models: elbow weights (already copied)

- **What changed:** `characters\camila\blender\camila.fbx` and `characters\kevin\blender\kevin.fbx` (+ `.json`).
  The upper-arm twist weights near the elbow are moved onto the upper arm, as for Megan in CXRP-620b: 64–66 vertices
  per arm.
- **What didn't:** blendshapes, meshes, materials and textures are unchanged. Validate PASS.
- **SALSA:** the blendshape lists are identical, so its bindings stay valid.
- **Rollback:** `characters\<id>\blender_pre_687\`.
- **Copied 2026-10-29 (owner OK):** `deliver_unity.py --apply` put `camila.fbx` + `camila.json` into `Avatars\Camila`
  and `kevin.fbx` + `kevin.json` into `Avatars\Kevin`. All 75 / 87 files are byte-identical to the art side.
  **Reimport both** and check that the prefabs still bind: SALSA, TwistDriver and the override controllers.

## 2. Re-copy the clip libraries

| Avatar | Folder | Files |
|---|---|---|
| Camila | `D:\Business\Code\art\characters\camila\exports\library_v0\unity\` | `Camila_<clip>.fbx` × 26 + `library_v0_manifest.json` |
| Kevin | `D:\Business\Code\art\characters\kevin\exports\library_v0\unity\` | `Kevin_<clip>.fbx` × 26 + `library_v0_manifest.json` |

- Rollback: `library_v0\unity_pre_687\` (the 21 clips you have now).
- Each manifest entry has a **`cxrp687`** line saying what changed for that clip.

**New clips (5 per avatar)**, the same as Megan's:
- `Posture_Sitting_StandToSit` and `Posture_Sitting_SitToStand` (CXRP-586);
- `Motion_WalkRelaxed_1Start`, `_2Loop` and `_3End` (CXRP-583).

They're built from the same CC4 motions as Megan's, so the manifest fields (`chain`, `meaning`, `walk`) match hers.
The walk distances are scaled to each body's hips: Camila ×1.041, Kevin ×1.114.

**Retired:** `Posture_Sitting` (1 s, ends on a ~25 cm seat), as on Megan. Use StandToSit / SitToStand.

### Seated: the 45 cm standard seat (CXRP-587 rule)

| Clip | Megan | Camila | Kevin |
|---|---|---|---|
| Posture_Sitting_Idle | 44.1 | 44.2 | 44.0 |
| Posture_SittingAva | 44.0 | 44.1 | 44.3 |
| StandToSit / SitToStand | 44.2 | 44.2 | 44.5 / 44.4 |

`seat_contact_cm` is in clip units; your height normalisation brings it to about 45.

The seated clips also have Megan's round-2 shape:
- **Sitting_Idle:** a chair sit with the hands on the thighs and the jaw closed.
- **StandToSit / SitToStand:** the hands brace on the thighs.
- **StandToSit → SittingAva:** a pose bridge, so the SitTalk seam matches.

Kevin's StandToSit / SittingAva / SitToStand chain is lowered 1.5 cm. His hips are wider, and unadjusted he sat 0.7 cm
above the seat.

### Standing: floor at 0 for every standing clip

- **What changed:** every standing clip (and the walks) now has `floor_at_0: true`. The planted heels are on each
  avatar's own floor, from its CC4 idle:

  | Avatar | Heel joint | Ball |
  |---|---|---|
  | Camila | 7.43 cm | 3.61 cm |
  | Kevin | 8.35 cm | 4.07 cm |

- **For you:** drop your per-clip floor offsets for Camila and Kevin. All of them, not just 5 as on Megan.
- **Planted foot slide:** 0.1–2.1 cm/s on Camila and 0.1–3.5 on Kevin. The worst is Kevin's anger_anim_2 at 3.47;
  Megan's is 4.94. The walk clips have no slide figure, since their feet are meant to move.

### Per-clip fixes (Megan's round 2, same frames)

- anger_anim_5 settles into a 0.4 s hold instead of stopping dead.
- FrustratedPosture: the left wrist is eased.
- LoweringHead: the hands stay out of the T-shirt.
- chat_anim_2: the source's 3-frame ramp-in is dropped (it popped every loop), and the clip is re-looped.
- **Elbows (CXRP-620b arm roll):** about 9 clips per avatar had keys softened. The manifest note says "arm roll /
  deep elbow bend softened".

## 3. Face words

| File | Version | Changes on review (owner, 2026-10-29) |
|---|---|---|
| `characters\camila\face\camila_vocab.json` | first | embarrassed, angry |
| `characters\kevin\face\kevin_vocab.json` | first | embarrassed |
| `characters\megan\face\megan_vocab.json` | **v1.3** | embarrassed |

- **Same words and units as Megan's v1.2.** `shape_meshes` is rebuilt per character: Camila's brows are `Camila_Brow`,
  Kevin's `Male_Brow_2`.
- **embarrassed (all three):** the smile read as plain happy. It's now a small lopsided, held-back smile with pressed
  lips, worried inner brows and lowered lids. **Add your gaze-down / head-turn**: that's what makes it read as
  embarrassment.
- **Camila's angry:** brows fully lowered and knitted, eyes narrowed, heavier lids, lips pressed.
- **Kevin's gaps:**
  - `guarded` drops Eyelid_Outer_Down_L/R (his model doesn't have it). Nothing else changes.
  - His tongue has no Jaw_Open. The words that open the jaw (happy 0.14, relieved 0.08, surprised 0.15, cough 0.38)
    move the teeth and lips but not the tongue blendshape. In CC4 it looks fine; **please check cough on Kevin in
    Unity** for a tongue poking through the lower teeth.
- **Review sheets:** `characters\<id>\face\<id>_vocab_review_head.png`.

## Please report back

1. Floor: Camila and Kevin standing on the floor with your per-clip offsets removed.
2. SitTalk seams on both after StandToSit; the seat at 45 cm.
3. Kevin's cough (tongue) and embarrassed with gaze-down on all three.
