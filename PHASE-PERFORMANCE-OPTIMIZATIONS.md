# PHASE-PERFORMANCE-OPTIMIZATIONS — App Speed and Responsiveness Improvements

## Overview

Eight issues are causing measurable latency and UI lag. They are ordered by impact. Fix them in order.

---

## Files to Change

- `src/app/api/chat/route.ts` — decouple diagnostic from stream, parallelize DB reads
- `prisma/schema.prisma` — add missing indexes on hot-path foreign keys
- `src/lib/db.ts` — add index creation to bootstrap SQL and schema upgrade function
- `src/components/chat/message-bubble.tsx` — memoize component and stripTags
- `src/components/chat/chat-area.tsx` — fix scroll thrashing during streaming
- `src/app/api/sessions/[sessionId]/students/summary/route.ts` — new lightweight endpoint
- `src/app/api/sessions/[sessionId]/students/route.ts` — add optional filter param
- `src/app/instructor/[sessionId]/monitor/page.tsx` — lazy-load student details
- `src/app/instructor/[sessionId]/page.tsx` — use summary endpoint for learner count

---

## Issue 1 (CRITICAL) — Diagnostic pipeline blocks the stream, adding 2–5 seconds per message

### The Problem

In `src/app/api/chat/route.ts`, the diagnostic Haiku call runs inside the `ReadableStream.start()` callback. The stream does not close until the diagnostic completes:

```typescript
await diagnosticPromise;  // waits 2-5 seconds for Haiku
controller.close();        // stream only closes AFTER diagnostic finishes
```

The client reads the stream in a `reader.read()` loop. It sees `done = true` only when the stream closes. So `isLoading` stays `true` and the text input stays disabled for 2–5 extra seconds after the tutor's last word appears. The student sees the response but cannot type.

### Why the naive fix is wrong

Simply swapping `controller.close()` and `await diagnosticPromise` is UNSAFE on Vercel. Once the stream closes, Vercel may terminate the serverless function. The diagnostic Haiku call would be killed mid-flight, and misconceptions would silently never get logged.

### Correct Fix — Use Next.js `after()` API

This app runs Next.js 16, which supports the `after()` API. `after()` tells the runtime: "run this code after the response completes, and keep the function alive for it."

**Step 1:** Add the import at the top of `src/app/api/chat/route.ts`:

```typescript
import { after } from "next/server";
```

**Step 2:** Remove the diagnostic promise and its await from inside the `start()` callback. Currently the code looks like this (starting around line 310):

```typescript
          const diagnosticInput = {
            studentSessionId,
            sessionId: studentSession.session.id,
            studentMessage: lastUserMessage.content,
            assistantMessage: cleanedText,
            topicThread: normalizedTopicThread,
            exchangeIndex: exchangeCount + 1,
            readingContent: studentSession.session.readings
              .map((reading) => reading.content)
              .join("\n\n"),
            checkpoints: checkpoints.map((checkpoint) => ({
              id: checkpoint.id,
              prompt: checkpoint.prompt,
              processLevel: checkpoint.processLevel,
              passageAnchors: checkpoint.passageAnchors,
            })),
            unresolvedMisconceptionIds: unresolvedMisconceptions.map(
              (misconception) => misconception.id
            ),
            conversationHistory: incomingMessages.map((message) => ({
              role: message.role as "user" | "assistant",
              content: message.content,
            })),
          };

          const diagnosticPromise = runDiagnostic(diagnosticInput).catch(
            (err) => {
              console.error("Background diagnostic failed:", err);
            }
          );
```

And near the end of `start()`:

```typescript
          await diagnosticPromise;
          controller.close();
```

**Replace with:** Remove the `diagnosticPromise` variable and its `await`. Instead, capture the diagnostic input in a variable accessible outside the stream callback, and schedule the diagnostic with `after()`.

Declare a variable BEFORE the `new ReadableStream(...)` call:

```typescript
    let capturedDiagnosticInput: Parameters<typeof runDiagnostic>[0] | null = null;
```

