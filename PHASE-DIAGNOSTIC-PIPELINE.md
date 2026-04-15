# PHASE-DIAGNOSTIC-PIPELINE — Separate Misconception Detection from Tutoring

## Context and Rationale

The current misconception detection and resolution tracking system works entirely inside the chat pipeline. After the tutor finishes streaming a response, the server parses internal tags (`[MISCONCEPTION: ...]`, `[MISCONCEPTION_RESOLVED: true]`, etc.) from the tutor's raw output. When those tags are missing, a fallback heuristic in `shouldFallbackLogMisconception()` tries to infer misconceptions from the tutor's surface language ("not quite," "the text states the opposite," etc.).

This architecture has a structural weakness: it asks the same model, in the same inference call, to both tutor well and diagnose accurately. Tag emission is unreliable not because the prompt is wrong, but because the model is doing too many things at once. The fallback heuristic measures how the tutor talks, not what the student misunderstands. Resolution tracking is self-reported — the tutor says `[MISCONCEPTION_RESOLVED: true]` without independent verification.

This refactor separates the diagnostic function into a dedicated, second model call (Claude Haiku) that runs after each exchange. The tutor focuses only on tutoring. A separate diagnostic model — receiving the full conversation, the reading, and the checkpoints — handles misconception detection, classification, resolution judgment, and engagement assessment. This is cheaper (~fractions of a cent per turn via Haiku), more reliable, and produces richer data.

---

## Architectural Overview

**Before (current):**
```
Student message → Tutor (Sonnet) streams response with inline tags → Parse tags → Store misconceptions
```

**After (new):**
```
Student message → Tutor (Sonnet) streams response (NO misconception tags required) → Store message →
                  Diagnostic model (Haiku) analyzes exchange → Store/update misconceptions, resolution, engagement
```

The tutor's system prompt is simplified: it no longer needs to emit `[MISCONCEPTION: ...]`, `[MISCONCEPTION_CANONICAL: ...]`, `[MISCONCEPTION_PASSAGE: ...]`, `[MISCONCEPTION_TYPE: ...]`, `[MISCONCEPTION_SEVERITY: ...]`, or `[MISCONCEPTION_RESOLVED: true]` tags. It keeps all other tags (`[MODE: ...]`, `[TOPIC_THREAD: ...]`, `[QTYPE: ...]`, `[FEEDBACK_TYPE: ...]`, `[CHECKPOINT_ID: ...]`, `[CHECKPOINT_STATUS: ...]`, etc.) which are still needed for conversation management.

The diagnostic call is fire-and-forget — it runs after the response is streamed to the student, so it adds zero latency to the chat experience.

---

## Files to Change

- `src/lib/diagnostic.ts` — **NEW FILE.** The diagnostic model call and response parser.
- `src/app/api/chat/route.ts` — Remove fallback heuristic functions. Remove misconception tag parsing. Add diagnostic call after streaming. Simplify post-streaming logic.
- `src/lib/system-prompt.ts` — Remove misconception tag emission instructions from the tutor's system prompt.
- `src/lib/attempt-tracker.ts` — Remove `MISCONCEPTION_RESOLVED` from `parseTags()` (it moves to the diagnostic model).
- `prisma/schema.prisma` — Add `confidence` and `engagementFlag` fields to `Misconception` model. Add `DiagnosticLog` model for audit trail.
- `src/app/api/sessions/[sessionId]/misconceptions/aggregate/route.ts` — Update resolution rate to be learner-based. Update median-turns-to-resolve to use diagnostic turn tracking.

---

## Change 1 — New file: `src/lib/diagnostic.ts`

Create this file. It contains the diagnostic model call, the structured prompt, and the response parser.

