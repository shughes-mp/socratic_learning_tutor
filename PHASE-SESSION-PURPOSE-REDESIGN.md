# PHASE-SESSION-PURPOSE-REDESIGN.md

## Context

The Socratic tutor currently treats every session identically: same tutor behavior, same report framing, same instructor dashboard emphasis. In practice, the app serves four distinct use cases that differ in cognitive target, tutor strategy, and what the instructor needs to see afterward. This phase introduces a **session purpose** system that adapts the tutor, the report, and the instructor tabs to each use case, while also fixing cross-screen redundancy, broken components, and information hierarchy issues identified in a comprehensive UI audit.

### The four session purposes

| Purpose | When | Cognitive target | Learning science anchor |
|---|---|---|---|
| `pre_class` | Before a class session | Comprehension and readiness | Ausubel (advance organizers), Kapur (productive failure as diagnostic) |
| `during_class_prep` | Start of class, activation phase | Activation and connection | Roediger & Karpicke (testing effect), retrieval practice literature |
| `during_class_reflection` | End of class, consolidation phase | Consolidation and self-explanation | Chi (self-explanation effect), Karpicke (retrieval-based learning) |
| `after_class` | After class ends | Far transfer and application | Cepeda (spacing effect), Bjork (desirable difficulties), Barnett & Ceci (transfer taxonomy) |

### Core design principle

The tutor ALWAYS resolves misconceptions through Socratic dialogue. Students should never leave a session stuck. What changes across purposes is the **cognitive level the tutor targets**: comprehension (pre-class) -> activation (during-class prep) -> consolidation (during-class reflection) -> far transfer (after-class).

---

## CHANGE 1: Add `sessionPurpose` to the Session schema

**Why:** Every downstream adaptation (tutor behavior, report framing, dashboard emphasis) depends on knowing the session's purpose. This is a session-level property set by the instructor at creation time.

**File:** `prisma/schema.prisma`

### Instructions:

1. Add a `sessionPurpose` field to the `Session` model, after the `stance` field:
```prisma
sessionPurpose String @default("pre_class") // pre_class | during_class_prep | during_class_reflection | after_class
```

2. Run `npx prisma db push` (or equivalent migration) to apply the schema change.

---

## CHANGE 2: Add session purpose selector to the session workspace

**Why:** The instructor needs to set the purpose when creating or configuring a session. This should be prominent and early in the setup flow, not buried in advanced settings.

**File:** `src/app/instructor/[sessionId]/page.tsx`

### Instructions:

1. Add a `sessionPurpose` field to the session state and form state. This should be loaded from the session data on mount and editable.

2. Create a purpose selector component with four options. Each option should show a label, a one-line description, and a visual indicator of cognitive level. Use a card-based selector (not a dropdown) since this is a high-stakes instructional design choice:

```
Pre-class              | Assess readiness. Resolve gaps so students arrive prepared.
During class (prep)    | Activate prior knowledge. Retrieve and connect before applying.
During class (reflect) | Consolidate learning. Self-explain and retrieve before closing.
After class            | Deepen and transfer. Apply learning to novel contexts.
```

3. Place this selector ABOVE the checkpoints section and BELOW the readings upload. The purpose should influence how the instructor thinks about their checkpoints.

4. When the purpose changes, PATCH to `/api/sessions/[sessionId]` with the new `sessionPurpose` value.

5. **Important placement note:** This selector should NOT be inside the "Advanced settings" toggle. It is a primary instructional design choice. The dead code cleanup (4 duplicate Teaching Context blocks and 5 duplicate Advanced settings toggles identified in prior audit) should be addressed as part of this change -- consolidate to a single clean section ordering:
   - Session name and description
   - Readings upload
   - **Session purpose selector** (new)
   - Assessments upload
   - Checkpoints
   - Learning outcomes
   - Course context / learning goal (collapsible)
   - Stance, max exchanges, schedule (advanced settings)

---

## CHANGE 3: Pass `sessionPurpose` to the session workspace API

**File:** `src/app/api/sessions/[sessionId]/route.ts`

### Instructions:

1. In the PATCH handler, accept `sessionPurpose` in the request body. Validate against the four allowed values: `pre_class`, `during_class_prep`, `during_class_reflection`, `after_class`.

2. In the GET handler, ensure `sessionPurpose` is included in the response.

---

