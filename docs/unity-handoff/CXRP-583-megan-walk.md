# CXRP-583: Megan walks: start / loop / stop (handoff to the Unity agent)

**Copy from** `D:\Business\Code\art\characters\megan\exports\library_v0\unity\`:
- `Megan_Motion_WalkRelaxed_1Start.fbx`
- `Megan_Motion_WalkRelaxed_2Loop.fbx`
- `Megan_Motion_WalkRelaxed_3End.fbx`
- `library_v0_manifest.json`

You remain the only writer on the Unity side.

These are CC4's female *Walk Relaxed* set, fitted to Megan. Arm-to-body contact is about 1 cm, her feet are on the
floor, and the clips follow the library_v0 conventions (30 fps, frame 0 = first motion frame, eye bones held, fingers
limited).

| Clip | Length | Playback | Distance | Speed |
|---|---|---|---|---|
| `1Start` | 3.5 s | one-shot | 1.15 m | speeds up from standing still |
| `2Loop` | 4.83 s | **seamless loop** (2 strides) | 1.95 m per loop | **0.40 m/s** |
| `3End` | 2.67 s | one-shot | 0.71 m | slows to standing still |

## How to play them

- **A scripted action only** (`use: action`, `category: walk`). Never choose a walk clip from emotion.
- **Chain:**
  1. standing idle;
  2. `1Start`;
  3. `2Loop`, repeated until she's ~0.7 m from the target;
  4. `3End`;
  5. standing idle (or StandToSit at a chair).
  - Start → loop joins cleanly (4°). Loop → stop differs by 13°, so use your usual ~0.25 s crossfade there.
- **The clips are in place, so you move her.**
  - For each clip, `walk.forward_m_every_0_5s` in the manifest gives the cumulative distance every 0.5 s. Move her
    transform along that curve and the planted foot stays still, with no sliding.
  - The loop is a constant 0.40 m/s.
- **Speed:** 0.40 m/s is a slow stroll; typical walking is 1.1–1.3 m/s.
  - If it looks too slow, play the clips faster and scale the movement by the same factor. For example, ×1.5 gives
    0.6 m/s.
- **Turns:** we own no turn-in-place clips for people. Rotate her toward the target while she walks, at the start and
  during the loop. A sharp turn before walking can be a slow rotation in place over ~0.5 s.

## Also in this delivery

The 4 seated clips are re-seated for the 45 cm seat; see `CXRP-587-seat-45cm.md`.

## Please check on Quest

1. Start → loop → stop toward a target: her feet don't slide (the transform follows the manifest curve).
2. Walking up to the chair, then StandToSit: she lines up with the seat. Unity places the chair spot.
3. The walking speed looks natural for a patient, or tell us the factor you'd like.