```typescript
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";

// ── Types ──

interface DiagnosticInput {
  studentSessionId: string;
  sessionId: string;
  studentMessage: string;
  assistantMessage: string;
  topicThread: string | null;
  exchangeIndex: number;
  readingContent: string;
  checkpoints: Array<{
    id: string;
    prompt: string;
    processLevel: string;
    passageAnchors: string | null;
  }>;
  unresolvedMisconceptionIds: string[];
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface DetectedMisconception {
  description: string;
  canonicalClaim: string;
  passageAnchor: string | null;
  misconceptionType:
    | "misread"
    | "missing_warrant"
    | "wrong_inference"
    | "overgeneralization"
    | "ignored_counterevidence";
  severity: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
}

interface ResolvedMisconception {
  misconceptionId: string;
  confidence: "high" | "medium" | "low";
  evidenceSummary: string;
}

interface DiagnosticResult {
  newMisconceptions: DetectedMisconception[];
  resolvedMisconceptions: ResolvedMisconception[];
  engagementFlag: "on_task" | "shallow" | "disengaged" | "off_topic" | "hostile";
  engagementNote: string | null;
  diagnosticTurnIndex: number;
}

const VALID_MISCONCEPTION_TYPES = [
  "misread",
  "missing_warrant",
  "wrong_inference",
  "overgeneralization",
  "ignored_counterevidence",
] as const;

const VALID_SEVERITIES = ["low", "medium", "high"] as const;
const VALID_CONFIDENCES = ["high", "medium", "low"] as const;
const VALID_ENGAGEMENT_FLAGS = [
  "on_task",
  "shallow",
  "disengaged",
  "off_topic",
  "hostile",
] as const;

// ── Prompt Builder ──

function buildDiagnosticPrompt(input: DiagnosticInput): string {
  const unresolvedSection =
    input.unresolvedMisconceptionIds.length > 0
      ? `\nCurrently unresolved misconception IDs from prior turns: ${JSON.stringify(input.unresolvedMisconceptionIds)}\nFor each one, judge whether this latest student message provides evidence that the misconception has been corrected. Only mark resolved if the student demonstrates genuine corrected understanding — not just echoing the tutor's words.`
      : "\nNo unresolved misconceptions from prior turns.";

  const checkpointSection =
    input.checkpoints.length > 0
      ? `\nCheckpoints for this session:\n${input.checkpoints.map((cp) => `- [${cp.id}] (${cp.processLevel}): ${cp.prompt}${cp.passageAnchors ? ` [anchors: ${cp.passageAnchors}]` : ""}`).join("\n")}`
      : "";

  return `You are a diagnostic analyzer for a Socratic reading tutor. Your job is to analyze a single exchange (student message + tutor response) and produce structured JSON output. You are NOT the tutor. You are a separate analytical system.

## Reading Content (excerpt)
${input.readingContent.slice(0, 6000)}

${checkpointSection}

## Conversation So Far
${input.conversationHistory.slice(-10).map((m) => `${m.role === "user" ? "STUDENT" : "TUTOR"}: ${m.content}`).join("\n\n")}

## Latest Exchange to Analyze
STUDENT: ${input.studentMessage}
TUTOR: ${input.assistantMessage}

## Current Topic Thread
${input.topicThread || "Not yet classified"}
${unresolvedSection}

## Your Task

Analyze the student's message and produce JSON with these fields:

1. **newMisconceptions**: Array of misconceptions the student expressed in THIS message. Only log genuine misunderstandings of the reading content — not off-task remarks, confusion about the tutor's question, or disengagement. Each misconception needs:
   - description: What the student got wrong (1 sentence)
   - canonicalClaim: The student's claim normalized to a clear declarative statement
   - passageAnchor: Which part of the reading this relates to (null if unclear)
   - misconceptionType: One of: misread, missing_warrant, wrong_inference, overgeneralization, ignored_counterevidence
   - severity: low (minor imprecision), medium (substantive misunderstanding), high (fundamental inversion of the text's argument)
   - confidence: How confident YOU are that this is actually a misconception — high (clear misunderstanding), medium (probable but ambiguous), low (possible but uncertain)

2. **resolvedMisconceptions**: Array of previously unresolved misconceptions that the student has now corrected. Each needs:
   - misconceptionId: The ID from the unresolved list above
   - confidence: How confident you are the student genuinely understands now (not just parroting)
   - evidenceSummary: Brief explanation of what the student said that demonstrates corrected understanding

3. **engagementFlag**: One of:
   - "on_task" — student is genuinely engaging with the reading and the tutor's questions
   - "shallow" — student is responding but with minimal effort (very short answers, no reasoning shown)
   - "disengaged" — student is not trying ("I don't know" repeatedly, "whatever", "just tell me")
   - "off_topic" — student is talking about something unrelated to the reading
   - "hostile" — student is being adversarial toward the tutor

4. **engagementNote**: If engagementFlag is NOT "on_task", a brief note explaining why. Null if on_task.

Return ONLY valid JSON. No markdown fences. No explanation outside the JSON.

{
  "newMisconceptions": [],
  "resolvedMisconceptions": [],
  "engagementFlag": "on_task",
  "engagementNote": null
}`;
}

