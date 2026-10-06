# Avatar expression brief: what the patient avatars can show (CXRP-562)

**For:** the backend (conversation/LLM) and Unity. **From:** the art pipeline. **Status:** information for a decision,
not a spec.

Right now the conversation decides what the patient *says*. Nothing decides how she *looks* while saying it, so the
avatars play the same idle and talk loops whatever the line is. The art side has built the face expressions and body
motions for this. This brief lists exactly what exists, what it can and can't do, and the decisions that need making.
It doesn't assume how the backend works: section 6 asks those questions rather than answering them.

Applies to **Megan, Kevin and Camila** (CC4 avatars, identical names and behaviour on all three). Ava and the bald
character are not covered.

---

## 1. What already happens without any tagging

| Layer | Driven by | Status |
|---|---|---|
| **Stance** (standing/seated × idle/talking) | the backend's existing *stance* value; Unity picks the animator layer by name | **works today** |
| **Lip movement** | the TTS audio. SALSA today; TTS visemes once a provider is chosen (CXRP-507) | works (SALSA) |
| **Blink, eye gaze, small head motion** | Unity, automatically | planned (CXRP-553), not built |
| **Facial emotion** | nothing yet | **needs a decision** (sections 2, 6) |
| **Gestures** (crossing arms, lowering head, pointing…) | nothing yet | **needs a decision** (sections 3, 6) |

So a tagging scheme never has to handle lips, blinking or stance switching. It only has to say what the patient
**feels** and, optionally, what she **does**.

---

## 2. Face: what's available

A face expression is a named **pose**: a set of facial muscle-shape weights. Unity blends to a pose over about
0.2–0.5 s, at any strength from 0 to 1, and back to neutral when told or after a timeout.

- **The mouth is never part of a pose:** lips stay free for speech, so a patient can look worried *while talking*.
- **Poses can be mixed** (e.g. worried 0.6 + smile_warm 0.2 = a brave face), though in practice one dominant emotion
  per line reads best.
- **Strength matters:** 0.3 is subtle (good for a calm patient), 0.6 clearly readable on Quest, 1.0 strong. Above
  about 0.8 most poses look theatrical for a clinical conversation.

### 2a. Authored for patient conversations (5): **recommended core set**

Built from facial-coding research (FACS) for clinical realism. Megan, Kevin and Camila all have them.

| Pose | Looks like | Typical patient moment |
|---|---|---|
| `worried` | inner brows raised and drawn together, lips pressed | describing symptoms, asking "is this serious?" |
| `embarrassed` | held-back smile, lips pressed, a slight brow lift | talking about weight, diet, side effects like nausea |
| `relieved` | soft genuine smile, brows easing | being reassured, good news |
| `discomfort` | lowered, compressed brows, squint, nose wrinkle (pain-face cluster) | describing pain, nausea, injection-site soreness |
| `smile_warm` | genuine smile with eye crinkle | greeting, thanks, rapport |

### 2b. CC4's basic emotions (7 emotions × 4 strengths = 28)

`anger`, `disgust`, `fear`, `happy`, `neutral`, `sad`, `surprise`, each as `_lo`, `_med`, `_hi`, `_max` (e.g.
`sad_med`).
- The strengths are CC4's own: `_lo`/`_med` are usable in conversation, while `_hi`/`_max` are theatrical.
- A scheme can either pick a named strength (`sad_med`) or use one pose per emotion with a continuous intensity. The
  second is simpler for an LLM; see question Q3.

### 2c. CC4's female "moods" (6)

`f_confident`, `f_gentle_look`, `f_glancing`, `f_normal`, `f_relaxed`, `f_serious`: subtle, general demeanours rather
than emotions, usable as a per-character *baseline* (e.g. a guarded patient sits at `f_serious` 0.3). Despite the
name, they work on Kevin as well.

**In total there are 39 poses.** A conversation scheme probably wants **8–12 emotion words**, mapped onto these, not
all 39 (see Q2).

---

## 3. Body: what's available

### 3a. Stance loops (already wired; per-avatar fitted versions just delivered)

| Stance | Clip | Notes |
|---|---|---|
| standing idle | `Gesture_HumanIdleBreathing` (11 s loop) | |
| standing talking | `Conversation_chat_anim_1` (5 s loop) | |
| seated talking (male controller) | `Conversation_chat_anim_2` (5 s loop) | |
| seated idle / talking | `Posture_SittingAva` (20 s loop) | ankle on knee |
| seated idle (alt) | `Posture_Sitting_Idle` (4 s loop) | |

### 3b. Emotion-flavoured talking loops (Megan only so far; BEAT motion capture)

Long, natural talking motion with the emotion in the body, not just the face. They could replace the plain talk loop
while an emotion is active.

| Clip | Emotion | Length |
|---|---|---|
| `Megan_BEAT_conversation_a` / `_b` | neutral | 20 s loops |
| `Megan_BEAT_fear` | fear / anxiety | 15–20 s loop |
| `Megan_BEAT_happy` | happy | 15–20 s loop |
| `Megan_BEAT_sad` | sad | 15–20 s loop |

These are standing clips. When seated, Unity plays only their upper body over the sitting legs (already supported).
Kevin and Camila versions are a pipeline run away once the look is approved.

### 3c. Gestures (one-shots: play once over the stance, then return)

