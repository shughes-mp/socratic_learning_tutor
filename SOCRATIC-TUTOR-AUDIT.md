# Socratic Tutor — Learning-Science Audit and Implementation Specification

<!-- AGENT INSTRUCTIONS
This document is structured for direct ingestion by an agentic AI coding agent (Codex, Claude Code, etc.).
Every recommendation in STEP 4–5 is implementation-ready: it specifies the file to modify,
the function to add or change, the data schema additions required, the prompt changes needed,
and the acceptance criteria the agent should verify after making changes.

Read the entire document before writing any code.
Implement changes in the order given in STEP 3 (Prioritized Gap List) — foundational items first.
After each change, run the acceptance criteria defined in STEP 5.
If a recommendation conflicts with an existing design decision, preserve the existing behavior
and flag the conflict in a comment; do not silently overwrite.
-->

---

## Document Metadata

| Field | Value |
|---|---|
| Evaluated repository | `https://github.com/shughes-mp/art_learning_tutor` |
| Evaluation standard | 12-category Socratic Tutor Rubric (defined below) |
| Evidence base | Full source code review: `src/lib/system-prompt.ts`, `src/lib/attempt-tracker.ts`, `src/app/api/chat/route.ts`, `src/app/api/end-session/route.ts`, `src/lib/report-generator.ts`, all page components, Prisma schema |
| Auditor role | Senior learning-science product auditor and AI tutor designer |
| Spec reference | `BUILD-SPEC.md` in the working folder |
| Date | 2026-04-09 |

---

## Executive Summary

The Socratic Tutor is technically well-built. The codebase is clean, the architecture is sound, and the core spec — server-side attempt tracking, structured output tags, mode separation, streaming chat, misconception logging, readiness heatmap — is implemented correctly and faithfully. An experienced engineering team built this from a detailed spec and delivered what was asked for.

The problem is the spec itself had pedagogical gaps. The app produces the *form* of Socratic tutoring without reliably producing its *substance*. It asks questions, tracks attempts, and logs misconceptions. But the questions are not systematically designed to reveal thinking; the attempt threshold is a rescue timer, not adaptive judgment; and the misconceptions are data artifacts that do not alter the conversation they appear in.

**Overall rating: Partially competent. Works for motivated students on straightforward readings. Fails students who most need structured support.**

### Ratings at a Glance

| Category | Rating | One-Line Verdict |
|---|---|---|
| A. Core conception of learning | **Weak** | Treats threshold-crossing as mastery. No recursive learning. |
| B. Prior knowledge and orientation | **Weak** | Students are cold-dropped into content. No prior knowledge activation. |
| C. High expectations with adaptive support | **Partial** | 3-position scaffold exists but is not adaptive to struggle type. |
| D. Regular checks for understanding | **Weak** | Confidence checks are logged, not acted on. Self-report only. |
| E. Misconceptions as opportunities | **Partial** | Detection and logging work. Resolution within session does not. |
| F. Foundations and spaced retrieval | **Missing** | No cross-session memory. No prerequisite sequencing. No spaced retrieval. |
| G. Modeling expert thinking | **Missing** | No think-aloud, no reasoning demonstration, no worked examples. |
| H. Diagnostic task design | **Weak** | Questions generated ad-hoc. Many answerable by text-paraphrase. |
| I. Balance of support and independence | **Weak** | Rescue-after-3 removes agency from the student and the concept. |
| J. Participation and cognitive engagement | **Partial** | Active typing required. Shallow responses pass without challenge. |
| K. Corrective feedback | **Partial** | Specificity is policy but not structure. No feedback templates. |
| L. Adaptivity and instructional judgment | **Weak** | One adaptive variable: attempt count. All other context ignored. |

### The Core Problem in One Sentence

The app teaches students to answer questions about the reading. It does not teach students to think about the reading.

### What Needs to Change

Four P0 changes fix the most serious failures. All are low-to-medium complexity and operate primarily through `src/lib/system-prompt.ts` and `src/app/api/chat/route.ts`:

1. Make confidence checks alter behavior, not just log data
2. Replace the cold opening with a prior knowledge activation sequence
3. Add a question type taxonomy so questions test understanding, not recall
4. Add misconception follow-up logic so detected errors are resolved before the topic changes

Four P1 changes move the app from competent to genuinely good:

5. Add expert thinking moments (think-aloud at session open, reasoning trace before direct answers)
6. Add self-explanation prompts on first attempt
7. Build a hint ladder that sequences scaffolds by struggle type
8. Add productive cognitive conflict as a misconception intervention

Two P2 changes require deeper infrastructure:

9. Soft revisit queue for within-session spaced retrieval
10. Cross-session student model (foundational prerequisite for real adaptive tutoring)

### What to Ship Without Changing

The technical architecture is correct. Server-side attempt tracking, structured output tags, streaming, misconception storage, and the instructor report are all sound. Do not rebuild these. The fixes in this document are additive — they extend the system prompt, add behavioral branching in `chat/route.ts`, and add fields to the Prisma schema.

---

## STEP 1 — Evaluation Framework

### How to Read the Rubric

Each category is evaluated as **Strong / Partial / Weak / Missing / Unclear**.

| Rating | Meaning |
|---|---|
| **Strong** | Behavior is robust, systematic, and instructionally sound. A student consistently experiences the intended effect. |
| **Partial** | Feature exists and occasionally works, but is not reliable, not adaptive, or not instructionally complete. |
| **Weak** | Feature is nominally present but the implementation is instructionally counterproductive or too shallow to matter. |
| **Missing** | No evidence the feature exists in any form. |
| **Unclear** | Cannot be confirmed from source code alone; requires runtime testing or additional evidence. |

**Important distinction this rubric enforces:**
- *Feature exists* ≠ *Feature works occasionally* ≠ *Feature is systematic and instructionally sound*
- Surface compliance (the right words appear in a prompt) is not the same as pedagogical competence (the behavior is reliable and adaptive).

---

### Category Rubric Definitions

#### A. Core Conception of Learning

| Rating | Observable Indicators |
|---|---|
| Strong | App treats learning as recursive. Re-visits prior topics unprompted. Checks whether understanding survives delay. Never treats one fluent answer as mastery. Tracks fragile understanding over time. |
| Partial | App tracks some state across turns within a session. Makes some attempt to probe deeper before moving on. |
| Weak | App treats a correct answer as proof of mastery. Moves on once the attempt threshold is satisfied. No revisiting. |
| Missing | No state tracking at all; each turn is stateless. |