// ── Response Parser ──

function parseDiagnosticResponse(raw: string): DiagnosticResult | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(cleaned);

    const newMisconceptions: DetectedMisconception[] = (
      parsed.newMisconceptions ?? []
    )
      .filter(
        (m: Record<string, unknown>) =>
          typeof m.description === "string" &&
          typeof m.canonicalClaim === "string" &&
          m.description.length > 0
      )
      .map((m: Record<string, unknown>) => ({
        description: String(m.description).slice(0, 500),
        canonicalClaim: String(m.canonicalClaim).slice(0, 280),
        passageAnchor:
          typeof m.passageAnchor === "string" ? m.passageAnchor : null,
        misconceptionType: VALID_MISCONCEPTION_TYPES.includes(
          m.misconceptionType as (typeof VALID_MISCONCEPTION_TYPES)[number]
        )
          ? (m.misconceptionType as DetectedMisconception["misconceptionType"])
          : "wrong_inference",
        severity: VALID_SEVERITIES.includes(
          m.severity as (typeof VALID_SEVERITIES)[number]
        )
          ? (m.severity as DetectedMisconception["severity"])
          : "medium",
        confidence: VALID_CONFIDENCES.includes(
          m.confidence as (typeof VALID_CONFIDENCES)[number]
        )
          ? (m.confidence as DetectedMisconception["confidence"])
          : "medium",
      }));

    const resolvedMisconceptions: ResolvedMisconception[] = (
      parsed.resolvedMisconceptions ?? []
    )
      .filter(
        (r: Record<string, unknown>) =>
          typeof r.misconceptionId === "string" && r.misconceptionId.length > 0
      )
      .map((r: Record<string, unknown>) => ({
        misconceptionId: String(r.misconceptionId),
        confidence: VALID_CONFIDENCES.includes(
          r.confidence as (typeof VALID_CONFIDENCES)[number]
        )
          ? (r.confidence as ResolvedMisconception["confidence"])
          : "medium",
        evidenceSummary:
          typeof r.evidenceSummary === "string"
            ? r.evidenceSummary.slice(0, 500)
            : "",
      }));

    const engagementFlag = VALID_ENGAGEMENT_FLAGS.includes(
      parsed.engagementFlag as (typeof VALID_ENGAGEMENT_FLAGS)[number]
    )
      ? (parsed.engagementFlag as DiagnosticResult["engagementFlag"])
      : "on_task";

    const engagementNote =
      typeof parsed.engagementNote === "string"
        ? parsed.engagementNote.slice(0, 300)
        : null;

    return {
      newMisconceptions,
      resolvedMisconceptions,
      engagementFlag,
      engagementNote,
      diagnosticTurnIndex: 0, // Set by caller
    };
  } catch (error) {
    console.error("Failed to parse diagnostic response:", error);
    return null;
  }
}

// ── Main Function ──

