# PHASE-SESSION-WORKSPACE-REDESIGN.md

## Context

The session workspace page (`src/app/instructor/[sessionId]/page.tsx`, ~1505 lines) serves as both the first-time setup wizard and the ongoing session management dashboard. This redesign addresses several UX problems:

1. **The page doesn't adapt to session state.** A first-time instructor and a returning instructor with 15 active students see the same giant form with every section expanded.
2. **Information hierarchy is inverted for the common case.** After initial setup, the instructor mostly needs monitoring tabs and the access code. But these are visually subordinate to the configuration form.
3. **Three config fields blur together.** "Learning Outcomes," "What you want learners to be able to do," and "Where this fits in your course" are three adjacent textareas whose distinctions are unclear.
4. **Readings are below Key Questions in page order.** The step indicator says "Add a reading" but the upload zone is the second-to-last section on the page — after Tutor Configuration and Key Questions.
5. **No AI-generated question suggestions.** The lint endpoint can analyze individual questions, but there's no way to generate starting-point questions from the reading content.
6. **The step indicator omits Key Questions.** An instructor following just the steps could share the link with zero checkpoints.

### Usage contexts (from prior discussion)
- **Before class**: Set up session, share link, review results later. No live monitoring.
- **During class**: Live-monitor while students work. Needs rapid situational awareness.
- **After class**: Review what happened, plan next steps.

---

## CHANGE 1: Reorder page sections to match the setup flow

**Why:** The current order is: Header → Status bar → Access code → Tutor Configuration → Key Questions → Readings → Assessments. But the natural setup flow is: upload a reading → write/generate questions → add teaching context → share the link. Readings should come *before* Key Questions and Tutor Configuration, because you can't write good questions without content, and the AI can't generate suggestions without a reading.

**File:** `src/app/instructor/[sessionId]/page.tsx`

Reorder the JSX sections (inside the `minerva-shell` div, after the header and status bar) to this order:

1. **Header** (session name, breadcrumb, tab navigation) — unchanged
2. **Status bar** (ready / needs reading) — unchanged  
3. **Access code card** — unchanged
4. **Readings section** (file upload + file list) — MOVED UP from near-bottom
5. **Key Questions section** (checkpoints) — stays after readings
6. **Tutor Configuration section** — MOVED DOWN from before questions
7. **Assessments section** — stays at bottom

### Implementation:

The sections are already self-contained JSX blocks within the `minerva-shell` div. Move the Readings block (currently lines ~1318-1406, the `{/* Readings section */}` comment) to immediately after the Access code card (after line ~795). Move the Assessments block (currently lines ~1408-1501) to remain at the bottom. The Key Questions block (currently lines ~1016-1316) stays where it is relative to Readings — it just moves up because Readings moved up. The Tutor Configuration block (currently lines ~797-1014) moves to after Key Questions.

The net effect is the page flows: Header → Status → Access Code → **Readings** → **Key Questions** → **Tutor Configuration** → Assessments.

---

## CHANGE 2: Update the step indicator to include Key Questions

**Why:** The current steps are "Name it → Add a reading → Share the link." Key Questions are the primary quality lever for the tutoring session — they're what make the tutor's probing structured rather than generic. Omitting them from the setup flow means an instructor could skip them entirely without realizing their importance.

**File:** `src/components/ui/step-indicator.tsx`

Replace the `steps` array:

```tsx
const steps = [
  { number: 1 as const, label: "Name it" },
  { number: 2 as const, label: "Add a reading" },
  { number: 3 as const, label: "Add questions" },
  { number: 4 as const, label: "Share the link" },
];
```

**File:** `src/components/ui/step-indicator.tsx`

Update the component's props type:

```tsx
export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
```

**File:** `src/app/instructor/[sessionId]/page.tsx`

Update the `setupStep` computation (currently around line 625-626). Change from:

```tsx
const setupStep: 2 | 3 | null =
  readings.length === 0 ? 2 : learnerCount === 0 ? 3 : null;
```

To:

```tsx
const setupStep: 2 | 3 | 4 | null =
  readings.length === 0
    ? 2
    : checkpoints.length === 0
      ? 3
      : learnerCount === 0
        ? 4
        : null;
```

---

## CHANGE 3: Merge and clarify the three configuration text fields

