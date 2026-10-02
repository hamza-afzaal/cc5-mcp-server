# CXRP-552: twist bones and 4-bone skinning (handoff to the Unity agent)

**Goal:** remove the candy-wrapping and over-twisting at the wrists, elbows, shoulders, knees and hips on the CC4 avatars (Kevin, Camila, Megan; Ava's older rig too) without adding a package.

**Root cause (from your audit, 2026-10-01).**
- The Humanoid Avatar maps no twist bone, and Humanoid clips carry no curves for them, so `*_twist_01_*` stay at bind pose while the limbs rotate.
- The "Meta Quest" quality level skins with **2 bone weights per vertex**. CC4 weights use up to 4, so the vertices that blend between a limb bone and its twist bone lose part of their weighting.

## 1. Facts about the rigs (measured from the exports)

GameBase rigs (Kevin, Camila, and Megan from now on) have one twist bone per segment. Each is a **leaf child of its segment, exactly halfway along it**. Each side has the same set (`_l` / `_r`).

| Twist bone | Parent (segment) | Child of the segment | Position along segment | Rule |
|---|---|---|---|---|
| `upperarm_twist_01_*` | `upperarm_*` | `lowerarm_*` | 13.4 of 26.9 cm (50%) | **counter**: undo 50% of the upper arm's own roll |
| `lowerarm_twist_01_*` | `lowerarm_*` | `hand_*` | 12.0 of 24.0 cm (50%) | **follow**: take 50% of the hand's roll |
| `thigh_twist_01_*` | `thigh_*` | `calf_*` | 22.4 of 44.8 cm (50%) | **counter**: undo 50% of the thigh's own roll |
| `calf_twist_01_*` | `calf_*` | `foot_*` | 22.7 of 45.5 cm (50%) | **follow**: take 50% of the foot's roll |

- `CC_Base_L/R_RibsTwist`: leave them alone (breathing/torso, not limb roll).
- **Ava** (pre-GameBase) has two twist bones per segment, `CC_Base_*Twist01/02`. Same rules, at 33% and 66% (Twist01 nearer the parent joint). The table in the script takes any number of entries.

"Roll" means rotation about the segment's long axis (the direction from the segment bone to its child bone), taken as the twist part of a swing-twist decomposition.

## 2. TwistDriver (reference implementation, untested in our project)

One MonoBehaviour on the avatar root. It runs in `LateUpdate`, after the Animator, and needs no package.

```csharp
using System;
using UnityEngine;

// Drives CC4 twist bones that the Humanoid Avatar leaves at bind pose (CXRP-552).
// Follow: twist bone takes `weight` of the child joint's roll (forearm <- hand, calf <- foot).
// Counter: twist bone undoes `weight` of its own segment's roll (upper arm, thigh) so shoulder/hip skin stays put.
[DefaultExecutionOrder(10000)]
public sealed class TwistDriver : MonoBehaviour
{
    public enum Mode { Follow, Counter }

    [Serializable]
    public sealed class Entry
    {
        public Transform twistBone;   // e.g. lowerarm_twist_01_l
        public Transform segment;     // its parent, e.g. lowerarm_l
        public Transform child;       // the segment's child joint, e.g. hand_l
        public Mode mode = Mode.Follow;
        [Range(0f, 1f)] public float weight = 0.5f;

        [NonSerialized] public Quaternion twistBind, segmentBind, childBind;
        [NonSerialized] public Vector3 axis;   // segment long axis, in the segment's local space
    }

    public Entry[] entries = Array.Empty<Entry>();

    void Awake()
    {
        foreach (var e in entries)
        {
            e.twistBind = e.twistBone.localRotation;
            e.segmentBind = e.segment.localRotation;
            e.childBind = e.child.localRotation;
            e.axis = e.child.localPosition.normalized;
        }
    }

    void LateUpdate()
    {
        foreach (var e in entries)
        {
            Quaternion roll;
            if (e.mode == Mode.Follow)
            {
                // child's rotation change since bind, expressed in the segment's frame
                Quaternion delta = e.child.localRotation * Quaternion.Inverse(e.childBind);
                roll = Twist(delta, e.axis);
            }
            else
            {
                // segment's own rotation change since bind, in its bind frame; undo part of its roll
                Quaternion delta = Quaternion.Inverse(e.segmentBind) * e.segment.localRotation;
                roll = Quaternion.Inverse(Twist(delta, e.axis));
            }
            e.twistBone.localRotation = Quaternion.Slerp(Quaternion.identity, roll, e.weight) * e.twistBind;
        }
    }

    // Twist part of q about unit axis (swing-twist decomposition).
    static Quaternion Twist(Quaternion q, Vector3 axis)
    {
        Vector3 r = new Vector3(q.x, q.y, q.z);
        Vector3 p = Vector3.Dot(r, axis) * axis;
        var t = new Quaternion(p.x, p.y, p.z, q.w);
        float n = Mathf.Sqrt(t.x * t.x + t.y * t.y + t.z * t.z + t.w * t.w);
        return n < 1e-6f ? Quaternion.identity : new Quaternion(t.x / n, t.y / n, t.z / n, t.w / n);
    }
}
```

**Setup**
- Add 8 entries for GameBase rigs, from the table in §1: `weight` 0.5, `mode` Follow for the forearm and calf, Counter for the upper arm and thigh.
- A small editor helper can fill them by bone name at prefab build time, which makes CC4 prefab rebuilds safe.
- The bind rotations are read in `Awake`. The avatar must be in its imported bind pose there, which it is before the Animator's first update.

**Interaction with the Avatar's own twist settings.** The Humanoid "Upper/Lower Arm Twist" and "Upper/Lower Leg Twist" settings (all 0.5 today) already move part of the roll between the main bones.
- Tune with both in play: start with the Avatar defaults and the driver at 0.5.
- If the forearm still candy-wraps near the wrist, try Avatar Lower Arm Twist 0 with the driver at 0.5, or the defaults with the driver at 0.6–0.7.
- Pick the setting that looks right in the test poses below. Record the chosen values in the ticket.

## 3. 4-bone skinning for the avatar

1. Confirm the model importer's **Skin Weights** is Standard (4 bones) for the avatar FBXs, so the weights aren't reduced at import.
2. Make the avatar skin with 4 weights on Quest:
   - Set `SkinnedMeshRenderer.quality = SkinQuality.Bone4` on the avatar's renderers: body, clothes, hair, brows.
   - **Verify on device** that this takes effect while `QualitySettings.skinWeights` is `TwoBones`. If the global setting caps it, raise the "Meta Quest" quality level to `FourBones` instead; the avatar is the only skinned mesh in our scenes.
3. Bench with `scripts/quest-bench.sh` (locked clocks), before and after:
   - GPU per view: avatar view today is 9.05 ms against a 10 ms ceiling.
   - CPU frame time, which has never been measured for animation. Measure it now: Animator + skinning + SALSA + TwistDriver.

## 4. Test and acceptance

**Test poses** (make a test clip, or rotate bones in the editor; Kevin, Camila and Megan):
- hand pronated/supinated ±90°
- upper arm rolled ±60°
- thigh rolled ±45°
- foot turned ±30°
- the seated Sit Talk loop

**Acceptance**
1. No candy-wrap: the wrist and forearm keep their volume at ±90° pronation, and the shoulder and hip skin don't twist with the limb roll.
2. GPU ≤ 10 ms per view with 4-bone skinning, or the bench proves 2 bones is required. In that case, keep the TwistDriver alone and report the numbers.
3. The CPU cost of animation per character is recorded in CXRP-552.
4. Before/after stills for each test pose are attached to CXRP-552.

## 5. Not part of this ticket

- Volume collisions (knees and arms passing through the body on heavy avatars) are fixed offline per avatar (CXRP-551).
- Animation Rigging and IK: only if a later bench affords 1–2 constraints.
