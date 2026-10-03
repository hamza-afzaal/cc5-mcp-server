# CXRP-553: face pose library v1 (handoff to the Unity agent)

The emotion layer of the face system, as data: named face poses with blendshape weights **keyed by shape name**,
so they survive re-exports and carry over between CC4 characters (Kevin, Camila, Megan share the names). SALSA binds
by index, and a re-export can silently break that (you raised it on CXRP-548); this binds by name.

## 1. Delivered (pipeline folder; copy it in yourself, no FBX change)

- **Library:** `D:\Business\Code\art\characters\megan\face\megan_face_library.json` (39 poses, 52 shapes).
- **Review sheets (Megan, CC4 renders):**
  - `characters\megan\renders\pose_sheet_clinical.png`: the authored patient poses next to neutral, sad and fear.
  - `pose_sheet_emotions.png`: the 7 CC4 emotions × Lo/Med/Hi/Max.
  - `pose_sheet_female.png`: CC4's 6 female moods.
- Source and rules: `blender-pipeline/params/face/clinical-poses.json` (authored poses, with the reasoning for each)
  and `blender-pipeline/tools/face_poses.py`.

## 2. File format

```json
{
 "version": 1,
 "units": "blendshape weight 0..1, keyed by shape name; set it on every mesh listed in shape_meshes",
 "poses": {
  "worried": {"source": "authored", "why": "...", "weights": {"Brow_Raise_Inner_L": 0.6, "Mouth_Press_L": 0.3, ...}},
  "sad_med": {"source": "02_Sad_Med.italk", "weights": {...}, "held_frames": 43, "peak_activation": 4.09},
  ...
 },
 "shape_meshes": {"Brow_Raise_Inner_L": ["CC_Game_Body", "Camila_Brow"], "Mouth_Smile_L": ["CC_Game_Body"], ...},
 "missing_shapes": {}
}
```

- Weights are 0..1; Unity's `SetBlendShapeWeight` wants 0..100, so multiply by 100.
- **Set a shape on every mesh in `shape_meshes`.** The brow shapes live on both the body and `Camila_Brow`; setting only
  the body leaves the brow hair behind (that's why we kept 53 brow shapes in S4).
- `missing_shapes` is empty for Megan: every shape exists in her delivered FBX.
- A few CC4 Max poses overdrove shapes past 1; they're clamped to 1 (the raw values are in `"clamped"`), since Unity
  clamps blendshapes at 100% by default.

## 3. The poses

**Patient poses (authored, recommended for the conversation):**

| Pose | Reads as | Built from (facial action units) |
|---|---|---|
| `worried` | concern, calm eyes | inner brows raised and drawn together, lips pressed, slight frown |
| `embarrassed` | held-back smile | small smile restrained by lip press and dimpler; **pair with gaze down / head down** |
| `relieved` | tension leaving | soft smile, lips slightly parted (the exhale), eased brows |
| `discomfort` | moderate pain | brows lowered and knit, squint, cheek raise, nose wrinkle, lids partly down |
| `smile_warm` | genuine friendly smile | smile + cheek raise + eye crinkle |

**CC4 emotions (from CC4's own clips, mapped with ExPlus):** `anger_*`, `disgust_*`, `fear_*`, `happy_*`, `neutral_*`,
`sad_*`, `surprise_*`, each `_lo`, `_med`, `_hi`, `_max`.
- `sad_med`/`sad_hi`, `fear_lo`/`fear_med` (reads as worried) and `surprise_*` are useful.
- `happy_*` stays mild even at Max; use `smile_warm`.
- Anger and disgust are there but unlikely in a patient.

**CC4 female moods** (`f_confident`, `f_gentle_look`, `f_glancing`, `f_normal`, `f_relaxed`, `f_serious`): very subtle,
closer to idle variation than emotion.

## 4. Runtime model (suggested; you own the implementation)

Three layers, each writing only its own shapes:

1. **Emotion** (this library): the LLM/state machine picks a pose name plus an intensity 0..1.
   - Crossfade from the current pose over ~0.4 s.
   - Final weight = pose weight × intensity.
   - Blend between two poses by lerping their weight maps; a shape missing from one pose counts as 0.
2. **Mouth** (visemes, `V_*` and the tongue mesh): from the TTS stream later (or SALSA lip-sync for now).
   - The poses contain **no** `V_*` or tongue shapes, so the two layers don't fight.
   - While speaking, scale the emotion's mouth shapes (`Mouth_*`, `Jaw_*`) by ~0.5 so speech stays readable. Brows and
     eyes keep full strength.
3. **Life** (procedural): blink, saccades and gaze, head motion. Not in the poses.
   - Exception: `discomfort` sets `Eye_Blink` 0.2 as a lid droop. Combine it with the blink as max(pose, blink), not a
     sum.

**SALSA for now:** keep SALSA's lip-sync if you need it, but turn off SALSA's emote/EmoteR on any shape this library
drives, so two systems don't write the same shape.

## 5. Applying a pose by name (sketch)

```csharp
// once per avatar: name -> (renderer, index) for every mesh in shape_meshes
foreach (var (shape, meshes) in lib.shape_meshes)
    foreach (var smr in renderers.Where(r => meshes.Contains(r.name)))
    {
        int i = smr.sharedMesh.GetBlendShapeIndex(shape);   // -1 if absent: log it, don't guess
        if (i >= 0) bindings[shape].Add((smr, i));
    }
// per frame: weights = lerp(fromPose, toPose, t) * intensity
foreach (var (shape, w) in weights)
    foreach (var (smr, i) in bindings[shape]) smr.SetBlendShapeWeight(i, w * 100f);
```

## 6. Please check (Quest, stills)

1. `worried`, `discomfort`, `relieved` and `smile_warm` at intensity 1.0 and 0.5: do they read at conversation distance
   (~1 m) on the headset?
2. A shape that exists on the body but not the brow mesh (or the reverse) must log, not break.
3. Emotion plus speech together: the mouth stays readable with the emotion's mouth shapes scaled to 0.5 while talking.

## 7. Not in this delivery

- Mapping the TTS visemes onto CC4's viseme shapes (`V_*`, tongue): the next step of CXRP-553, once the TTS
  provider's viseme set is fixed.
- Libraries for Kevin and Camila: the same names, so this file should work as is. `face_poses.py` regenerates it
  per character against that character's shape manifest if you want the check.