**Why:** "Learning Outcomes" and "What you want learners to be able to do" are confusingly similar from an instructor's perspective. Internally, `learningOutcomes` feeds the LO assessment in the teaching brief (report-generator.ts line 219: "The institutional learning outcomes for this session are..."), while `learningGoal` feeds the system prompt framing (system-prompt.ts line 214-215: "SESSION LEARNING GOAL"). These serve different functions, but the labels don't communicate that difference.

**File:** `src/app/instructor/[sessionId]/page.tsx`

### 3A: Rename "Learning Outcomes" field

Find the Learning Outcomes field (around lines 879-897). Change the label and helper text:

Replace:
```tsx
<label className="minerva-label">
  Learning Outcomes
</label>
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  Optional. The specific skills or understandings learners should demonstrate. These are referenced in learner reports.
</p>
```

With:
```tsx
<label className="minerva-label">
  Learning outcomes to assess
</label>
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  The specific skills or understandings you want to track. The tutor will assess each learner against these and include formative ratings in the teaching brief.
</p>
```

### 3B: Rename "What you want learners to be able to do" field

Find the learningGoal field (around lines 899-917). Change the label and helper text:

Replace:
```tsx
<label className="minerva-label">
  What you want learners to be able to do
</label>
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  What you want learners to understand by the end of this session.
</p>
```

With:
```tsx
<label className="minerva-label">
  Session goal
</label>
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  The overarching understanding you're building toward. This shapes how the tutor opens the session, selects questions, and frames the closing synthesis.
</p>
```

### 3C: Rename the section header

Replace "Tutor Configuration" (around lines 799-805):

```tsx
<h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
  Tutor Configuration
</h2>
<p className="mt-2 text-sm text-[var(--dim-grey)]">
  What you write here shapes how the tutor opens the session, checks for
  understanding, and identifies gaps. Optional, but improves response quality.
</p>
```

With:

```tsx
<h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
  Teaching context
</h2>
<p className="mt-2 text-sm text-[var(--dim-grey)]">
  Help the tutor understand your course, your goals, and what good
  performance looks like. Optional, but meaningfully improves the quality
  of questions and feedback.
</p>
```

---

## CHANGE 4: Collapse configuration sections for active sessions

**Why:** An instructor returning to manage an active session (with at least one reading and one student) shouldn't have to scroll past the full configuration form every time. The monitoring tabs and access code are what they need. Configuration sections should default to collapsed for active sessions.

**File:** `src/app/instructor/[sessionId]/page.tsx`

### 4A: Add a state variable for section collapse

Add near the existing state declarations:

```tsx
const hasStudents = learnerCount > 0;
const [showConfig, setShowConfig] = useState(!hasStudents);
const [showQuestions, setShowQuestions] = useState(!hasStudents);
const [showReadings, setShowReadings] = useState(!hasStudents);
const [showAssessments, setShowAssessments] = useState(false);
```

IMPORTANT: These useState calls use the initial value of `hasStudents`, but `learnerCount` is fetched asynchronously. To handle this correctly, use a useEffect that sets the collapsed state after learner count is loaded:

```tsx
const [sectionsInitialized, setSectionsInitialized] = useState(false);

useEffect(() => {
  if (!loading && !sectionsInitialized) {
    const hasActiveStudents = learnerCount > 0;
    if (hasActiveStudents) {
      setShowConfig(false);
      setShowQuestions(false);
      setShowReadings(false);
    }
    setSectionsInitialized(true);
  }
}, [loading, learnerCount, sectionsInitialized]);
```

Initialize all four `show*` states to `true` by default, then collapse them in the effect above.

### 4B: Wrap each section in a collapsible container

For each of the four content sections (Readings, Key Questions, Teaching Context, Assessments), wrap the section in a collapsible pattern. Use this consistent pattern:

