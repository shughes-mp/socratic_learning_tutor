# PHASE-TAB-REDESIGN.md

## Context

The instructor dashboard has three tabs: **Learner Progress** (monitor), **Session Summaries** (report), and **Common Misunderstandings** (misconceptions). These changes address gaps identified in a critical analysis of each tab's utility, redundancy, and action-orientation across the three usage contexts:

1. **Before class** — instructor sets up the session, shares the link, reviews results later. No live monitoring.
2. **During class** — instructor live-monitors while students work. Needs rapid situational awareness and real-time signals.
3. **After class** — instructor reviews what happened and plans next steps. Needs forward-looking recommendations and student-level insight.

The instructor's core question across all three contexts is: *"Where are my students individually and collectively, and what should I do about it?"*

---

## CHANGE 1: Add live auto-refresh to Learner Progress tab

**Why:** The Learner Progress tab (`monitor/page.tsx`) is the primary during-class monitoring surface, but it only loads data once on mount. During a live session, the instructor has to manually reload the page to see updated exchange counts, misconception counts, and new students joining. The Common Misunderstandings tab already has a live mode with 30-second auto-refresh — Learner Progress needs the same.

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

### Instructions:

1. Add a `mode` state variable (same pattern as `misconceptions/page.tsx`):
```tsx
const [mode, setMode] = useState<"snapshot" | "live">("snapshot");
```

2. Extract the existing fetch logic into a `fetchStudents` callback wrapped in `useCallback`:
```tsx
const fetchStudents = useCallback(async () => {
  try {
    const res = await fetch(`/api/sessions/${params.sessionId}/students/summary`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setStudents(data);
    }
  } catch (err) {
    console.error("Failed to fetch learner progress:", err);
  } finally {
    setIsLoading(false);
  }
}, [params.sessionId]);
```

3. Replace the existing `useEffect` with two effects — one for initial fetch, one for live polling:
```tsx
useEffect(() => {
  fetchStudents();
}, [fetchStudents]);

useEffect(() => {
  if (mode !== "live") return;
  const interval = window.setInterval(fetchStudents, 15000); // 15 seconds — faster than misconceptions because this is the primary monitoring view
  return () => window.clearInterval(interval);
}, [fetchStudents, mode]);
```

4. Add mode toggle buttons to the header area, after the "Back to session workspace" link. Use the same styling pattern from `misconceptions/page.tsx` lines 366-384:
```tsx
<div className="flex flex-wrap gap-2">
  <button
    type="button"
    onClick={() => setMode("snapshot")}
    className={`minerva-button ${mode === "snapshot" ? "" : "minerva-button-secondary"}`}
  >
    Snapshot
  </button>
  <button
    type="button"
    onClick={() => setMode("live")}
    className={`minerva-button ${mode === "live" ? "" : "minerva-button-secondary"}`}
  >
    Live monitoring
  </button>
</div>
```

---

## CHANGE 2: Surface engagement flags as top-level signals in Learner Progress

**Why:** The diagnostic pipeline produces `engagementFlag` values (`on_task`, `shallow`, `disengaged`, `off_topic`, `hostile`) and `engagementNote` on every student message. These are currently only visible as tiny badges inside the exchange replay — the instructor has to expand individual student traces to discover engagement problems. During live monitoring, the instructor needs to see at a glance which students need attention.

### Step 2A: Add engagement data to the summary API

**File:** `src/app/api/sessions/[sessionId]/students/summary/route.ts`

Currently this route returns `messageCount`, `misconceptionCount`, and `lastActiveAt`. Add:

1. Add a `latestEngagementFlag` field. After the existing `studentSessions` query, compute the most recent engagement flag per student. The simplest approach is to include the latest *student* message's engagement data in the select:

Replace the existing `select` with:
```typescript
select: {
  id: true,
  studentName: true,
  startedAt: true,
  endedAt: true,
  _count: {
    select: {
      messages: true,
      misconceptions: true,
    },
  },
  messages: {
    select: { createdAt: true, engagementFlag: true, role: true },
    orderBy: { createdAt: "desc" as const },
    take: 5, // Take last 5 to find the most recent student message with a flag
  },
},
```