## CHANGE 4: Inject session-purpose-specific tutor behavior into the system prompt

**Why:** The tutor's questioning strategy, cognitive target, and resolution approach must differ by purpose. This is the most critical change in the redesign.

**File:** `src/lib/system-prompt.ts`

### Instructions:

#### 4A: Extend the `BuildSystemPromptSession` interface (line 25)

Add `sessionPurpose` to the interface:
```typescript
interface BuildSystemPromptSession {
  courseContext?: string | null;
  learningGoal?: string | null;
  learningOutcomes?: string | null;
  stance?: string | null;
  sessionPurpose?: string | null; // NEW
}
```

#### 4B: Add a purpose-specific instruction block to `buildSystemPrompt()` (after line 218, after learning outcomes)

Insert a new block that appends purpose-specific behavioral instructions:

```typescript
const purposeInstruction = buildPurposeInstruction(session?.sessionPurpose);
if (purposeInstruction) {
  prompt += purposeInstruction;
}
```

#### 4C: Create the `buildPurposeInstruction()` function

Add this new function. Each mode's instructions are grounded in specific learning science and override or supplement the default tutor behavior:

```typescript
function buildPurposeInstruction(purpose: string | null | undefined): string {
  if (!purpose) return "";

  const instructions: Record<string, string> = {
    pre_class: `

SESSION PURPOSE: PRE-CLASS READINESS
Your goal is to assess and build comprehension readiness so students arrive at class prepared to APPLY concepts, not re-learn them.

COGNITIVE TARGET: Comprehension and corrected understanding.
- Focus on whether students can accurately restate the text's core arguments.
- Probe for misreadings, missing warrants, and wrong inferences.
- When you detect a misconception, resolve it fully through Socratic dialogue. Do not leave students confused.
- Use the FLAG -> LOCATE -> QUESTION sequence for errors. The student should leave understanding the reading correctly.
- Prioritize breadth across checkpoints. The instructor needs to know which concepts the class has and has not grasped.
- Keep transfer questions light (one per session at most). The goal is solid comprehension, not application depth.

QUESTION EMPHASIS: Favor [QTYPE: explain] and [QTYPE: distinguish] early. Use [QTYPE: detect-error] to surface hidden misreadings. Reserve [QTYPE: apply] for a brief closing check only.

RESOLUTION STANDARD: A topic is resolved when the student can restate the concept accurately in their own words, anchored to specific textual evidence. Do not accept vague paraphrases.`,

    during_class_prep: `

SESSION PURPOSE: DURING-CLASS ACTIVATION
Your goal is to activate prior knowledge and prime retrieval so students are ready for in-class application and experiential learning.

COGNITIVE TARGET: Retrieval and connection-making.
- Begin with retrieval practice: ask students to recall key concepts WITHOUT re-reading. This leverages the testing effect (Roediger & Karpicke, 2006).
- After retrieval, ask students to connect concepts to each other or to scenarios they will encounter in class.
- When misconceptions surface during retrieval, resolve them. Students should not carry wrong models into class activities.
- Keep exchanges brisk. This is a warm-up, not a deep dive. Aim for 8-12 exchanges maximum.
- Favor questions that bridge reading knowledge to the upcoming class activity context (if provided in course context).

QUESTION EMPHASIS: Favor [QTYPE: explain] (retrieval) and [QTYPE: apply] (connection to upcoming class). Use [QTYPE: predict] to prime forward thinking. Minimize [QTYPE: challenge] -- save critical evaluation for class discussion.

RESOLUTION STANDARD: A topic is resolved when the student demonstrates accurate recall and can articulate at least one connection to a broader concept or application context. Partial recall with correct direction is acceptable -- flag it for the instructor but do not belabor it.`,

    during_class_reflection: `

SESSION PURPOSE: DURING-CLASS REFLECTION
Your goal is to consolidate learning from the class session through retrieval practice and self-explanation.

COGNITIVE TARGET: Consolidation and self-explanation.
- Ask students to explain what they learned in class in their own words (Chi self-explanation effect).
- Probe for integration: can the student connect what happened in class back to the reading's framework?
- Use retrieval practice: ask about concepts discussed in class WITHOUT letting students refer back. The effort of retrieval strengthens retention.
- When students reveal gaps between what they think they learned and what the reading actually argues, resolve through Socratic dialogue.
- Ask at least one metacognitive question: "What was the most surprising thing you encountered today?" or "Where did your initial understanding change?"
- Self-explanation prompts are especially important in this mode. Use [SELF_EXPLAIN_PROMPTED: true] liberally.