export async function runDiagnostic(input: DiagnosticInput): Promise<void> {
  try {
    const prompt = buildDiagnosticPrompt(input);

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("Diagnostic model returned no text content");
      return;
    }

    const result = parseDiagnosticResponse(textBlock.text);
    if (!result) return;

    result.diagnosticTurnIndex = input.exchangeIndex;

    // ── Store new misconceptions ──
    for (const misconception of result.newMisconceptions) {
      await prisma.misconception.create({
        data: {
          studentSessionId: input.studentSessionId,
          topicThread: input.topicThread || "general",
          description: misconception.description,
          canonicalClaim: misconception.canonicalClaim,
          passageAnchor: misconception.passageAnchor,
          misconceptionType: misconception.misconceptionType,
          severity: misconception.severity,
          confidence: misconception.confidence,
          studentMessage: input.studentMessage.slice(0, 1000),
          resolved: false,
          persistentlyUnresolved: false,
          detectedAtTurn: input.exchangeIndex,
        },
      });
    }

    // ── Resolve misconceptions ──
    for (const resolved of result.resolvedMisconceptions) {
      // Only resolve if the ID is in the unresolved list (prevent hallucinated IDs)
      if (input.unresolvedMisconceptionIds.includes(resolved.misconceptionId)) {
        await prisma.misconception.update({
          where: { id: resolved.misconceptionId },
          data: {
            resolved: true,
            resolutionConfidence: resolved.confidence,
            resolutionEvidence: resolved.evidenceSummary,
            resolvedAtTurn: input.exchangeIndex,
          },
        });
      }
    }

    // ── Store engagement flag on the user message ──
    // Update the most recent user message for this student session
    const latestUserMessage = await prisma.message.findFirst({
      where: {
        studentSessionId: input.studentSessionId,
        role: "user",
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestUserMessage) {
      await prisma.message.update({
        where: { id: latestUserMessage.id },
        data: {
          engagementFlag: result.engagementFlag,
          engagementNote: result.engagementNote,
        },
      });
    }

    // ── Store diagnostic log for auditing ──
    await prisma.diagnosticLog.create({
      data: {
        studentSessionId: input.studentSessionId,
        turnIndex: input.exchangeIndex,
        rawResponse: textBlock.text.slice(0, 3000),
        misconceptionsDetected: result.newMisconceptions.length,
        misconceptionsResolved: result.resolvedMisconceptions.length,
        engagementFlag: result.engagementFlag,
      },
    });
  } catch (error) {
    // Diagnostic failures should NEVER break the chat pipeline.
    // Log and move on — the student's experience is unaffected.
    console.error("Diagnostic pipeline error:", error);
  }
}
```

---

## Change 2 — Schema updates: `prisma/schema.prisma`

### 2A — Update the `Misconception` model

Add these new fields to the existing `Misconception` model. Do NOT remove any existing fields — this must be backwards compatible.

```prisma
model Misconception {
  // ... all existing fields remain ...

  // NEW: Diagnostic confidence — how confident the analyzer was that this is a real misconception
  confidence          String    @default("medium")  // "high" | "medium" | "low"

  // NEW: Turn-based tracking (replaces timestamp-based estimation)
  detectedAtTurn      Int?      // Exchange index when detected
  resolvedAtTurn      Int?      // Exchange index when resolved

  // NEW: Resolution quality
  resolutionConfidence String?  // "high" | "medium" | "low" — was resolution genuine?
  resolutionEvidence   String?  // Brief explanation of what evidence the student showed
}
```

### 2B — Add engagement fields to the `Message` model

Add these fields to the existing `Message` model:

```prisma
model Message {
  // ... all existing fields remain ...

  // NEW: Engagement assessment from diagnostic model
  engagementFlag  String?  // "on_task" | "shallow" | "disengaged" | "off_topic" | "hostile"
  engagementNote  String?  // Explanation when not on_task
}
```

### 2C — Add `DiagnosticLog` model

Add this new model for auditing diagnostic calls:

```prisma
model DiagnosticLog {
  id                    String         @id @default(cuid())
  studentSessionId      String
  studentSession        StudentSession @relation(fields: [studentSessionId], references: [id], onDelete: Cascade)
  turnIndex             Int
  rawResponse           String
  misconceptionsDetected Int
  misconceptionsResolved Int
  engagementFlag        String
  createdAt             DateTime       @default(now())

  @@index([studentSessionId])
}
```

Add the relation to `StudentSession`:

```prisma
model StudentSession {
  // ... all existing fields and relations ...
  diagnosticLogs  DiagnosticLog[]
}
```

### 2D — Run migration

```bash
npx prisma migrate dev --name add-diagnostic-pipeline
```

---

## Change 3 — Update `src/app/api/chat/route.ts`

### 3A — Add import

At the top of the file, add:

```typescript
import { runDiagnostic } from "@/lib/diagnostic";
```

### 3B — Remove fallback heuristic functions

Delete these four functions entirely:

- `normalizeFallbackClaim()` (lines ~98–104)
- `isSubstantiveMisunderstanding()` (lines ~106–122)
- `shouldFallbackLogMisconception()` (lines ~124–165)
- `buildFallbackMisconception()` (lines ~167–191)

Also delete `extractStructuredMisconceptions()` (lines ~65–96) — misconception detection is no longer done by parsing tutor output.

Keep `extractTagValues()` — it's still used for checkpoint tags.

### 3C — Remove misconception tag parsing from post-streaming logic

In the section after the tutor finishes streaming (after `const { cleanedText, tags } = parseTags(fullResponse);`), find and remove:

1. The call to `extractStructuredMisconceptions(fullResponse)`
2. Any `for` loop or logic that creates `prisma.misconception.create()` records from structured misconceptions
3. Any `if (shouldFallbackLogMisconception(...))` block and the `buildFallbackMisconception()` call inside it
4. Any `if (tags.misconceptionResolved)` block that runs `prisma.misconception.updateMany()` to set `resolved: true`

These are all replaced by the diagnostic model.

### 3D — Add the diagnostic call after the message is saved

After the assistant message is saved to the database (the `prisma.message.create()` call for the assistant message), add the diagnostic call. This should be fire-and-forget — do NOT await it in the streaming pipeline.

Find the place where the assistant message is created in the database. After that line, add:

```typescript
// Fire-and-forget: run diagnostic analysis on this exchange.
// This adds zero latency to the student's chat experience.
const diagnosticInput = {
  studentSessionId,
  sessionId: studentSession.session.id,
  studentMessage: lastUserMessage.content,
  assistantMessage: cleanedText,
  topicThread: normalizedTopicThread,
  exchangeIndex: exchangeCount + 1,
  readingContent: studentSession.session.readings
    .map((r) => r.content)
    .join("\n\n"),
  checkpoints: checkpoints.map((cp) => ({
    id: cp.id,
    prompt: cp.prompt,
    processLevel: cp.processLevel,
    passageAnchors: cp.passageAnchors,
  })),
  unresolvedMisconceptionIds: unresolvedMisconceptions.map((m) => m.id),
  conversationHistory: incomingMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })),
};

