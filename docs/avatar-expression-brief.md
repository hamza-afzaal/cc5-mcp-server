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
- The strengths are CC4's own. On Megan they are mild: `_lo`/`_med` barely differ from neutral, and `_hi` is often
  the first readable level (CXRP-581 review, 2026-10-07). Happy hardly smiles at any strength; use `smile_warm`.
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

## 5. Example message (a strawman to react to, not a spec; superseded by the phase-1 contract in section 6)

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

### Owner's answers (2026-10-07)

**Terms.** From here on:
- An **action** (the owner's "gesture") is a one-time event that changes the scene: handing over a card, sitting down
  from standing, walking to a spot.
- **Body language** is what the body does while talking: hand use, palm on face, throwing up the hands.

Actions are commands from the backend or director, and Unity just executes them. Body language follows the emotion
(see Q6).

| Q | Answer | Owner |
|---|---|---|
| Q1 | Both. Some emotions are hardcoded when the sim is created (the compile step); others are generated for Inworld's director queues. | backend |
| Q2 | Draw on psychology (Plutchik's wheel, Willcox's Feelings Wheel) and find the size that's realistic without being excessive or underwhelming. Disgust stays in. Draft below. | owner + art |
| Q3 | Fixed intensity per word to start. Avoid adding many variables at once; tune by watching it run. | art (defaults), owner (review) |
| Q4 | Open. It depends on the backend and on the scenario. | backend |
| Q5 | Open. The tag should probably arrive *with* the audio so they sync. The backend confirms. | backend |
| Q6 | Body language: Unity picks from the emotion (below). Actions: explicit commands. Actions are needed but can wait; they'll become a major part of the sims later. | owner |
| Q7 | The backend configures each scenario's baseline, with input from instructors. | backend |
| Q8 | Play defaults at random so it never looks robotic. Proposed: the persona's baseline face plus random *neutral* body language. A random emotion on the face would show feelings that aren't there. | Unity |
| Q9 | Content rules (what a patient may show in a scenario) belong to the backend, which creates the sim. Compatibility rules (no two clips that can't play together, cool-downs, seated limits) stay in Unity. Revisit after running it for a while. | backend + Unity |

**TTS:** Inworld (most likely). Its viseme timestamps feed lip sync (CXRP-507 / 506 / 553).

**Scope:** Megan is the reference character. Everything is built and approved on her first, then rolled out to Kevin,
Camila and later avatars.

**How Unity picks body language (no semantics in Unity).** The meaning is decided upstream: the backend or Inworld
turns the line into an emotion word. Unity then does a lookup in the clip manifests, in two layers:
1. **Talking loop by emotion.** While "anxious" is active, the plain talk loop is swapped for the fear loop.
2. **Occasional accent.** Unity sometimes plays one body-language clip tagged with the same emotion, chosen at random
   and with a cool-down, so nothing repeats within about 20 s.

Unity never matches keywords in the text.

### Emotion vocabulary v0 (draft, to be reviewed on Megan)

**Approved on Megan, 2026-10-07 (CXRP-581):**
- All 16 words are approved. Many mappings were strengthened from the draft below, because CC4's own levels are mild on
  her face.
- **happy** has two variants, a big smile and a soft one. Unity picks one at random per line, because "sometimes a
  person smiles more and sometimes less".
- **Final weights:** `characters\megan\face\megan_vocab.json`. **Sheet:** `characters\megan\face\megan_vocab_v1_sheet.png`.

**Sources:**
- **Plutchik** gives each emotion family three named intensities (apprehension → fear → terror; annoyance → anger →
  rage). That fits Q3: the *word* carries the intensity, so no separate number is needed.
- **Willcox's wheel** supplies the everyday words a patient would actually use.
- **Neither wheel covers physical states** (pain, nausea, fatigue). A patient sim needs them, so they're listed
  separately.

| Word | Family (Plutchik) | Face (starting mapping) | Body language today |
|---|---|---|---|
| neutral | — | persona baseline | talking loops |
| warm | joy, low | `smile_warm` 0.5 | neutral talking |
| happy | joy | `happy_med` | BEAT happy (Megan) |
| relieved | joy + trust | `relieved` 0.6 | — |
| worried | fear, low (apprehension) | `worried` 0.5 | — |
| anxious | fear | `worried` + `fear_lo` | BEAT fear (Megan) |
| scared | fear, mid | `fear_med` | BEAT fear (Megan) |
| sad | sadness | `sad_med` | lowering head, BEAT sad (Megan) |
| embarrassed | shame (fear + disgust) | `embarrassed` 0.6 | — |
| frustrated | anger, low (annoyance) | `anger_lo` | frustrated posture |
| angry | anger | `anger_med` | angry talking ×5 |
| guarded | — (defensive) | `f_serious` 0.4 | crossing arms |
| disgusted | disgust | `disgust_lo` | — |
| surprised | surprise | `surprise_lo` | — |
| *physical:* discomfort (pain) | — | `discomfort` 0.6 | — |
| *physical:* nauseous | — | `discomfort` + `disgust_lo` | — |

**Gaps:**
- **Face:** confused, skeptical and tired have no pose yet.
- **Body:** worried, relieved, embarrassed, disgusted, surprised and both physical states have no body language.
  Sourcing it (Reallusion marketplace, BEAT-like motion-capture sets) is a separate piece of work.

### Backend answers (2026-10-07) and the agreed phase-1 contract

**Today:**
- A "director" LLM step picks the patient's tone once per turn, as free text (`[Speak in a guarded, clipped tone]`).
- That text is prefixed to the line sent to Inworld. Unity never sees it: it gets raw PCM audio only.
- The director runs only for Inworld voices.
- A short in-character filler line ("Okay…") covers the thinking time before the main reply.
- Scenario states carry free-text emotions ("frightened, shouting"). The persona baseline is a paragraph.

**Phase 1 (agreed):**

| Topic | Decision |
|---|---|
| Vocabulary | **This brief's list is the single list.** The director picks one word from it, and the backend turns that word into the Inworld voice instruction. One word drives voice, face and body. Inworld returns no emotion labels. |
| Message | `avatar.emotion { turn_uuid, emotion }` on the session socket, sent **just before the turn's first audio frame**. It always arrives first, so the face never changes mid-sentence. |
| Granularity | One emotion per turn, sent every turn; Unity ignores it if unchanged. The voice stays per turn (per-sentence voice changes sounded halting). |
| Filler line | Plays with the baseline (or the previous turn's emotion). The turn's emotion takes over at the main reply, a sentence boundary. |
| Baseline | A one-word `baseline_emotion` from the list. The compiler sets it, the author can edit it, and it goes to Unity in `session.init.ack`. |
| Content rules | A per-scenario allowlist in the backend. A disallowed word is swapped for the baseline before sending. |
| Gestures | The backend marks gesture moments: at most one big gesture per turn, never on consecutive turns. Unity enforces cool-downs, no repeats of the same clip, incompatible clips and seated limits. Scripted actions (card, sit, walk) stay separate commands. |
| Fallback | The backend always sends a valid word; if the director times out it falls back to the state's emotion, then the baseline. Unity: unknown word → baseline face + neutral body language. |
| Voice providers | The director will also run for Azure voices, so emotion works for any provider. |
| Lip sync | SALSA stays for phase 1. Inworld's viseme timings (11 shapes) are a later upgrade; they may add latency. |

**Later (phase 2):**
- **Variety within a turn.** One pose held through a long, multi-sentence turn may look robotic. Fix it on the animation side only (small intensity drift, idle variation, the body-language accents); the voice doesn't change.
- **Lip sync.** Inworld visemes, or on-device OVRLipSync.

**Gesture tag (owner, 2026-10-07):**
- Phase 1 uses a flag on the turn: `gesture: true`. Unity picks a clip that matches the turn's emotion from the manifest.
- Typed gestures (`emphasis`, `dismiss`, `self_soothe`…) come later, once CXRP-582 has the clips to back them.

## 7. What happens next

1. **Owner:** answered (2026-10-07). **Backend:** answered (2026-10-07, above). The brief is closed; the contract above is the spec.
2. **Backend:** the phase-1 work listed above (CXRP-585).
3. **Art pipeline (us):**
   - Megan's word → face mapping is approved: `characters\megan\face\megan_vocab.json` (CXRP-581).
   - Body language: CXRP-582.
   - Actions: CXRP-583, later.
   - Wrinkles: CXRP-584.
4. **Unity:**
   - The face player (CXRP-560): it reads `megan_vocab.json`, listens for `avatar.emotion` and `session.init.ack.baseline_emotion`, and picks a random variant for words that have several.
   - Body-language selection (CXRP-326).

**Data files** (all under `D:\Business\Code\art\characters\`):
- face poses: `<id>\face\<id>_face_library.json`
- emotion words → faces: `megan\face\megan_vocab.json` (approved; Kevin and Camila later)
- clips: `<id>\exports\library_v0\unity\library_v0_manifest.json`
- BEAT: `megan\exports\beat\unity\megan_beat_manifest.json`