QUESTION EMPHASIS: Favor [QTYPE: explain] (self-explanation), [QTYPE: distinguish] (differentiate what they learned from prior assumptions), and [QTYPE: apply] (consolidate through novel application). Use [QTYPE: challenge] to test depth of new understanding.

RESOLUTION STANDARD: A topic is resolved when the student can self-explain the concept, connect it to the class experience, and identify what changed in their understanding. Prompt for specificity -- "I understand it better now" is not evidence of consolidation.`,

    after_class: `

SESSION PURPOSE: AFTER-CLASS TRANSFER AND APPLICATION
Your goal is to deepen understanding and push toward far transfer -- applying concepts to novel, unfamiliar contexts.

COGNITIVE TARGET: Far transfer and flexible application.
- This is the most cognitively demanding mode. Students should have baseline comprehension; your job is to extend it.
- Prioritize transfer scenarios: professional contexts, cross-domain applications, edge cases, and situations the reading does not directly address.
- Ask students to generate their own examples, not just evaluate yours. Generation is harder and produces more durable learning (Bjork desirable difficulties).
- When misconceptions surface, they often reflect shallow initial learning. Resolve them, but then push past the corrected understanding toward application.
- Use spacing: reference concepts from the reading that the student may not have engaged with recently. The retrieval effort is productive.
- Connect to learning outcomes explicitly. This mode should produce the clearest evidence for LO assessment.

QUESTION EMPHASIS: Favor [QTYPE: apply] (novel transfer), [QTYPE: predict] (extend reasoning to new contexts), and [QTYPE: challenge] (evaluate limitations and edge cases). Use [QTYPE: explain] only to verify baseline before pushing deeper.

RESOLUTION STANDARD: A topic is resolved when the student can apply the concept correctly in a context not discussed in the reading, explain WHY the concept applies (not just THAT it applies), and identify boundary conditions or limitations. This is a high bar -- use the hint ladder when students need scaffolding, but do not lower the target.`,
  };

  return instructions[purpose] || "";
}
```

#### 4D: Adapt `getConversationPhase()` to be purpose-aware (line 361)

The current phase logic uses generic thresholds. Modify to accept purpose and adjust phase guidance:

1. Add `sessionPurpose` parameter to `getConversationPhase()`:
```typescript
function getConversationPhase(
  exchangeNumber: number | undefined,
  maxExchanges: number | undefined,
  sessionPurpose?: string | null
): { phase: string; guidance: string }
```

2. Adjust the wrap-up guidance per purpose:
- `pre_class`: "Summarize which reading concepts the student now understands and which remain unclear. Frame as readiness: 'Based on our conversation, you seem ready on X but should review Y before class.'"
- `during_class_prep`: "Brief activation summary. Name what the student recalled successfully and what they should pay attention to during class."
- `during_class_reflection`: "Ask the student to state their single biggest takeaway from today's class in one sentence. Then ask what they would still like to understand better."
- `after_class`: "Ask the student to articulate the single most important way this reading's ideas could apply in their professional context. Close with encouragement and a forward-looking connection to future material."

3. Update the call site in `buildContextInstruction()` (line 416) to pass the purpose. This requires adding `sessionPurpose` to the `ContextOptions` interface and threading it through from `chat/route.ts`.

#### 4E: Thread `sessionPurpose` through `chat/route.ts`

**File:** `src/app/api/chat/route.ts`

1. The session data is already fetched at line 78. Access `studentSession.session.sessionPurpose`.

2. Pass it to `buildSystemPrompt()` by adding it to the session config object at line 191:
```typescript
const systemPrompt = buildSystemPrompt(
  studentSession.session.readings,
  studentSession.session.assessments,
  {
    courseContext: studentSession.session.courseContext,
    learningGoal: studentSession.session.learningGoal,
    learningOutcomes: studentSession.session.learningOutcomes,
    stance: studentSession.session.stance,
    sessionPurpose: studentSession.session.sessionPurpose, // NEW
  },
  checkpoints
);
```