// Do not await — diagnostic runs in the background
runDiagnostic(diagnosticInput).catch((err) =>
  console.error("Background diagnostic failed:", err)
);
```

**Important:** This call must NOT be awaited inside the streaming response. The student sees their response immediately. The diagnostic runs in the background and writes to the database independently.

---

## Change 4 — Simplify the tutor's system prompt: `src/lib/system-prompt.ts`

### 4A — Remove misconception tag emission instructions

In the `STATIC_BASE_PROMPT` constant, find and remove the section that instructs the tutor to emit misconception-related tags. This includes instructions about:

- `[MISCONCEPTION: ...]`
- `[MISCONCEPTION_CANONICAL: ...]`
- `[MISCONCEPTION_PASSAGE: ...]`
- `[MISCONCEPTION_TYPE: ...]`
- `[MISCONCEPTION_SEVERITY: ...]`
- `[MISCONCEPTION_RESOLVED: true]`

Search for these tag names in the system prompt string and remove the paragraphs or rule blocks that instruct the tutor to emit them.

**Keep** the conceptual instructions about how the tutor should handle misconceptions pedagogically (cognitive conflict stages, corrective feedback, etc.). The tutor should still address misconceptions in conversation — it just no longer needs to label them with tags. The diagnostic model handles that.

### 4B — Keep all other tags

The tutor still emits these tags (they are used for conversation management, not diagnostics):

- `[MODE: ...]`
- `[TOPIC_THREAD: ...]`
- `[IS_GENUINE_ATTEMPT: ...]`
- `[QTYPE: ...]`
- `[FEEDBACK_TYPE: ...]`
- `[EXPERT_MODEL: ...]`
- `[SELF_EXPLAIN_PROMPTED: true]`
- `[COGNITIVE_CONFLICT: ...]`
- `[CHECKPOINT_ID: ...]`
- `[CHECKPOINT_STATUS: ...]`
- `[SOFT_REVISIT: true]` / `[IS_REVISIT_PROBE: true]`

Do NOT remove instructions related to these tags.

---

## Change 5 — Update `src/lib/attempt-tracker.ts`

### 5A — Remove `misconceptionResolved` from ParsedTags

In the `ParsedTags` interface, change:

```typescript
misconceptionResolved: boolean;
```

To:

```typescript
misconceptionResolved?: boolean; // DEPRECATED — now handled by diagnostic pipeline
```

### 5B — Remove misconception-related patterns from TAG_PATTERNS

Remove these patterns (the diagnostic model handles them now):

```typescript
misconception: /\[MISCONCEPTION:\s*([\s\S]+?)\]/i,
misconceptionCanonical: /\[MISCONCEPTION_CANONICAL:\s*([\s\S]+?)\]/i,
misconceptionPassage: /\[MISCONCEPTION_PASSAGE:\s*([\s\S]+?)\]/i,
misconceptionType: /\[MISCONCEPTION_TYPE:\s*([\s\S]+?)\]/i,
misconceptionSeverity: /\[MISCONCEPTION_SEVERITY:\s*([\s\S]+?)\]/i,
misconceptionResolved: /\[MISCONCEPTION_RESOLVED:\s*true\]/i,
```

### 5C — Update parseTags()

Remove the lines that parse `misconception`, `misconceptionResolved`, and related tags. Remove the corresponding `.replace()` calls in the `cleanedText` builder for these tags.

### 5D — Keep the interface field

Keep `misconception` and `misconceptionResolved` as optional fields in the `ParsedTags` interface (set to `null` / `false` by default) so that any code that still references them does not break at compile time. Mark them with `// DEPRECATED` comments. They can be fully removed in a future cleanup pass.