2. In the `.map()` response builder, compute `latestEngagementFlag` from the messages:
```typescript
return NextResponse.json(
  studentSessions.map((studentSession) => {
    const latestFlaggedMessage = studentSession.messages.find(
      (m) => m.role === "user" && m.engagementFlag && m.engagementFlag !== "on_task"
    );
    const latestEngagement = studentSession.messages.find(
      (m) => m.role === "user" && m.engagementFlag
    );

    return {
      id: studentSession.id,
      studentName: studentSession.studentName,
      startedAt: studentSession.startedAt,
      endedAt: studentSession.endedAt,
      messageCount: studentSession._count.messages,
      misconceptionCount: studentSession._count.misconceptions,
      lastActiveAt: studentSession.messages[0]?.createdAt ?? studentSession.startedAt,
      latestEngagementFlag: latestEngagement?.engagementFlag ?? null,
      hasRecentEngagementConcern: !!latestFlaggedMessage,
    };
  })
);
```

### Step 2B: Display engagement signals in the monitor table

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

1. Update the `StudentSummary` interface to include the new fields:
```tsx
interface StudentSummary {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messageCount: number;
  misconceptionCount: number;
  lastActiveAt: string | Date;
  latestEngagementFlag: string | null;
  hasRecentEngagementConcern: boolean;
}
```

2. Add a new column header "Engagement" to the `<thead>` between "Common misunderstandings" and "Last active":
```tsx
<th className="px-6 py-4">Engagement</th>
```

3. Add the corresponding `<td>` in the row body. Display the engagement flag with color coding:
```tsx
<td className="px-6 py-4">
  {student.hasRecentEngagementConcern ? (
    <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(144,111,18,0.10)] px-2.5 py-1 text-xs font-medium text-[#906f12]">
      <span className="h-2 w-2 rounded-full bg-[#906f12]" />
      {student.latestEngagementFlag === "disengaged"
        ? "Disengaged"
        : student.latestEngagementFlag === "shallow"
          ? "Low effort"
          : student.latestEngagementFlag === "off_topic"
            ? "Off topic"
            : student.latestEngagementFlag === "hostile"
              ? "Hostile"
              : "Needs attention"}
    </span>
  ) : (
    <span className="text-xs text-[var(--teal)]">On task</span>
  )}
</td>
```

---

## CHANGE 3: Add response latency to Learner Progress

**Why:** How long a student takes to respond is a powerful signal during live monitoring. A student who hasn't responded in 3+ minutes might be stuck, confused, or disengaged. This is distinct from the `lastActive` timestamp — latency tells you about the *current* gap, not the most recent activity.

### Step 3A: Compute response latency in the summary API

**File:** `src/app/api/sessions/[sessionId]/students/summary/route.ts`