3. Pass it to `buildContextInstruction()` by adding `sessionPurpose` to the options at line 203:
```typescript
const instruction = buildContextInstruction({
  ...existingOptions,
  sessionPurpose: studentSession.session.sessionPurpose, // NEW
});
```

---

## CHANGE 5: Make the report generator purpose-conditional

**Why:** The Teaching Brief should frame results differently depending on what the session was for. A pre-class report answers "Are they ready?" while an after-class report answers "Did they achieve transfer?"

**File:** `src/lib/report-generator.ts`

### Instructions:

#### 5A: Fetch `sessionPurpose` in `generateInstructorReport()`

The session is already fetched at line 115. `session.sessionPurpose` will be available after the schema change.

#### 5B: Replace the static `REPORT_SYSTEM_PROMPT` with a purpose-conditional builder

Create a function `buildReportSystemPrompt(sessionPurpose: string)` that returns the full report system prompt with purpose-specific framing for each section. The structural sections stay the same, but their framing and emphasis change:

```typescript
function buildReportSystemPrompt(sessionPurpose: string): string {
  const purposeFraming = getReportPurposeFraming(sessionPurpose);

  return `You generate instructor teaching briefs from Socratic tutoring sessions. ${purposeFraming.overallFrame}

SESSION SNAPSHOT
- Session name, number of students, total exchanges, session purpose. One sentence framing how the session went overall.

READINESS HEATMAP
${purposeFraming.heatmapInstruction}

${purposeFraming.strengthsSectionTitle}
- 2-3 bullet points on topics or concepts where most students demonstrated solid understanding. Include brief representative evidence. Keep this section SHORT.

${purposeFraming.gapsSectionTitle}
- For each area of concern, describe the specific pattern, how many students showed it, and whether it was resolved in-session or remains open.
- Distinguish between "resolved in session" vs "unresolved."
- Include one representative student quote (first name only) per pattern.

WHAT TO DO NEXT
${purposeFraming.nextStepsInstruction}

PER-STUDENT NOTES
${purposeFraming.perStudentInstruction}

LEARNING OUTCOME ASSESSMENT
[... existing LO assessment instructions unchanged ...]

Under 900 words total for the main brief.`;
}
```

#### 5C: Define `getReportPurposeFraming()` with mode-specific language