---

## Change 6 — Update the dashboard aggregation: `src/app/api/sessions/[sessionId]/misconceptions/aggregate/route.ts`

### 6A — Learner-based resolution rate

The current resolution rate is record-based: `resolvedCount / totalClusterCount`. Change it to be learner-based.

In the `semanticGroups.forEach` loop where clusters are built, replace the resolution rate calculation.

**Find the current calculation (approximately):**

```typescript
const resolutionRate =
  group.misconceptions.length > 0
    ? resolvedCount / group.misconceptions.length
    : 0;
```

**Replace with:**

```typescript
// Learner-based resolution: did each affected student resolve at least one misconception?
const studentResolutionMap = new Map<string, boolean>();
group.misconceptions.forEach((record) => {
  const current = studentResolutionMap.get(record.studentSessionId) ?? false;
  if (record.resolved) {
    studentResolutionMap.set(record.studentSessionId, true);
  } else if (!current) {
    studentResolutionMap.set(record.studentSessionId, false);
  }
});
const studentsWhoResolved = Array.from(studentResolutionMap.values()).filter(Boolean).length;
const resolutionRate =
  studentResolutionMap.size > 0
    ? studentsWhoResolved / studentResolutionMap.size
    : 0;
```

### 6B — Turn-based median resolution time

Replace the timestamp-based turns-to-resolve calculation with the new `detectedAtTurn` and `resolvedAtTurn` fields.

**Find the current `resolutionTurns` calculation (approximately):**