1. Expand the `messages` select to include `take: 2` (need the last two messages to compute whether we're waiting for a student reply):
```typescript
messages: {
  select: { createdAt: true, engagementFlag: true, role: true },
  orderBy: { createdAt: "desc" as const },
  take: 5,
},
```
(Already done in Change 2.)

2. In the `.map()`, compute `waitingForReply` and `secondsSinceLastMessage`:
```typescript
const lastMessage = studentSession.messages[0];
const isWaitingForStudentReply = lastMessage?.role === "assistant";
const secondsSinceLastMessage = lastMessage
  ? Math.floor((Date.now() - new Date(lastMessage.createdAt).getTime()) / 1000)
  : null;

return {
  // ...existing fields...
  isWaitingForStudentReply,
  secondsSinceLastMessage,
};
```

### Step 3B: Display response gap in the monitor

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

1. Update `StudentSummary` interface to add:
```tsx
isWaitingForStudentReply: boolean;
secondsSinceLastMessage: number | null;
```

2. In the "Last active" column, when `isWaitingForStudentReply` is true AND `secondsSinceLastMessage > 180` (3 minutes), show a visual warning:
```tsx
<td className="px-6 py-4 text-[var(--dim-grey)]">
  <div className="flex flex-col">
    <span>
      {new Date(lastActive).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
    {student.isWaitingForStudentReply &&
      student.secondsSinceLastMessage !== null &&
      student.secondsSinceLastMessage > 180 && (
        <span className="mt-0.5 text-[10px] font-medium text-[#906f12]">
          Waiting {Math.floor(student.secondsSinceLastMessage / 60)}m for reply
        </span>
      )}
  </div>
</td>
```

---

## CHANGE 4: Add checkpoint difficulty analysis ("Item Analysis") to Common Misunderstandings tab

**Why:** The instructor needs to know which checkpoints (comprehension questions / discussion prompts) are hardest for the class. This is the equivalent of item analysis in assessment design. The misconception clusters tell you *what* students get wrong, but checkpoint difficulty tells you *where in the content* students struggle, tied directly to the instructor's own prompts. This belongs in Common Misunderstandings because it's about diagnosing class-level patterns.

### Step 4A: Create a new API endpoint

**File to create:** `src/app/api/sessions/[sessionId]/checkpoints/difficulty/route.ts`

```typescript
import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const checkpoints = await prisma.checkpoint.findMany({
      where: { sessionId },
      include: {
        studentCheckpoints: {
          select: {
            status: true,
            turnsSpent: true,
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    const difficulty = checkpoints.map((cp) => {
      const total = cp.studentCheckpoints.length;
      const addressed = cp.studentCheckpoints.filter(
        (sc) => sc.status !== "unseen"
      ).length;
      const mastered = cp.studentCheckpoints.filter(
        (sc) => sc.status === "mastered" || sc.status === "passed"
      ).length;
      const struggling = cp.studentCheckpoints.filter(
        (sc) => sc.status === "in_progress" || sc.status === "stuck"
      ).length;
      const avgTurns =
        addressed > 0
          ? cp.studentCheckpoints
              .filter((sc) => sc.status !== "unseen")
              .reduce((sum, sc) => sum + sc.turnsSpent, 0) / addressed
          : 0;

      return {
        checkpointId: cp.id,
        prompt: cp.prompt,
        processLevel: cp.processLevel,
        passageAnchors: cp.passageAnchors,
        totalStudents: total,
        addressedCount: addressed,
        masteredCount: mastered,
        strugglingCount: struggling,
        averageTurnsSpent: Math.round(avgTurns * 10) / 10,
        difficultySignal:
          total === 0
            ? "no_data"
            : mastered / Math.max(addressed, 1) > 0.7
              ? "easy"
              : struggling / Math.max(addressed, 1) > 0.5
                ? "hard"
                : "moderate",
      };
    });

    return NextResponse.json(difficulty);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to compute checkpoint difficulty:", error);
    return NextResponse.json(
      { error: "Failed to compute checkpoint difficulty", details: message },
      { status: 500 }
    );
  }
}
```

### Step 4B: Add a "Checkpoint difficulty" section to the Common Misunderstandings page

**File:** `src/app/instructor/[sessionId]/misconceptions/page.tsx`

1. Add state for checkpoint difficulty data:
```tsx
const [checkpointDifficulty, setCheckpointDifficulty] = useState<Array<{
  checkpointId: string;
  prompt: string;
  processLevel: string;
  passageAnchors: string | null;
  totalStudents: number;
  addressedCount: number;
  masteredCount: number;
  strugglingCount: number;
  averageTurnsSpent: number;
  difficultySignal: "no_data" | "easy" | "moderate" | "hard";
}>>([]);
```

2. Fetch it alongside the existing dashboard data. In the `useEffect` that calls `fetchDashboard()` and `fetchRecommendations()`, add:
```tsx
fetch(`/api/sessions/${sessionId}/checkpoints/difficulty`)
  .then((res) => res.json())
  .then((data) => {
    if (Array.isArray(data)) setCheckpointDifficulty(data);
  })
  .catch(console.error);
```

3. After the stats grid and before the cluster cards section, add a "Checkpoint difficulty" card. Only render it in `post-session` mode and when there is data:
```tsx
{mode === "post-session" && checkpointDifficulty.length > 0 && (
  <section className="minerva-card p-6 md:p-8">
    <h2 className="font-serif text-[30px] leading-[1.02] tracking-[-0.03em] text-[var(--charcoal)]">
      Checkpoint difficulty
    </h2>
    <p className="mt-2 max-w-[42rem] text-sm text-[var(--dim-grey)]">
      How your checkpoints performed across the class. Hard checkpoints
      may indicate content areas that need more scaffolding.
    </p>
    <div className="mt-6 space-y-3">
      {checkpointDifficulty.map((cp) => (
        <div
          key={cp.checkpointId}
          className="flex items-start gap-4 rounded-lg border border-[var(--rule)] p-4"
        >
          <div
            className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ${
              cp.difficultySignal === "hard"
                ? "bg-[var(--signal)]"
                : cp.difficultySignal === "moderate"
                  ? "bg-[#906f12]"
                  : cp.difficultySignal === "easy"
                    ? "bg-[var(--teal)]"
                    : "bg-[var(--rule)]"
            }`}
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--charcoal)]">
              {cp.prompt}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--dim-grey)]">
              <span>{cp.addressedCount}/{cp.totalStudents} attempted</span>
              <span>{cp.masteredCount} mastered</span>
              {cp.strugglingCount > 0 && (
                <span className="text-[var(--signal)]">
                  {cp.strugglingCount} struggling
                </span>
              )}
              <span>Avg {cp.averageTurnsSpent} turns</span>
              <span className="rounded bg-[rgba(34,34,34,0.05)] px-1.5 py-0.5 text-[10px] uppercase tracking-widest">
                {cp.processLevel}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)}