```typescript
function getReportPurposeFraming(purpose: string) {
  const framings: Record<string, {
    overallFrame: string;
    heatmapInstruction: string;
    strengthsSectionTitle: string;
    gapsSectionTitle: string;
    nextStepsInstruction: string;
    perStudentInstruction: string;
  }> = {
    pre_class: {
      overallFrame: "This was a PRE-CLASS session. Your purpose is to help the instructor decide whether students are READY for the upcoming class. Frame everything around readiness to apply, not depth of mastery.",
      heatmapInstruction: "Rate class READINESS on each major topic as GREEN (ready to apply in class), YELLOW (understands basics but has gaps that may surface during application), or RED (significant misunderstandings that will block productive class work). After the ratings, write ONE sentence: 'Overall, the class is [ready/mostly ready/not yet ready] for [topic].'\nIMPORTANT: The heatmap must be formatted as a structured list, one topic per line, with the rating in brackets. Example:\n- **Topic name**: [GREEN] Brief explanation\n- **Topic name**: [YELLOW] Brief explanation",
      strengthsSectionTitle: "WHAT YOUR STUDENTS ARE READY FOR",
      gapsSectionTitle: "WHERE YOUR STUDENTS ARE NOT YET READY",
      nextStepsInstruction: "For each gap, suggest what the instructor should do BEFORE or AT THE START of the upcoming class to address it. Frame as: 'Before class, consider...' or 'At the start of class, try...' Connect suggestions to specific evidence. Prioritize: what will most block productive class time if unaddressed?",
      perStudentInstruction: "For each student: 2-3 sentences covering readiness level, key gaps to watch for during class, and one strength to build on. Flag students who may need extra support during class activities.",
    },
    during_class_prep: {
      overallFrame: "This was a DURING-CLASS PREP session (activation phase). Your purpose is to help the instructor understand what prior knowledge students activated and where retrieval gaps exist, so they can adapt the class session that is about to begin.",
      heatmapInstruction: "Rate ACTIVATION LEVEL on each major topic as GREEN (strong retrieval, ready for application), YELLOW (partial retrieval, may need brief review before applying), or RED (failed to retrieve or retrieved incorrectly). Write ONE sentence summarizing what the class is primed for.\nIMPORTANT: Format as a structured list:\n- **Topic name**: [GREEN] Brief explanation\n- **Topic name**: [YELLOW] Brief explanation",
      strengthsSectionTitle: "WHAT YOUR STUDENTS RECALLED WELL",
      gapsSectionTitle: "WHERE RETRIEVAL WAS WEAK",
      nextStepsInstruction: "For each weak area, suggest a quick in-class move the instructor can use in the NEXT FEW MINUTES. These should be rapid: 'Before starting the activity, briefly clarify...' or 'During the debrief, revisit...' Keep suggestions actionable within the current class period.",
      perStudentInstruction: "For each student: 1-2 sentences on what they activated successfully and what the instructor should watch for during the upcoming activity. Keep very brief -- the instructor is about to start teaching.",
    },
    during_class_reflection: {
      overallFrame: "This was a DURING-CLASS REFLECTION session (consolidation phase). Your purpose is to help the instructor understand what students consolidated from the class session and what remains fragile before they leave.",
      heatmapInstruction: "Rate CONSOLIDATION LEVEL on each major topic as GREEN (student can self-explain accurately), YELLOW (partial consolidation -- remembers but cannot fully explain), or RED (did not consolidate or consolidated incorrectly). Write ONE sentence on overall consolidation.\nIMPORTANT: Format as a structured list:\n- **Topic name**: [GREEN] Brief explanation\n- **Topic name**: [YELLOW] Brief explanation",
      strengthsSectionTitle: "WHAT YOUR STUDENTS CONSOLIDATED",
      gapsSectionTitle: "WHAT REMAINS FRAGILE",
      nextStepsInstruction: "For each fragile area, suggest what the instructor should do BEFORE THE NEXT CLASS to reinforce it. Frame as: 'For homework, ask students to...' or 'In the next session, start by...' Leverage spacing -- suggest revisiting fragile topics after a delay.",
      perStudentInstruction: "For each student: 2-3 sentences on what they consolidated, what they articulated as their key takeaway, and what the instructor should follow up on. Note any gaps between student confidence and actual understanding.",
    },
    after_class: {
      overallFrame: "This was an AFTER-CLASS session focused on far transfer and application depth. Your purpose is to help the instructor assess whether students can apply concepts flexibly in novel contexts, not just recall them.",
      heatmapInstruction: "Rate TRANSFER READINESS on each major topic as GREEN (can apply flexibly to novel contexts), YELLOW (can apply to familiar contexts but struggles with novel ones), or RED (cannot transfer beyond the original reading context). Write ONE sentence on overall depth.\nIMPORTANT: Format as a structured list:\n- **Topic name**: [GREEN] Brief explanation\n- **Topic name**: [YELLOW] Brief explanation",
      strengthsSectionTitle: "WHERE YOUR STUDENTS SHOWED DEPTH",
      gapsSectionTitle: "WHERE TRANSFER BROKE DOWN",
      nextStepsInstruction: "For each transfer gap, suggest how the instructor can build toward transfer in future sessions or assignments. Frame as: 'In a future session, try...' or 'For the next assignment, consider...' Connect to learning outcomes and note which outcomes have sufficient evidence for assessment.",
      perStudentInstruction: "For each student: 2-3 sentences on transfer capability, strongest application examples, and areas where understanding remains surface-level. Include LO evidence quality -- which outcomes have strong evidence and which need more opportunities?",
    },
  };

  return framings[purpose] || framings.pre_class;
}
```

#### 5D: Update the call site

In `generateInstructorReport()`, replace:
```typescript
system: REPORT_SYSTEM_PROMPT,
```
with:
```typescript
system: buildReportSystemPrompt(session.sessionPurpose || "pre_class"),
```

Keep the old `REPORT_SYSTEM_PROMPT` constant as a fallback reference but mark it deprecated with a comment.

---

## CHANGE 6: Fix the ReadinessHeatmap component

**Why:** The heatmap parser is currently broken -- it uses regex to extract GREEN/YELLOW/RED ratings from free-text markdown, which fails when the report prose does not match the expected format. The report prompt improvements in Change 5 will help by enforcing structured output, but the parser also needs hardening.

**File:** `src/app/instructor/[sessionId]/report/page.tsx` (ReadinessHeatmap component)