```typescript
const resolutionTurns = group.misconceptions
  .filter((record) => record.resolved)
  .map((record) => {
    const assistantTurns =
      assistantMessagesByStudent.get(record.studentSessionId) ?? [];
    const turnsToResolve = assistantTurns.filter(
      (createdAt) =>
        createdAt > record.detectedAt && createdAt <= record.updatedAt
    ).length;
    return Math.max(turnsToResolve, 1);
  });
```

**Replace with:**

```typescript
const resolutionTurns = group.misconceptions
  .filter((record) => record.resolved && record.resolvedAtTurn != null && record.detectedAtTurn != null)
  .map((record) => Math.max((record.resolvedAtTurn as number) - (record.detectedAtTurn as number), 1));
```

This is simpler and more accurate — it measures actual exchange indices, not timestamp-based estimation.

### 6C — Update the Prisma select to include new fields

In the `prisma.misconception.findMany()` call, add the new fields to the `select`:

```typescript
select: {
  // ... existing fields ...
  confidence: true,
  detectedAtTurn: true,
  resolvedAtTurn: true,
  resolutionConfidence: true,
  resolutionEvidence: true,
},
```

### 6D — Add engagement summary to session stats

After computing `sessionStats`, add an engagement summary. Query the engagement flags:

```typescript
const engagementCounts = await prisma.message.groupBy({
  by: ["engagementFlag"],
  where: {
    studentSession: { sessionId },
    role: "user",
    engagementFlag: { not: null },
  },
  _count: true,
});

const engagementSummary = Object.fromEntries(
  engagementCounts.map((row) => [row.engagementFlag, row._count])
);
```

Add `engagementSummary` to the response JSON alongside `clusters`, `overrides`, and `sessionStats`.

### 6E — Remove the `assistantMessages` query

Since we no longer need timestamp-based turn estimation, the entire `assistantMessages` query and `assistantMessagesByStudent` map can be removed. This simplifies the aggregation and removes one database query.

---

## Change 7 — Update types: `src/types/index.ts` (or wherever types are defined)

Add the new fields to the cluster type:

```typescript
// In MisconceptionClusterRecord or equivalent
resolutionConfidence?: "high" | "medium" | "low";
detectionConfidence?: "high" | "medium" | "low";
```

Add the engagement summary type:

```typescript
interface EngagementSummary {
  on_task?: number;
  shallow?: number;
  disengaged?: number;
  off_topic?: number;
  hostile?: number;
}
```

---

## Verification Checklist

After implementing these changes:

- [ ] Run `npx prisma migrate dev` — confirm migration succeeds
- [ ] Run a complete chat session (5+ exchanges) — confirm:
  - The tutor no longer emits `[MISCONCEPTION: ...]` tags in its raw output
  - Messages stream to the student with no added latency
  - The `DiagnosticLog` table has one entry per exchange
  - Misconceptions are being created in the database by the diagnostic model
  - The `confidence` field is populated on new misconception records
  - `detectedAtTurn` and `resolvedAtTurn` are populated correctly
- [ ] Deliberately express a misconception, then correct it in a later turn — confirm:
  - The misconception is detected and stored
  - After correction, `resolved` is set to true with `resolutionConfidence` and `resolutionEvidence` populated
  - `resolvedAtTurn` minus `detectedAtTurn` matches the actual number of exchanges between detection and resolution
- [ ] Send several shallow/disengaged messages ("I don't know", "ok", "whatever") — confirm:
  - `engagementFlag` on those user messages is NOT "on_task"
  - No misconception records are created for these messages
- [ ] Check the misconception dashboard — confirm:
  - Resolution rate reflects learner-based calculation (percentage of affected students who resolved)
  - Median turns to resolve uses the new turn-index-based calculation
  - Engagement summary appears in the response
- [ ] TypeScript builds cleanly with `npm run build` — no type errors from removed/deprecated fields
- [ ] Confirm the tutor's conversational quality is not degraded — it should still address misconceptions naturally in conversation, just without emitting tags about them
