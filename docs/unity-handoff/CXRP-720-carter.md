# CXRP-720: Carter, rebuilt to Megan / Kevin / Camila's level (handoff to the Unity agent)

Carter (a frail woman in her 70s) is rebuilt end to end through the same pipeline as Camila, Kevin and the bald man.
What's new:
- an old face and body on Camila's base: Human Anatomy Female Old sliders, aged skin with wrinkles and age spots,
  greyed brows, a grey chic bun;
- an owner-approved outfit made in Blender: a cream turtleneck, a hip-length blue-grey knit cardigan, charcoal
  straight-leg slacks, dark leather flats (no bare legs);
- Game Base (Single Material);
- the Blender stage;
- 26 clips fitted to her body;
- a face vocabulary.

Treat her as a **new avatar**: fresh import, fresh prefab. The existing `Avatars\Carter\` folder (the legacy Carter,
ponytail and rocker jeans) is **not touched**; the new model goes to a new folder, `CarterV2`. Decide with the owner
whether she replaces the legacy prefab or sits beside it.

## Fix round 1 (2026-10-31): your review of 2026-10-31

The model is rebuilt; the clips are unchanged (same body and skeleton, so reuse the imported ones). Re-import
`carter.fbx` + `carter.json` (+ the changed textures, 29 files) over `CarterV2`; mesh, material and shape names and
order are unchanged (body 152, brow 47, tongue 41 shapes), so the prefab's SALSA and vocab bindings stay valid.

| Your item | Fix |
|---|---|
| 1. Back of the head bare below the bun | The scalp cap's painted hair is now grey (just under the strands' grey), so it reads as her hair drawn tight into the bun. No extra hair: the Chic bun's only other piece is long loose hair, and CC4 takes one hairstyle |
| 2. Skin through the scalp | The head skin sat within 1 mm of the cap (104 vertices outside it). Every skin vertex near the cap now sits 3 mm under it; the hairline is unchanged |
| 3. Skin/turtleneck through the cardigan | Skin 1 cm under the cardigan; turtleneck 3 mm in where the cardigan covers it (contacts within 1 mm on the upper back: turtleneck 3 → 0) |
| 4. Skin too shiny | `Roughness_Value` 0.55 on `Ga_Skin_Body` (smoothness 0.45 instead of 0.63) |
| 5. Bare ankle seated | Mid-calf charcoal socks (`Carter_Socks` material, merged into `Canvas_shoes` by Game Base), hidden under the flats' upper |
| 6. Bun darker than the hair | The bun's RLHair specular settings now match `Hair1_Transparency` (Specular 0.8, Secondary 1.0) |

**Camila:** your hair fix is in her JSON now (`Soft_Waves_Lob_Transparency`: `Roughness_Value` 0.55, normal strength 50),
so a CCiC rebuild keeps it. Only `camila.json` changes; trilinear filtering stays your import setting.

## 1. Model (copied 2026-10-30, all files byte-identical)

| From | To |
|---|---|
| `D:\Business\Code\art\characters\carter\blender\` | `Assets\_CraftXR\Art\Models\Avatars\CarterV2\` (new folder) |

`carter.fbx` + `carter.json` + `carter.fbm\` + `textures\carter\`: 95 files, all new. **Always import the FBX and the
JSON together** (CCiC).

- **51,357 triangles, 21 material slots, 242 blendshapes.** Validate PASS.
  - The slots are over the ≤ 8 LOD0 budget. That's the same open M2 item as the other avatars.
- **Meshes:**
  - `CC_Game_Body`, `CC_Base_Eye`, `CC_Base_Teeth`, `CC_Game_Tongue`, `Camila_Brow` (3D brows, as on Camila);
  - hair: `Hair_Base`, `Bun` (strand-style hair cards);
  - the outfit: `Carter_Turtleneck`, `Carter_Cardigan`;
  - `Canvas_shoes`, which, despite its name, is the slacks + flats that Game Base merged into one mesh (materials
    `Carter_Slacks`, `Flat_Leather`, `Flat_Sole`, `Flat_Lace`). The hidden canvas-shoe part is removed.
- **Cloth smoothness:** `Roughness_Value` set for the knits (0.9), slacks (0.8), leather (0.6) and soles (0.8), so CCiC
  doesn't give them the wet 0.9-smoothness look.
- **Floor:** her CC4 idle puts the heel joint at 7.46 cm and the ball at 4.02 cm.
- **Blinks:** her lids close in front of the eyes. In a flat test render a thin slit shows along the lash line at full
  blink, a little wider on her right eye than Camila's; with lashes and real shading (CC4) the eyes read fully closed.
  No blink correction was applied.
- **Tongue:** it has `Jaw_Open` (Camila's base).
- **Web:** `characters\carter\blender\web\carter.fbx` (textures embedded) is for the owner's web upload, not Unity.

## 2. Clip library (copy it yourself)

| From | Files |
|---|---|
| `D:\Business\Code\art\characters\carter\exports\library_v0\unity\` | `Carter_<clip>.fbx` × 26 + `library_v0_manifest.json` |

It's the same 26-clip set as Megan, Camila, Kevin and the bald man, built with the same rules:
- Megan's round-2 shapes;
- the CXRP-620b elbows;
- the per-clip fixes;
- `Posture_Sitting` retired: use StandToSit / SitToStand.

Each manifest entry has a `cxrp687` note.

- **Hips:** ×0.909 (her narrower pelvis), so the walk distances are scaled the same.
- **Standing clips:** every standing clip and the walks have `floor_at_0: true`, with the planted heels on her own
  floor. **No per-clip floor offsets.** Planted foot slide is 0.15–1.91 cm/s.
- **Hands against the thighs:** on her body several standing clips (HumanIdleBreathing, NeutralPosture,
  anger_anim_2, HandingAppointmentCard, the walk loop) bring the hanging hand against the side of the thigh. Rendered
  with her clothes, the hands sit on the outside of the slacks; the one exception is **anger_anim_2**, where the right
  fist presses into the hip for a moment and the fingers sink into the slacks (about 0.5 s).
- **Seated, on the 45 cm standard seat (`seat_contact_cm`, clip units):**

  | Clip | cm |
  |---|---|
  | Sitting_Idle | 44.1 |
  | SittingAva | 43.2 |
  | StandToSit | 43.9 |
  | SitToStand | 44.0 |

  SittingAva is the legs-crossed sit with her hands on her knee; Sitting_Idle is the upright chair sit with both hands on
  her thighs.
- **LoweringHead:** the hands are kept out of her cardigan.

## 3. Face words

`D:\Business\Code\art\characters\carter\face\carter_vocab.json`:
- Megan's v1.3 vocabulary, the same 18 words and units, with `shape_meshes` rebuilt for her meshes (brows on
  `Camila_Brow`). No word dropped.
- Review sheet: `carter_vocab_review_head.png`.
- The face pose library is `carter_face_library.json` (39 poses, nothing missing).

## 4. Prefab (the usual new-avatar set-up)

- CCiC import, no hand fixes.
- Fresh SALSA OneClick, the CraftXR components, TwistDriver, skin quality and the BlendShapeFollower (brows follow
  expressions).
- A per-avatar stance override controller with the fitted clips: StandIdle = HumanIdleBreathing, StandTalk = chat_anim_1,
  SitIdle / SitTalk = SittingAva (or Sitting_Idle for the upright hands-on-thighs sit, if the owner prefers it for her).
- The addressable `avatar_<backendId>` and the catalog row.

## Please report back

1. Closed eyes, close up in the headset: no eyeball showing between the lids at full blink (right eye especially).
2. Standing on the floor with no per-clip offsets; the SitTalk seam after StandToSit; the seat at 45 cm.
3. The cardigan and slacks in motion (StandTalk, walk, sit): nothing through the cardigan hem when seated; the
   anger_anim_2 fist at the hip.
4. The ankles when her legs are crossed (SittingAva): the slacks ride up; tell us if bare ankle shows (socks are the
   fix).
5. Cough and the open-jaw words (tongue), and embarrassed with your gaze-down.
6. The Quest check, seated and standing: **this is the acceptance test.**