Inside the `start()` callback, KEEP the `diagnosticInput` object construction but instead of creating the promise, just capture it:

```typescript
          capturedDiagnosticInput = diagnosticInput;
```

Remove the `await diagnosticPromise;` line. The `controller.close()` now runs immediately after the DB writes.

Then, AFTER the `new ReadableStream(...)` constructor but BEFORE the `return new Response(stream, ...)` line, add:

```typescript
    after(async () => {
      if (capturedDiagnosticInput) {
        try {
          await runDiagnostic(capturedDiagnosticInput);
        } catch (err) {
          console.error("Background diagnostic failed:", err);
        }
      }
    });
```

### Why `after()` and not just moving `controller.close()`

The `after()` callback is guaranteed by the runtime to execute even after the response is sent. Moving `controller.close()` before `await diagnosticPromise` would work on local dev but could silently fail on Vercel serverless because the function may be recycled after the response completes.

### Timing concern with `capturedDiagnosticInput`

The `after()` callback runs after the response is fully sent (i.e., after `controller.close()`). By that point, the `start()` callback has set `capturedDiagnosticInput`. There is no race condition — `after()` fires after the stream finishes, and the stream finishes after the `start()` callback sets the variable.

---

## Issue 2 (HIGH) — Missing database indexes on hot-path tables

### The Problem

Every chat request queries `Message`, `Misconception`, and `ConfidenceCheck` by `studentSessionId`. The Activity Monitor queries `StudentSession` by `sessionId`. None of these tables have an index on their foreign key columns.

Tables with explicit `@@index` directives: `Checkpoint`, `StudentCheckpoint`, `LOAssessment`, `DiagnosticLog`, `MisconceptionOverride`, `TeachingRecommendation`.

Tables **missing** indexes on foreign keys:

| Table | Column | Queried on |
|---|---|---|
| `Message` | `studentSessionId` | Every chat request, monitor page |
| `Misconception` | `studentSessionId` | Every chat request, dashboard |
| `ConfidenceCheck` | `studentSessionId` | Every chat request |
| `StudentSession` | `sessionId` | Monitor page, dashboard, session setup |
| `Reading` | `sessionId` | Every chat request (system prompt build) |
| `Assessment` | `sessionId` | Every chat request (system prompt build) |

With SQLite (Turso), foreign keys do NOT create automatic indexes. Every query on these columns does a full table scan. As the app accumulates sessions and messages, this gets linearly slower.

### Fix — Part A: Add indexes to `prisma/schema.prisma`

**In the `Message` model, add before the closing `}`:**

```prisma
  @@index([studentSessionId])
```

**In the `Misconception` model, add before the closing `}`:**

```prisma
  @@index([studentSessionId])
```

**In the `ConfidenceCheck` model, add before the closing `}`:**

```prisma
  @@index([studentSessionId])
```

**In the `StudentSession` model, add before the closing `}`:**

```prisma
  @@index([sessionId])
```

**In the `Reading` model, add before the closing `}`:**

```prisma
  @@index([sessionId])
```

**In the `Assessment` model, add before the closing `}`:**

```prisma
  @@index([sessionId])
```

### Fix — Part B: Add index creation to the Turso bootstrap SQL

In `src/lib/db.ts`, add these lines to the END of the `TURSO_BOOTSTRAP_SQL` string (after the existing `CREATE INDEX IF NOT EXISTS` statements):

```sql
CREATE INDEX IF NOT EXISTS "Message_studentSessionId_idx" ON "Message"("studentSessionId");
CREATE INDEX IF NOT EXISTS "Misconception_studentSessionId_idx" ON "Misconception"("studentSessionId");
CREATE INDEX IF NOT EXISTS "ConfidenceCheck_studentSessionId_idx" ON "ConfidenceCheck"("studentSessionId");
CREATE INDEX IF NOT EXISTS "StudentSession_sessionId_idx" ON "StudentSession"("sessionId");
CREATE INDEX IF NOT EXISTS "Reading_sessionId_idx" ON "Reading"("sessionId");
CREATE INDEX IF NOT EXISTS "Assessment_sessionId_idx" ON "Assessment"("sessionId");
```