```

---

## CHANGE 5: Surface confidence check data in Learner Progress

**Why:** Confidence checks are pedagogically valuable — a student who reports high confidence on a misconception (miscalibrated) is a very different case from a student who reports low confidence on a correct understanding (underconfident). This data is currently stored in the database and included in the AI-generated report's transcript, but it's not directly visible to the instructor in any tab.

### Step 5A: Add confidence summary to the expanded student detail

**File:** `src/components/instructor/exchange-replay.tsx`

The `ExchangeReplay` component already receives `confidenceChecks` from the `StudentSessionData` type in `monitor/page.tsx` (but the props interface only takes `messages` and `misconceptions`). 

1. Update the `ReplayProps` interface to accept confidence checks:
```tsx
import type { ConfidenceCheck, Message, Misconception } from "@prisma/client";

interface ReplayProps {
  messages: ReplayMessage[];
  misconceptions: Misconception[];
  confidenceChecks?: ConfidenceCheck[];
}
```

2. Update the component signature:
```tsx
export function ExchangeReplay({ messages, misconceptions, confidenceChecks = [] }: ReplayProps) {
```

3. Before the message list, if there are confidence checks, render a summary card:
```tsx
{confidenceChecks.length > 0 && (
  <div className="mb-4 rounded-lg border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.04)] p-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--teal)]">
      Confidence checks
    </p>
    <div className="mt-2 space-y-1.5">
      {confidenceChecks.map((check) => (
        <div key={check.id} className="flex items-center gap-2 text-xs text-[var(--dim-grey)]">
          <span className="font-medium text-[var(--charcoal)]">
            {check.topicThread}
          </span>
          <span>→</span>
          <span
            className={
              check.rating === "very_confident"
                ? "text-[var(--teal)]"
                : check.rating === "uncertain"
                  ? "text-[var(--signal)]"
                  : "text-[#906f12]"
            }
          >
            {check.rating.replace(/_/g, " ")}
          </span>
          {check.probeAsked && (
            <span className="rounded bg-[rgba(34,34,34,0.06)] px-1.5 py-0.5 text-[10px]">
              Probe: {check.probeResult || "pending"}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

4. In `monitor/page.tsx`, where `ExchangeReplay` is rendered, pass the confidence checks:
```tsx
<ExchangeReplay
  messages={expandedDetail.messages}
  misconceptions={expandedDetail.misconceptions}
  confidenceChecks={expandedDetail.confidenceChecks}
/>
```

---

## CHANGE 6: Redesign Session Summaries into a forward-looking "Teaching Brief"

**Why:** Session Summaries currently produces a backward-looking narrative report. It's the weakest of the three tabs in terms of action-orientation — an instructor finishes reading it and still has to decide what to do next. The readiness heatmap is the most actionable element; the prose narrative is the least.

Across all three usage contexts (before / during / after class), the instructor's core question when reviewing this tab is: *"What should I focus on next?"*

This is a **report-generator prompt change + UI restructuring**, not a schema change.

### Step 6A: Restructure the report prompt for forward-looking advice

**File:** `src/lib/report-generator.ts`

Replace the `REPORT_SYSTEM_PROMPT` constant (lines 15-54) with:

```typescript
const REPORT_SYSTEM_PROMPT = `You generate instructor teaching briefs from Socratic tutoring sessions. Your purpose is to help the instructor decide what to do NEXT — in the upcoming class discussion, in follow-up activities, or in the next session. Write in professional, direct prose. Use these section headers:

SESSION SNAPSHOT
- Session name, number of students, total exchanges. One sentence framing how the session went overall — momentum, not just numbers.

READINESS HEATMAP
- For each major topic from the readings, rate class readiness as GREEN, YELLOW, or RED.
- Use topic mastery signals as a primary indicator: mastered tends GREEN, direct_answer_given tends YELLOW, uncertain or persistently unresolved tends RED.
- After the ratings, write ONE sentence summarizing the overall readiness picture for the instructor.

WHAT YOUR STUDENTS UNDERSTOOD WELL
- 2-3 bullet points on topics/concepts where most students demonstrated solid understanding. Include brief representative evidence. Keep this section SHORT — the instructor needs to know what's safe to build on.

WHERE YOUR STUDENTS NEED HELP
- For each RED or YELLOW area, describe the specific misconception pattern, how many students showed it, and whether it was resolved in-session or remains open.
- Distinguish between "resolved in session — reinforce briefly" vs. "unresolved — needs direct attention."
- Include one representative student quote (first name only) per pattern.

WHAT TO DO NEXT
- For each gap identified above, suggest one concrete, specific teaching move. Frame as "In your next session, try..." or "Before the next class, consider..."
- Connect each suggestion to the evidence. Don't give generic advice — tie it to what actually happened.

PER-STUDENT NOTES
- For each student: 2-3 sentences covering key strengths, key gaps, and one thing the instructor should watch for. Focus on what's actionable.
- Include confidence calibration notes where relevant (e.g., "reported high confidence but had unresolved misconception on X" or "uncertain but actually demonstrated solid understanding of Y").

LEARNING OUTCOME ASSESSMENT
- Assess each student's observed engagement against each outcome formatively.
- After the main brief, emit one tag per student per learning outcome using this exact format:
[LO_ASSESSMENT: student session id | learning outcome text | status | confidence | evidence summary]
- Do not use the pipe character inside the evidence summary.

For each learning outcome assessment:
- status must be one of: not_observed, insufficient_evidence, emerging, meets, exceeds
- confidence must be one of: low, medium, high
- evidence summary should be 2-4 short sentences with exchange references, brief quotes under 20 words, and question-type cues where possible

CRITICAL RATING RULES
- insufficient_evidence is always valid. Do not force a stronger rating.
- Require at least two distinct question-type opportunities before rating meets or exceeds.
- Score text grounding and reasoning quality, not polish or vocabulary.
- If unresolved high-severity misconceptions remain on a topic related to the learning outcome, the maximum rating is emerging.
- These assessments are formative and instructor-facing, not summative records.

Under 900 words total for the main brief. Keep the LO tags separate from the prose.`;
```

### Step 6B: Update the report page UI labels

**File:** `src/app/instructor/[sessionId]/report/page.tsx`

1. Change the page title from "Session summaries" to "Teaching brief":
   - Line 147 breadcrumb: change `Session summaries` → `Teaching brief`
   - Line 149 h1: change `Session summaries` → `Teaching brief`

2. Change the loading text (line 82): `Building session summaries...` → `Building teaching brief...`

3. Change the "Refresh summaries" button text (line 169): `Refresh summaries` → `Refresh brief`

4. Replace the "Direct Answers" stat card (lines 197-202) with a more actionable metric. Replace:
```tsx
<div className="minerva-card p-5">
  <p className="eyebrow eyebrow-teal">Direct Answers</p>
  <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
    {stats.directAnswers}
  </p>
</div>
```
With:
```tsx
<div className="minerva-card p-5">
  <p className="eyebrow eyebrow-teal">Hints needed</p>
  <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
    {stats.directAnswers}
  </p>
  <p className="mt-1 text-[11px] text-[var(--dim-grey)]">
    Times the tutor gave a direct answer
  </p>
</div>
```

5. Update the `ReportStats` interface to keep backwards compatibility. The field is still `directAnswers` in the JSON — we're just relabeling it in the UI.

### Step 6C: Update breadcrumbs in the session workspace page

**File:** `src/app/instructor/[sessionId]/page.tsx`

Find where the "Session summaries" tab link is rendered and update the label to "Teaching brief". Search for the string "Session summaries" or "report" link in this file and update the label text.

---

## CHANGE 7: Fix misconception count inconsistency across tabs

**Why:** The Learner Progress tab shows raw `misconceptionCount` per student (from the database count). The Session Summaries tab shows `stats.misconceptions` (also a raw count from the report generator). The Common Misunderstandings tab shows clustered/merged counts after semantic grouping, which may be a different number. An instructor seeing "12" in one place and "8 clusters" in another will be confused.

### Instructions:

**File:** `src/app/instructor/[sessionId]/misconceptions/page.tsx`

In the stats grid section (after the `{stats && (` block), the stats cards should clearly label what they're counting. Find the stat that shows total misconceptions and append a clarifying label:

After the misconception count value, add:
```tsx
<p className="mt-1 text-[11px] text-[var(--dim-grey)]">
  Individual instances (clustered into {clusters.length} patterns below)
</p>
```

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

In the table header, change "Common misunderstandings" to "Misconceptions detected" to distinguish it from the cluster-based view:
```tsx
<th className="px-6 py-4">Misconceptions detected</th>
```

---

## CHANGE 8: Add topic mastery summary to expanded student detail in Learner Progress

**Why:** Topic mastery is tracked per student (`TopicMastery` model) but only appears in the AI-generated report prose. When an instructor expands a student's trace, they should see a quick summary of which topics the student has mastered, is working on, or is stuck on — without having to read through every exchange.

### Step 8A: Include topic mastery in the student detail API response

**File:** `src/app/api/sessions/[sessionId]/students/route.ts`

The `prisma.studentSession.findMany` include block (lines 17-47) already includes `messages`, `misconceptions`, and `confidenceChecks`. Add `topicMastery` after `confidenceChecks` (after line 46):
```typescript
confidenceChecks: {
  orderBy: { createdAt: "asc" },
},
topicMastery: {
  orderBy: { updatedAt: "desc" },
},
```

### Step 8B: Display topic mastery in the exchange replay header

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

1. Update the `StudentSessionData` interface to include topic mastery:
```tsx
interface StudentSessionData {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messages: Array<Message & { createdAt: string | Date; hidden?: boolean }>;
  misconceptions: Misconception[];
  confidenceChecks: ConfidenceCheck[];
  topicMastery: Array<{
    id: string;
    topicThread: string;
    status: string;
    criteriamet: string;
    hintLadderRung: number;
  }>;
}
```

2. When the expanded detail is shown (before `<ExchangeReplay>`), render a topic mastery summary:
```tsx
{expandedDetail.topicMastery.length > 0 && (
  <div className="mb-4 rounded-lg border border-[var(--rule)] bg-[rgba(34,34,34,0.02)] p-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--dim-grey)]">
      Topic mastery
    </p>
    <div className="mt-2 flex flex-wrap gap-2">
      {expandedDetail.topicMastery.map((tm) => (
        <span
          key={tm.id}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
            tm.status === "mastered"
              ? "bg-[rgba(17,120,144,0.10)] text-[var(--teal)]"
              : tm.status === "direct_answer_given"
                ? "bg-[rgba(144,111,18,0.10)] text-[#906f12]"
                : tm.status === "in_progress"
                  ? "bg-[rgba(34,34,34,0.06)] text-[var(--charcoal)]"
                  : "bg-[rgba(223,47,38,0.08)] text-[var(--signal)]"
          }`}
        >
          {tm.topicThread}: {tm.status.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  </div>
)}
```

---

## CHANGE 9: Add class-level engagement summary banner to Learner Progress (live mode only)

**Why:** During live monitoring, the instructor's first question is "does anyone need help right now?" A banner at the top of the student list that aggregates engagement signals gives an instant answer without scanning every row.

**File:** `src/app/instructor/[sessionId]/monitor/page.tsx`

After the header card and before the student table, when in live mode, render an engagement summary:

```tsx
{mode === "live" && students.length > 0 && (() => {
  const concernCount = students.filter((s) => s.hasRecentEngagementConcern).length;
  const waitingLong = students.filter(
    (s) => s.isWaitingForStudentReply && (s.secondsSinceLastMessage ?? 0) > 180
  ).length;

  if (concernCount === 0 && waitingLong === 0) {
    return (
      <div className="minerva-card flex items-center gap-3 p-4">
        <span className="h-3 w-3 rounded-full bg-[var(--teal)]" />
        <p className="text-sm text-[var(--charcoal)]">
          All learners are on task
        </p>
      </div>
    );
  }

  return (
    <div className="minerva-card flex items-center gap-3 border-l-4 border-[#906f12] p-4">
      <p className="text-sm text-[var(--charcoal)]">
        {concernCount > 0 && (
          <span className="font-medium text-[#906f12]">
            {concernCount} learner{concernCount !== 1 ? "s" : ""} showing engagement concerns.{" "}
          </span>
        )}
        {waitingLong > 0 && (
          <span className="font-medium text-[var(--dim-grey)]">
            {waitingLong} waiting 3+ minutes for a reply.
          </span>
        )}
      </p>
    </div>
  );
})()}
```

---

## CHANGE 10: Update session workspace tab labels

**File:** `src/app/instructor/[sessionId]/page.tsx`

Find where the three tab links are rendered (they should be Link components pointing to `/instructor/${sessionId}/monitor`, `/instructor/${sessionId}/report`, and `/instructor/${sessionId}/misconceptions`).

1. Change "Session summaries" to "Teaching brief" (matching Change 6).
2. Keep "Learner progress" and "Common misunderstandings" as-is.

---

## Implementation order

These changes have minimal interdependencies. Recommended order:

1. **Changes 2A + 3A** (summary API additions) — one file, enables both features
2. **Change 1** (live mode for monitor) — standalone
3. **Changes 2B + 3B + 9** (monitor UI) — depends on 2A/3A
4. **Change 4** (checkpoint difficulty) — new API + misconceptions page addition, standalone
5. **Changes 5** (confidence checks in replay) — standalone
6. **Change 6** (teaching brief redesign) — report-generator.ts + report page UI, standalone
7. **Change 7** (count labeling) — small text changes, standalone
8. **Change 8** (topic mastery in expanded detail) — API + monitor, standalone
9. **Change 10** (tab labels) — small text change, do last

## Testing notes

- **Live mode polling**: Verify that the 15-second interval in Learner Progress fires correctly and doesn't cause state flicker. The fetch should not reset `isLoading` to true on polling — only on initial load. Use a separate `isPolling` state if needed to avoid showing the loading skeleton on refresh.
- **Engagement flag accuracy**: The `latestFlaggedMessage` logic looks at the most recent student message with a non-`on_task` flag. If the student's LAST message was flagged but the one before it was on_task, the banner still shows concern. This is intentional — the instructor should know about the most recent signal.
- **Checkpoint difficulty**: The `difficultySignal` thresholds (70% mastered = easy, 50% struggling = hard) are starting heuristics. They may need tuning based on real usage.
- **Report prompt change**: The new `REPORT_SYSTEM_PROMPT` changes the structure of the AI-generated report. Existing cached reports (in the `Report` table) will still have the old format. The 5-minute cache check in `report/route.ts` means the new format will appear on the next refresh after the cache expires. No migration needed.
- **Backwards compatibility**: No schema changes. All new fields in API responses are additive. Existing clients that don't read the new fields will continue working.
