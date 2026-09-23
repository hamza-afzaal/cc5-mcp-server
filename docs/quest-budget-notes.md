# Quest 3 frame budget: what Meta says, and what we still need

Status: research notes, 2026-09-23. Feeds design §4 (character budget) and §12 (contract with the environments project). **The character budget can't be fixed until the open questions below are answered for the whole app.**

## Meta's published targets (Quest 3 / 3S)

From Meta's [Testing and performance analysis](https://developers.meta.com/horizon/documentation/unity/unity-perf/) page for Unity:

| | Busy simulation | Medium simulation | Light simulation |
|---|---|---|---|
| Draw calls per frame | **200–300** | 400–600 | 700–1,000 |
| Triangles per frame | 1.3M–1.8M (all levels) | | |
| Frame rate | ≥ 72 FPS for interactive apps | | |

Meta defines **busy** as applications with *animation and skinning from multiple players*; medium as medium-sized worlds; light as minimal pipeline-state changes. Meta's general [VR performance guidelines](https://developers.meta.com/horizon/documentation/native/pc/dg-performance-guidelines/) add 1–3 ms for script logic per frame. The [Runtime Optimizer](https://developers.meta.com/horizon/documentation/unity/unity-quest-runtime-optimizer/) treats < 300 draw calls as optimal. Mesh complexity costs more GPU time than material changes (the [draw call cost analysis](https://developers.meta.com/horizon/documentation/unity/po-draw-call-analysis/)).

## What this changes in design §4

- Design v0.3 assumed the **medium** row (400–600 draw calls) and gave avatars 25% (~40 calls). A scenario with a patient, partner and bystanders, all skinned and animated, fits Meta's **busy** definition better: **200–300 draw calls for the whole frame**. At a 25% share, that's ~50–75 calls for all characters, and the environment gets the rest.
- The measured hero character (clothed Camila) is **19 material slots ≈ 19 draw calls** before optimization, and each extra character adds its own. Draw calls, not triangles, are the binding constraint: 42k triangles is only ~3% of 1.3M.
- Skinned meshes can't be static-batched, and blendshape evaluation costs GPU/CPU per frame. Neither is in Meta's table, so they have to be measured on device (M2, with OVR Metrics and Perfetto).

## Answers from the Unity project (2026-09-23, reference clinic scene with Ava)

**Source of truth:** the Unity repo's `Assets/_CraftXR/Docs/quest-perf-baseline.md` (measurements) and its planned `Assets/_CraftXR/Docs/quest-budget.md` (agreed targets). This file only summarizes; don't fork the numbers.

- **Budget by GPU milliseconds and texture memory, not draw calls.** The reference scene uses 10–37 draw calls in view (97 total) and 14k–106k triangles in view, with 4–10 ms of GPU time against a 13.9 ms budget at 72 Hz. The busy/medium classes above don't bind here. Per-character targets get validated by benchmark runs with and without the character.
- **Cast:** one avatar per scene, and the learner has no visible body. Plan for **one hero at 0.5–2 m** (room-scale examination). No LODs are needed at current distances; a hair LOD1 is cheap insurance.
- **Frame and rendering:** 72 Hz, SpaceWarp off, foveation currently not applied (a fix is being tested), 2184×2288 per eye (render scale 1.3), MSAA 4×.
- **Lighting:** baked rooms; characters lit only by Adaptive Probe Volumes (L1) plus one reflection probe; no real-time lights or shadows. The high-fidelity CCiC shaders buy little except on hair and eyes, so default to the **performance** set and keep RL5 hair/eye/teeth shaders pending a benchmark.
- **Reference character, Ava (known OK, not a ceiling):** 51.8k tris, 17 draw calls, 11 skinned meshes, 70 bones (body 63), 366 blendshapes, 66 textures ≈ 135 MB on Quest. Hair was 51% of the triangles, 5 draw calls and 85% of the texture memory (2048² ASTC 4×4 × 7 maps per layer).
- **Constraints the CC4 export must respect:**
  - **Skin weights = 2** in the Meta Quest quality level, while CC4 exports 4. Either author for 2 or raise the setting (costs GPU). Check shoulders, hips and fingers for creasing.
  - **Textures:** ASTC 6×6 for everything except where 4×4 visibly matters (roughly 2× less memory); hair maps ≤ 1024² where acceptable.
  - Keep the face blendshapes (SALSA); the 180 brow shapes are worth pruning.
  - The prefab expects a humanoid Animator, SALSA (Salsa, Emoter, Eyes, QueueProcessor, silence analyzer, external analysis driver), and AudioSource + StreamedAudioPlayer.
- Environment-side issue (not this project): runtime glTF prop textures decode to uncompressed RGBA (several hundred MB); the KTX2/Basis fix is CXRP-247.

## What this means for the character pipeline

- Design §4's triangle and draw-call table becomes a **benchmark-validated** per-character target, with Ava's numbers as the known-OK reference. The design's draw-call target of 8 is not required.
- The purchased Lite Hair (2.7k tris, 1 draw call, 1 texture set) already removes most of Ava's hair cost.
- The hero route is **Convert to Game Base (Single Material)** (see the decimation test in `docs/spikes.md`): ~32k tris, 17 draw calls, all face blendshapes kept, which is Ava-like.
- Still to settle: bone weights (2 vs 4), per-role texture sizes and ASTC block size at import, and brow blendshape pruning.
