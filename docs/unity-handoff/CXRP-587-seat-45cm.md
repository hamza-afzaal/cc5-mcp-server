# CXRP-587: Megan's seated clips re-seated for the 45 cm standard seat (handoff to the Unity agent)

**Re-copy these 4 clips and the manifest** from `D:\Business\Code\art\characters\megan\exports\library_v0\unity\`.
The file names are unchanged, and you remain the only writer on the Unity side.

| Clip | Seat contact (clip) | Before |
|---|---|---|
| `Megan_Posture_SittingAva` | 44.0 cm | 36.5 cm |
| `Megan_Posture_Sitting_Idle` | 43.9 cm | 34.9 cm |
| `Megan_Posture_Sitting_StandToSit` | 44.2 cm (seated end) | 36.6 cm |
| `Megan_Posture_Sitting_SitToStand` | 44.2 cm (seated start) | 36.6 cm |

The old files are in `unity_pre_587\`, for rollback.

## What changed

- **Her pelvis is 8–10 cm higher.** With Unity's ×1.019 height normalisation she sits on a **45 cm** seat.
- **Her feet stay exactly where they were,** on the floor. A leg solve moves the thigh and calf; each foot keeps its
  orientation.
  - Her thighs now slope gently down to the knee, as on a slightly taller chair.
- **The crossed leg** in SittingAva and the transitions is lowered back onto the knee it rests on.
- **The sit-down transitions** raise her only as she sits down. The standing part is unchanged.
- **The StandToSit → SittingAva → SitToStand chain joins exactly as before.**
- **Contact is the same or better.**
  - Her arm resting on the crossed leg in SittingAva went from 5.6 cm to 1.7 cm.
  - Thigh-on-thigh where her legs cross is 5.7 cm, about the same as before (the known trade-off).

## Seat heights (owner, 2026-10-08)

- The seat height in the reference scene is **61 cm**, and seat heights vary between scenes.
- **On a taller seat:**
  - lift her in the portal so she sits on the seat;
  - her feet hang, and that's fine.
- **No seat IK or auto-alignment** (CXRP-587 criteria 1–2).
- **The lift:** with these clips, the lift for a seat of height H is about **(H − 45) cm**. For the 61 cm stool that's about 16 cm.

## Manifest

On each of the 4 clips:
- `seat_contact_cm`: the new value, in clip units;
- `seat_height_cm`: 45;
- `seat_note`: explains the above.

The manifest also has a new top-level `rules.seat`.

## Please check on Quest (scene 23)

1. After setting the lift for the 61 cm stool, she sits on the seat, neither sunk in nor floating.
2. Her hanging feet look natural at conversation distance.
3. StandToSit → SittingAva → SitToStand plays without a pop.