These use `IF NOT EXISTS` so they are safe to run on every cold start. They will create the indexes on the first run and no-op thereafter.

---

## Issue 3 (HIGH) — Chat route runs six sequential database reads before streaming

### The Problem

The chat route runs these reads in strict sequence:

```
studentSession         → ~40ms (Turso round trip)
checkpoints            → ~40ms
studentCheckpoints     → ~40ms
dbMessages             → ~40ms
unresolvedMisconceptions → ~40ms
topicMastery           → ~40ms
confidenceCheck        → ~40ms
```

Total: ~280ms of sequential network I/O before Claude even starts streaming. Reads 2–4 can run in parallel once `studentSession` resolves. Reads 5–7 depend on `currentTopicThread` (derived from `dbMessages`) but are independent of each other.

### Fix

Restructure the reads in `src/app/api/chat/route.ts` into three stages:

**Stage 1:** Get `studentSession` (everything else depends on `session.id`):

```typescript
    const studentSession = await prisma.studentSession.findUnique({
      where: { id: studentSessionId },
      include: {
        session: {
          include: {
            readings: true,
            assessments: true,
          },
        },
      },
    });
```

Keep the null checks and session-closed check immediately after this, unchanged.

**Stage 2:** Parallelize three reads that only need `studentSession.session.id`:

```typescript
    const [checkpoints, studentCheckpoints, dbMessages] = await Promise.all([
      prisma.checkpoint.findMany({
        where: { sessionId: studentSession.session.id },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.studentCheckpoint.findMany({
        where: { studentSessionId },
      }),
      prisma.message.findMany({
        where: { studentSessionId },
        orderBy: { createdAt: "asc" },
      }),
    ]);
```

**Stage 3:** Derive `currentTopicThread` from `dbMessages` (keep this code unchanged), then parallelize the three reads that depend on it:

```typescript
    const [unresolvedMisconceptions, topicMastery, unresolvedConfidenceProbe] =
      await Promise.all([
        currentTopicThread
          ? prisma.misconception.findMany({
              where: {
                studentSessionId,
                topicThread: currentTopicThread,
                resolved: false,
              },
              orderBy: { detectedAt: "asc" },
            })
          : Promise.resolve([]),
        currentTopicThread
          ? prisma.topicMastery.findUnique({
              where: {
                studentSessionId_topicThread: {
                  studentSessionId,
                  topicThread: currentTopicThread,
                },
              },
            })
          : Promise.resolve(null),
        prisma.confidenceCheck.findFirst({
          where: {
            studentSessionId,
            probeAsked: true,
            probeResult: null,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
```

Remove the existing individual `await` calls for these three queries.

This reduces 7 sequential round trips to 3 parallel batches: roughly 280ms → 120ms.

---

## Issue 4 (MEDIUM) — React re-renders every streaming chunk, running stripTags 100+ times per response

### The Problem

During streaming, every chunk calls `setMessages(...)` which triggers a full React re-render. `ChatArea` maps over ALL messages, rendering each `MessageBubble`. `MessageBubble` calls `stripTags(content)` — 20+ regex operations — for every message on every render, including messages that haven't changed.

### Fix — Part A: Memoize MessageBubble

In `src/components/chat/message-bubble.tsx`, wrap the component with `React.memo` and memoize the expensive computation:

**Find the imports:**

```typescript
import ReactMarkdown from "react-markdown";
import { stripTags } from "@/lib/strip-tags";
```

**Replace with:**

```typescript
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { stripTags } from "@/lib/strip-tags";
```

**Find:**

```typescript
export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  const displayContent = stripTags(content);
```

**Replace with:**

```typescript
export const MessageBubble = memo(function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  const displayContent = useMemo(() => stripTags(content), [content]);
```