| Clip | Emotion / meaning | Length | Notes |
|---|---|---|---|
| `Conversation_LoweringHead` | sad, ashamed | 5.5 s | can also loop as a "head down" state |
| `Conversation_CrossingArms` | guarded, defensive | 2.3 s | |
| `Gesture_FrustratedPosture` | frustrated | 1.2 s | |
| `Conversation_PointingForward` | insistent, emphasis | 1.3 s | travels slightly |
| `Conversation_anger_anim_1`…`_5` | angry talking | 1.6–5.8 s | five variants (avoids repetition) |
| `Conversation_chat_anim_3` | neutral talking gesture | 6.3 s | |
| `Actions_PointingAtPhone` | showing something on a phone | 4.1 s | needs a phone prop |
| `Actions_HandingAppointmentCard` | handing over a card | 3.0 s | needs a card prop; a scripted action |
| `Gesture_NeutralPosture` | weight shift | 3.3 s | filler |
| `Motion_WalkStop`, `Motion_WalkingCycle` | walking | 0.9 s / 1.0 s loop | locomotion, not conversation |

**Constraints that matter for any scheme:**
- **The gestures are standing clips.** When seated, Unity can play the upper body only, which works for arm and head
  gestures (crossing arms, lowering head) but not for anything involving the legs or weight.
- **Gestures take 1–6 s.** A line shorter than its gesture either cuts the gesture or lets it run into the next line.
- **Repetition shows quickly:** the same gesture twice within about 20 s looks robotic. The anger set has five variants
  for this reason.
- **No library gesture is a sentence-level beat** (nodding, small hand emphasis). Those come from the talking loops.
- **Props:** phone and card gestures need Unity props and only make sense in specific scripted moments.
- Every clip has a machine-readable manifest (`library_v0_manifest.json`: emotion, tags, length, loop/one-shot,
  standing/seated). A selector can work from it instead of hard-coded names.

---

## 4. Timing facts

| What | Time |
|---|---|
| Face blend into a pose | 0.2–0.5 s (Unity setting) |
| Gesture length | 1–6 s |
| Talking loops | 5–20 s, loop seamlessly |
| Stance change (stand ↔ sit) | handled by the existing stance system, not by gestures |

**If an emotion arrives after the line starts playing,** the face visibly changes mid-sentence. The tag should
therefore reach Unity before or with the audio (see Q5).

---

## 5. Example message (a strawman to react to, not a spec)

```json
{
  "utterance_id": "t12",
  "text": "Honestly the nausea has been really bad this week.",
  "emotion": "discomfort",
  "intensity": 0.6,
  "gesture": null
}
```

Unity would blend the face to `discomfort` at 0.6 when the audio starts, keep the stance loop playing, and ease back
to the character's baseline after the line (or hold until the next tag). `gesture` is optional and usually empty.

---

## 6. Decisions for the backend (and the owner)

These depend on how the conversation system works, which the art side doesn't know. Each has options; none is
assumed.

- **Q1: Where does the emotion come from?**
  - (a) The same LLM call that writes the line, as structured output.
  - (b) A separate, cheap classifier on the generated text.
  - (c) Scripted per scenario step, with the LLM filling in.
  - (d) A mix: a scenario baseline plus a per-line override.
- **Q2: How large is the vocabulary?** A small fixed list (about 8–12 words, e.g. neutral, worried, embarrassed,
  relieved, discomfort, sad, frustrated, happy, anxious, guarded) is easier to keep consistent than all 39 poses. The art
  side maps each word to a pose, or a mix, and can tune that mapping without backend changes.
- **Q3: Intensity:** a number (0–1) or a level (low/medium/high)? Can the LLM produce it reliably, or should it be fixed
  per word?
- **Q4: Granularity:** one tag per turn, per sentence, or only on change? Per turn is simplest; per sentence reacts
  better within long answers.
- **Q5: Timing:** can the tag be delivered before or with the TTS audio for that line? What latency does this add, if
  any?
- **Q6: Gestures:**
  - Should the backend pick gestures at all?
  - Or should Unity pick them from the emotion and the manifest, with cool-downs?
  - Or only for scripted moments (handing a card)?
  - Letting Unity choose keeps the LLM's job small.
- **Q7: Baseline:** does each scenario/persona have a resting mood (anxious patient, guarded patient), and where is
  it configured?
- **Q8: Missing or invalid tags:** fall back to the baseline? Log? Unity should never fail on an unknown word.
- **Q9: Clinical appropriateness:** are there emotions the patient must not show in some scenarios (e.g. no smiling
  while disclosing something serious), and who owns those rules?

---

## 7. What happens next

1. **Owner + backend:** answer Q1–Q9 when the backend picks this up. The owner takes the product calls (Q2
   vocabulary, Q6 gestures, Q9 clinical rules); the backend takes the ones that depend on how the system works. Then
   we agree the message together.
2. **Until then:** nothing here blocks Unity's current work (CXRP-558/559/561).
3. **Art pipeline (us):** the word → pose mapping table per avatar, and Kevin/Camila versions of any talking loops chosen.
4. **Unity:** the face-pose player (CXRP-560) and the gesture system (CXRP-326) against the agreed message.

**Data files** (all under `D:\Business\Code\art\characters\`):
- face poses: `<id>\face\<id>_face_library.json`
- clips: `<id>\exports\library_v0\unity\library_v0_manifest.json`
- BEAT: `megan\exports\beat\unity\megan_beat_manifest.json`