```tsx
<div className="minerva-card overflow-hidden">
  <button
    type="button"
    onClick={() => setShowReadings((v) => !v)}
    className="flex w-full items-center justify-between p-6 text-left md:p-8"
  >
    <div>
      <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
        Readings
      </h2>
      {!showReadings && readings.length > 0 && (
        <p className="mt-2 text-sm text-[var(--dim-grey)]">
          {readings.length} reading{readings.length !== 1 ? "s" : ""} uploaded
        </p>
      )}
    </div>
    <svg
      className={`h-5 w-5 flex-shrink-0 text-[var(--dim-grey)] transition-transform ${
        showReadings ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  {showReadings && (
    <div className="space-y-4 px-6 pb-6 md:px-8 md:pb-8">
      {/* existing readings content (drop zone + file list) goes here */}
    </div>
  )}
</div>
```

Apply this pattern to all four sections. The collapsed state shows the section title plus a brief summary (e.g., "3 questions", "1 reading uploaded", "Teaching context configured"). The expanded state shows the full section content.

For the Key Questions section, the collapsed summary should show:
```tsx
{!showQuestions && checkpoints.length > 0 && (
  <p className="mt-2 text-sm text-[var(--dim-grey)]">
    {checkpoints.length} question{checkpoints.length !== 1 ? "s" : ""}
  </p>
)}
{!showQuestions && checkpoints.length === 0 && (
  <p className="mt-2 text-sm text-[#906f12]">
    No questions yet — add 2-4 to guide the tutor
  </p>
)}
```

For the Teaching Context section, the collapsed summary should show:
```tsx
{!showConfig && (session.courseContext || session.learningGoal || session.learningOutcomes) && (
  <p className="mt-2 text-sm text-[var(--dim-grey)]">
    Configured
  </p>
)}
{!showConfig && !session.courseContext && !session.learningGoal && !session.learningOutcomes && (
  <p className="mt-2 text-sm text-[var(--dim-grey)]">
    Not yet configured
  </p>
)}
```

---

## CHANGE 5: Make the monitoring tabs more prominent for active sessions

**Why:** The three monitoring tabs (Learner progress, Teaching brief, Common misunderstandings) are currently small secondary buttons in the top-right of the header, visually equal-weight to the session title. For a returning instructor, these are the *primary action* — but they're presented as secondary navigation.

**File:** `src/app/instructor/[sessionId]/page.tsx`

### 5A: When the session has students, add a prominent monitoring card above all content sections

After the access code card and before the first content section, add a monitoring dashboard card that only appears when `learnerCount > 0`:

```tsx
{learnerCount > 0 && (
  <div className="minerva-card p-6 md:p-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="eyebrow eyebrow-teal">Session active</p>
        <p className="mt-2 text-sm text-[var(--dim-grey)]">
          {learnerCount} learner{learnerCount !== 1 ? "s" : ""} connected
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/instructor/${sessionId}/monitor`}
          className="minerva-button"
        >
          Learner progress
        </Link>
        <Link
          href={`/instructor/${sessionId}/report`}
          className="minerva-button minerva-button-secondary"
        >
          Teaching brief
        </Link>
        <Link
          href={`/instructor/${sessionId}/misconceptions`}
          className="minerva-button minerva-button-secondary"
        >
          Common misunderstandings
        </Link>
      </div>
    </div>
  </div>
)}
```

Note: The "Learner progress" link uses the primary button style (`minerva-button` without `minerva-button-secondary`) to indicate it's the most common action during a live session.

### 5B: Keep the existing header tab buttons but make them secondary

The existing tab buttons in the header (lines 704-731) should remain as-is for quick access. They already serve as the persistent navigation. No change needed here — the new monitoring card (5A) adds a *prominent* version, not a replacement.

---

## CHANGE 6: Add AI-generated question suggestions from reading content

**Why:** Writing 3-4 strong inferential/evaluative questions from scratch is the hardest and most time-consuming part of session setup. The reading content is already uploaded and parsed. The lint endpoint already exists for analyzing individual questions. A "Suggest questions from my reading" feature generates plausible starting points the instructor can review, edit, and accept — turning the task from creation to curation.

### Step 6A: Create the suggestion API endpoint

**File to create:** `src/app/api/sessions/[sessionId]/checkpoints/suggest/route.ts`

```typescript
import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import type { ApiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        readings: true,
        checkpoints: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (session.readings.length === 0) {
      return NextResponse.json<ApiError>(
        { error: "Upload a reading before generating questions.", code: "NO_READINGS" },
        { status: 400 }
      );
    }

    const maxExchanges = session.maxExchanges || 20;
    const recommendedCount = Math.max(2, Math.floor((maxExchanges - 4) / 4));
    const existingCount = session.checkpoints.length;
    const suggestCount = Math.max(1, Math.min(4, recommendedCount - existingCount));

    const readingContent = session.readings
      .map((r) => `=== ${r.filename} ===\n${r.content}`)
      .join("\n\n");

    const existingQuestions =
      session.checkpoints.length > 0
        ? `\n\nThe instructor has already written these questions (do NOT duplicate them):\n${session.checkpoints
            .map((cp, i) => `${i + 1}. [${cp.processLevel}] ${cp.prompt}`)
            .join("\n")}`
        : "";

    const contextInfo = session.courseContext
      ? `\n\nCourse context: ${session.courseContext}`
      : "";
    const goalInfo = session.learningGoal
      ? `\n\nSession goal: ${session.learningGoal}`
      : "";

    const systemPrompt = `You are an expert in reading assessment design and Socratic instruction. Generate ${suggestCount} discussion questions for a Socratic tutoring session based on the provided reading.

RULES:
- Questions must require interpretation, inference, evaluation, or synthesis — NOT recall or lookup.
- Each question should target a different key idea or passage in the reading.
- Questions should be specific to this text — not generic questions that could apply to any reading.
- For each question, assign a process level and identify the relevant passage.
- A strong question makes the student reconstruct the author's reasoning, not just locate a fact.

Process levels:
- retrieve: Locate specific information in the text (avoid this level — only use if essential)
- infer: Draw conclusions the author implies but doesn't state directly
- integrate: Link ideas across different parts of the reading
- evaluate: Assess the strength or validity of the author's reasoning

Respond ONLY with valid JSON:
{
  "suggestions": [
    {
      "prompt": "The discussion question text",
      "processLevel": "infer|integrate|evaluate",
      "passageAnchors": "Section/paragraph reference or null",
      "expectations": ["What a strong answer would demonstrate", "Another evidence feature"],
      "misconceptions": ["A likely misreading", "Another common error"]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate ${suggestCount} discussion questions for this reading:\n\n${readingContent.slice(0, 12000)}${existingQuestions}${contextInfo}${goalInfo}`,
        },
      ],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      return NextResponse.json<ApiError>(
        { error: "Unexpected response.", code: "UNEXPECTED_MODEL_RESPONSE" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content.text) as {
      suggestions?: Array<{
        prompt?: string;
        processLevel?: string;
        passageAnchors?: string | null;
        expectations?: string[];
        misconceptions?: string[];
      }>;
    };

    const validLevels = ["retrieve", "infer", "integrate", "evaluate"];
    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => typeof s.prompt === "string" && s.prompt.trim().length > 0)
      .map((s) => ({
        prompt: s.prompt!.trim(),
        processLevel: validLevels.includes(s.processLevel ?? "") ? s.processLevel! : "infer",
        passageAnchors: typeof s.passageAnchors === "string" ? s.passageAnchors : null,
        expectations: Array.isArray(s.expectations)
          ? s.expectations.filter((e): e is string => typeof e === "string")
          : [],
        misconceptions: Array.isArray(s.misconceptions)
          ? s.misconceptions.filter((m): m is string => typeof m === "string")
          : [],
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error generating question suggestions:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to generate suggestions.", code: "SUGGESTION_FAILED" },
      { status: 500 }
    );
  }
}
```

### Step 6B: Add the "Suggest questions" UI to the Key Questions section

**File:** `src/app/instructor/[sessionId]/page.tsx`

1. Add state for suggestion management:

```tsx
const [suggestions, setSuggestions] = useState<Array<{
  prompt: string;
  processLevel: string;
  passageAnchors: string | null;
  expectations: string[];
  misconceptions: string[];
}>>([]);
const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
const [acceptingSuggestionIndex, setAcceptingSuggestionIndex] = useState<number | null>(null);
```

2. Add the suggestion generation function:

```typescript
async function generateSuggestions() {
  setGeneratingSuggestions(true);
  setError("");
  try {
    const res = await fetch(`/api/sessions/${sessionId}/checkpoints/suggest`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Failed to generate suggestions.");
    }
    setSuggestions(data.suggestions ?? []);
    if ((data.suggestions ?? []).length === 0) {
      setToast({ tone: "error", message: "No suggestions were generated. Try adding more reading content." });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate suggestions.";
    setError(message);
    setToast({ tone: "error", message });
  } finally {
    setGeneratingSuggestions(false);
  }
}
```

3. Add the suggestion acceptance function:

```typescript
async function acceptSuggestion(index: number) {
  const suggestion = suggestions[index];
  if (!suggestion) return;

  setAcceptingSuggestionIndex(index);
  setError("");
  try {
    const res = await fetch(`/api/sessions/${sessionId}/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: suggestion.prompt,
        processLevel: suggestion.processLevel,
        passageAnchors: suggestion.passageAnchors || null,
        expectations: suggestion.expectations,
        misconceptionSeeds: suggestion.misconceptions,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Failed to add question.");
    }

    setSuggestions((prev) => prev.filter((_, i) => i !== index));
    await fetchCheckpoints();
    setToast({ tone: "success", message: "Question added." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add question.";
    setError(message);
    setToast({ tone: "error", message });
  } finally {
    setAcceptingSuggestionIndex(null);
  }
}

function dismissSuggestion(index: number) {
  setSuggestions((prev) => prev.filter((_, i) => i !== index));
}
```

4. Add the "Suggest questions" button to the Key Questions section header. Find the section header area (around lines 1017-1032) and add a button next to the question count:

After the closing `</div>` of the header text block and before the question count `<p>`, add:

```tsx
<div className="flex items-center gap-3">
  <button
    onClick={generateSuggestions}
    disabled={generatingSuggestions || readings.length === 0}
    title={readings.length === 0 ? "Upload a reading first" : undefined}
    className="minerva-button minerva-button-secondary"
  >
    {generatingSuggestions ? "Generating..." : "Suggest questions from reading"}
  </button>
  <p className="text-xs uppercase tracking-[0.12em] text-[var(--dim-grey)]">
    {checkpoints.length} question{checkpoints.length === 1 ? "" : "s"}
  </p>
</div>
```

Remove the standalone question count `<p>` that's currently at the end of the header.

5. Render suggestion cards between the section header and the existing checkpoint list. After the "too many questions" warning (around line 1042) and before the checkpoint list, add:

```tsx
{suggestions.length > 0 && (
  <div className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
      Suggested questions — review and accept or dismiss
    </p>
    {suggestions.map((suggestion, index) => (
      <div
        key={`suggestion-${index}`}
        className="space-y-3 rounded-2xl border-2 border-dashed border-[rgba(17,120,144,0.28)] bg-[rgba(17,120,144,0.04)] p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                Suggestion {index + 1}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getProcessLevelTone(
                  suggestion.processLevel as CheckpointProcessLevel
                )}`}
              >
                {formatProcessLevelLabel(suggestion.processLevel as CheckpointProcessLevel)}
              </span>
              {suggestion.passageAnchors && (
                <span className="rounded-full bg-[rgba(0,0,0,0.04)] px-2.5 py-1 text-[11px] font-medium text-[var(--dim-grey)]">
                  {suggestion.passageAnchors}
                </span>
              )}
            </div>
            <p className="max-w-[48rem] text-[15px] leading-7 text-[var(--charcoal)]">
              {suggestion.prompt}
            </p>
            {suggestion.expectations.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                  Expected evidence
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                  {suggestion.expectations.map((e) => (
                    <li key={e}>- {e}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestion.misconceptions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                  Likely misreadings
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                  {suggestion.misconceptions.map((m) => (
                    <li key={m}>- {m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => acceptSuggestion(index)}
              disabled={acceptingSuggestionIndex === index}
              className="minerva-button"
            >
              {acceptingSuggestionIndex === index ? "Adding..." : "Accept"}
            </button>
            <button
              onClick={() => dismissSuggestion(index)}
              className="minerva-button minerva-button-secondary"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
)}
```

### Step 6C: Checkpoint POST endpoint — NO CHANGE NEEDED

**File:** `src/app/api/sessions/[sessionId]/checkpoints/route.ts`

Verified: The POST handler already accepts `expectations` (line 58) and `misconceptionSeeds` (line 59) in the request body and saves them as JSON strings (lines 106-113). The `acceptSuggestion` function in Step 6B sends these fields correctly. No backend changes needed.

---

## CHANGE 7: Auto-suggest process level based on question text

**Why:** Choosing a process level for every question is a small cognitive tax. The lint endpoint already detects recall-only questions. Extend this: when the instructor types a question in the "Add question" textarea and blurs (or after a brief debounce), auto-suggest the process level based on the question text. The instructor can still override it.

**File:** `src/app/instructor/[sessionId]/page.tsx`

This is a lightweight client-side heuristic, not an API call. Add a function:

```typescript
function suggestProcessLevel(prompt: string): CheckpointProcessLevel {
  const lower = prompt.toLowerCase();

  // Evaluate signals
  if (
    lower.includes("strength of") ||
    lower.includes("weakness") ||
    lower.includes("how convincing") ||
    lower.includes("assess") ||
    lower.includes("evaluate") ||
    lower.includes("valid") ||
    lower.includes("justified")
  ) {
    return "evaluate";
  }

  // Integrate signals
  if (
    lower.includes("connect") ||
    lower.includes("relationship between") ||
    lower.includes("how does") ||
    lower.includes("relate to") ||
    lower.includes("compare") ||
    lower.includes("contrast") ||
    lower.includes("tension between") ||
    lower.includes("across")
  ) {
    return "integrate";
  }

  // Retrieve signals
  if (
    lower.includes("what does the author say") ||
    lower.includes("according to") ||
    lower.includes("find in the text") ||
    lower.includes("what is the definition") ||
    lower.includes("list the") ||
    lower.includes("identify the")
  ) {
    return "retrieve";
  }

  // Default to infer
  return "infer";
}
```

Then add a `useEffect` that updates the process level when the prompt changes (with debounce to avoid flickering):

```tsx
useEffect(() => {
  if (!newCheckpointPrompt.trim()) return;
  const timeout = setTimeout(() => {
    const suggested = suggestProcessLevel(newCheckpointPrompt);
    setNewCheckpointProcessLevel(suggested);
  }, 800);
  return () => clearTimeout(timeout);
}, [newCheckpointPrompt]);
```

This only applies to the "Add question" form (not editing existing checkpoints). The instructor can still manually change the dropdown — the auto-suggest just sets a better default than always starting at "infer."

---

## CHANGE 8: Add a "session active" learner count to the status bar

**Why:** The current status bar shows "Ready: 1 reading, 0 assessments uploaded." After setup, the instructor wants to know how many students have joined. This is especially relevant for the "before class" context — the instructor sets up, shares the link, and checks back to see who has joined.

**File:** `src/app/instructor/[sessionId]/page.tsx`

Update the status bar text (around lines 736-744). Change from:

```tsx
{readings.length === 0
  ? "Upload at least one reading to activate this session."
  : `Ready: ${readings.length} reading${readings.length !== 1 ? "s" : ""}, ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} uploaded.`}
```

To:

```tsx
{readings.length === 0
  ? "Upload at least one reading to activate this session."
  : learnerCount === 0
    ? `Ready: ${readings.length} reading${readings.length !== 1 ? "s" : ""}, ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} uploaded. No learners yet.`
    : `Active: ${learnerCount} learner${learnerCount !== 1 ? "s" : ""} connected. ${readings.length} reading${readings.length !== 1 ? "s" : ""}, ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""}.`}
```

---

## Implementation order

1. **Change 1** (section reorder) — Move Readings before Key Questions, Tutor Config after. Pure JSX block move, no logic changes.
2. **Change 3** (field relabeling) — Text-only changes, no logic.
3. **Change 2** (step indicator update) — Small change to StepIndicator + setupStep logic.
4. **Change 8** (status bar learner count) — Small text change.
5. **Change 4** (collapsible sections) — Adds state + wraps sections. Do this after Change 1 so the sections are already in the right order.
6. **Change 5** (prominent monitoring card) — Adds a new JSX block, standalone.
7. **Change 6** (AI question suggestions) — New API endpoint + UI. Largest change, standalone.
8. **Change 7** (auto-suggest process level) — Small client-side addition, standalone.

## Testing notes

- **Section reorder**: After moving Readings above Key Questions, verify that the step indicator still shows "Add a reading" as step 2 and that the reading upload area is the first content section an instructor sees.
- **Collapsible sections**: Verify that on first page load with `learnerCount > 0`, sections are collapsed. On first load with `learnerCount === 0`, sections are expanded. Manual toggle should work in both cases.
- **Question suggestions**: Test with a session that has a reading but no checkpoints. The "Suggest questions from reading" button should generate 2-4 questions. Test accepting and dismissing. Verify accepted questions appear in the checkpoint list with correct process level, passage anchors, expectations, and misconception seeds.
- **Auto-suggest process level**: Type "What is the strength of the author's argument?" and verify the dropdown switches to "Judge the argument." Type "What does the author say about X?" and verify it switches to "Find in the text." The debounce should prevent flickering while typing.
- **Backwards compatibility**: No schema changes. The new `/checkpoints/suggest` endpoint is additive. All existing functionality (manual question creation, lint, reorder, edit, delete) continues unchanged.
- **New `/checkpoints/difficulty` directory**: Note that PHASE-TAB-REDESIGN.md also creates a file in the checkpoints directory (`/checkpoints/difficulty/route.ts`). These don't conflict — they're separate endpoints.