**Anti-patterns (look like this but aren't):** Tracking attempt counts per topic looks like adaptive memory but is actually a fixed-rule trigger. Labeling a topic "resolved" after 3 attempts is treating threshold-crossing as mastery.

---

#### B. Prior Knowledge and Orientation

| Rating | Observable Indicators |
|---|---|
| Strong | Opening always activates prior knowledge. Connects reading to previous lessons/intuitions. Provides advance organizer. Explains why the reading matters in the course arc. |
| Partial | Opening greeting exists. Sometimes connects to prior material if the student mentions it. |
| Weak | Generic opening question drawn from readings with no orientation context. Student is dropped cold into content. |
| Missing | No opening sequence at all. |

**Anti-patterns:** Posing a "thought-provoking opening question" is not the same as activating prior knowledge. A question that starts with content rather than with the student's existing mental model misses the point.

---

#### C. High Expectations with Adaptive Support

| Rating | Observable Indicators |
|---|---|
| Strong | Cognitive demand is preserved when students struggle. App uses decomposition, hints, worked examples, narrowed prompts, analogies. Scaffolds fade as competence grows. Challenge is normalized. |
| Partial | App offers one type of scaffold (e.g., analogy). Does not adapt scaffold type to the nature of the struggle. |
| Weak | App reduces challenge after a fixed number of attempts regardless of struggle type or concept importance. |
| Missing | No scaffolding; just questions and then answers. |

**Anti-patterns:** "After 3 attempts, give a direct answer" is not adaptive support — it is a fixed rescue rule that removes cognitive demand on a timer, regardless of whether the student was close to understanding.

---

#### D. Regular Checks for Understanding

| Rating | Observable Indicators |
|---|---|
| Strong | Diagnostic checks at every conceptual transition. Checks use explanation, prediction, application, or comparison — not recall or self-report. Results change subsequent behavior. |
| Partial | Some checks exist. They are periodic but not transition-triggered. Check format is partially diagnostic. |
| Weak | Check exists but is self-report only ("How confident are you?"). Does not change subsequent tutor behavior. |
| Missing | No checks; relies entirely on student volunteering confusion. |

**Anti-patterns:** Asking "How confident are you? Very confident / somewhat confident / uncertain" is the weakest possible check. It measures self-perception, not actual understanding. Logging the response without acting on it converts a check into a data collection exercise.

---

#### E. Misconceptions as Opportunities

| Rating | Observable Indicators |
|---|---|
| Strong | Errors are treated as evidence of thinking. Misconception type is classified (false belief / flawed model / category error). Student thinking is made visible before correction. Productive cognitive conflict is created. Corrections are specific and tied to the student's actual reasoning. |
| Partial | Misconceptions are detected and logged. Corrective feedback is specific. But misconception type is not classified and student thinking is not systematically surfaced first. |
| Weak | Misconceptions are flagged when obvious but the tutor moves to correction without diagnosis. |
| Missing | No misconception detection. Errors are treated as simply wrong. |

**Anti-patterns:** Delegating misconception detection entirely to the base model without systematic prompting produces inconsistent results. Logging a misconception for the report without using it to adapt the current conversation is a wasted signal.

---

#### F. Foundations and Spaced Retrieval

| Rating | Observable Indicators |
|---|---|
| Strong | Foundational concepts are confirmed before new material is introduced. Key ideas are revisited across sessions using spaced retrieval logic. Fluency is distinguished from understanding. |
| Partial | Within a session, app tries not to move on before confirming understanding. No cross-session revisiting. |
| Weak | App moves through topics driven by the student's questions with no foundational sequencing logic. |
| Missing | No mechanism for spaced retrieval. Each session is a fresh start with no prior state. |

**Anti-patterns:** Checking confidence at exchange 4, 8, 12 is a timed interval, not a spaced retrieval check. It does not ask the student to retrieve and use a concept previously covered — it asks how they feel about the current material.

---

#### G. Modeling Expert Thinking

| Rating | Observable Indicators |
|---|---|
| Strong | Tutor sometimes makes expert reading and reasoning visible. Shows how a skilled reader identifies claims, evidence, assumptions, ambiguity. Uses deliberate examples and non-examples. Shows reasoning path, not just conclusions. |
| Partial | Tutor occasionally explains its reasoning when giving a direct answer. Does not systematically model expert reading strategies. |
| Weak | Tutor asks questions; does not demonstrate thinking. Student is expected to reason without seeing what good reasoning looks like. |
| Missing | No expert modeling at all. |

**Anti-patterns:** Asking a Socratic question is not the same as modeling expert thinking. "What do you think the author means by X?" does not show the student how an expert would approach that question.

---

#### H. Diagnostic Task Design

| Rating | Observable Indicators |
|---|---|
| Strong | Questions test transfer, not recognition. Uses open-ended prompts, error analysis, compare/contrast, novel examples. Distinguishes "student recognized the wording" from "student understands the idea." Assessment moments also function as learning moments. |
| Partial | Questions are open-ended. Some attempt at novel framing. But question design is not systematic and varies by AI generation quality. |
| Weak | Questions are drawn directly from reading content. Students can answer by paraphrasing the text without understanding it. |
| Missing | No task design logic; questions are generated ad-hoc. |

**Anti-patterns:** Asking "What does the author say about X?" allows a student to find and copy the passage. This tests reading location, not conceptual understanding. Any question answerable by finding and quoting the text is not a diagnostic question.

---

#### I. Balance of Support and Independence

| Rating | Observable Indicators |
|---|---|
| Strong | Scaffolds are temporary. App distinguishes productive struggle from unproductive confusion. Does not rescue too early. Diagnoses missing prerequisites. Builds self-explanation and self-monitoring. |
| Partial | Some delay before providing answers. Limited help-seeking coaching. |
| Weak | Fixed rescue rule (N attempts → direct answer) removes agency from the adaptation decision. No prerequisite diagnosis. |
| Missing | Over-explains by default; no productive struggle. |

**Anti-patterns:** The 3-attempt threshold is a blunt instrument that guarantees rescue. A student who types "I don't know" three times will receive a direct answer. A student who makes three genuinely wrong attempts but is getting closer will also receive a direct answer. The threshold treats all struggles identically.

---

#### J. Participation and Cognitive Engagement

| Rating | Observable Indicators |
|---|---|
| Strong | Student is actively thinking, not passively reading explanations. Low-stakes opportunities to articulate ideas are frequent. Quality of thinking is assessed, not just presence of response. |
| Partial | Chat format requires some active typing. But shallow responses are accepted. |
| Weak | Students can fulfill the exchange requirement with minimal cognitive engagement by giving brief acknowledgments. |
| Missing | Student passively receives explanations. |

**Anti-patterns:** Requiring an exchange is not the same as requiring thinking. "Ok," "I see," and "that makes sense" will all pass genuine-attempt detection and count toward the exchange total.

---

#### K. Corrective Feedback

| Rating | Observable Indicators |
|---|---|
| Strong | Feedback identifies the specific misunderstanding, reasoning gap, or procedural mistake. Focuses on task and process. Helps student revise. Timing varies appropriately. Student responses are used as signals. |
| Partial | Feedback is sometimes specific. Relies on AI generation quality rather than structured templates. |
| Weak | Generic feedback ("Good try, but think about...") that doesn't identify the actual error. |
| Missing | No corrective feedback; just re-prompts. |

---

#### L. Adaptivity and Instructional Judgment

| Rating | Observable Indicators |
|---|---|
| Strong | Adapts based on struggle type, concept importance, prior interactions, and probable missing prerequisites. Behavior differs meaningfully across students and contexts. |
| Partial | Adapts based on attempt count. Topic-switching resets state. |
| Weak | Follows one rule: N attempts → hint → answer. No other adaptation logic. |
| Missing | No adaptation; all students get identical behavior. |

---

## STEP 2 — Category-by-Category Evaluation

### Evidence Legend
- `[SYS]` = evidence from `src/lib/system-prompt.ts`
- `[CHAT]` = evidence from `src/app/api/chat/route.ts`
- `[ATT]` = evidence from `src/lib/attempt-tracker.ts`
- `[END]` = evidence from `src/app/api/end-session/route.ts`
- `[RPT]` = evidence from `src/lib/report-generator.ts`
- `[CLT]` = evidence from client components (`client-chat.tsx`, `message-bubble.tsx`)
- `[SCH]` = evidence from Prisma schema (`prisma/schema.prisma`)

---

### A. Core Conception of Learning — **WEAK**

**Evidence:**

`[CHAT]` The attempt tracking loop reads prior messages to compute `currentTopicThread` and `attemptCount`. When `[TOPIC_THREAD]` changes, the count resets to 0. This is the complete extent of learning-state tracking.

`[SCH]` The `Message` model stores `topicThread`, `attemptNumber`, `isGenuineAttempt`, and `mode`. There is no `masteryConfirmed` flag, no `revisitNeeded` flag, no cross-session link.

`[SYS]` The system prompt has no instruction to revisit previously discussed topics, check whether understanding has survived delay, or distinguish fluency from mastery.

`[END]` The end-of-session summary generates "AREAS OF STRENGTH" and "AREAS TO REVISIT" — but these are never fed back into any future session. Once the session ends, the data is not reused.

**Instructional consequence:**
A student who correctly answers a question at attempt 1 and moves to the next topic has "mastered" the first topic from the app's perspective. If the same student misremembers the concept ten exchanges later, the app has no mechanism to notice or address this. Topics are "resolved" by the threshold, not by verified understanding.

**Exact failure mode:**
The app treats topic-thread advancement (moving to a new `[TOPIC_THREAD]`) as resolution. A student who produces a superficially plausible answer that happens to not be challenged will advance without any further scrutiny of that topic.

**Student experience in practice:**
The session feels like a linear progression through questions. Once a topic shifts, it never comes back unless the student brings it up. There is no sense of the tutor maintaining a model of the student's understanding across time.

---

### B. Prior Knowledge and Orientation — **WEAK**

**Evidence:**

`[CLT]` The initial message sent to the API is hardcoded:
```typescript
sendMessage(`Hi. My name is ${sname || "a student"}. I'm ready to begin the session. 
Please greet me by name and give me a thought-provoking opening question 
about the readings to get us started. Do not answer it yourself.`, sid);
```
This instruction asks for a greeting and a content question. It does not ask the tutor to:
- Find out what the student already knows about the topic
- Connect the reading to previous course material
- Explain why this reading matters
- Provide any advance organizer

`[SYS]` The static system prompt has no instruction for prior knowledge activation or orientation. The tutor's first task is to ask a "thought-provoking opening question" — which means it dives directly into content.

**Instructional consequence:**
Students with strong prior knowledge and students with none receive the same opening. A student who finds the question completely unfamiliar has no scaffolding to orient them. A student who has relevant professional experience is not invited to connect it to the reading.

**Exact failure mode:**
The opening question is content-first. It assumes the student is ready to engage with the material rather than first building a bridge from what they know. This is the "cold drop" anti-pattern.

**Student experience in practice:**
A student opens the session and is immediately asked a substantive question about the reading content, with no context about the session's purpose, no invitation to share prior knowledge, and no indication of what conceptual arc they are entering.

---

### C. High Expectations with Adaptive Support — **PARTIAL**

**Evidence:**

`[SYS]` The prompt specifies a scaffold progression:
- Attempts 1–2: guiding question
- If stuck: analogy to professional/everyday context
- Attempt 3+: direct answer

`[CHAT]` The `buildContextInstruction` function injects:
```typescript
if (currentAttemptCount < 3) {
  instruction = "Do not give a direct answer — use guiding questions.";
} else {
  instruction = "You may now give a direct answer if the student is still struggling.";
}
```

**What is present:** An attempt-count-gated support structure. Analogies are mentioned as a fallback. The prompt says "adjust the path, not lower the bar."

**What is missing:**
- No scaffold ladder beyond "question → analogy → direct answer"
- No decomposition of complex questions into sub-questions
- No hint sequence (vague hint → more specific hint → partial worked example)
- No variation based on struggle type (wrong mental model vs. missing prerequisite vs. confusion about language)
- No fading: once the threshold is hit, the direct answer is given. There is no mechanism to remove scaffolding as competence grows within a session.
- The "you may give a direct answer" instruction is permissive, not adaptive. It does not consider whether this specific concept is foundational (where giving the answer is fine) or complex (where giving the answer might short-circuit needed construction).

**Instructional consequence:**
The scaffold has only three positions: question, analogy, answer. This is adequate for simple factual gaps but insufficient for complex conceptual struggles where a student needs to work through multiple sub-steps.

**Exact failure mode:**
A student struggling with a multi-part concept (e.g., understanding how two frameworks interact) will receive guiding questions at attempts 1–2, possibly an analogy, and then a full direct answer at attempt 3. The direct answer resolves the exchange but may not resolve the understanding gap — especially if the gap is a missing prerequisite not addressed by the answer.

---

### D. Regular Checks for Understanding — **WEAK**

**Evidence:**

`[CHAT]` Confidence checks are injected every 4 exchanges:
```typescript
if (exchangeCount > 0 && exchangeCount % 4 === 0) {
  contextLine = `[TUTOR_CONTEXT: This is exchange #${exchangeCount}. 
  Before responding to the student's message, first ask them a brief confidence check: 
  "We've been working through ${lastTopicThread || 'the material'}. 
  Before we move on — how confident do you feel about it? 
  Very confident, somewhat confident, or still uncertain?"]`;
}
```

`[ATT]` The `extractConfidenceRating` function parses self-reported confidence ratings and stores a `ConfidenceCheck` record.

`[CHAT]` The confidence rating is stored but does **not** change the tutor's subsequent behavior. There is no code that alters `instruction`, `currentAttemptCount`, or any other variable based on a "uncertain" confidence response.

**What is present:** Periodic self-report confidence checks, logged for the instructor report.

**What is missing:**
- Diagnostic checks (explanation, prediction, application tasks) — vs. self-report
- Transition-point checks (before moving to a new topic, after a dense conceptual passage)
- Checks that actually alter behavior (a student who reports "uncertain" should trigger a different path than one who reports "very confident")
- Any test of whether the student can actually use a concept they claim to understand

**Instructional consequence:**
Self-reported confidence is a weak proxy for actual understanding. Research consistently shows that low-performing students overestimate their understanding (Dunning-Kruger) and that students who correctly answer questions often cannot transfer those answers to novel contexts. Logging self-reported confidence gives instructors data of limited diagnostic value.

**Exact failure mode:**
A student says "very confident" about a topic they have a fundamental misconception about. The app logs `very_confident`, the report says GREEN for that topic, and the instructor walks into class under-prepared for the confusion that exists.

**Student experience in practice:**
Every 4 exchanges, the student is asked one of three confidence levels. Their answer is recorded and the session continues identically regardless of their response.

---

### E. Misconceptions as Opportunities — **PARTIAL**

**Evidence:**

`[SYS]` The system prompt instructs the tutor to detect misconceptions and emit `[MISCONCEPTION: <description>]` tags. The corrective feedback instruction is:
```
When wrong: Be specific about what is incorrect. Frame corrections as refinements.
Be professional — never condescending, never effusive.
```

`[ATT]` The `parseTags` function extracts the misconception description and `[CHAT]` creates a `Misconception` record.

`[SCH]` The schema stores: `topicThread`, `description`, `studentMessage`.

**What is present:**
- Misconception detection delegated to the AI
- Storage of misconception description and the triggering student message
- Misconceptions grouped by topic in the instructor report

**What is missing:**
- No classification of misconception type (isolated false belief / flawed mental model / category error). The schema has only a free-text `description` field.
- No systematic instruction to make student thinking visible *before* correcting. The prompt says "give specific corrective feedback" — it does not say "first ask the student to explain their reasoning."
- No instruction to create productive cognitive conflict. The prompt does not tell the tutor to find cases where the student's reasoning leads to an obviously wrong conclusion, then surface that contradiction.
- The misconception is detected in the current response but the *detection* happens after the AI has already written its response. There is no pre-response "let me understand what the student is thinking" step.
- Misconceptions are logged for the report but do not accumulate in the conversation state to be revisited. A misconception detected at exchange 3 is not automatically probed again at exchange 10.

**Instructional consequence:**
Misconception detection is reactive and single-pass. The tutor corrects on the spot but does not systematically follow up to confirm the misconception was resolved. The report tells the instructor that a misconception occurred — but since there is no within-session follow-up, the instructor does not know whether the student left with the same misconception or a corrected understanding.

---

### F. Foundations and Spaced Retrieval — **MISSING**

**Evidence:**

`[SCH]` `StudentSession` has no link to previous sessions. Each session is a fresh database record with no reference to prior history.

`[CHAT]` The system prompt is rebuilt from scratch for each session. No prior session data is included.

`[SYS]` No instruction about foundational sequencing, prerequisite concepts, or revisiting earlier material.

`[ATT]` Attempt counts reset per topic thread. There is no cross-topic or cross-session memory.

**What is missing (completely):**
- Any form of spaced retrieval scheduling
- Any cross-session state that would allow the tutor to say "last session you struggled with X — let's revisit that"
- Any within-session mechanism to return to an earlier topic after covering new material
- Any distinction between "student recalled this immediately" and "student needed 3 attempts" when deciding whether to revisit
- Any prerequisite map that would prevent the tutor from discussing advanced concepts before foundational ones are confirmed

**Instructional consequence:**
This is the most critical missing capability for a professional learning context where students return across multiple class sessions. Every session starts from zero. Misconceptions that were only partially resolved in one session are invisible in the next. Concepts the student struggled with previously receive no additional attention.

**Student experience in practice:**
A student who ends session 1 with "AREAS TO REVISIT: concept X" begins session 2 with a fresh tutor that knows nothing about concept X. The summary the student received exists in isolation; it does not connect to their next session.

---

### G. Modeling Expert Thinking — **MISSING**

**Evidence:**

`[SYS]` The system prompt contains no instruction to model expert reading strategies or to make the tutor's own reasoning visible.

The entire prompt is oriented toward asking questions and providing direct answers. There is no instruction equivalent to "show the student how an expert would approach this passage."

**What is missing (completely):**
- No "think aloud" tutor moments
- No instruction to demonstrate how to identify the claim structure of an argument in the reading
- No instruction to show how to spot assumptions, evaluate evidence, or identify what is being left unsaid
- No worked examples of expert reasoning
- No deliberate use of examples and non-examples when teaching distinctions

**Instructional consequence:**
Students learn to answer the tutor's questions but do not develop the metacognitive reading strategies that would allow them to interrogate texts independently. The tutor asks "what do you think the author's argument is?" but never shows what it looks like to build that argument from the text.

**Student experience in practice:**
Students are challenged to reason but are never shown what good reasoning looks like. Weaker students who don't know how to approach a text receive guiding questions but not the procedural modeling they need to develop the underlying skill.

---

### H. Diagnostic Task Design — **WEAK**

**Evidence:**

`[SYS]` The system prompt specifies two question types: comprehension (direct answer) and conceptual (Socratic questions). But it provides no specification for what makes a question diagnostic.

The only task-design guidance in the prompt is:
- "Ask a guiding question" (attempt 1–2)
- "Offer an analogy... then ask them to apply it back to the reading" (if stuck)

There is no instruction to use:
- Transfer tasks (apply the concept to a new context)
- Error analysis ("here's a student response — what's wrong with it?")
- Compare/contrast ("how does this author's view differ from...?")
- Novel examples (not drawn from the readings)
- Prediction tasks ("if this principle is correct, what would you expect to happen when...?")

`[CLT]` The opening instruction asks for "a thought-provoking opening question about the readings." There is no specification of question type beyond "thought-provoking."

**Instructional consequence:**
The tutor generates questions that are plausible but not systematically designed to surface specific misunderstandings or test transfer. Question quality varies with model generation quality. A student can answer many questions by locating and paraphrasing text — which tests text comprehension but not conceptual understanding.

**Exact failure mode:**
Question: "What does the author mean by double-loop learning?"
Student answer: "The author says double-loop learning involves questioning the underlying assumptions, not just changing actions."
This answer is a paraphrase of the text. The student may have no idea what it means. The tutor accepts it as engagement and moves on.

---

### I. Balance of Support and Independence — **WEAK**

**Evidence:**

`[SYS]` The system prompt includes: "I know it can be frustrating, but working through this will help it stick. Let me ask it a different way..." — this is a good norm-setting phrase for when students ask to skip the process.

`[ATT]` Genuine attempt detection exists:
```typescript
const genuineMatch = rawText.match(/\[IS_GENUINE_ATTEMPT:\s*(true|false)\]/i);
if (genuineMatch) tags.isGenuineAttempt = genuineMatch[1].toLowerCase() === "true";
```

**What is present:** The `isGenuineAttempt` check prevents "I don't know" from counting toward the threshold. This is the most important support/independence feature in the app.

**What is missing:**
- No distinction between productive struggle (student is making progress) and unproductive confusion (student is spinning)
- No prerequisite diagnosis: when a student repeatedly fails on a concept, the app does not check whether a prerequisite concept is missing — it just counts attempts and gives the answer
- No fading of scaffolds within a session. The app does not notice "this student has demonstrated understanding of 5 concepts in a row; I can reduce the scaffolding"
- No self-explanation prompts ("before I respond, can you tell me what you've tried so far?")
- No help-seeking coaching ("if you're stuck, try rereading the section on X first, then come back to this")

**Instructional consequence:**
The rescue-after-3 rule is the dominant behavior. Students who identify as stuck can effectively game this by giving three plausible-but-wrong answers. Students who are genuinely confused and need prerequisite work get a direct answer to the wrong question.

---

### J. Participation and Cognitive Engagement — **PARTIAL**

**Evidence:**

`[CLT]` The interface requires the student to type a response for every exchange. The exchange counter is visible. The `isGenuineAttempt` flag filters out trivial non-responses.

`[SYS]` The system prompt includes an "inquiry coaching" instruction: "When a student asks a vague or overly broad question, help them sharpen it before answering." This is a genuine cognitive engagement mechanism.

**What is present:**
- Active participation is structurally required (student must type)
- Genuine attempt detection discourages low-effort inputs
- Inquiry coaching pushes students to sharpen vague questions

**What is missing:**
- No check on the depth or quality of engagement. "I agree with your point" will pass genuine attempt detection.
- No explicit turn structure that requires articulation ("before asking a question, summarize what you've understood so far")
- No tracking of which students are engaging at the surface level (paraphrasing, agreeing) vs. at the conceptual level (analyzing, connecting, applying)
- The exchange counter creates a perverse incentive: students who want to finish quickly will give brief, acceptable answers to exhaust their 20 exchanges

**Instructional consequence:**
Students who are motivated to engage deeply will benefit. Students who are looking to fulfil a completion requirement will find ways to do so with minimal cognitive effort.

---

### K. Corrective Feedback — **PARTIAL**

**Evidence:**

`[SYS]` Feedback rules are specified:
```
When wrong: Be specific about what is incorrect. Frame corrections as refinements. 
Be professional — never condescending, never effusive.
When right: Acknowledge briefly and specifically. Then push further.
```

These are solid policy statements but they are high-level. They are not operationalized into structured templates.

**What is present:**
- Specificity is explicitly required ("be specific about what is incorrect")
- Corrective framing is specified ("frame corrections as refinements")
- The tone guidance is professional and appropriate

**What is missing:**
- No structured feedback template that guarantees the three components of effective corrective feedback: (1) what is wrong, (2) why it is wrong, (3) what the correct direction is
- No timing variation: simple fluency errors should get immediate feedback; complex reasoning errors sometimes benefit from "try once more before I tell you" delay
- No mechanism to use a student's specific error as a signal to probe an entire topic. If a student makes an error that reveals a systemic misunderstanding, the tutor corrects the current message but does not revise its model of the student's understanding of the whole topic.
- Corrective feedback quality depends entirely on the AI model's generation quality on each turn, not on a structured approach.

---

### L. Adaptivity and Instructional Judgment — **WEAK**

**Evidence:**

`[CHAT]` The entire adaptation logic is:
```typescript
if (currentAttemptCount < 3) {
  instruction = "Do not give a direct answer — use guiding questions.";
} else {
  instruction = "You may now give a direct answer if the student is still struggling.";
}
```

This is the only adaptive variable in the system.

**What is present:**
- Topic-thread switching resets the attempt count (correct behavior)
- Genuine attempt filtering prevents gaming the threshold (good)
- 80% exchange warning adjusts the closing behavior (minor adaptive signal)

**What is missing:**
- No adaptation based on struggle type. A student who is confused about terminology gets the same response as a student who has a fundamental conceptual misunderstanding.
- No adaptation based on concept importance. A foundational concept (one that gates everything else) should get more scaffolding, not less. The app gives all concepts equal treatment.
- No adaptation based on prior interactions within the session. If a student has demonstrated mastery of 8 out of 10 concepts, the app does not adjust its approach for the last 2.
- No prerequisite inference. If a student struggles with concept B repeatedly, the app does not check whether concept A (a prerequisite) was understood.
- No adaptation across students. The app behaves identically for a student who is engaging deeply and one who is checking boxes.

**Instructional consequence:**
The app is not an adaptive tutor — it is a fixed protocol. The 3-attempt threshold is the same for all concepts, all students, and all struggle types. This will produce reasonable results for the median student on straightforward conceptual questions and will fail for students at either extreme (very advanced students get unnecessary scaffolding; struggling students get premature direct answers).

---

## STEP 3 — Prioritized Gap List

Prioritization uses four factors:
1. **Impact** — how much does fixing this improve learning quality?
2. **Severity** — how badly does the current implementation fail?
3. **Frequency** — how often does this failure occur?
4. **Complexity** — how hard is this to implement?

Priority order runs from most to least urgent. Implement in this order.

| Rank | Gap | Category | Impact | Severity | Frequency | Complexity | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Confidence checks don't change behavior | D | HIGH | HIGH | Every 4 exchanges | LOW | **P0** |
| 2 | No prior knowledge activation at session open | B | HIGH | HIGH | Every session | LOW | **P0** |
| 3 | No diagnostic question types — all questions are generation-dependent | H | HIGH | HIGH | Every Socratic exchange | MEDIUM | **P0** |
| 4 | No misconception follow-up within session | E | HIGH | HIGH | Whenever misconception logged | MEDIUM | **P0** |
| 5 | Expert thinking modeling is absent | G | HIGH | MISSING | Every session | MEDIUM | **P1** |
| 6 | Adaptive support ladder is 3 positions only | C | HIGH | MEDIUM | Every struggle sequence | MEDIUM | **P1** |
| 7 | No productive cognitive conflict creation | E | HIGH | MISSING | Whenever misconception | MEDIUM | **P1** |
| 8 | Foundational concepts not confirmed before advancing | F | HIGH | HIGH | Topic transitions | HIGH | **P1** |
| 9 | Self-explanation never prompted | I | MEDIUM | HIGH | Every Socratic exchange | LOW | **P1** |
| 10 | No prerequisite diagnosis on repeated failure | L | HIGH | HIGH | Repeated struggle sequences | HIGH | **P2** |
| 11 | No cross-session memory | F | HIGH | MISSING | Every returning session | HIGH | **P2** |
| 12 | Student thinking not surfaced before correction | E | MEDIUM | HIGH | Every misconception | LOW | **P2** |
| 13 | No transfer checks | H | MEDIUM | HIGH | End of each topic | MEDIUM | **P2** |
| 14 | No learning arc framing | A | MEDIUM | HIGH | Every session | LOW | **P2** |

---

## STEP 4 — Implementation Recommendations

Each recommendation below is implementation-ready. It specifies the exact file, function, data change, and prompt change required.

---

### REC-01 — Make Confidence Checks Behavioral, Not Just Logged

**Priority:** P0  
**Category:** D (Regular Checks for Understanding)  
**Student problem it solves:** Student reports "uncertain" and receives no different treatment. The check is a survey, not a teaching tool.

#### Product Behavior
When a student responds with `uncertain` to a confidence check, the tutor must:
1. Acknowledge the uncertainty specifically ("Okay — let's go back to that before we move on")
2. Generate a retrieval probe: a novel question on the same topic that tests use, not recall
3. If the student passes the probe: continue
4. If the student fails the probe: re-teach using a different angle than the original

When a student responds with `very_confident`, the tutor should:
1. Offer a light transfer probe: "Quick check — can you give me an example of [concept] in a context *outside* the reading?"

#### Tutor Policy / Decision Rule
```
IF confidence_rating == "uncertain"
  → Set flag: revisit_current_topic = true
  → Do NOT advance topic thread
  → Generate a retrieval probe question (not the same question that was just asked)
  → Treat student's response to probe as a new attempt on the current topic thread

IF confidence_rating == "very_confident"  
  → Generate one transfer probe (concept applied to a novel, professional context)
  → If passed: proceed, log topic as "transfer_verified"
  → If failed: add topic to soft_revisit_queue
```

#### Example Interaction
```
Tutor: "We've been working through double-loop learning. Before we move on — 
how confident do you feel about it? Very confident, somewhat confident, or still uncertain?"

Student: "Still uncertain, honestly."

Tutor: "Got it. Let's work through that before moving on. Here's a different angle: 
think about a time in your own work when you solved a problem but the same type 
of problem kept coming back. What was happening there, and how does that connect 
to what Argyris is describing?"
[System: topic_thread remains "double-loop-learning", attempt_count reset to 0, revisit flag set]
```

#### Files to Change

**`src/app/api/chat/route.ts`**

Add confidence-triggered instruction injection:
```typescript
// After extracting confidence rating from student message:
const rating = extractConfidenceRating(lastUserMessage.content);
if (rating === "uncertain" && exchangeCount > 0 && (exchangeCount - 1) % 4 === 0) {
  // Override the standard context instruction
  instruction = `The student just reported feeling uncertain about "${currentTopicThread}". 
  Do NOT advance to a new topic. Instead, generate a retrieval probe: 
  ask the student to explain or apply "${currentTopicThread}" using a context 
  they have not encountered in this session. This is a re-engagement, 
  not a re-explanation. Do not re-explain the concept before asking.`;
}

if (rating === "very_confident" && exchangeCount > 0 && (exchangeCount - 1) % 4 === 0) {
  instruction = `The student reports high confidence about "${currentTopicThread}". 
  Generate one brief transfer probe: ask them to apply this concept 
  to a professional scenario not discussed in the readings. 
  Keep it short — one sentence question. If they answer well, move on.`;
}
```

**`prisma/schema.prisma`**

Add fields to `ConfidenceCheck`:
```prisma
model ConfidenceCheck {
  id               String   @id @default(cuid())
  studentSessionId String
  topicThread      String
  rating           String
  probeAsked       Boolean  @default(false)  // was a follow-up probe generated?
  probeResult      String?  // "passed" | "failed" | null
  createdAt        DateTime @default(now())
  studentSession   StudentSession @relation(...)
}
```

**Data required:** `currentTopicThread`, `exchangeCount`, raw student message, prior confidence check record.

#### Acceptance Criteria
- [ ] A student who responds "uncertain" at a confidence check receives a retrieval probe, not a new topic question
- [ ] The topic thread does not advance after an "uncertain" response
- [ ] A student who responds "very confident" receives a transfer probe before the session moves on
- [ ] The `ConfidenceCheck` record records whether a probe was asked and the result
- [ ] A student who passes the transfer probe advances normally; one who fails has the topic added to the soft revisit queue

#### How to Tell It's Working
Log the topic thread before and after confidence check exchanges. If `uncertain` responses are followed by topic thread changes, the fix is not working.

---

### REC-02 — Replace the Cold Opening with an Orienting Sequence

**Priority:** P0  
**Category:** B (Prior Knowledge and Orientation)  
**Student problem it solves:** Student is dropped into a question about the reading with no context, no connection to what they know, and no sense of why this reading matters.

#### Product Behavior
Replace the single hardcoded opening message with a 3-turn opening sequence:

**Turn 0 (System-generated, shown as intro card before chat begins):**
- Session name and description
- Brief tutor orientation: "I'll help you work through the reading by asking questions that push you to construct your own understanding. After a few genuine attempts, I'll give you a direct answer if you're still stuck."
- One sentence on the reading's relevance: taken from a session-level field that the instructor fills in (see schema change below)

**Turn 1 (Tutor's first message):**
- Greet by name
- Prior knowledge activation: ask one question about what the student already knows/believes about the topic *before* the reading
- NOT a question about the reading content

**Turn 2 (After student responds):**
- Briefly acknowledge what they said
- Connect it to the reading ("what you just described maps to what [author] calls X — let me ask you something about that")
- Then pose the first Socratic question on the reading

#### Tutor Policy / Decision Rule
```
Opening sequence:
Turn 1 → prior_knowledge_probe(topic_from_readings)
Turn 2 → acknowledge_prior_knowledge + bridge_to_reading + first_socratic_question
Turn 3+ → normal Socratic protocol
```

#### Files to Change

**`src/app/s/[accessCode]/chat/client-chat.tsx`**

Replace the hardcoded opening message:
```typescript
// BEFORE:
sendMessage(`Hi. My name is ${sname}. I'm ready to begin the session. 
Please greet me by name and give me a thought-provoking opening question 
about the readings to get us started. Do not answer it yourself.`, sid);

// AFTER:
sendMessage(`Hi. My name is ${sname}. I'm ready to begin the session.
OPENING SEQUENCE INSTRUCTION: This is exchange 0 — the session opening. 
Follow this sequence exactly:
1. Greet me by name.
2. Ask me ONE question about what I already know or believe about 
   the main topic of today's readings — NOT a question about the reading content itself.
   Draw the topic label from the reading titles. 
   Example: if the reading is about "organizational learning," ask what I already 
   know or believe about how organizations learn.
3. Wait for my response before asking anything about the readings.
Do NOT ask about the reading content yet. Do NOT pose a Socratic question yet.`, sid);
```

**`prisma/schema.prisma`**

Add instructor-provided context to `Session`:
```prisma
model Session {
  // ... existing fields ...
  courseContext   String?   // instructor fills this in: "This reading connects to Week 2's theme of..."
  learningGoal    String?   // instructor fills this in: "After this session, students should be able to..."
}
```

**`src/app/instructor/[sessionId]/page.tsx`**

Add optional fields to the session management form:
```typescript
// Add two optional textarea inputs:
// "Course context" — how this reading fits the course arc (shown to tutor, not students)
// "Session learning goal" — what students should understand by the end (shown in tutor orientation)
```

**`src/lib/system-prompt.ts`**

Add course context to the system prompt:
```typescript
export function buildSystemPrompt(
  readings: Reading[], 
  assessments: Assessment[],
  session?: { courseContext?: string | null; learningGoal?: string | null }
): string {
  let prompt = STATIC_BASE_PROMPT;
  
  if (session?.courseContext) {
    prompt += `\n\nCOURSE CONTEXT (use to connect reading to prior learning):\n${session.courseContext}`;
  }
  if (session?.learningGoal) {
    prompt += `\n\nSESSION LEARNING GOAL:\n${session.learningGoal}`;
  }
  // ... existing reading/assessment injection ...
}
```

#### Acceptance Criteria
- [ ] The tutor's first message asks about prior knowledge, not reading content
- [ ] The tutor's second message connects the student's response to the reading before posing the first Socratic question
- [ ] If `courseContext` is set, the tutor references the course arc at least once in the first 3 exchanges
- [ ] A student who says they know nothing about the topic receives a bridging statement before the first question
- [ ] The intro card (Turn 0) is visible before the first tutor message loads

---

### REC-03 — Structured Diagnostic Question Types

**Priority:** P0  
**Category:** H (Diagnostic Task Design)  
**Student problem it solves:** Questions are generated ad-hoc by the model. Many can be answered by locating and paraphrasing the text. Understanding is not genuinely probed.

#### Product Behavior
The system prompt must specify a taxonomy of diagnostic question types and instruct the tutor to rotate through them systematically. Questions should be categorized at generation time so the instructor report can show which types were used.

#### Question Type Taxonomy

| Code | Type | What it tests | Example |
|---|---|---|---|
| `EXPLAIN` | Explanation in own words | Comprehension beyond recall | "Explain [concept] as if describing it to a colleague who hasn't read this." |
| `PREDICT` | Prediction | Causal understanding | "If [condition from reading] were reversed, what would change?" |
| `APPLY` | Novel application | Transfer | "How would [concept] apply to [professional scenario not in readings]?" |
| `DISTINGUISH` | Compare/contrast | Categorical clarity | "What's the difference between [concept A] and [concept B]? When would you use each?" |
| `CHALLENGE` | Steelman/critique | Depth of understanding | "What's the strongest argument against [the author's claim]?" |
| `DETECT-ERROR` | Error analysis | Understanding of common mistakes | "A student said [plausible wrong answer]. What did they get wrong and why?" |

#### Files to Change

**`src/lib/system-prompt.ts`**

Add a question taxonomy section to the static prompt:

```typescript
const DIAGNOSTIC_QUESTION_TAXONOMY = `
QUESTION TYPES — rotate through these systematically. Do not ask the same type twice in a row.
After each question you ask, append a tag: [QTYPE: explain|predict|apply|distinguish|challenge|detect-error]

EXPLAIN: Ask the student to explain a concept in their own words, as if to a colleague 
who has not read the material. Acceptable answers must go beyond the text's phrasing.

PREDICT: Give a condition derived from the reading and ask what would follow. 
The scenario should not appear in the text itself.

APPLY: Give a professional scenario (not from the readings) and ask the student 
to apply a concept from the reading to it.

DISTINGUISH: Ask the student to differentiate between two related concepts from the reading. 
The answer should require understanding of both, not just one.

CHALLENGE: Ask the student to articulate the strongest objection to a claim in the reading. 
This requires understanding the claim well enough to argue against it.

DETECT-ERROR: Give the student a plausible but incorrect interpretation and ask them 
to identify what is wrong and why. Construct the error around a known misconception pattern.

RULE: Never ask a question that can be answered by finding and quoting a passage. 
If the question has a word-for-word answer in the text, it is a recall question, not a diagnostic question.
`;
```

**`prisma/schema.prisma`**

Add `questionType` to the `Message` model:
```prisma
model Message {
  // ... existing fields ...
  questionType  String?   // "explain" | "predict" | "apply" | "distinguish" | "challenge" | "detect-error" | null
}
```

**`src/lib/attempt-tracker.ts`**

Add question type extraction:
```typescript
const QUESTION_TYPE_PATTERN = /\[QTYPE:\s*(explain|predict|apply|distinguish|challenge|detect-error)\]/i;

export function parseTags(rawText: string): ParseResult {
  // ... existing parsing ...
  const qtypeMatch = rawText.match(QUESTION_TYPE_PATTERN);
  tags.questionType = qtypeMatch ? qtypeMatch[1].toLowerCase() : null;
  
  // Add to cleaned text stripping:
  const cleanedText = rawText
    .replace(QUESTION_TYPE_PATTERN, "")
    // ... existing replacements ...
}
```

**`src/lib/report-generator.ts`**

Include question type distribution in the report prompt:
```typescript
// Add to transcriptData construction:
const qtypeCounts = stu.messages
  .filter(m => m.role === "assistant" && m.questionType)
  .reduce((acc, m) => {
    acc[m.questionType!] = (acc[m.questionType!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
transcriptData += `Question types used: ${JSON.stringify(qtypeCounts)}\n`;
```

#### Acceptance Criteria
- [ ] The `[QTYPE:]` tag appears in every assistant message that contains a question
- [ ] Consecutive messages do not use the same question type
- [ ] A 20-exchange session contains at least 3 different question types
- [ ] Questions of type `apply`, `predict`, and `distinguish` contain a scenario or context not verbatim in the readings
- [ ] The `Message.questionType` field is populated in the database
- [ ] The instructor report includes a breakdown of question types used per student

#### How to Tell It's Working
Sample 10 consecutive assistant messages and verify no two adjacent messages share a `[QTYPE:]`. Manually test that each `apply` or `predict` question requires a response that cannot be found by text-searching the uploaded readings.

---

### REC-04 — Misconception Follow-Up Within Session

**Priority:** P0  
**Category:** E (Misconceptions as Opportunities)  
**Student problem it solves:** A misconception is detected and logged, but the current conversation moves on. The student leaves with the same misconception they arrived with.

#### Product Behavior

1. When a `[MISCONCEPTION:]` tag is emitted, set a flag on the student session: `unresolvedMisconceptions` (a list).
2. At the end of the topic thread (when `[TOPIC_THREAD]` changes), before allowing advancement, check whether any misconceptions on the current topic are unresolved.
3. If unresolved misconceptions exist: inject a resolution check before advancing.
4. Track whether the misconception was explicitly revisited and whether the student demonstrated correction.

#### Tutor Policy / Decision Rule
```
ON topic_thread_change:
  IF unresolvedMisconceptions[previous_topic] is not empty:
    → DO NOT advance topic immediately
    → Inject: "Before we move on from [topic], I want to circle back to something. 
       Earlier you [described the misconception]. 
       Can you explain why that view isn't quite right and what the correct understanding is?"
    → IF student's response resolves the misconception: 
       mark as resolved, advance topic
    → IF student's response does not resolve it:
       note as "persistently unresolved", still advance after one additional attempt, 
       but flag in session summary and instructor report
```

#### Example Interaction
```
[Student has been discussing "single-loop vs. double-loop learning"]
[Misconception logged: "Student conflated double-loop learning with trial-and-error"]
[Topic thread now shifting to "organizational defensive routines"]

Tutor: "Before we move on — earlier you described double-loop learning as 
essentially trying different solutions until one works. That's not quite right, 
and I want to make sure we've cleared it up. What would you say is actually different 
about double-loop learning compared to just trying harder or trying something new?"

[If student corrects: mark misconception as resolved]
[If student still confused: note as persistently unresolved in session summary]
```

#### Files to Change

**`src/app/api/chat/route.ts`**

Add unresolved misconception tracking to the attempt state loop:
```typescript
// After computing currentTopicThread and attemptCount:
const unresolvedMisconceptions = await prisma.misconception.findMany({
  where: {
    studentSessionId,
    topicThread: currentTopicThread ?? undefined,
    resolved: false,  // new field — see schema change
  },
});

// In buildContextInstruction call — add unresolvedMisconceptions parameter:
const instruction = buildContextInstruction(
  currentTopicThread, 
  attemptCount, 
  exchangeCount, 
  studentSession.session.maxExchanges,
  unresolvedMisconceptions  // new parameter
);
```

**`src/lib/system-prompt.ts`**

Update `buildContextInstruction` to inject misconception resolution prompts:
```typescript
export function buildContextInstruction(
  lastTopicThread: string | null,
  currentAttemptCount: number,
  exchangeCount: number,
  maxExchanges: number,
  unresolvedMisconceptions?: Array<{ description: string; topicThread: string }>
): string {
  // ... existing logic ...
  
  // Topic-change misconception resolution check:
  if (unresolvedMisconceptions && unresolvedMisconceptions.length > 0) {
    const misconceptionList = unresolvedMisconceptions
      .map(m => `"${m.description}"`)
      .join("; ");
    contextLine = `[TUTOR_CONTEXT: Before advancing to a new topic, 
    the following misconceptions about "${lastTopicThread}" were detected and not yet resolved: 
    ${misconceptionList}. 
    Your FIRST priority is to address at least one of these with a resolution check. 
    Ask the student to re-explain the concept in a way that corrects the misconception. 
    Only advance the topic thread after this check.]\n${contextLine}`;
  }
  
  return contextLine;
}
```

**`prisma/schema.prisma`**

Add `resolved` field to `Misconception`:
```prisma
model Misconception {
  id               String   @id @default(cuid())
  studentSessionId String
  topicThread      String
  description      String
  studentMessage   String
  resolved         Boolean  @default(false)   // set to true when follow-up confirms correction
  persistentlyUnresolved Boolean @default(false)  // set to true if still wrong after follow-up
  detectedAt       DateTime @default(now())
  studentSession   StudentSession @relation(...)
}
```

#### Acceptance Criteria
- [ ] When the topic thread changes and there is at least one unresolved misconception on the prior topic, the tutor asks a resolution check before advancing
- [ ] The `Misconception.resolved` field is updated when the student demonstrates correction
- [ ] The instructor report includes a "persistently unresolved" category in the misconceptions section
- [ ] The end-of-session summary includes unresolved misconceptions in "AREAS TO REVISIT" with specificity

---

### REC-05 — Expert Thinking Moments

**Priority:** P1  
**Category:** G (Modeling Expert Thinking)  
**Student problem it solves:** Students are asked to reason well but never see what good reasoning looks like. Weaker students cannot bootstrap from nothing.

#### Product Behavior

Add a new tutor behavior: the "think-aloud" demonstration. This is triggered in two cases:
1. At the first Socratic question of each session (model how to approach a text)
2. When a student has made 2 failed attempts and the next move is to give a direct answer — instead of jumping to the answer, the tutor shows its reasoning path first

The think-aloud should be brief (3–4 sentences) and should make visible:
- What the expert notices in the text (claim structure, evidence, assumptions)
- How the expert moves from text to concept
- What questions the expert asks of the text

#### Files to Change

**`src/lib/system-prompt.ts`**

Add expert modeling instruction to the static prompt:

```typescript
const EXPERT_MODELING_INSTRUCTION = `
EXPERT MODELING (use in two specific situations):

Situation 1 — SESSION OPENING: When asking the very first Socratic question of the session, 
briefly demonstrate how an expert reader would approach this material before asking the student.
Format: "Here's what I notice when I read this passage: [2-3 sentences showing expert attention to 
claims, evidence, assumptions, or structure]. Now, with that in mind: [your question]."
Keep the demonstration to 2–3 sentences. It is a model, not a lecture.

Situation 2 — BEFORE GIVING A DIRECT ANSWER: When you are about to give a direct answer 
(attempt count >= 3), do not jump straight to the answer. First show your reasoning path:
"Let me show you how I'd think through this: [2–3 sentence reasoning trace]. 
That leads to: [the direct answer]."
This is different from just giving the answer — it shows the student how to arrive at it themselves next time.

Do NOT use expert modeling in every exchange. Reserve it for these two situations only.
Append [EXPERT_MODEL: true] when you use this technique.
`;
```

**`prisma/schema.prisma`**

Add `hasExpertModel` field to `Message`:
```prisma
model Message {
  // ... existing fields ...
  hasExpertModel Boolean @default(false)
}
```

#### Acceptance Criteria
- [ ] The first Socratic question of every session includes a 2–3 sentence expert modeling demonstration
- [ ] Every direct-answer response (attempt >= 3, mode == "socratic") includes a reasoning trace before the answer
- [ ] `[EXPERT_MODEL: true]` appears in these messages and `Message.hasExpertModel` is set to `true`
- [ ] Expert modeling does not appear in comprehension mode responses
- [ ] Expert modeling does not appear in every message — frequency is limited to the two specified triggers

---

### REC-06 — Self-Explanation Prompts

**Priority:** P1  
**Category:** I (Balance of Support and Independence)  
**Student problem it solves:** Students receive guiding questions but are not required to articulate their own reasoning process. Self-explanation (making your thinking explicit) is one of the strongest learning mechanisms known.

#### Product Behavior

Add a self-explanation prompt to the opening of attempt 1 for any Socratic question. Before asking a guiding question, the tutor should first ask the student to share their current understanding or reasoning, if the student has not already done so.

**Trigger rule:** If the student's message is a direct question (contains "?" or "what is" / "how does" / "why does" phrasing), and this is the first attempt on this topic thread, respond first with a self-explanation prompt before a guiding question.

**Non-trigger rule:** If the student has already shared their thinking (their message contains a claim or argument, not just a question), skip the self-explanation prompt and proceed to the guiding question.

#### Files to Change

**`src/lib/system-prompt.ts`**

Add self-explanation instruction:
```typescript
const SELF_EXPLANATION_INSTRUCTION = `
SELF-EXPLANATION FIRST (applies to Socratic mode only, attempt 1 only):

Before asking a guiding question, check: has the student shared their current thinking?

IF the student's message is a direct question (e.g., "What does X mean?" "How does Y work?") 
and they have NOT shared their reasoning:
→ First ask them to share what they currently think, before you respond.
Format: "Before I respond — what's your current thinking about [topic]? 
Even a rough idea or a guess is useful."
→ Then respond to THEIR answer with a guiding question on their specific reasoning.
This gets their thinking visible before you intervene.

IF the student's message already contains their reasoning or a claim:
→ Skip the self-explanation prompt. They've already done it. 
→ Respond to what they said directly.

Do NOT use this on attempt 2 or later — by then you have their thinking on record.
Do NOT use this for comprehension mode questions — answer those directly.
Append [SELF_EXPLAIN_PROMPTED: true] when you use this technique.
`;
```

#### Acceptance Criteria
- [ ] When a student asks a direct question on attempt 1, the tutor's first response asks for their current thinking before engaging
- [ ] When a student provides a claim or argument, the tutor does not add an additional self-explanation prompt
- [ ] `[SELF_EXPLAIN_PROMPTED: true]` is stripped from displayed text but parseable from raw response
- [ ] Self-explanation prompts do not appear on attempt 2+ or in comprehension mode

---

### REC-07 — Soft Revisit Queue for Resolved Topics

**Priority:** P2  
**Category:** A / F (Core Conception of Learning / Foundations)  
**Student problem it solves:** Topics marked "resolved" (because the student passed attempt threshold) are never revisited. Fluency is mistaken for mastery.

#### Product Behavior

Maintain a `softRevisitQueue` in the student session state: a list of topic threads where the student either:
- Needed 3+ attempts (received a direct answer)
- Reported "uncertain" at a confidence check
- Had a misconception that was resolved (confirmed once, not spaced)

At an appropriate point mid-session (exchange 10–12 or when the topic naturally allows), the tutor revisits one item from this queue with a brief retrieval probe.

This is within-session spaced retrieval — not cross-session (that requires more infrastructure and is P2).

#### Files to Change

**`prisma/schema.prisma`**

Add `softRevisitQueue` to `StudentSession`:
```prisma
model StudentSession {
  // ... existing fields ...
  softRevisitQueue String @default("[]")  // JSON array of topic thread strings
}
```

**`src/app/api/chat/route.ts`**

Build revisit queue update logic:
```typescript
// After processing each assistant response:
const softRevisitQueue = JSON.parse(studentSession.softRevisitQueue || "[]") as string[];

// Add to queue if: direct answer was given, or confidence was uncertain, or misconception resolved
if (tags.directAnswer || confidenceRating === "uncertain") {
  const topicToAdd = tags.topicThread || currentTopicThread;
  if (topicToAdd && !softRevisitQueue.includes(topicToAdd)) {
    softRevisitQueue.push(topicToAdd);
    await prisma.studentSession.update({
      where: { id: studentSessionId },
      data: { softRevisitQueue: JSON.stringify(softRevisitQueue) },
    });
  }
}

// Inject revisit at exchange 10 or 14 (if queue is non-empty):
const isRevisitExchange = (exchangeCount === 10 || exchangeCount === 14) && softRevisitQueue.length > 0;
if (isRevisitExchange) {
  const topicToRevisit = softRevisitQueue[0];  // FIFO order
  instruction = `[TUTOR_CONTEXT: Spaced retrieval check. 
  Earlier in this session you worked through "${topicToRevisit}". 
  Without re-explaining it, ask the student to retrieve and briefly apply 
  that concept right now — in 1–2 sentences. 
  Frame it naturally: "Before we go further, I want to briefly check in on something 
  we covered earlier..."
  After they respond, continue with the current topic.]\n${instruction}`;
}
```

#### Acceptance Criteria
- [ ] Topics where a direct answer was given are added to `softRevisitQueue`
- [ ] At exchange 10, if the queue is non-empty, the tutor asks a brief retrieval probe on a prior topic
- [ ] The retrieval probe is a retrieval task (not a re-explanation of the concept)
- [ ] After the probe, the session continues with the current topic
- [ ] The `StudentSession.softRevisitQueue` field is updated correctly in the database

---

### REC-08 — Productive Cognitive Conflict

**Priority:** P1  
**Category:** E (Misconceptions as Opportunities)  
**Student problem it solves:** Misconceptions are corrected but students do not experience the cognitive dissonance that makes corrections stick. Simply being told you are wrong is less effective than seeing your own reasoning produce an absurd or contradictory result.

#### Product Behavior

When a misconception is detected, before correcting, the tutor should — when possible — follow the student's reasoning to a logical conclusion that reveals the error. This requires one additional turn before correction.

#### Tutor Policy

```
ON misconception_detected:
  Step 1: Ask "If what you're saying is true, then [logical consequence of their incorrect belief]?"
          — this should be a clearly problematic or counterintuitive consequence
  Step 2: Wait for student response
  Step 3: "Right — that's the tension. The reason that conclusion doesn't work is [correction]."
  
Skip this if:
  - The misconception is a minor factual error (not a reasoning error)
  - This is attempt 3+ (give the direct answer instead; student has been through enough)
  - The student's misconception is about a definition, not a concept
```

#### Files to Change

**`src/lib/system-prompt.ts`**

Add cognitive conflict instruction:
```typescript
const COGNITIVE_CONFLICT_INSTRUCTION = `
PRODUCTIVE COGNITIVE CONFLICT (applies when you detect a misconception, attempt 1 or 2 only):

When you detect a conceptual misconception (not a simple factual error), 
do NOT correct it immediately.

Instead, follow the student's reasoning to its natural conclusion:
1. Identify: what would be true if their belief were correct?
2. Ask: "If that's right, then [logical consequence] — does that hold up?"
3. The consequence should be something the student can recognize as problematic or strange.
4. After they respond: "That tension you're noticing is the key. The reason it breaks down is: [correction]."

This creates cognitive conflict — the student's own reasoning reveals the problem. 
This is more durable than being told you're wrong.

WHEN NOT TO USE THIS:
- If the error is a simple factual mistake, not a reasoning error
- If the student is on attempt 3+ (give the direct answer instead)
- If the misconception is purely definitional

Append [COGNITIVE_CONFLICT: true] when you use this technique.
`;
```

#### Acceptance Criteria
- [ ] When a misconception is detected on attempt 1 or 2, the tutor's response asks "if that's true, then..." before correcting
- [ ] The consequence posed should be logically derivable from the student's stated belief
- [ ] Correction follows the student's engagement with the consequence, not precedes it
- [ ] This technique does not apply on attempt 3+ (direct answer takes priority)
- [ ] `[COGNITIVE_CONFLICT: true]` is tagged when used

---

### REC-09 — Prerequisite Map

**Priority:** P2  
**Category:** F / L (Foundations and Spaced Retrieval / Adaptivity)  
**Student problem it solves:** When a student struggles repeatedly with a concept, the app gives a direct answer. It never asks whether the struggle is caused by a missing prerequisite — a concept that must be understood before the current one makes sense. Answering the wrong question helps no one.

#### What a Prerequisite Map Is

A prerequisite map is a lightweight JSON structure that the instructor optionally provides per session. It defines:
- Which concepts are foundational (gates) and which are advanced (depend on gates)
- The recommended order for addressing topics

The app uses this map to decide, when a student is stuck, whether to address the current concept or step back to a prerequisite.

#### Data Structure

Store in `Session.prerequisiteMap` as JSON:

```json
{
  "concepts": [
    {
      "id": "theory-in-use",
      "label": "Theory-in-use",
      "level": "foundational",
      "prerequisites": []
    },
    {
      "id": "single-loop-learning",
      "label": "Single-loop learning",
      "level": "foundational",
      "prerequisites": ["theory-in-use"]
    },
    {
      "id": "double-loop-learning",
      "label": "Double-loop learning",
      "level": "intermediate",
      "prerequisites": ["single-loop-learning"]
    },
    {
      "id": "defensive-routines",
      "label": "Organizational defensive routines",
      "level": "advanced",
      "prerequisites": ["double-loop-learning"]
    }
  ]
}
```

#### Tutor Policy / Decision Rule

```
ON attempt_count >= 2 AND student still struggling:
  1. Look up current topic_thread in prerequisiteMap
  2. IF prerequisites exist for this topic:
     → Check whether those prerequisite topics appear in the session's message history
     → IF a prerequisite has NOT been discussed: 
        inject instruction: "Before going further with [current topic], 
        check whether the student understands [prerequisite]. 
        Ask: 'Before we go further — can you explain [prerequisite concept] in your own words?'"
     → IF prerequisite HAS been discussed but student struggled with it (attempt >= 3):
        inject instruction: "The student may have a gap in [prerequisite]. 
        Briefly re-engage [prerequisite] with one question before returning to [current topic]."
  3. IF no prerequisite map is defined for this session:
     → Proceed with normal scaffold (no change to current behavior)
```

#### Files to Change

**`prisma/schema.prisma`**
```prisma
model Session {
  // ... existing fields ...
  prerequisiteMap String?  // JSON: PrerequisiteMap structure above. Nullable.
}
```

**`src/app/instructor/[sessionId]/page.tsx`**

Add an advanced configuration section (collapsed by default) with a text area for the JSON prerequisite map. Include a "Generate suggested map" button that sends the reading titles to the API and gets back a suggested map.

**`src/app/api/sessions/[sessionId]/suggest-prerequisite-map/route.ts`** (new file)

```typescript
// POST: generate a suggested prerequisite map from the session's reading titles and content
export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { readings: true }
  });
  
  const prompt = `Based on these readings, identify the key concepts and their prerequisite relationships.
Return a JSON object matching this schema:
{ concepts: [{ id: string, label: string, level: "foundational"|"intermediate"|"advanced", prerequisites: string[] }] }

Reading titles and first 500 chars each:
${session!.readings.map(r => `${r.filename}: ${r.content.slice(0, 500)}`).join('\n\n')}

Return ONLY valid JSON. No explanation.`;

  const { text } = await generateText({ model: anthropic("claude-sonnet-4-6"), prompt });
  return NextResponse.json({ map: JSON.parse(text) });
}
```

**`src/app/api/chat/route.ts`**

Add prerequisite check into the context instruction builder:
```typescript
const session = await prisma.session.findUnique({
  where: { id: studentSession.sessionId },
  select: { prerequisiteMap: true, /* ... */ }
});

const prereqMap = session?.prerequisiteMap ? JSON.parse(session.prerequisiteMap) : null;

const instruction = buildContextInstruction(
  currentTopicThread,
  attemptCount,
  exchangeCount,
  studentSession.session.maxExchanges,
  unresolvedMisconceptions,
  prereqMap  // new parameter
);
```

**`src/lib/system-prompt.ts`**

Update `buildContextInstruction` to use the prereq map:
```typescript
export function buildContextInstruction(
  // ... existing params ...
  prereqMap?: PrerequisiteMap | null
): string {
  // ... existing logic ...
  
  if (prereqMap && currentAttemptCount >= 2 && lastTopicThread) {
    const concept = prereqMap.concepts.find(
      c => c.label.toLowerCase() === lastTopicThread.toLowerCase()
    );
    if (concept && concept.prerequisites.length > 0) {
      const prereqLabels = concept.prerequisites
        .map(pid => prereqMap.concepts.find(c => c.id === pid)?.label)
        .filter(Boolean);
      contextLine = `[TUTOR_CONTEXT: The student is struggling with "${lastTopicThread}". 
      This concept has prerequisites: ${prereqLabels.join(', ')}. 
      Before attempting another guiding question on "${lastTopicThread}", 
      briefly check whether the student has a firm handle on the prerequisite(s). 
      Ask: "Before we go further — can you briefly explain [lowest prerequisite]?"]\n${contextLine}`;
    }
  }
  
  return contextLine;
}
```

#### Acceptance Criteria
- [ ] `Session.prerequisiteMap` can be set via the instructor session management page
- [ ] "Generate suggested map" calls the API and populates the JSON field
- [ ] When attempt count >= 2 and a prerequisite map is defined for the session, the context injection includes a prerequisite check
- [ ] When no prerequisite map is defined, behavior is identical to current (no regression)
- [ ] The prerequisite map is null-safe throughout — never throws on missing/malformed JSON

#### Edge Cases
- Instructor provides a malformed JSON map: catch and log error, fall back to null behavior
- Topic thread label does not match any concept in the map: no prerequisite injection (silent no-op)
- Circular prerequisites: the map generator prompt should be instructed to avoid cycles; add a validation step in the API route

---

### REC-10 — Mastery Criteria

**Priority:** P1  
**Category:** A / D (Core Conception of Learning / Regular Checks)  
**Student problem it solves:** The app currently has no definition of mastery. A topic is "resolved" when either (a) the student's answer goes unchallenged or (b) the attempt threshold is crossed. Neither is mastery. Mastery requires demonstrated understanding that survives a challenge.

#### Mastery Definition

A topic thread is considered **mastered** when the student satisfies at least TWO of the following three criteria within the session:

| Criterion | Code | Evidence |
|---|---|---|
| Correct explanation in own words | `EXPLAIN_PASSED` | `[IS_GENUINE_ATTEMPT: true]` on an explain-type question with no misconception flag |
| Successful transfer to novel context | `TRANSFER_PASSED` | `[QTYPE: apply]` or `[QTYPE: predict]` with `[IS_GENUINE_ATTEMPT: true]` and no misconception |
| No unresolved misconceptions on topic | `MISCONCEPTIONS_CLEAR` | `Misconception.resolved = true` for all records on this `topicThread` |

A topic thread where only the attempt threshold was crossed (direct answer given) is marked `DIRECT_ANSWER_GIVEN` — not mastered.

#### Data Structure

Add `masteryStatus` to the `Message` model and a new `TopicMastery` model:

```prisma
model TopicMastery {
  id               String   @id @default(cuid())
  studentSessionId String
  topicThread      String
  status           String   // "mastered" | "direct_answer_given" | "uncertain" | "in_progress"
  criteriamet      String   @default("[]")  // JSON array of met criteria codes
  updatedAt        DateTime @updatedAt
  studentSession   StudentSession @relation(fields: [studentSessionId], references: [id], onDelete: Cascade)
  
  @@unique([studentSessionId, topicThread])
}
```

#### Tutor Policy

```
AFTER every assistant message:
  For the current topic_thread, evaluate mastery criteria:
  
  EXPLAIN_PASSED = any prior message on this topic has:
    isGenuineAttempt = true AND mode = "socratic" AND no Misconception record on same message
  
  TRANSFER_PASSED = any prior message on this topic has:
    questionType IN ("apply", "predict") AND isGenuineAttempt = true AND no Misconception
  
  MISCONCEPTIONS_CLEAR = all Misconception records for this topicThread have resolved = true
  
  criteria_met = count of true criteria above
  
  IF criteria_met >= 2: status = "mastered"
  ELSE IF directAnswer was given: status = "direct_answer_given"  
  ELSE IF any confidence check on topic = "uncertain": status = "uncertain"
  ELSE: status = "in_progress"
  
  Upsert TopicMastery record.
```

#### Files to Change

**`src/app/api/chat/route.ts`**

Add mastery evaluation after saving the assistant message:
```typescript
// After saving assistant message and any misconceptions:
await evaluateMastery(studentSessionId, tags.topicThread || currentTopicThread);
```

**`src/lib/mastery.ts`** (new file)
```typescript
export async function evaluateMastery(
  studentSessionId: string, 
  topicThread: string | null
): Promise<void> {
  if (!topicThread) return;
  
  const messages = await prisma.message.findMany({
    where: { studentSessionId, topicThread }
  });
  const misconceptions = await prisma.misconception.findMany({
    where: { studentSessionId, topicThread }
  });
  
  const explainPassed = messages.some(m => 
    m.role === "assistant" && m.isGenuineAttempt && m.mode === "socratic" &&
    !misconceptions.some(mc => mc.studentMessage === 
      messages.find(um => um.role === "user" && /* adjacent */ true)?.content)
  );
  
  const transferPassed = messages.some(m =>
    m.role === "assistant" && m.isGenuineAttempt &&
    ["apply", "predict"].includes(m.questionType ?? "")
  );
  
  const misconceptionsClear = misconceptions.every(m => m.resolved);
  const directAnswerGiven = messages.some(m => m.role === "assistant" && m.attemptNumber && m.attemptNumber >= 3);
  
  const criteriaMet: string[] = [];
  if (explainPassed) criteriaMet.push("EXPLAIN_PASSED");
  if (transferPassed) criteriaMet.push("TRANSFER_PASSED");
  if (misconceptionsClear && misconceptions.length > 0) criteriaMet.push("MISCONCEPTIONS_CLEAR");
  
  const status = criteriaMet.length >= 2 ? "mastered"
    : directAnswerGiven ? "direct_answer_given"
    : "in_progress";
  
  await prisma.topicMastery.upsert({
    where: { studentSessionId_topicThread: { studentSessionId, topicThread } },
    update: { status, criteriamet: JSON.stringify(criteriaMet) },
    create: { studentSessionId, topicThread, status, criteriamet: JSON.stringify(criteriaMet) }
  });
}
```

**`src/lib/report-generator.ts`**

Include mastery data in the report:
```typescript
// Add to student session data fetch:
const studentSessions = await prisma.studentSession.findMany({
  where: { sessionId },
  include: {
    messages: true,
    misconceptions: true,
    confidenceChecks: true,
    topicMastery: true,  // new include
  }
});

// Add to transcriptData:
stu.topicMastery.forEach(tm => {
  transcriptData += `- ${tm.topicThread}: ${tm.status} (criteria: ${tm.criteriamet})\n`;
});
```

**Report prompt update:** Add instruction to use mastery status when rating topics GREEN/YELLOW/RED in the heatmap. `"mastered"` status topics → GREEN unless multiple students show `"direct_answer_given"`. `"direct_answer_given"` → YELLOW. `"uncertain"` or `"in_progress"` with low exchange count → RED.

#### Acceptance Criteria
- [ ] `TopicMastery` records are created/updated after every assistant message
- [ ] A topic where the student passed an explain AND a transfer question is marked `"mastered"`
- [ ] A topic where only a direct answer was given is marked `"direct_answer_given"`, not `"mastered"`
- [ ] The readiness heatmap uses mastery status as primary signal, not just AI-generated labels
- [ ] The instructor report distinguishes "mastered", "direct_answer_given", and "uncertain" in per-student summaries

---

### REC-11 — Structured Feedback Templates

**Priority:** P1  
**Category:** K (Corrective Feedback)  
**Student problem it solves:** The system prompt says "be specific when wrong" but provides no structure for what specificity looks like. Feedback quality varies entirely with model generation. Students sometimes receive vague or effusive feedback that does not identify the actual error or provide a path forward.

#### Feedback Template Taxonomy

Three feedback types, each with a required structure:

**Template 1: CORRECTIVE** (student answer is wrong or incomplete)
```
Structure:
  1. Name what is incorrect, specifically: "What you said — [paraphrase] — isn't quite right because [specific reason]."
  2. Identify the direction of the error: "The issue is [over-generalization / missed distinction / confusion between X and Y / missing mechanism]."
  3. Give one step forward: "Try thinking about it this way: [single narrowed question or reframe]."
  
DO NOT: say "good try," "almost," or "you're close" without specifying what is close and what is wrong.
DO NOT: give the correct answer in the forward step. Give a direction, not a destination.
```

**Template 2: EXTENSION** (student answer is correct but shallow or paraphrased)
```
Structure:
  1. Acknowledge specifically: "Right — [restate what they said in different words] is the core of it."
  2. Push: "Now [apply / extend / challenge]: [next-level question]."
  
DO NOT: say "great!" or "exactly!" without specifying what is great or exactly right.
DO NOT: move to a new topic. Always push deeper before advancing.
```

**Template 3: REDIRECTION** (student answer is off-topic, confused, or refuses to engage)
```
Structure:
  1. Acknowledge the confusion without judgment: "It sounds like this isn't landing clearly — that's a signal we should approach it differently."
  2. Narrow the task: "Let's start with just one piece of this. Can you tell me [smallest meaningful sub-question]?"
  3. If confusion persists after 1 redirection: switch to prerequisite check (see REC-09).
  
DO NOT: re-explain the whole concept. DO NOT: give up and give the direct answer on the first confusion.
```

#### Files to Change

**`src/lib/system-prompt.ts`**

Add feedback templates to the static prompt:

```typescript
const FEEDBACK_TEMPLATES = `
FEEDBACK TEMPLATES — use the appropriate template for every response that involves student evaluation.
Do not deviate from the structure. The structure exists to prevent vague or effusive feedback.

TEMPLATE: CORRECTIVE (student is wrong or substantially incomplete)
Required structure:
1. "What you said — [brief paraphrase of their answer] — isn't right here because [specific reason]."
2. "The gap is [name the type: over-generalization / missed distinction / confused mechanism / inverted relationship / etc.]."
3. "Try this: [one narrowed question — not the answer, a direction toward it]."
Forbidden: "Good try," "Almost," "You're close," or any phrase that praises without specifying what is close.

TEMPLATE: EXTENSION (student is correct but answer is shallow, paraphrased, or incomplete)
Required structure:
1. "Right — [paraphrase their answer in different words, confirming the correct element specifically]."
2. "[apply / extend / complicate]: [next-level question that tests deeper or broader understanding]."
Forbidden: "Great!" "Exactly!" "Perfect!" without specifying what is great or exact.
Never advance to a new topic after a shallow-correct answer. Always deepen first.

TEMPLATE: REDIRECTION (student is confused, off-topic, or refusing to engage)
Required structure:
1. "It sounds like [this concept / this question] isn't landing clearly — let's approach it differently."
2. "Start here: [the smallest sub-question that would establish the minimum foothold]."
If confusion persists after one REDIRECTION: check for missing prerequisite before trying again.
Forbidden: Re-explaining the whole concept. Giving up and providing the direct answer on first confusion.

TAGGING: Append [FEEDBACK_TYPE: corrective|extension|redirection] to every response that evaluates a student answer.
`;
```

**`prisma/schema.prisma`**

Add `feedbackType` to `Message`:
```prisma
model Message {
  // ... existing fields ...
  feedbackType  String?  // "corrective" | "extension" | "redirection" | null
}
```

**`src/lib/attempt-tracker.ts`**

Add feedback type parsing:
```typescript
const FEEDBACK_TYPE_PATTERN = /\[FEEDBACK_TYPE:\s*(corrective|extension|redirection)\]/i;

export function parseTags(rawText: string): ParseResult {
  // ... existing parsing ...
  const feedbackTypeMatch = rawText.match(FEEDBACK_TYPE_PATTERN);
  tags.feedbackType = feedbackTypeMatch ? feedbackTypeMatch[1].toLowerCase() : null;
  
  const cleanedText = rawText
    .replace(FEEDBACK_TYPE_PATTERN, "")
    // ... existing replacements ...
}
```

**`src/lib/report-generator.ts`**

Add feedback quality data to the report:
```typescript
const feedbackCounts = stu.messages
  .filter(m => m.role === "assistant" && m.feedbackType)
  .reduce((acc, m) => {
    acc[m.feedbackType!] = (acc[m.feedbackType!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
transcriptData += `Feedback breakdown: ${JSON.stringify(feedbackCounts)}\n`;
```

#### Acceptance Criteria
- [ ] Every assistant message that responds to a student answer contains `[FEEDBACK_TYPE:]`
- [ ] `corrective` responses contain the three required structural elements (specific error + error type + direction)
- [ ] `extension` responses do not advance the topic — they deepen within the current topic thread
- [ ] `redirection` responses contain a narrowed sub-question, not a re-explanation
- [ ] No assistant message contains "good try," "almost," "great!" or similar unspecified praise without a specific attribution
- [ ] `Message.feedbackType` is populated in the database
- [ ] Instructor report includes feedback type distribution

#### Offline Evaluation Plan

Sample 20 corrective feedback responses from a live session. Score each on:
- Does it name specifically what is wrong? (0/1)
- Does it name the type of error? (0/1)
- Does it give a direction without giving the answer? (0/1)

Target: average score >= 2.5/3 across 20 samples before considering templates effective.

---

### REC-12 — Hint Ladder

**Priority:** P1  
**Category:** C / I (High Expectations with Adaptive Support / Balance of Support and Independence)  
**Student problem it solves:** The current scaffold has three positions: guiding question → analogy → direct answer. This is too coarse. A student who is slightly lost needs a different intervention than one who is completely lost. Jumping from a guiding question to an analogy to a direct answer in 3 attempts leaves no room for graduated scaffolding.

#### Hint Ladder Definition

A 5-rung ladder. The tutor uses the current rung and advances only when the previous rung has been tried and failed. The rung is tracked per topic thread.

| Rung | Code | Description | When to Use |
|---|---|---|---|
| 0 | `QUESTION` | Open guiding question on the concept | First approach. Student has not engaged yet. |
| 1 | `NARROW` | Narrowed version of the same question, focused on one element | Student engaged but answer was too broad or missed the key element. |
| 2 | `ANALOGY` | Analogy from professional or everyday context, followed by application question | Student is directionally wrong or clearly stuck. |
| 3 | `PARTIAL` | Give the first step of the answer; ask student to complete it | Student has tried analogy but still cannot connect. Concept is genuinely difficult. |
| 4 | `DIRECT` | Full direct answer with reasoning trace (see REC-05) | Student has been through all prior rungs. Do not withhold. |

**Important:** A student who gives a correct but shallow answer at rung 0 does NOT advance to rung 1. They receive an extension prompt (see REC-11). The ladder is for students who are genuinely stuck, not for all students at all times.

**Important:** Rung advancement is also gated by `isGenuineAttempt`. A student who gives a non-attempt response at rung 1 does NOT advance to rung 2. The rung advances only after a genuine attempt fails.

#### Data Structure

Track hint ladder state per topic thread in the student session:

```prisma
model TopicMastery {
  // ... existing fields ...
  hintLadderRung  Int @default(0)  // 0–4, current position on hint ladder for this topic
}
```

#### Tutor Policy / Decision Rule

```
WHEN composing context instruction for a Socratic exchange:
  
  rung = TopicMastery.hintLadderRung for current topicThread (default 0)
  
  IF previous attempt was genuine AND previous attempt failed (no misconception resolution):
    rung = min(rung + 1, 4)
    Update TopicMastery.hintLadderRung
  
  Inject hint-ladder instruction based on rung:
  
  rung 0 → "Ask an open guiding question about [topic]. Do not narrow it yet."
  rung 1 → "The student has engaged but hasn't landed on the key element. 
             Ask a narrowed version of your question focused on one specific aspect of [topic]."
  rung 2 → "The student is stuck. Offer an analogy from professional or everyday life. 
             End by asking them to apply the analogy back to [topic]."
  rung 3 → "The student has tried the analogy and is still stuck. 
             Give the first step of the answer — the foundational piece — 
             then ask them to build the rest from there."
  rung 4 → "Give the complete, direct answer. Show the reasoning path first (see expert modeling instruction). 
             Then check understanding with a brief verification question."
```

#### Files to Change

**`prisma/schema.prisma`**

Add to `TopicMastery`:
```prisma
model TopicMastery {
  // ... existing fields ...
  hintLadderRung Int @default(0)
}
```

**`src/app/api/chat/route.ts`**

Replace the binary `attemptCount < 3` instruction with hint-ladder-driven instruction:

```typescript
// Get or create TopicMastery record for current topic:
const topicMastery = currentTopicThread ? await prisma.topicMastery.findUnique({
  where: {
    studentSessionId_topicThread: {
      studentSessionId,
      topicThread: currentTopicThread
    }
  }
}) : null;

const hintRung = topicMastery?.hintLadderRung ?? 0;

// Advance rung if previous attempt was genuine and failed:
const lastAssistantMsg = dbMessages.filter(m => m.role === "assistant").at(-1);
const lastUserMsg = dbMessages.filter(m => m.role === "user").at(-1);
const previousAttemptFailed = lastAssistantMsg?.isGenuineAttempt === true &&
  lastAssistantMsg?.misconception !== undefined;  // rough heuristic; refine as needed

const newRung = previousAttemptFailed ? Math.min(hintRung + 1, 4) : hintRung;

if (newRung !== hintRung && currentTopicThread) {
  await prisma.topicMastery.upsert({
    where: { studentSessionId_topicThread: { studentSessionId, topicThread: currentTopicThread } },
    update: { hintLadderRung: newRung },
    create: { studentSessionId, topicThread: currentTopicThread, hintLadderRung: newRung, status: "in_progress" }
  });
}

// Build hint-rung-aware instruction:
const instruction = buildHintLadderInstruction(newRung, currentTopicThread);
```

**`src/lib/system-prompt.ts`**

Add `buildHintLadderInstruction` export:
```typescript
export function buildHintLadderInstruction(
  rung: number,
  topicThread: string | null
): string {
  const topic = topicThread ? `"${topicThread}"` : "the current concept";
  
  const rungs: Record<number, string> = {
    0: `Ask an open guiding question about ${topic}. Do not narrow it. Do not offer hints. Let the student engage first.`,
    1: `The student engaged but missed the key element. Ask a narrowed version of your question — focus on ONE specific aspect of ${topic} that they are missing.`,
    2: `The student is stuck. Offer a brief analogy from professional or everyday life that illuminates ${topic}. End with: "How does that connect to what [author] describes?" Do not answer for them.`,
    3: `The student has tried the analogy and is still stuck. Give the first foundational step — the minimum piece needed to unlock the concept — then ask: "Given that, what do you think [the rest of the concept] means?"`,
    4: `Give the complete, direct answer to ${topic}. Show the reasoning path first (2–3 sentences showing how you arrive at the answer). Then ask one brief verification question. Frame it: "You've been working hard at this. Here's how it comes together: ..."`
  };
  
  return `[TUTOR_CONTEXT: Hint ladder rung ${rung}/4 for ${topic}. Instruction: ${rungs[rung]}]`;
}
```

#### Acceptance Criteria
- [ ] `TopicMastery.hintLadderRung` is initialized to 0 for every new topic thread
- [ ] After a genuine failed attempt, the rung advances by 1 (not by attempt count)
- [ ] Rung 2 responses contain an analogy AND an application-back question
- [ ] Rung 3 responses contain a partial answer AND a completion question — not a full answer
- [ ] Rung 4 responses contain a reasoning trace before the direct answer
- [ ] A student who gives a correct-but-shallow answer at rung 0 does NOT advance to rung 1 (extension template is used instead)
- [ ] The rung never exceeds 4; rung 4 is the permanent ceiling

#### How to Tell It's Working

Run the test in adversarial group 7 (Test 7-B: Lowering the Bar). At rung 1, the response should contain a narrowed question, not a simplified explanation. At rung 3, the response should contain a partial answer, not a full explanation. If rung 3 responses contain full answers, the ladder is collapsing too early.

---

## STEP 5 — Build Specs with Acceptance Criteria

### SPEC-01: Behavioral Confidence Checks

**Feature name:** Confidence-Responsive Tutor Behavior  
**Purpose:** Convert confidence checks from data-logging events to adaptive teaching triggers.

**User story (instructor):**  
As an instructor, when I see a student marked "uncertain" in the confidence data, I want to know the tutor actually addressed that uncertainty — not just logged it.

**User story (student):**  
As a student, when I say I'm not confident about something, I want the tutor to actually help me work through it, not just note it and continue.

**System behavior:**
1. After extracting a confidence rating from a student message, inject confidence-specific instruction into the next API call (see REC-01)
2. Update `ConfidenceCheck.probeAsked = true` when a follow-up probe is generated
3. Update `ConfidenceCheck.probeResult = "passed" | "failed"` based on the student's response to the probe (parsed from subsequent `[IS_GENUINE_ATTEMPT]` tag)

**Acceptance criteria:**
- [ ] Unit test: `buildContextInstruction` with `rating = "uncertain"` returns an instruction containing the word "retrieval probe"
- [ ] Integration test: A conversation where the student says "uncertain" does not advance the topic thread in the next exchange
- [ ] Integration test: A conversation where the student says "very confident" generates a transfer probe before advancing
- [ ] Database test: `ConfidenceCheck.probeAsked` is `true` for sessions where student said "uncertain" or "very confident"

**Metrics:**
- Ratio of `probeAsked` to total confidence checks (target: >90%)
- Ratio of topic-thread-unchanged exchanges following "uncertain" response (target: 100%)

**Risks:**
- Model may not reliably distinguish a genuine transfer probe from a content question; mitigate by adding `[QTYPE: apply]` requirement on all post-confidence-check questions
- Student may answer the probe with another vague response; implement a maximum 1 additional probe before advancing (avoid indefinite loop)

---

### SPEC-02: Prior Knowledge Activation Opening

**Feature name:** Structured Session Opening  
**Purpose:** Replace cold content drop with a 3-turn orientation and prior knowledge activation.

**User story:**  
As a student, when I start a session, I want to feel oriented — I want to know why this reading matters and be invited to connect it to what I already know before being asked hard questions.

**System behavior:**
1. `client-chat.tsx` sends a modified opening instruction that specifies Turn 1 = prior knowledge probe (see REC-02)
2. `Session` model adds optional `courseContext` and `learningGoal` fields
3. Instructor session management page adds two optional text inputs for these fields
4. `buildSystemPrompt` includes these fields when non-null

**Acceptance criteria:**
- [ ] Database migration adds `courseContext` and `learningGoal` to `Session` without breaking existing sessions (nullable fields)
- [ ] The tutor's first message does not reference specific reading content — it asks about the student's prior knowledge/beliefs on the topic
- [ ] The tutor's second message contains a reference to the student's response AND a connection to the reading
- [ ] When `courseContext` is set, the tutor references the course arc in the first 3 exchanges
- [ ] When `courseContext` is null, the session opens normally without error

**Offline evaluation plan:**  
Run 5 simulated opening sequences:
1. Student with strong prior knowledge → verify tutor acknowledges and connects
2. Student with no prior knowledge → verify tutor bridges rather than penalizes
3. Session with course context set → verify arc connection in opening
4. Session without course context → verify clean fallback
5. Student who immediately asks about reading content → verify tutor still completes orientation before answering

---

### SPEC-03: Diagnostic Question Taxonomy

**Feature name:** Typed Socratic Questions  
**Purpose:** Move from ad-hoc question generation to a structured taxonomy that ensures questions test understanding rather than recall.

**User story:**  
As an instructor, I want to know what kinds of thinking my students were asked to do — not just that questions were asked.

**System behavior:**
1. Static prompt adds question taxonomy and `[QTYPE:]` tag requirement (see REC-03)
2. `parseTags` extracts `[QTYPE:]` and cleans it from displayed text
3. `Message.questionType` populated on every assistant message
4. Report generator includes question type distribution per student

**Acceptance criteria:**
- [ ] Every Socratic mode assistant message contains a `[QTYPE:]` tag
- [ ] No two consecutive assistant messages share the same `[QTYPE:]`
- [ ] `apply` and `predict` type questions contain a professional scenario or context not verbatim in the readings (spot-check 5 examples per session)
- [ ] Report includes a question-type distribution table per student
- [ ] `explain` type questions are answered by students in their own words at least 80% of the time (manual evaluation: does the response paraphrase the text or construct an answer?)

**Instrumentation:**
- Log `questionType` per message in database
- Track question type distribution per session in `Report.stats` JSON

---

### SPEC-04: Misconception Follow-Up

**Feature name:** In-Session Misconception Resolution  
**Purpose:** Ensure misconceptions are not just logged but actively addressed before the student leaves the topic.

**System behavior:**
1. `Misconception.resolved` defaults to `false`
2. When `[TOPIC_THREAD]` changes, query for unresolved misconceptions on the prior topic
3. If found: inject resolution check instruction before allowing advancement (see REC-04)
4. Parse `[MISCONCEPTION_RESOLVED: true]` tag from AI response to mark resolution
5. If student still wrong after one follow-up: set `persistentlyUnresolved = true`

**Acceptance criteria:**
- [ ] Database test: `Misconception.resolved` remains `false` for topics that had a misconception and changed without follow-up (this should not happen after the fix)
- [ ] Integration test: A session with a misconception on "topic A" followed by a shift to "topic B" results in a resolution check at the transition
- [ ] Integration test: After a successful resolution, `Misconception.resolved = true` is set
- [ ] Integration test: After a failed resolution, `Misconception.persistentlyUnresolved = true` is set
- [ ] The instructor report's MISCONCEPTIONS section distinguishes "resolved" from "persistently unresolved"

**Schema migration:**
```sql
-- Add fields to Misconception table
ALTER TABLE Misconception ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE Misconception ADD COLUMN persistentlyUnresolved BOOLEAN NOT NULL DEFAULT FALSE;
```

---

### SPEC-05: Expert Modeling Moments

**Feature name:** Expert Thinking Demonstrations  
**Purpose:** Give students a visible model of expert-level reasoning at session open and during direct-answer moments, so they are not just told facts but shown how to think about content.

**User story:**  
*As a student, when I begin a session I want to hear how an expert reader approaches this material — what they notice, what surprises them, what questions they ask — so I have a model to emulate rather than just being quizzed cold.*

**System behavior:**
1. In `src/lib/system-prompt.ts`, add a new expert-modeling instruction block to `STATIC_BASE_PROMPT`:
   ```
   EXPERT MODELING PROTOCOL:
   At session opening (exchange 1 only): Before posing your first Socratic question, deliver a 
   2–3 sentence expert-reader reaction to the material. This is NOT a summary. It surfaces what 
   an expert would notice as interesting, surprising, or worth questioning. Tag it:
   [EXPERT_MODEL: OPENING]
   
   When giving a direct answer (MODE: DIRECT_ANSWER only): Append a 1–2 sentence think-aloud 
   showing the reasoning process, not just the conclusion. Tag it:
   [EXPERT_MODEL: REASONING]
   
   Expert model must be substantive — specific to the readings, never generic. Do not say 
   "experts would consider many factors." Show the actual thinking.
   ```
2. In `src/lib/attempt-tracker.ts`, add `expertModelType` to `ParsedTags`:
   ```typescript
   expertModelType?: 'OPENING' | 'REASONING';
   ```
3. In `src/app/api/chat/route.ts`, parse `expertModelType` from response tags and save to `Message.expertModelType` (new field on `Message` model)
4. Opening expert model triggers once per session (check `exchangeCount === 1`)

**Acceptance criteria:**
- [ ] Exchange 1 of every session contains a response tagged `[EXPERT_MODEL: OPENING]`
- [ ] Exchange 2+ do NOT contain `[EXPERT_MODEL: OPENING]`
- [ ] Every `[DIRECT_ANSWER:]` response also contains `[EXPERT_MODEL: REASONING]`
- [ ] `Message.expertModelType` is populated in the DB for these messages
- [ ] Expert model content references specific details from the reading, not generic statements (manual review of 10 sessions)
- [ ] Instructor monitor view displays the expert model tag badge in `exchange-replay.tsx`

**Example prompts/messages:**

Opening expert model (History of Impressionism reading):
```
[EXPERT_MODEL: OPENING]
What strikes me about the 1874 Salon des Refusés is that the critics who coined 
"Impressionism" as an insult accidentally named something the painters hadn't named 
themselves — which makes me wonder whether the movement was a conscious break or an 
accidental coalition. That's the question I'd be asking if I were reading this for 
the first time.
```

Reasoning think-aloud (during direct answer):
```
[DIRECT_ANSWER: true]
The key distinction is that *en plein air* painting wasn't just a technique — it was 
an epistemological claim that the only "true" color is the color seen in that specific 
light at that specific moment.
[EXPERT_MODEL: REASONING]
The reasoning path: if you accept that light constantly changes, you must accept that 
color is relational, not fixed — which is why the Impressionists rejected the studio 
doctrine that shadows are always darker versions of local color.
```

**Instrumentation / metrics:**
- `Message.expertModelType` — db field, queryable for coverage reports
- Dashboard stat: "Expert model coverage: X% of sessions had opening model, Y% of direct answers had reasoning model"
- Alert if coverage drops below 90%

**Offline evaluation plan:**
- Sample 20 sessions post-deployment, 10 with complex readings and 10 with straightforward ones
- Score each opening expert model on 3 criteria: (1) Reading-specific (not generic), (2) Surfaces a non-obvious insight or question, (3) Is 2–3 sentences (not a summary)
- Target: average ≥ 2.5/3 across all criteria
- Score each reasoning think-aloud: (1) Shows the reasoning step, not just the answer, (2) Connects to a concept in the reading, (3) Uses language a student could internalize
- Target: average ≥ 2.5/3

**Risks and mitigations:**
- **Risk:** AI produces generic expert model ("experts consider multiple interpretations"). **Mitigation:** System prompt specifies "never generic — specific to the readings" with a negative example. Offline eval catches this.
- **Risk:** Expert model at opening makes first response too long. **Mitigation:** Instruct 2–3 sentences max; include length constraint in system prompt.
- **Risk:** Opening model becomes repetitive across sessions on same reading set. **Mitigation:** Prompt instructs expert model to surface a different angle than the Socratic question that follows; varied openings expected across multiple students.

---

### SPEC-06: Self-Explanation Prompts

**Feature name:** Self-Explanation Scaffold  
**Purpose:** When a student gives a correct or partially-correct answer, prompt them to explain *how* they arrived at it rather than accepting the answer and moving on. Self-explanation generates deeper encoding than passive confirmation.

**User story:**  
*As a student who just gave a correct answer, I want the tutor to push me to articulate my reasoning — not just say "correct" — so I understand why I'm right and can apply the concept elsewhere.*

**System behavior:**
1. In `src/lib/system-prompt.ts`, add self-explanation protocol to `STATIC_BASE_PROMPT`:
   ```
   SELF-EXPLANATION PROTOCOL:
   When a student gives a correct or substantially correct response, do NOT simply confirm 
   and advance. Instead, use a self-explanation prompt:
   - "Walk me through how you arrived at that."
   - "What in the reading made you confident about that?"
   - "Can you state the principle behind that answer?"
   - "If you had to explain this to another student, what would you say?"
   
   Tag self-explanation prompts: [SELF_EXPLAIN_PROMPTED: true]
   Self-explanation is mandatory after first correct answer per topic thread.
   After a successful self-explanation (student articulates reasoning clearly), 
   advance to the next topic or pose a transfer question.
   Skip self-explanation prompt if MODE is DIRECT_ANSWER (tutor supplied the answer, 
   student did not need to produce it).
   ```
2. In `src/lib/attempt-tracker.ts`, add `selfExplainPrompted: boolean` to `ParsedTags`
3. In `src/app/api/chat/route.ts`, parse `[SELF_EXPLAIN_PROMPTED: true]` from response and save to `Message.selfExplainPrompted` (new boolean field on `Message`)
4. In `src/lib/mastery.ts`, count self-explanation success as one signal in `evaluateMastery()`: when student response after `[SELF_EXPLAIN_PROMPTED: true]` is substantive, increment `EXPLAIN_PASSED` criterion

**Acceptance criteria:**
- [ ] After every student correct answer in `MODE: SOCRATIC`, AI response includes `[SELF_EXPLAIN_PROMPTED: true]`
- [ ] `Message.selfExplainPrompted` is stored in DB for tagged messages
- [ ] AI does NOT self-explain-prompt when `MODE: DIRECT_ANSWER` (the AI supplied the answer, not the student)
- [ ] Self-explanation prompt is conversationally varied (not always the same phrasing) — verified by reading 20 session transcripts
- [ ] The mastery criterion `EXPLAIN_PASSED` is triggered correctly when student provides substantive self-explanation

**Example prompts/messages:**

Student: "Monet was trying to capture light as it actually appears at a specific moment."  
Tutor:
```
[SELF_EXPLAIN_PROMPTED: true]
That's the heart of it. Walk me through how you arrived at that — what in the reading 
or the paintings themselves made that clear to you?
```

Student: "Because he painted the same haystack at different times of day."  
Tutor (after substantive self-explanation):
```
Exactly — and that move from depicting the object to depicting the light *on* the object 
is the whole epistemological shift. Let's test whether that principle holds elsewhere: 
Does the same logic explain why Impressionist paintings look blurry up close but resolved 
at a distance?
```

**Instrumentation / metrics:**
- `Message.selfExplainPrompted` — db field
- Coverage metric: % of correct-answer moments that received a self-explanation prompt (target ≥ 85%)
- Mastery metric: % of self-explanation prompts that resulted in a substantive student response (tracked via `EXPLAIN_PASSED` criterion trigger rate)

**Offline evaluation plan:**
- Pull 25 "correct answer" exchanges from session logs (where AI did NOT give direct answer)
- Check whether each correct-answer response was followed by a self-explanation prompt
- Score prompt quality: (1) Pushes for reasoning, not just confirmation; (2) Conversationally natural; (3) Advances toward a transfer test
- Target: ≥ 85% coverage; average ≥ 2.5/3 on quality rubric
- Control check: Confirm no self-explanation prompt appears after `[DIRECT_ANSWER: true]`

**Risks and mitigations:**
- **Risk:** AI self-explanation-prompts every single correct response, including trivial factual ones. **Mitigation:** System prompt specifies self-explanation for "substantive" answers; instruct AI to skip for one-word factual confirmations.
- **Risk:** Students find repeated self-explanation prompts annoying. **Mitigation:** Limit to first correct response per `TOPIC_THREAD`; after that, advance to transfer question instead.
- **Risk:** Self-explanation prompt is generic ("Can you explain your reasoning?") across every exchange. **Mitigation:** Provide 4 example variants in system prompt; instruct AI to choose based on context.

---

### SPEC-07: Soft Revisit Queue

**Feature name:** Within-Session Spaced Retrieval  
**Purpose:** Topics where a student received a direct answer, expressed low confidence, or had an unresolved misconception are added to a soft revisit queue. Mid-session, the tutor issues a retrieval probe on a prior topic before advancing further — testing whether understanding survived beyond the original exchange.

**User story:**  
*As a student who got an answer told to me during a session, I want the tutor to come back and test whether I actually learned it — not just move on — so I'm not fooled into thinking I understand something I was just told.*

**System behavior:**
1. Add `softRevisitQueue` field to `StudentSession` in `prisma/schema.prisma`:
   ```prisma
   softRevisitQueue  Json?    // Array of { topicThread: string, reason: "DIRECT_ANSWER" | "LOW_CONFIDENCE" | "UNRESOLVED_MISCONCEPTION", addedAtExchange: number }
   ```
2. In `src/app/api/chat/route.ts`, after saving assistant message:
   - If `[DIRECT_ANSWER: true]` was parsed: append `{ topicThread: currentTopicThread, reason: "DIRECT_ANSWER", addedAtExchange: exchangeCount }` to `softRevisitQueue`
   - If confidence < 3: append with `reason: "LOW_CONFIDENCE"`
   - If `[MISCONCEPTION:]` was parsed and `persistentlyUnresolved`: append with `reason: "UNRESOLVED_MISCONCEPTION"`
3. In `src/lib/system-prompt.ts`, add a `buildSoftRevisitInstruction(queue, exchangeCount, maxExchanges)` export:
   ```typescript
   export function buildSoftRevisitInstruction(
     queue: SoftRevisitItem[],
     exchangeCount: number,
     maxExchanges: number
   ): string {
     if (queue.length === 0) return '';
     // Trigger revisit at 60% of session
     const triggerAt = Math.floor(maxExchanges * 0.6);
     if (exchangeCount !== triggerAt) return '';
     const item = queue[0]; // First item in queue
     return `[SOFT_REVISIT] At this point in the session, before advancing, 
   issue a retrieval probe on this prior topic: "${item.topicThread}". 
   Reason it was queued: ${item.reason}. 
   Do not reference that this is a revisit — ask naturally as if introducing a new angle.`;
   }
   ```
4. Call `buildSoftRevisitInstruction` in `route.ts` and append to context instruction passed in the system prompt for that exchange

**Acceptance criteria:**
- [ ] `StudentSession.softRevisitQueue` is populated in DB after a session containing a direct answer
- [ ] At exchange ~60% of session length, a retrieval probe is issued for the first queued topic
- [ ] The revisit probe is NOT labeled as a revisit ("Let me come back to...") — it should appear as a natural new angle
- [ ] If the student answers the revisit correctly, the item is removed from the queue
- [ ] If the student answers incorrectly, `Misconception` or `persistentlyUnresolved` is updated accordingly
- [ ] Sessions with no direct answers and no low confidence have an empty `softRevisitQueue`

**Example prompts/messages:**

Queue item: `{ topicThread: "color-perception-impressionism", reason: "DIRECT_ANSWER" }`  
At 60% mark, tutor injects naturally:
```
Before we move to the next part of the reading — I want to test something. 
When Pissarro and Monet argued about whether to use black in their palettes, 
what was actually at stake for them theoretically?
```
(This revisits the color-perception concept via a different angle — not "let me revisit" framing.)

**Instrumentation / metrics:**
- `StudentSession.softRevisitQueue` — queryable JSON field
- `Message.isRevisitProbe` — boolean field added to `Message` model to flag revisit probes
- Coverage metric: % of sessions with at least one queued item that received a revisit probe (target 100%)
- Effectiveness metric: % of revisit probes answered correctly (tracks whether delayed retrieval improved retention)

**Offline evaluation plan:**
- Pull 15 sessions where `softRevisitQueue` was non-empty
- Verify that each received a revisit probe at approximately the 60% exchange mark (±2 exchanges)
- Check framing: revisit probe should NOT use "let me come back to" or "you mentioned earlier" language
- Score revisit probe on: (1) Tests the same concept from a different angle; (2) Requires genuine retrieval, not re-reading; (3) Natural conversational integration
- Target: ≥ 90% probe timing compliance; average ≥ 2.5/3 quality score

**Risks and mitigations:**
- **Risk:** Revisit probe disrupts conversational flow, feels jarring. **Mitigation:** System prompt explicitly forbids "revisit" framing; probe must be introduced as a new angle on an adjacent idea.
- **Risk:** 60% trigger point lands on an awkward moment (mid-explanation, mid-scaffold). **Mitigation:** Add logic: if `IS_GENUINE_ATTEMPT: true` in the current exchange, delay revisit by one exchange.
- **Risk:** Multiple items in queue cause repeated revisit interruptions. **Mitigation:** Cap revisits at 1 per session for MVP; process only the first item, log the rest in the queue but do not inject.
- **Risk:** Student notices the pattern across many sessions and game-plans it. **Mitigation:** Low risk for MVP given session-by-session architecture; flag for future cross-session tracking.

---

### SPEC-08: Productive Cognitive Conflict

**Feature name:** Contradiction-Based Misconception Correction  
**Purpose:** When a student holds a misconception, the tutor's first response is not correction but a guided contradiction — the student's own reasoning is followed to a point of logical tension before the correct model is offered. This produces deeper conceptual revision than simple correction.

**User story:**  
*As a student with a wrong mental model, I want the tutor to show me where my reasoning breaks down — not just tell me I'm wrong — so that I actually update my understanding rather than just memorizing the correct answer.*

**System behavior:**
1. In `src/lib/system-prompt.ts`, add cognitive conflict protocol to `STATIC_BASE_PROMPT`:
   ```
   COGNITIVE CONFLICT PROTOCOL:
   When you detect a student misconception (you will tag [MISCONCEPTION:]), do NOT 
   immediately correct. Instead:
   
   Step 1 — Acknowledge: Briefly validate what's reasonable about the student's framing.
   Step 2 — Extend: Ask the student to apply their reasoning to a related case that 
            their model cannot handle correctly.
   Step 3 — Surface the tension: When their extended reasoning contradicts an observable 
            fact or a principle they've already accepted, name the contradiction explicitly.
   Step 4 — Offer the better model: Only after the contradiction is visible to the student, 
            offer the correct framework.
   
   Tag the conflict step: [COGNITIVE_CONFLICT: EXTEND | TENSION | RESOLVE]
   
   Example: Student claims "Impressionists painted quickly because they were lazy."
   - EXTEND: "If speed reflects laziness, what would you expect their later, more deliberate 
     works to look like? Were those also 'lazy'?"
   - TENSION: "You've described Monet spending weeks on the same haystack from multiple 
     angles — does that match the laziness model?"
   - RESOLVE: "Speed was a constraint of the medium — capturing transient light — not a 
     character trait. The misconception mistakes method for motive."
   ```
2. In `src/lib/attempt-tracker.ts`, add `cognitiveConflictStage` to `ParsedTags`:
   ```typescript
   cognitiveConflictStage?: 'EXTEND' | 'TENSION' | 'RESOLVE';
   ```
3. In `src/app/api/chat/route.ts`, parse `cognitiveConflictStage` and save to `Message.cognitiveConflictStage` (new field on `Message`)
4. Link to misconception resolution: when `cognitiveConflictStage = 'RESOLVE'` is parsed on the same `TOPIC_THREAD` as an open `Misconception`, set `Misconception.resolved = true`

**Acceptance criteria:**
- [ ] When `[MISCONCEPTION:]` is parsed, the next AI response contains `[COGNITIVE_CONFLICT: EXTEND]` (not immediate correction)
- [ ] `[COGNITIVE_CONFLICT: TENSION]` appears in the response following a failed extension (student's answer reveals the contradiction)
- [ ] `[COGNITIVE_CONFLICT: RESOLVE]` appears after the tension is surfaced
- [ ] `Misconception.resolved` is set to `true` when `RESOLVE` stage is reached
- [ ] If student immediately accepts the conflict at EXTEND stage (acknowledges error without needing TENSION), the protocol may skip to RESOLVE — this is a valid short-circuit
- [ ] Cognitive conflict protocol is NOT triggered for factual gaps (only for misconceptions — wrong model, not missing knowledge)
- [ ] The instructor monitor `exchange-replay.tsx` displays `[COGNITIVE_CONFLICT]` stage badges alongside the exchange

**Example exchange:**

Student: "Impressionists used short brushstrokes because they didn't have the technical skill for detail."  
AI response:
```
[MISCONCEPTION: technical_skill_deficit]
[COGNITIVE_CONFLICT: EXTEND]
That framing makes sense if skill determines style. Let's test it: some of these 
painters — Degas, Renoir — also produced highly detailed academic work earlier in 
their careers. What would the skill-deficit model predict about the quality of their 
pre-Impressionist work?
```

Student: "I guess it would be worse?"  
AI:
```
[COGNITIVE_CONFLICT: TENSION]
Actually, Degas's early academic paintings are technically virtuosic — his draughtsmanship 
was praised by Ingres. So the short-brushstroke approach wasn't a fallback from lacking 
skill — it was a deliberate choice by someone who demonstrably could do otherwise. What 
does that do to the skills-deficit explanation?
```

Student: "Oh — so they chose that style on purpose."  
AI:
```
[COGNITIVE_CONFLICT: RESOLVE]
Exactly. The technique was a response to a specific problem: capturing light at a specific 
moment requires speed, and speed requires a looser mark. The style was a solution, not a 
limitation. The "unskilled" label was the critics' projection, not a description of the 
painters' abilities.
[MISCONCEPTION_RESOLVED: true]
```

**Instrumentation / metrics:**
- `Message.cognitiveConflictStage` — db field for all three stages
- Coverage metric: % of `[MISCONCEPTION:]` tags that triggered a `[COGNITIVE_CONFLICT: EXTEND]` response (target ≥ 90%)
- Resolution rate: % of cognitive conflict sequences that reached `RESOLVE` within the session (target ≥ 70%)
- Short-circuit rate: % of EXTEND stages that skipped directly to RESOLVE (student self-corrected)
- Instructor report: MISCONCEPTIONS section should indicate "resolved via cognitive conflict" vs. "resolved via direct correction"

**Offline evaluation plan:**
- Pull 20 sessions containing at least one `[MISCONCEPTION:]` tag post-deployment
- Verify that each misconception triggered the EXTEND stage (not immediate correction)
- Score the EXTEND probe on: (1) Asks student to apply their own model to a new case; (2) The new case cannot be answered correctly under the wrong model; (3) Conversationally natural
- Score the TENSION response on: (1) Names the contradiction explicitly; (2) Uses evidence the student already accepted; (3) Does not shame or lecture
- Target: average ≥ 2.5/3 on both EXTEND and TENSION dimensions across 20 sessions
- Edge-case check: Verify RESOLVE-only responses are not used for factual gaps (no misconception tag present)

**Risks and mitigations:**
- **Risk:** Three-step protocol makes the AI verbose and the student impatient. **Mitigation:** Each step must be 2–3 sentences max; specify length cap in system prompt.
- **Risk:** AI uses cognitive conflict for factual gaps (student doesn't know X, AI extends it into a contradiction), which is confusing. **Mitigation:** System prompt distinguishes misconception (wrong model) from knowledge gap (missing fact); EXTEND protocol only fires on `[MISCONCEPTION:]` tag, not on wrong factual answers.
- **Risk:** Student agrees superficially at EXTEND stage without actually updating their model. **Mitigation:** TENSION stage is still required if the student's verbal agreement is not supported by a corrected explanation; system prompt: "Only proceed to RESOLVE if the student can articulate the contradiction in their own words."
- **Risk:** Cognitive conflict feels adversarial or shaming. **Mitigation:** Step 1 (Acknowledge) is mandatory — validate what's reasonable about the student's framing before extending it. System prompt: "Never say 'that's wrong.' Find what's right about the framing before revealing what it misses."

---

## STEP 6 — Ideal Target Behavior Specification

This is the north star against which all future design, prompt, and policy decisions should be evaluated.

### The Ideal Socratic Tutor: Behavioral Contract

```
SESSIONS BEGIN with orientation, not content.
The first exchange activates the student's prior knowledge.
The student is told what they're walking into and why it matters.
Only after this orientation does the tutor pose its first Socratic question.

QUESTIONS ARE DIAGNOSTIC, not rhetorical.
Every Socratic question tests understanding that cannot be demonstrated by 
quoting the text. Questions rotate through: explanation, prediction, application, 
comparison, error analysis, and challenge. The tutor tracks which types it has used 
and ensures variety within each session.

MISTAKES ARE TREATED AS EVIDENCE, not outcomes.
When a student is wrong, the tutor's first move is to understand why. 
The type of error matters: a false belief, a flawed model, and a category error 
each require a different response. Productive cognitive conflict is the preferred 
intervention — the student's own reasoning is followed to a contradiction before 
correction is offered.

CONFIDENCE IS VERIFIED, not self-reported.
When a student expresses confidence, the tutor verifies it with a transfer probe. 
When a student expresses uncertainty, the tutor re-engages rather than moving on. 
Self-reported confidence is treated as a starting hypothesis, not a conclusion.

UNDERSTANDING IS REVISITED, not assumed.
Topics where students struggled (needed a direct answer, expressed uncertainty, 
or had misconceptions) are placed in a soft revisit queue. At an appropriate 
mid-session point, the tutor issues a retrieval probe on a prior topic. 
This tests whether understanding survived more than one exchange.

SCAFFOLDING IS TEMPORARY AND TYPED.
The tutor uses a differentiated scaffold ladder: inquiry sharpening, 
self-explanation prompts, narrowing questions, professional analogies, 
cognitive conflict, partial worked examples, and only then — direct answers. 
The choice of scaffold depends on the type of struggle, not the number of attempts.

EXPERT THINKING IS VISIBLE.
At the opening of each session, the tutor briefly demonstrates how an expert 
reader approaches the material — what they notice, what they question, what they 
find surprising. When giving a direct answer, the tutor shows the reasoning path, 
not just the conclusion.

SESSIONS END WITH ACTIONABLE CLOSURE.
The end-of-session summary tells the student specifically what to re-read, 
which concept to think about before class, and leaves them with one open question 
that connects the reading to their work. The summary is short enough to be 
genuinely useful, not a list of everything that happened.

THE INSTRUCTOR REPORT IS DECISION-READY.
The report tells the instructor not what happened but what to do. 
Each RED or YELLOW topic includes: the specific misconception pattern, 
the recommended in-class intervention, and the percentage of students affected. 
It is readable in 5 minutes.
```

---

## STEP 7 — Adversarial Test Suite

Each test is a scenario designed to reveal whether the tutor is *performing* Socratic behavior or *enacting* it. Run these tests against any new version of the system prompt or attempt-tracking logic.

### Test Group 1: Over-Explaining Too Early

**Test 1-A: First-Exchange Rescue**  
Student sends: "I don't really understand how double-loop learning is different from trial and error. Can you explain?"  
*Expected:* Tutor asks for student's current thinking before explaining. Does NOT explain.  
*Failure mode:* Tutor immediately explains the difference.  
*Pass criterion:* First tutor response ends with a question, contains no explanation of double-loop learning, and contains `[MODE: socratic]`.

**Test 1-B: Vague-Paraphrase Acceptance**  
Student sends: "I think double-loop learning is when you question your assumptions."  
*Expected:* Tutor acknowledges but probes deeper — "What does that look like in practice?" or similar.  
*Failure mode:* Tutor says "Exactly right! That's a great summary." and moves to a new topic.  
*Pass criterion:* Tutor response contains a follow-up probe and does not mark this as "topic resolved."

---

### Test Group 2: Failing to Surface Misconceptions

**Test 2-A: Plausible-But-Wrong Answer**  
Student sends: "Single-loop learning is reactive and double-loop learning is proactive — it's about timing."  
This is wrong. Double-loop vs. single-loop is about whether you question governing assumptions, not about timing.  
*Expected:* Tutor detects the misconception, generates `[MISCONCEPTION: ...]`, and responds with a corrective approach — ideally cognitive conflict ("If that's right, then a proactive version of keeping the same strategy would be double-loop — does that hold?").  
*Failure mode:* Tutor accepts the timing framing as partially correct and moves on.  
*Pass criterion:* `Misconception` record created with description referencing the timing error. Tutor response does not affirm the timing framing.

**Test 2-B: Paraphrase That Sounds Right**  
Student sends: "The author argues that organizations learn by adapting their strategies over time."  
This is a text paraphrase that says nothing about single vs. double-loop.  
*Expected:* Tutor classifies this as `[IS_GENUINE_ATTEMPT: false]` or challenges the student to be more specific.  
*Failure mode:* Tutor counts this as a genuine attempt and decrements the attempt budget.  
*Pass criterion:* `isGenuineAttempt = false` on this message, OR tutor responds with "Can you be more specific about what kind of adaptation?" before counting the attempt.

---

### Test Group 3: Mistaking Paraphrase for Understanding

**Test 3-A: Direct Text Echo**  
Upload a reading that contains the sentence: "Governing variables are the preferred states that individuals strive to maintain."  
Student sends: "Governing variables are the preferred states that individuals try to maintain."  
*Expected:* Tutor recognizes this as a verbatim/near-verbatim paraphrase and requests application.  
*Failure mode:* Tutor responds "That's right! Good understanding of governing variables."  
*Pass criterion:* Tutor response asks the student to explain what that means in their own words or give an example. Does NOT mark as fully understood.

---

### Test Group 4: Accepting Shallow Answers

**Test 4-A: One-Word Agreement**  
Context: Tutor asked "What does the author mean by defensive routines?"  
Student sends: "Avoidance."  
*Expected:* Tutor classifies as `[IS_GENUINE_ATTEMPT: false]` and asks the student to elaborate.  
*Failure mode:* Tutor provides a guiding hint on "avoidance" and counts this as attempt 1.  
*Pass criterion:* `isGenuineAttempt = false` on this message, tutor asks for elaboration before responding substantively.

**Test 4-B: "I Think So" Confirmation**  
Context: Tutor asked "Does that make sense to you now?"  
Student sends: "Yes, I think so."  
*Expected:* Tutor generates a brief verification probe, not acceptance.  
*Failure mode:* Tutor advances to a new topic.  
*Pass criterion:* Tutor response contains a brief check question before advancing. "Yes I think so" is not accepted as demonstrated understanding.

---

### Test Group 5: Not Revisiting Old Concepts

**Test 5-A: Concepts Disappear After Resolution**  
Session steps:
1. Student struggles with concept A (3 attempts, receives direct answer)
2. Session continues for 8 more exchanges on concepts B and C
3. At exchange 12, student makes a comment that is inconsistent with the direct answer they received for concept A
*Expected:* Tutor notices the inconsistency and gently flags it.  
*Failure mode:* Tutor ignores the inconsistency because concept A is "resolved."  
*Pass criterion:* This is a difficult automated test — best done as a human red-team scenario. Check: does the soft revisit queue contain concept A? Does the revisit mechanism trigger around exchange 10?

---

### Test Group 6: Generic Praise Instead of Corrective Feedback

**Test 6-A: Praise Without Specificity**  
Student sends a substantively correct but underdeveloped answer.  
*Expected:* Tutor acknowledges specifically what is correct and pushes further. ("Right — you've identified the governing variable part. What about the action strategies?")  
*Failure mode:* Tutor says "Great insight! That shows real understanding." and moves on.  
*Pass criterion:* Tutor response contains the word "and" or "now" connecting acknowledgment to a follow-up probe. No generic superlatives appear in feedback responses.

---

### Test Group 7: Collapsing Challenge Too Quickly

**Test 7-A: Three Vague Attempts → Direct Answer**  
Attempt 1: "I'm not sure, maybe it has to do with reflection?"  
Attempt 2: "Something about changing how you think?"  
Attempt 3: "Going deeper than the surface?"  
*Expected:* `isGenuineAttempt = false` for at least 2 of these 3 messages. Direct answer is NOT triggered.  
*Failure mode:* All three count as genuine attempts and the direct answer is given.  
*Pass criterion:* At most 1 of these 3 messages is classified as `isGenuineAttempt = true`.

**Test 7-B: Lowering the Bar vs. Changing the Path**  
Student is stuck on a complex concept.  
*Expected:* Tutor decomposes the question ("Let's start with just one piece of this...") rather than simplifying the concept.  
*Failure mode:* Tutor explains the concept in simpler terms without asking the student to engage with it.  
*Pass criterion:* Tutor response contains a narrowed, scaffolded version of the same question, not an explanation that replaces the question.

---

### Test Group 8: Failure to Identify Missing Prerequisites

**Test 8-A: Advanced Concept, Missing Foundation**  
Reading covers both "single-loop learning" (foundational) and "Model II theories-in-use" (advanced).  
Student jumps immediately to: "What is Model II theories-in-use?"  
*Expected:* Tutor checks foundational concept first. ("Before we get to that, let's make sure we have the foundation — can you explain what a theory-in-use is?")  
*Failure mode:* Tutor answers Model II question directly.  
*Pass criterion:* Tutor's response on this question involves a prerequisite check before engaging with Model II. The `[TOPIC_THREAD]` tag reflects the foundational concept, not "Model II."

---

### Test Group 9: Lack of Transfer Checks

**Test 9-A: Same Context, Different Wording**  
Student gives a correct answer using the reading's own framing.  
Tutor should verify transfer with a non-reading context.  
*Expected:* After a successful answer, tutor poses an `[QTYPE: apply]` question with a novel professional scenario.  
*Failure mode:* Tutor marks topic as understood and advances.  
*Pass criterion:* At least one `apply` or `predict` type question is asked for every 3 `explain` type questions in a session.

---

### Test Group 10: Unsafe Handling of Errors

**Test 10-A: Repeated Failure Response**  
Student has been wrong 3 times and is clearly frustrated ("I keep getting this wrong").  
*Expected:* Tutor normalizes struggle ("Working through this takes time — you're making progress") before giving the direct answer.  
*Failure mode:* Tutor gives the direct answer without acknowledging the student's frustration.  
*Pass criterion:* The direct-answer response (attempt 3+) contains a normalizing phrase before the answer, not after.

**Test 10-B: Tone After Error**  
Student gives a clearly wrong answer.  
*Expected:* Feedback is specific and constructive, no condescension or excessive softening.  
*Failure mode:* "Almost! You're so close!" (effusive) OR "That's incorrect because..." (clinical) without a forward path.  
*Pass criterion:* Feedback identifies specifically what is wrong AND provides a specific direction (not a general prompt like "think more about it").

---

### Test Group 11: One-Size-Fits-All Scaffolding

**Test 11-A: Advanced Student Gets Unnecessary Scaffolding**  
Student gives a sophisticated, accurate answer on attempt 1.  
*Expected:* Tutor acknowledges, verifies with a transfer probe or harder question, and does not offer basic scaffolding.  
*Failure mode:* Tutor gives the same guiding question it would give a struggling student.  
*Pass criterion:* When `isGenuineAttempt = true` and the answer is substantive, the tutor's follow-up is a harder or transfer-level question, not a repetition of the same scaffold.

---

### Test Group 12: Poor Memory Across Session

**Test 12-A: Misconception in Exchange 2, Inconsistency in Exchange 15**  
A misconception is logged at exchange 2. At exchange 15, the student makes a statement that reflects the same misconception.  
*Expected:* Tutor notices the recurrence (the misconception is in `unresolvedMisconceptions` or the context) and flags it.  
*Failure mode:* Tutor treats exchange 15 as a new independent error with no memory of exchange 2.  
*Pass criterion:* The `Misconception.resolved` field for the exchange-2 misconception is still `false` and the revisit mechanism has triggered.

---

## STEP 8 — Final Verdict

### The 5 Most Serious Weaknesses

**1. Confidence checks are placebo.**  
Every 4 exchanges the app asks how confident the student feels and logs the answer. The answer never changes anything. This is theatre, not pedagogy. It creates the impression of metacognitive support while delivering none. A student who says "uncertain" receives the same next exchange as one who says "very confident."

**2. No opening orientation.**  
Students are dropped into a thought-provoking question about the reading with zero context. There is no prior knowledge activation, no course arc framing, no bridging to what they already know. For students who struggle with the reading, this is sink-or-swim from exchange 1.

**3. The 3-attempt threshold is a rescue rule, not an adaptive rule.**  
The app reduces cognitive demand on a timer. Every student gets 3 attempts on every concept regardless of concept importance, struggle type, or how close they are to understanding. A student typing "I don't know" three times and a student making three genuinely wrong attempts both get the direct answer. The rule conflates effort with mastery.

**4. Questions are not systematically diagnostic.**  
The system prompt does not specify what makes a question diagnostic. Questions are generated by the model on each turn. Many will be answerable by locating and paraphrasing the text, which tests reading comprehension rather than conceptual understanding. There is no mechanism to ensure questions rotate through explanation, prediction, application, and transfer.

**5. Misconceptions are logged but not resolved.**  
When a misconception is detected, it is stored in the database and surfaced in the instructor report. But within the session, the conversation moves on. There is no follow-up check to confirm the student understood the correction. The report may show zero misconceptions — not because students had none, but because the misconceptions were never probed enough to surface.

---

### The 5 Highest-Leverage Improvements

**1. Make confidence ratings behavioral.** (REC-01 — LOW complexity, HIGH impact)  
This requires approximately 20 lines of code in `chat/route.ts` and a prompt addition. It transforms an existing feature from cosmetic to functional. Every session immediately benefits.

**2. Add prior knowledge activation to the opening.** (REC-02 — LOW complexity, HIGH impact)  
Changing the hardcoded opening message in `client-chat.tsx` is a one-file change. Adding `courseContext` and `learningGoal` to the schema and session form is a half-day of work. The instructional improvement is immediate and durable.

**3. Add a question type taxonomy to the system prompt.** (REC-03 — MEDIUM complexity, HIGH impact)  
This requires prompt additions, tag parsing, and schema changes to `Message`. But it is the single most important structural improvement to learning quality — it changes what kinds of thinking the app actually demands.

**4. Add misconception follow-up on topic change.** (REC-04 — MEDIUM complexity, HIGH impact)  
Schema migration plus a query on topic change. Closes the most obvious gap between detection and resolution.

**5. Add self-explanation prompts to first attempt.** (REC-06 — LOW complexity, MEDIUM impact)  
A prompt addition only — no schema change, no new API logic. Surfaces student thinking before intervention, which improves the quality of all subsequent exchanges.

---

### What Would Make This App Genuinely Excellent

The current app is pedagogically competent for motivated students working through accessible readings. It becomes genuinely excellent when it does three things:

**A. It maintains a student model.**  
Not just attempt counts per topic, but a representation of: what this student understands well, what they have struggled with, what misconceptions they carry, and how their fluency compares to their transfer ability. This model should update within a session and persist across sessions.

**B. It generates questions that reveal thinking, not just require thinking.**  
A great Socratic tutor asks questions that would expose a student's mental model even if answered correctly. "What would change if X were different?" reveals whether the student understands the causal structure. "What's the strongest argument against this?" reveals whether they can hold the concept at arm's length. These require deliberate design, not model generation.

**C. It teaches reading as a skill, not just reading as access to content.**  
The expert modeling instruction (REC-05) is the beginning of this. A genuinely excellent version would have the tutor occasionally demonstrate how to read — how to identify the argumentative structure, spot the assumptions, evaluate the evidence, notice what the author is not saying. Students learn the content; they also learn how to read like a professional.

---

### What to Absolutely Avoid

**Do NOT add more questions to the opening.**  
The temptation when adding prior knowledge activation is to make the opening sequence longer. Resist this. Two exchanges of orientation is the ceiling. Students open the app to prepare for class; they do not have unlimited time and patience.

**Do NOT lower the attempt threshold.**  
Lowering the threshold from 3 to 2 attempts does not improve learning — it just provides direct answers faster. The threshold is already the weakest part of the pedagogy. The fix is not to move the number; it is to replace the blunt threshold with adaptive scaffolding logic.

**Do NOT make misconception logging visible to students.**  
The exchange replay in the instructor monitor correctly shows misconception flags on student messages. Do not show these to students during their session. Being labeled as having a misconception is demotivating and changes how students respond (they become strategically careful rather than genuinely exploratory).

**Do NOT add more confidence check options.**  
The current three-level scale (very confident / somewhat confident / uncertain) is already richer than students will use reliably. Adding "somewhat uncertain" or "neutral" does not improve diagnostic value. The fix is behavioral, not categorical.

**Do NOT generate the instructor report at session end automatically.**  
The current design (instructor triggers report generation on demand) is correct. Auto-generating reports removes the instructor's agency and may fire on incomplete or very small data. Keep it manual.

---

## Appendix: Evidence-to-Gap Mapping

| Source File | Evidence | Gap It Reveals |
|---|---|---|
| `client-chat.tsx` line ~36–43 | Hardcoded opening message requests greeting + question | No prior knowledge activation (Gap B) |
| `chat/route.ts` line ~44–51 | `if (exchangeCount > 0 && exchangeCount % 4 === 0)` confidence extraction | Confidence logged but behavior unchanged (Gap D) |
| `system-prompt.ts` — no question type taxonomy | Questions generated ad-hoc | No diagnostic question design (Gap H) |
| `attempt-tracker.ts` — no misconception resolved field | Misconceptions parsed but no resolution tracking | No follow-up mechanism (Gap E) |
| `system-prompt.ts` — no expert modeling instruction | No think-aloud or reasoning demonstration | Expert modeling absent (Gap G) |
| `prisma/schema.prisma` — no cross-session link | Each session fully isolated | No spaced retrieval or cross-session memory (Gap F) |
| `chat/route.ts` — single adaptive variable | `attemptCount < 3 → question; else → answer` | One-dimensional adaptivity (Gap L) |
| `system-prompt.ts` — no self-explanation instruction | Student thinking not surfaced before intervention | No self-explanation mechanism (Gap I) |
| `chat/route.ts` — confidence rating not injected into instruction | Rating extracted and stored, no behavioral branch | Confidence checks are placebo (Gap D) |
| `system-prompt.ts` — no prerequisite logic | All concepts treated equally | No prerequisite sequencing (Gap F, L) |

---

<!-- IMPLEMENTATION SUMMARY FOR AGENT
Quick reference: priority order for implementation.

P0 (implement first, in order):
1. REC-01: behavioral confidence checks — files: chat/route.ts, system-prompt.ts, schema.prisma
2. REC-02: prior knowledge opening — files: client-chat.tsx, system-prompt.ts, schema.prisma, instructor session page
3. REC-03: question taxonomy — files: system-prompt.ts, attempt-tracker.ts, schema.prisma, report-generator.ts
4. REC-04: misconception follow-up — files: chat/route.ts, system-prompt.ts, schema.prisma

P1 (implement after P0 is verified):
5. REC-05: expert modeling moments — files: system-prompt.ts, schema.prisma
6. REC-06: self-explanation prompts — files: system-prompt.ts
7. REC-08: productive cognitive conflict — files: system-prompt.ts

P2 (implement after P1 is verified):
8. REC-07: soft revisit queue — files: chat/route.ts, schema.prisma

For each change: run the acceptance criteria in STEP 5 before marking done.
Run the adversarial tests in STEP 7 after all P0 and P1 changes are complete.
-->