### Instructions:

1. Update the regex parser to handle the structured format specified in the report prompt:
```
- **Topic name**: [GREEN] Brief explanation
- **Topic name**: [YELLOW] Brief explanation
- **Topic name**: [RED] Brief explanation
```

The regex should match:
```typescript
/[-*]\s*\*{0,2}(.+?)\*{0,2}\s*:\s*\[(GREEN|YELLOW|RED)\]\s*(.+)/gi
```

2. Add a fallback: if zero matches are found, scan for the words GREEN, YELLOW, RED preceded by any topic-like text. This handles cases where the model does not follow the exact format.

3. If the heatmap section is entirely missing from the report, show a clear empty state: "Heatmap data not available for this report. Regenerate the report to include it."

4. Update the section title dynamically based on session purpose:
- `pre_class`: "Readiness Heatmap"
- `during_class_prep`: "Activation Heatmap"
- `during_class_reflection`: "Consolidation Heatmap"
- `after_class`: "Transfer Heatmap"

---

## CHANGE 7: Invert the Teaching Brief information hierarchy

**Why:** The current Teaching Brief buries the most actionable content ("What to do next") at the bottom. Instructors scan top-down. The action items should lead.

**File:** `src/app/instructor/[sessionId]/report/page.tsx`

### Instructions:

1. After parsing the report markdown, extract sections by their headers. Reorder the rendered sections to:
   1. **Session Snapshot** (1-2 lines of orientation)
   2. **What to Do Next** (most actionable -- moved UP from position 5)
   3. **Heatmap** (visual overview)
   4. **Gaps section** (evidence for the action items above)
   5. **Strengths section** (what is safe to build on)
   6. **Per-Student Notes** (detail on demand)
   7. **Learning Outcome Assessment** (formal assessment -- already at bottom)

2. Implementation approach: Use a section parser that splits the markdown by `##` headers, maps each to a section key, then renders them in the new order. Sections that are not found render nothing (graceful degradation).

3. Remove the 4 redundant stat cards at the top (total students, total exchanges, misconceptions, direct answers). These duplicate information in the Session Snapshot prose and the Learner Progress tab. Replace with a single summary line extracted from the Session Snapshot section.

---

## CHANGE 8: Unify teaching recommendations into a single source

**Why:** Currently, teaching recommendations are generated by TWO separate AI pipelines: the `REPORT_SYSTEM_PROMPT` produces a "What to Do Next" section in the Teaching Brief, and `src/app/api/sessions/[sessionId]/recommendations/route.ts` generates separate `TeachingRecommendation` records displayed on the Common Misunderstandings tab. These can contradict each other because they run independently on the same data.

### Instructions:

#### 8A: Make the Teaching Brief the single authoritative source

The report generator already has full access to all session data (misconceptions, checkpoints, mastery, transcripts). Its "What to Do Next" section should be the canonical teaching recommendation.

#### 8B: Deprecate the separate recommendations endpoint

**File:** `src/app/api/sessions/[sessionId]/recommendations/route.ts`

Add a deprecation comment at the top. Do NOT delete it yet -- the Common Misunderstandings tab still references it. But stop calling it from the UI when a report exists.

#### 8C: Update the Common Misunderstandings tab

**File:** `src/app/instructor/[sessionId]/misconceptions/page.tsx`

1. When a report exists for the session, extract the "What to Do Next" section from the report content and display it in the teaching recommendations area, replacing the separately generated recommendations.

2. Keep the separate recommendations endpoint as a fallback for sessions without a generated report.

3. Remove the 5/15/30 minute facilitation script format from the misconceptions tab (this level of detail belongs in the report, if anywhere). Replace with a simpler display: each recommendation as a card with "What to address", "Why it matters", and "Suggested move".

---

## CHANGE 9: Resolve cross-screen stat redundancy

**Why:** Learner count, exchange count, and misconception count currently appear on all three instructor tabs. This is noise.

### Instructions:

1. **Learner Progress tab** (`monitor/page.tsx`): Keep exchange count and engagement status per student (this is its unique value -- real-time monitoring). Remove the aggregate misconception count from this tab.

2. **Common Misunderstandings tab** (`misconceptions/page.tsx`): Keep misconception-specific KPIs (total detected, resolved, unresolved, resolution rate). Remove the generic "total students" and "total exchanges" cards.