**Find the closing brace of the component (the last `}`):**

```typescript
}
```

If it currently ends with just `}`, change it to `});` to close the `memo()` call. The component function body stays unchanged — only the wrapping changes.

`React.memo` does a shallow comparison of props. Since `role` and `content` are both strings, this correctly skips re-renders for messages whose content hasn't changed (i.e., every message except the one currently streaming).

---

## Issue 5 (MEDIUM) — Auto-scroll fires on every streaming chunk, causing scroll thrash

### The Problem

`src/components/chat/chat-area.tsx` has:

```typescript
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
```

`messages` changes ~100+ times during a single streaming response. Each change triggers `scrollIntoView({ behavior: "smooth" })`, which starts a CSS animation that immediately gets interrupted by the next one. The result is jittery, stuttering scroll.

### Fix

**Find the existing scroll effect:**

```typescript
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
```

**Replace with:**

```typescript
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(messages.length);

  useEffect(() => {
    const isNewMessage = messages.length !== messageCountRef.current;
    messageCountRef.current = messages.length;

    // Smooth scroll when a new message bubble appears.
    // Instant scroll when the streaming message grows (no animation thrashing).
    endOfMessagesRef.current?.scrollIntoView({
      behavior: isNewMessage ? "smooth" : "instant",
    });
  }, [messages, isLoading]);
```

Add `useRef` to the existing import if not already there.

---

## Issue 6 (MEDIUM) — Activity Monitor fetches full message content for all students on page load

### The Problem

`src/app/instructor/[sessionId]/monitor/page.tsx` calls `/api/sessions/${sessionId}/students` on mount. That route returns every message's full `content` for every student. The table only needs exchange counts and misconception counts — message text is only used when an instructor expands a trace.

With 20 students × 40 messages × average 300-word responses, this is transmitting and parsing roughly 240,000 words of JSON on every page load.

### Fix — Part A: Create a lightweight summary endpoint

