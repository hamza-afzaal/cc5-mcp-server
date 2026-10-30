# CXRP-721: the bald man, rebuilt to Megan / Kevin / Camila's level (handoff to the Unity agent)

The bald man (today's `BaldGuyPrefab`) is rebuilt end to end through the same pipeline as Camila and Kevin. What's new:
- his own face, kept (custom head shape);
- a fit 40s body;
- an owner-approved outfit: closed dress shirt, tie, belt, watch, black trousers, black socks, dress shoes;
- Game Base (Single Material);
- the Blender stage;
- 26 clips fitted to his body;
- a face vocabulary.

Treat him as a **new avatar**: fresh import, fresh prefab. Nothing from the old prefab's model carries over.

## 1. Model (not copied yet: waits for the owner's OK)

| From | To |
|---|---|
| `D:\Business\Code\art\characters\bald\blender\` | `Assets\_CraftXR\Art\Models\Avatars\BaldGuy\` (new folder) |

`bald.fbx` + `bald.json` + `bald.fbm\` + `textures\bald\`: 101 files, all new. **Always import the FBX and the JSON
together** (CCiC).

- **39,229 triangles, 24 material slots, 258 blendshapes.** Validate PASS.
  - The slots are over the ≤ 8 LOD0 budget. That's the same open M2 item as the other avatars.
- **Meshes:**
  - `CC_Game_Body`, `CC_Base_Eye`, `CC_Base_Teeth`, `CC_Game_Tongue`, `Male_Brow_2`;
  - the outfit: `Dress_Shirt_Closed`, `Tie`, `Belt`, `Watch`;
  - `Canvas_shoes`, which, despite its name, is the trousers + socks + dress shoes that Game Base merged into one mesh. The hidden canvas-shoe part is removed.
- **Floor:** his CC4 idle puts the heel joint at 7.87 cm and the ball at 3.60 cm.
- **Right blink:** the custom head shape made his right upper lid close behind the eyeball, so the eye showed through
  the closed lid. `Eye_Blink_R` is corrected in the Blender stage (the lid now closes in front of the eye at 50/75/100%).
  `Eye_Blink_L` and every other shape are as CC4 exported them.
- **Tongue:** it has no `Jaw_Open`, as on Kevin. The words that open the jaw move the teeth and lips, not the tongue.
- **Web:** `characters\bald\blender\web\bald.fbx` (textures embedded) is for the owner's web upload, not Unity.

## 2. Clip library (copy it yourself)

| From | Files |
|---|---|
| `D:\Business\Code\art\characters\bald\exports\library_v0\unity\` | `Bald_<clip>.fbx` × 26 + `library_v0_manifest.json` |

It's the same 26-clip set as Megan, Camila and Kevin, built with the same rules:
- Megan's round-2 shapes;
- the CXRP-620b elbows;
- the per-clip fixes;
- `Posture_Sitting` retired: use StandToSit / SitToStand.

Each manifest entry has a `cxrp687` note.

- **Hips:** ×1.114, like Kevin, so the walk distances are scaled the same.
- **Standing clips:** every standing clip and the walks have `floor_at_0: true`, with the planted heels on his own floor.
  **No per-clip floor offsets.** Planted foot slide is 0.1–3.5 cm/s; the worst is anger_anim_2 at 3.47, as on Kevin.
- **Seated, on the 45 cm standard seat (`seat_contact_cm`, clip units):**

  | Clip | cm |
  |---|---|
  | Sitting_Idle | 44.2 |
  | SittingAva | 44.2 |
  | StandToSit | 44.4 |
  | SitToStand | 44.3 |

- **LoweringHead:** the hands are kept out of his dress shirt.

## 3. Face words

`D:\Business\Code\art\characters\bald\face\bald_vocab.json`:
- Megan's v1.3 vocabulary, the same words and units, with `shape_meshes` rebuilt for his meshes (brows on `Male_Brow_2`).
- `guarded` drops `Eyelid_Outer_Down_L/R` (his model doesn't have it, as on Kevin).
- Review sheet: `bald_vocab_review_head.png`.
- The face pose library is `bald_face_library.json` (39 poses, nothing missing).

## 4. Prefab (the usual new-avatar set-up)

- CCiC import, no hand fixes.
- Fresh SALSA OneClick, the CraftXR components, TwistDriver, skin quality and the BlendShapeFollower (brows follow
  expressions).
- A per-avatar stance override controller with the fitted clips: StandIdle = HumanIdleBreathing, StandTalk = chat_anim_1,
  SitIdle / SitTalk = SittingAva.
- The addressable `avatar_<backendId>` and the catalog row. Decide with the owner whether this replaces `BaldGuyPrefab`
  or sits beside it.

## Please report back

1. **Blinks on his right eye**, close up in the headset: no eyeball through the closed lid, and no ridge visible at the
   outer corner where the lids meet (it should be hidden by the lashes).
2. Standing on the floor with no per-clip offsets; the SitTalk seam after StandToSit; the seat at 45 cm.
3. The tie and shoes in motion (StandTalk, walk, sit): the tie follows the shirt and the shoes stay on the feet.
4. Cough and the open-jaw words (tongue), and embarrassed with your gaze-down.
5. The Quest check, seated and standing: **this is the acceptance test.**
