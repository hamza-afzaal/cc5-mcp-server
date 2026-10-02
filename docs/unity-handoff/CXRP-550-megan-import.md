# CXRP-550: Megan (semaglutide patient, replaces Ava): import into Unity

Continues the CC4 avatar work from CXRP-532 (Kevin & Camila) and the twist fix from CXRP-552. Megan comes out of the same pipeline: CC4 → Game Base → S4 (option B).

## 1. What was delivered

- **Location:** `Assets/_CraftXR/Art/Models/Avatars/Megan/`, 70 new files, nothing overwritten. They're **untracked** in your working tree.
- **Branch:** put them on their own branch (e.g. `feat/megan-avatar` off `main`), not on the open PR, unless the owner says otherwise. Binaries go in Git LFS, as for Kevin and Camila.
- **Files:**
  - `megan.fbx`: CC4 Game Base (option B, S4-patched). 39.5k tris, 16 material slots, 73 bones.
  - `megan.json`: CC4 sidecar for CCiC.
  - `megan.fbm/`: textures.
  - `textures/megan/...`: per-material custom-shader maps (eyes, teeth, brows, hair), as for Kevin and Camila.
- **Not in Unity:**
  - Web copy with embedded textures: `D:\Business\Code\art\characters\megan\blender\web\megan.fbx` (for the web upload, like CXRP-531).
  - Shape manifest: `D:\Business\Code\art\characters\megan\blender\reports\megan_shapes.json`.

## 2. Import: same as Kevin and Camila

1. Add the `CC4OpacityPack` label and run CCiC with Ava's settings. Expect **zero hand fixes**; report any you need.
2. Rig: Humanoid, as for every other avatar. GameBase bone names (pelvis, thigh_l, upperarm_l…), and the twist bones are the same as Kevin's and Camila's.
3. Body mesh `CC_Game_Body`, one skin material plus a separate eyelash material (`Ga_Skin_Body`, `Ga_Eyelash`).

## 3. Prefab: MeganPrefab

- Stance controller: **FemalePatient** (as for Camila). Megan's clips are a seated patient in a doctor's office: sitting is the priority, standing must also work.
- **TwistDriver** from CXRP-552: 8 entries, the same bone names as the GameBase table in that spec.
- **Face:**
  - **Shapes are kept by a new rule.** `CC_Game_Body` keeps 152 (Camila's standard CC4 set), `CC_Game_Tongue` 41, and `Camila_Brow` **53**, where Kevin and Camila have 24. `CC_Base_Eye` keeps 2 (pupil dilate/contract).
  - **The brow mesh is named `Camila_Brow`.** Megan is built on the Camila base, and it's her own mesh.
  - **Why the brow count changed:** the old 24-shape brow subset dropped Mouth_Smile, Cheek_Raise, Nose_Sneer and Jaw_Open from the brows, so the brows stayed still on smiles and sneers. The 53 are every brow shape that measurably moves the brow.
  - **SALSA:** if Megan still uses it for now, run OneClick fresh on `megan.fbx`. SALSA binds by index, and the brow indices differ from Camila's prefab, so **don't copy Camila's SALSA config**. For the new face system (CXRP-553), bind by name using `megan_shapes.json`.
- Underwear: removed in CC4 before export. There's no Bra or Underwear_Bottoms mesh, so no Unity-side fix is needed.

## 4. Addressables

Megan needs a prod asset id from the backend, mapped like Kevin 42 → `avatar_42`: Default Local Group + `AssetAddressableCatalog`, then SmokeTest load by key. **Ask the owner for the id**, and say whether she replaces Ava's entry in the semaglutide sim or sits next to it.

## 5. A/B on Quest: please check and send stills

1. **Waist:** the light-blue shirt hem below the sweater rib was removed in S4 (only that 368-vertex strip), so the sweater should read tucked in. My Blender renders can't confirm this; the A/B is the test.
2. **Eyes:** no dark crescent above the upper eyelids and no line across the iris. CC4's Fix Eye Element was applied.
3. **Brows follow expressions:** smile, cheek raise, sneer, jaw open. This is new compared with Kevin and Camila.
4. **Scalp:** no bare patch at the hair parting.
5. **Skin:** realistic (SkinGen Realistic Human Skin), with tired under-eyes and no plastic look. Check the shading under the URP shader.
6. **Seated:** hips at the chair; known limits are below.
7. **GPU:** a locked-clock bench of Megan's view against the 10 ms ceiling (Ava is at 9.05 ms).

## 6. Coming next from the pipeline (not in this delivery)

- **Corrected seated clips:** Female Sit Talk, Stand to Sit and Sit to Stand, fitted to Megan's body offline (CXRP-551).
  - The stock Sit Talk crosses her right leg over the left. On her BMI-28 body the thighs sank 4–5.5 cm into each other for the whole clip, and the arms up to 6–8 cm into her sides.
  - The fitted clip loosens the cross by about 10° per leg and moves the upper arms out by 0–18°, with the overlap checked frame by frame.
  - They'll be Humanoid clips for her own controller (the CXRP-327 per-avatar pattern), exported with Reset Bone Scale, the same skeleton as the character.
- Until then, the stock seated clips will show the leg overlap on Megan.