3. **Teaching Brief** (`report/page.tsx`): Remove all 4 stat cards. The Session Snapshot prose covers this. Keep the report content as the single rendered view.

---

## CHANGE 10: Add session purpose badge to instructor tab headers

**Why:** The instructor needs constant awareness of which mode they are viewing results for, especially if they run multiple sessions with different purposes.

**Files:** All three instructor tab pages (`monitor/page.tsx`, `misconceptions/page.tsx`, `report/page.tsx`)

### Instructions:

1. Add a small purpose badge next to the session name in each tab's header. Use color coding:
   - `pre_class`: Blue badge, "Pre-class"
   - `during_class_prep`: Amber badge, "In-class Prep"
   - `during_class_reflection`: Purple badge, "In-class Reflection"
   - `after_class`: Green badge, "After Class"

2. Fetch the session purpose from the session data (already available via the session API).

---

## CHANGE 11: Dead code cleanup in session workspace

**Why:** The session workspace page (`page.tsx`) currently contains 4 hidden duplicate Teaching Context blocks (dead code at approximately lines 898, 1147, 1515, 1765) and 5 copies of the Advanced settings toggle. These make the file brittle and confusing for future changes.

**File:** `src/app/instructor/[sessionId]/page.tsx`

### Instructions:

1. Identify all duplicate blocks by searching for repeated patterns:
   - Search for all instances of "Teaching Context" or "courseContext" form sections
   - Search for all instances of "Advanced" toggle sections
   - Keep only the FIRST (or most complete) instance of each

2. Consolidate the page into the section ordering defined in Change 2:
   - Session name and description
   - Readings upload
   - Session purpose selector (new, from Change 2)
   - Assessments upload
   - Checkpoints
   - Learning outcomes
   - Course context / learning goal (single instance, collapsible)
   - Stance, max exchanges, schedule (single Advanced settings toggle)

3. This cleanup should be done BEFORE adding the session purpose selector to avoid confusion about where to insert it.

---

## CHANGE 12: Add session purpose to the create-session flow

**Why:** The purpose should be set at session creation, not just edited afterward. It is foundational to how the session will work.

**File:** `src/app/instructor/create/page.tsx` (or wherever the session creation form lives)

### Instructions:

1. Add the same purpose selector component from Change 2 to the creation form.

2. Default to `pre_class` (the most common use case based on the instructor's workflow).

3. Include the purpose in the POST request body when creating the session.

4. Update the create session API endpoint to accept and store `sessionPurpose`.

---

## Implementation order

These changes have dependencies. Implement in this sequence:

1. **Change 1** (schema) -- everything depends on the field existing
2. **Change 11** (dead code cleanup) -- makes Change 2 safe to implement
3. **Change 2** (purpose selector in workspace) + **Change 3** (API) + **Change 12** (create flow) -- can be done together
4. **Change 4** (system prompt) + **Change 4E** (chat route threading) -- tutor behavior adaptation
5. **Change 5** (report generator) -- report framing
6. **Change 6** (heatmap fix) + **Change 7** (hierarchy inversion) -- Teaching Brief fixes
7. **Change 8** (unified recommendations) -- cross-screen fix, depends on report changes
8. **Change 9** (stat deduplication) + **Change 10** (purpose badges) -- polish

Changes 4 and 5 are the highest-impact items. If implementing incrementally, prioritize: 1 -> 4 -> 5 -> 2 -> rest.

---

## Testing checklist

- [ ] Create a session with each of the four purposes. Verify the purpose is stored and displayed correctly.
- [ ] Run a student conversation in each purpose mode. Verify the tutor's questioning style and resolution approach match the mode description.
- [ ] Generate a report for each purpose mode. Verify the section titles, heatmap labels, and framing language are purpose-appropriate.
- [ ] Verify the ReadinessHeatmap component parses the new structured format correctly.
- [ ] Verify the Teaching Brief renders sections in the new order (action items first).
- [ ] Verify that the Common Misunderstandings tab pulls recommendations from the report when one exists.
- [ ] Verify no duplicate stat cards appear across tabs.
- [ ] Verify the purpose badge appears on all three instructor tabs.
- [ ] Verify sessions created without a purpose default to `pre_class`.
- [ ] Verify the session workspace has no duplicate Teaching Context or Advanced settings blocks.
