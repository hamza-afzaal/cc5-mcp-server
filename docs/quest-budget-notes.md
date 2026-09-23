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

## Questions for the owner (so the character and environment projects stay in sync)

1. **Simulation class:** should the app budget as *busy* (200–300 draw calls), given several skinned characters plus interaction?
2. **Environment numbers:** what draw calls, triangles and texture memory does the environments project plan per scene (or has it measured)?
3. **Cast size:** the maximum number of characters visible at once, and how many are near the learner (< 1.5 m) at the same time.
4. **Frame rate target:** 72, 90 or 120 Hz? Application SpaceWarp? Fixed/eye-tracked foveated rendering?
5. **Lighting and shading:** baked lightmaps + light probes (design §12) vs real-time lights; MSAA level; the CCiC performance vs high-fidelity shader set.
6. **Who owns the shared budget table:** one budget file both projects read, and where it should live.