Create `src/app/api/sessions/[sessionId]/students/summary/route.ts`:

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

    const studentSessions = await prisma.studentSession.findMany({
      where: { sessionId },
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
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(
      studentSessions.map((s) => ({
        id: s.id,
        studentName: s.studentName,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        messageCount: s._count.messages,
        misconceptionCount: s._count.misconceptions,
        lastActiveAt: s.messages[0]?.createdAt ?? s.startedAt,
      }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch student summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch student summary", details: message },
      { status: 500 }
    );
  }
}
```

Note: this calls `ensureDatabaseReady()`. The existing `students/route.ts` does NOT call it — that is a bug. Add `ensureDatabaseReady()` to the existing `students/route.ts` as well while you are here.

### Fix — Part B: Add `studentSessionId` filter to the existing students route

In `src/app/api/sessions/[sessionId]/students/route.ts`, add URL param parsing and filtering so the monitor page can request data for a single student when expanding:

**Find:**

```typescript
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const p = await params;
    const { sessionId } = p;

    const studentSessions = await prisma.studentSession.findMany({
      where: { sessionId },
```

**Replace with:**

```typescript
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await ensureDatabaseReady();
    const p = await params;
    const { sessionId } = p;

    const url = new URL(req.url);
    const studentSessionIdFilter = url.searchParams.get("studentSessionId");

    const studentSessions = await prisma.studentSession.findMany({
      where: {
        sessionId,
        ...(studentSessionIdFilter ? { id: studentSessionIdFilter } : {}),
      },
```

Also add `ensureDatabaseReady` to the import:

```typescript
import { ensureDatabaseReady, prisma } from "@/lib/db";
```

### Fix — Part C: Update the monitor page to lazy-load trace details

In `src/app/instructor/[sessionId]/monitor/page.tsx`:

1. Change the initial fetch to use the summary endpoint
2. Fetch full data for a single student only when expanding their trace

Update the `StudentSessionData` interface to distinguish between summary and detail:

```typescript
interface StudentSummary {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messageCount: number;
  misconceptionCount: number;
  lastActiveAt: string | Date;
}

interface StudentSessionData {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messages: Array<Message & { createdAt: string | Date; hidden?: boolean }>;
  misconceptions: Misconception[];
  confidenceChecks: ConfidenceCheck[];
}
```

Add new state:

```typescript
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [expandedDetail, setExpandedDetail] = useState<StudentSessionData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
```

Change the initial `fetchData` to use the summary endpoint:

```typescript
    async function fetchData() {
      try {
        const res = await fetch(`/api/sessions/${params.sessionId}/students/summary`);
        const data = await res.json();
        if (Array.isArray(data)) setStudents(data);
      } catch (err) {
        console.error("Failed to fetch student data:", err);
      } finally {
        setIsLoading(false);
      }
    }
```

Change `toggleStudent` to fetch detail on expand:

```typescript
  const toggleStudent = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(
        `/api/sessions/${params.sessionId}/students?studentSessionId=${id}`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setExpandedDetail(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch student detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };
```

Update the table to use summary data for the table rows:

- Exchange count: `Math.floor(student.messageCount / 2)` instead of `Math.floor(student.messages.length / 2)`
- Misconception count: `student.misconceptionCount` instead of `student.misconceptions.length`
- Last active: `student.lastActiveAt` instead of computing from messages array

Update the expanded trace section to show a loading state:

```tsx
{isExpanded && (
  <tr>
    <td colSpan={5} className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 p-0">
      <div className="p-8 border-l-2 border-indigo-500 ml-6 my-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm max-w-4xl">
        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Interaction Trace</h4>
        {loadingDetail ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            Loading trace...
          </div>
        ) : expandedDetail ? (
          <ExchangeReplay messages={expandedDetail.messages} misconceptions={expandedDetail.misconceptions} />
        ) : (
          <p className="text-slate-500 text-sm">Failed to load trace.</p>
        )}
      </div>
    </td>
  </tr>
)}
```

### UX tradeoff note

This changes expansion from instant (data pre-loaded) to lazy (short spinner on expand). For a class of 20+ students, the faster initial page load is worth this tradeoff. For 2–3 students, the difference is negligible either way.

---

## Issue 7 (LOW) — Instructor session page fetches full student data just to count learners

### The Problem

In `src/app/instructor/[sessionId]/page.tsx`, `fetchLearnerCount` calls the full `/students` endpoint (all messages, all misconceptions) just to get `data.length`.

### Fix

After implementing Issue 6 (summary endpoint), change `fetchLearnerCount`:

**Find:**

```typescript
  const fetchLearnerCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/students`);
```

**Replace with:**

```typescript
  const fetchLearnerCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/students/summary`);
```

The rest stays the same — it just uses `data.length`.

---

## Issue 8 (LOW) — Cold start schema check runs 15+ individual queries

### The Problem

`ensureTursoSchemaUpgrades()` in `src/lib/db.ts` calls `addColumnIfMissing()` 15+ times. Each call runs `PRAGMA table_info("TableName")` — a separate Turso round trip — then conditionally runs an `ALTER TABLE`. On a cold start, this adds ~600ms.

### Fix

Batch the `PRAGMA` queries per table. Replace `ensureTursoSchemaUpgrades` with:

```typescript
async function ensureTursoSchemaUpgrades(client: LibsqlClient) {
  // Batch-check columns per table instead of 15+ individual queries
  const [misconceptionCols, messageCols, sessionCols] = await Promise.all([
    getExistingColumns(client, "Misconception"),
    getExistingColumns(client, "Message"),
    getExistingColumns(client, "Session"),
  ]);

  const alters: string[] = [];

  // Session columns
  if (!sessionCols.has("learningOutcomes")) alters.push('ALTER TABLE "Session" ADD COLUMN "learningOutcomes" TEXT');
  if (!sessionCols.has("stance")) alters.push(`ALTER TABLE "Session" ADD COLUMN "stance" TEXT NOT NULL DEFAULT 'directed'`);

  // Misconception columns
  const misconceptionNewCols: Array<[string, string]> = [
    ["canonicalClaim", "TEXT"],
    ["passageAnchor", "TEXT"],
    ["misconceptionType", "TEXT"],
    ["severity", "TEXT NOT NULL DEFAULT 'medium'"],
    ["confidence", "TEXT NOT NULL DEFAULT 'medium'"],
    ["updatedAt", "DATETIME"],
    ["detectedAtTurn", "INTEGER"],
    ["resolvedAtTurn", "INTEGER"],
    ["resolutionConfidence", "TEXT"],
    ["resolutionEvidence", "TEXT"],
  ];
  for (const [col, def] of misconceptionNewCols) {
    if (!misconceptionCols.has(col)) alters.push(`ALTER TABLE "Misconception" ADD COLUMN "${col}" ${def}`);
  }

  // Message columns
  if (!messageCols.has("engagementFlag")) alters.push('ALTER TABLE "Message" ADD COLUMN "engagementFlag" TEXT');
  if (!messageCols.has("engagementNote")) alters.push('ALTER TABLE "Message" ADD COLUMN "engagementNote" TEXT');

  // Run all ALTER TABLEs
  if (alters.length > 0) {
    // SQLite does not support multiple ALTER TABLE statements in a single executeMultiple
    // because each ALTER TABLE must be its own statement, but executeMultiple can handle that.
    await client.executeMultiple(alters.join(";\n") + ";");
  }

  await client.execute(
    `UPDATE "Misconception" SET "updatedAt" = COALESCE("updatedAt", "detectedAt", CURRENT_TIMESTAMP)`
  );
}
```

This reduces 15+ round trips to 3 (the PRAGMA queries) plus at most 1 (the batched ALTERs).

---

## Expected Impact After All Fixes

| Fix | What changes |
|---|---|
| Issue 1 | Input re-enables 2–5 seconds sooner after each tutor response |
| Issue 2 | Every DB query on hot-path tables is indexed. Prevents linear slowdown as data grows |
| Issue 3 | Chat responses begin streaming ~160ms sooner (7 serial reads → 3 parallel batches) |
| Issue 4 | No more CPU spikes during streaming. Only the active message re-renders |
| Issue 5 | Smooth, non-jittery auto-scroll during streaming |
| Issue 6 | Activity Monitor loads in <500ms instead of fetching megabytes of message text |
| Issue 7 | Session setup page loads faster |
| Issue 8 | Cold start latency reduced by ~400ms |

---

## Verification Checklist

- [ ] **Issue 1:** Send a message. Confirm the text input re-enables immediately when the tutor finishes responding — no 2–5 second dead zone. Then check Vercel function logs: confirm `runDiagnostic` still completes (diagnostic log records appear in DB after the exchange)
- [ ] **Issue 2:** Run `npx prisma db push` locally to verify the schema is valid. Check that the Turso bootstrap SQL includes the new `CREATE INDEX IF NOT EXISTS` statements. Start a fresh session and verify chat still works (indexes don't break queries, they only speed them up)
- [ ] **Issue 3:** Verify the chat route still works correctly — all metadata (topic threads, attempt counts, misconceptions, confidence checks) still populate correctly
- [ ] **Issue 4:** Open DevTools Performance tab. Record during a streaming response. Confirm the flame chart shows fewer re-renders per second
- [ ] **Issue 5:** Watch auto-scroll during a long tutor response. It should flow smoothly without stuttering
- [ ] **Issue 6:** Open the Activity Monitor. Confirm the table loads quickly. Expand a student — confirm the trace loads after a brief spinner and renders correctly
- [ ] **Issue 7:** Open the session setup page. Confirm the learner count still displays correctly
- [ ] **Issue 8:** Deploy to Vercel. Check Vercel function logs on first cold-start request. Confirm the schema bootstrap runs with fewer queries
- [ ] **TypeScript builds cleanly:** `npm run build` completes with no errors
