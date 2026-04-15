# PHASE 2A: Checkpoint System Implementation

**Status:** Phase 2 implementation (depends on Phase 1 completion)  
**Scope:** Structured learning checkpoints with adaptive coverage tracking  
**Priority:** High — core feature for interpretive reading assessment

---

## 1. Data Model Changes (Prisma Schema)

### 1.1 Add Checkpoint Model

In `socratic-tutor/prisma/schema.prisma`, add this model before the StudentSession model:

```prisma
model Checkpoint {
  id                  String   @id @default(cuid())
  sessionId           String
  session             Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  orderIndex          Int      // display/default order (0-based)
  prompt              String   // the interpretive question (e.g., "Why does the author's argument about X depend on assumption Y?")
  processLevel        String   // "retrieve" | "infer" | "integrate" | "evaluate" (PIRLS/NAEP taxonomy)
  passageAnchors      String?  // paragraph numbers or section headers the checkpoint targets (free text, e.g. "Paragraph 3-4")
  expectations        String?  // JSON array of 2-4 "must appear" ideas (AutoTutor-style evidence features)
  misconceptionSeeds  String?  // JSON array of common misreadings to seed misconception detection
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Runtime tracking per student
  studentCheckpoints  StudentCheckpoint[]

  @@index([sessionId])
}
```

### 1.2 Add StudentCheckpoint Model

In `socratic-tutor/prisma/schema.prisma`, add this model after Checkpoint:

```prisma
model StudentCheckpoint {
  id                String   @id @default(cuid())
  studentSessionId  String
  studentSession    StudentSession @relation(fields: [studentSessionId], references: [id], onDelete: Cascade)
  checkpointId      String
  checkpoint        Checkpoint @relation(fields: [checkpointId], references: [id], onDelete: Cascade)
  status            String   @default("unseen") // "unseen" | "probing" | "evidence_sufficient" | "evidence_insufficient" | "deferred"
  turnsSpent        Int      @default(0)
  evidenceNotes     String?  // JSON: { demonstratedIdeas: [...], misconceptionsEncountered: [...], resolvedCount: int }
  updatedAt         DateTime @updatedAt

  @@unique([studentSessionId, checkpointId])
  @@index([studentSessionId])
}
```

### 1.3 Update Session Model

In the `Session` model in `socratic-tutor/prisma/schema.prisma`, add this relation field:

```prisma
checkpoints         Checkpoint[]
```

### 1.4 Update StudentSession Model

In the `StudentSession` model in `socratic-tutor/prisma/schema.prisma`, add this relation field:

```prisma
studentCheckpoints  StudentCheckpoint[]
```

### 1.5 Run Migration

After all schema changes, run:

```bash
cd socratic-tutor
npx prisma db push
```

---

## 2. API Endpoints

### 2.1 Create `src/app/api/sessions/[sessionId]/checkpoints/route.ts`

**Purpose:** CRUD for checkpoints on a session  
**Methods:** GET (list), POST (create), DELETE (remove)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { user: true },
  });

  if (!session || session.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checkpoints = await prisma.checkpoint.findMany({
    where: { sessionId: params.sessionId },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json(checkpoints);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { user: true },
  });

  if (!session || session.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { prompt, processLevel, passageAnchors, expectations, misconceptionSeeds } = body;

  if (!prompt || !processLevel) {
    return NextResponse.json(
      { error: "prompt and processLevel are required" },
      { status: 400 }
    );
  }

  const validLevels = ["retrieve", "infer", "integrate", "evaluate"];
  if (!validLevels.includes(processLevel)) {
    return NextResponse.json(
      { error: `processLevel must be one of: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  // Get next orderIndex
  const maxCheckpoint = await prisma.checkpoint.findFirst({
    where: { sessionId: params.sessionId },
    orderBy: { orderIndex: "desc" },
  });
  const nextOrderIndex = (maxCheckpoint?.orderIndex ?? -1) + 1;

  const checkpoint = await prisma.checkpoint.create({
    data: {
      sessionId: params.sessionId,
      orderIndex: nextOrderIndex,
      prompt,
      processLevel,
      passageAnchors: passageAnchors || null,
      expectations: expectations ? JSON.stringify(expectations) : null,
      misconceptionSeeds: misconceptionSeeds ? JSON.stringify(misconceptionSeeds) : null,
    },
  });

  return NextResponse.json(checkpoint, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { user: true },
  });

  if (!session || session.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { checkpointId } = body;

  if (!checkpointId) {
    return NextResponse.json({ error: "checkpointId is required" }, { status: 400 });
  }

  // Verify checkpoint belongs to this session
  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
  });

  if (!checkpoint || checkpoint.sessionId !== params.sessionId) {
    return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  }

  await prisma.checkpoint.delete({ where: { id: checkpointId } });

  return NextResponse.json({ success: true });
}
```

### 2.2 Create `src/app/api/sessions/[sessionId]/checkpoints/[checkpointId]/route.ts`

**Purpose:** Update individual checkpoint  
**Method:** PATCH

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string; checkpointId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { user: true },
  });

  if (!session || session.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: params.checkpointId },
  });

  if (!checkpoint || checkpoint.sessionId !== params.sessionId) {
    return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  }

  const body = await request.json();
  const { prompt, processLevel, passageAnchors, expectations, misconceptionSeeds, orderIndex } = body;

  const validLevels = ["retrieve", "infer", "integrate", "evaluate"];
  if (processLevel && !validLevels.includes(processLevel)) {
    return NextResponse.json(
      { error: `processLevel must be one of: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await prisma.checkpoint.update({
    where: { id: params.checkpointId },
    data: {
      ...(prompt !== undefined && { prompt }),
      ...(processLevel !== undefined && { processLevel }),
      ...(passageAnchors !== undefined && { passageAnchors }),
      ...(expectations !== undefined && { expectations: expectations ? JSON.stringify(expectations) : null }),
      ...(misconceptionSeeds !== undefined && { misconceptionSeeds: misconceptionSeeds ? JSON.stringify(misconceptionSeeds) : null }),
      ...(orderIndex !== undefined && { orderIndex }),
    },
  });

  return NextResponse.json(updated);
}
```

### 2.3 Create `src/app/api/sessions/[sessionId]/checkpoints/lint/route.ts`

**Purpose:** AI-powered checkpoint validation and suggestion  
**Method:** POST  
**Input:** `{ prompt: string }`  
**Output:** Structured suggestions for improving the checkpoint

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { user: true },
  });

  if (!session || session.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt (string) is required" }, { status: 400 });
  }

  const systemPrompt = `You are an expert in reading assessment design and Socratic instruction. You are analyzing a checkpoint prompt (a question students will answer after engaging with a text).

Your job is to:
1. Detect if the question is "recall-only" (requires only factual lookup, no interpretation)
2. If it is recall-only, suggest a rewrite that promotes interpretation/inference
3. Suggest 2-3 expected evidence features (ideas students should demonstrate)
4. Suggest 1-2 common misreadings or misinterpretations

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "isRecallOnly": boolean,
  "suggestedRewrite": "rewritten prompt that promotes higher-order thinking",
  "suggestedExpectations": ["evidence feature 1", "evidence feature 2", "evidence feature 3"],
  "suggestedMisconceptions": ["misreading 1", "misreading 2"]
}`;

  const userPrompt = `Analyze this checkpoint prompt for a reading comprehension session:\n\n"${prompt}"`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response type from Claude" },
        { status: 500 }
      );
    }

    const result = JSON.parse(content.text);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error linting checkpoint:", error);
    return NextResponse.json(
      { error: "Failed to analyze checkpoint" },
      { status: 500 }
    );
  }
}
```

---

## 3. Session Management Page Changes

### 3.1 Update `src/app/instructor/[sessionId]/page.tsx`

**Location:** Add a new "Learning Checkpoints" section after the Tutor Configuration card and before the Readings section (approximately line 300-350 in the existing file).

**Implementation Notes:**
- Fetch checkpoints on page load: `GET /api/sessions/{sessionId}/checkpoints`
- Display as reorderable cards with edit/delete/improve buttons
- "Improve this checkpoint" button calls the lint API and shows inline suggestions
- "Add checkpoint" form at bottom with prompt textarea, processLevel dropdown, optional passage anchors field
- Show warning if checkpoint count > max(3, maxExchanges / 4)
- Support drag-to-reorder or up/down arrow buttons for orderIndex management
- On reorder, PATCH each checkpoint with new orderIndex

**Key UI Components:**
- CheckpointCard: Display prompt, processLevel badge (color: retrieve=blue, infer=purple, integrate=green, evaluate=red), passage anchor chip, edit/delete/improve buttons
- CheckpointForm: Textarea, processLevel select with descriptions, optional passage anchors field, Add button
- CheckpointImproveModal: Display lint results (isRecallOnly, suggestedRewrite, suggestedExpectations, suggestedMisconceptions) with apply buttons
- DensityWarning: "You have {checkpointCount} checkpoints with {maxExchanges} exchanges. Consider 2-4 checkpoints for this session length."

---

## 4. System Prompt Changes

### 4.1 Update `src/lib/system-prompt.ts` — buildSystemPrompt()

In the `buildSystemPrompt()` function, after the STATIC_BASE_PROMPT section and before returning the complete prompt, add:

```typescript
let checkpointSection = "";
if (checkpoints && checkpoints.length > 0) {
  checkpointSection = `

CHECKPOINTS:
You have ${checkpoints.length} checkpoints to cover in this session. Work through them adaptively — not as a sequential quiz, but by weaving them into natural Socratic dialogue. Each checkpoint is a target understanding, not a script.

`;

  checkpoints.forEach((cp, idx) => {
    const expectations = cp.expectations ? JSON.parse(cp.expectations) : [];
    const seeds = cp.misconceptionSeeds ? JSON.parse(cp.misconceptionSeeds) : [];

    checkpointSection += `Checkpoint ${idx + 1} [${cp.processLevel.toUpperCase()}] (ID: ${cp.id}): ${cp.prompt}\n`;
    if (cp.passageAnchors) {
      checkpointSection += `  Passage anchor: ${cp.passageAnchors}\n`;
    }
    if (expectations.length > 0) {
      checkpointSection += `  Expected evidence:\n`;
      expectations.forEach((e) => {
        checkpointSection += `    - ${e}\n`;
      });
    }
    if (seeds.length > 0) {
      checkpointSection += `  Common misreadings:\n`;
      seeds.forEach((s) => {
        checkpointSection += `    - ${s}\n`;
      });
    }
    checkpointSection += "\n";
  });

  checkpointSection += `CHECKPOINT MANAGEMENT:
- Track which checkpoints have been addressed vs unseen
- When selecting your next question, consider: which unseen checkpoints are most at risk of being missed given remaining exchanges?
- Emit [CHECKPOINT_ID: {id}] tag when your question targets a specific checkpoint
- Emit [CHECKPOINT_STATUS: {id}|{status}] after evaluating a student's response
  Status values: "probing" (initial response, more evidence needed), "evidence_sufficient" (clear understanding), "evidence_insufficient" (student cannot demonstrate understanding), "deferred" (will revisit later)
`;
}

return STATIC_BASE_PROMPT + basePrompt + contextInstruction + checkpointSection;
```

### 4.2 Update `src/lib/system-prompt.ts` — buildContextInstruction()

In the `buildContextInstruction()` function, add checkpoint-aware phase logic before the return statement:

```typescript
let coverageRescue = "";
if (checkpoints && checkpoints.length > 0 && studentCheckpoints) {
  const unseenCount = studentCheckpoints.filter((sc) => sc.status === "unseen").length;
  const exchangesRemaining = maxExchanges - currentExchange;

  // Rough heuristic: need at least 2 turns per unseen checkpoint + buffer
  const minTurnsNeeded = unseenCount * 2 + 2;

  if (exchangesRemaining <= minTurnsNeeded && unseenCount > 0) {
    coverageRescue = `

COVERAGE RESCUE MODE:
You have ${unseenCount} unseen checkpoints and only ${exchangesRemaining} exchanges remaining. Switch to high-discrimination coverage mode:
- Ask ONE focused question per remaining checkpoint
- Accept concise but well-grounded answers
- If the student cannot demonstrate understanding in one turn, mark as "evidence_insufficient" and briefly explain what was needed
- Skip deep scaffolding; prioritize coverage breadth
`;
  }
}

return contextInstructionBase + coverageRescue;
```

---

## 5. Chat API Changes

### 5.1 Update `src/app/api/chat/route.ts`

**Location:** In the main POST handler, after fetching studentSession and before calling buildSystemPrompt():

```typescript
// Fetch checkpoints and student checkpoint tracking
const checkpoints = await prisma.checkpoint.findMany({
  where: { sessionId: session.id },
  orderBy: { orderIndex: "asc" },
});

const studentCheckpoints = await prisma.studentCheckpoint.findMany({
  where: { studentSessionId: studentSession.id },
});

// Pass to buildSystemPrompt and buildContextInstruction
const systemPrompt = buildSystemPrompt({
  // ... existing params
  checkpoints,
  studentCheckpoints,
});
```

**After streaming completes** (in the response streaming section), add checkpoint tag parsing:

```typescript
// Parse CHECKPOINT_ID and CHECKPOINT_STATUS tags from the response
const checkpointIdMatch = responseText.match(/\[CHECKPOINT_ID:\s*([^\]]+)\]/);
const checkpointStatusMatches = responseText.matchAll(/\[CHECKPOINT_STATUS:\s*([^|]+)\|([^\]]+)\]/g);

if (checkpointIdMatch) {
  const targetCheckpointId = checkpointIdMatch[1].trim();
  // Log for analytics if needed
}

for (const match of checkpointStatusMatches) {
  const checkpointId = match[1].trim();
  const status = match[2].trim();

  const validStatuses = ["probing", "evidence_sufficient", "evidence_insufficient", "deferred"];
  if (!validStatuses.includes(status)) continue;

  const checkpoint = checkpoints.find((c) => c.id === checkpointId);
  if (!checkpoint) continue;

  const studentCheckpoint = studentCheckpoints.find(
    (sc) => sc.checkpointId === checkpointId
  );

  if (studentCheckpoint) {
    // Update existing
    await prisma.studentCheckpoint.update({
      where: { id: studentCheckpoint.id },
      data: {
        status,
        turnsSpent: studentCheckpoint.turnsSpent + 1,
      },
    });
  } else {
    // Create new
    await prisma.studentCheckpoint.create({
      data: {
        studentSessionId: studentSession.id,
        checkpointId,
        status,
        turnsSpent: 1,
      },
    });
  }
}
```

---

## 6. Verification Checklist

- [ ] Prisma schema updated with Checkpoint and StudentCheckpoint models
- [ ] `npx prisma db push` executed successfully
- [ ] All three checkpoint API routes created and tested
- [ ] Checkpoint lint endpoint validates and returns JSON correctly
- [ ] Session management page displays Learning Checkpoints section
- [ ] Checkpoint cards render with correct badges and buttons
- [ ] Add checkpoint form validates processLevel and creates records
- [ ] Improve checkpoint button fetches lint results and displays suggestions
- [ ] Drag/reorder functionality updates orderIndex on checkpoints
- [ ] buildSystemPrompt() includes checkpoint context section
- [ ] buildContextInstruction() includes coverage rescue logic
- [ ] Chat API fetches and passes checkpoints to system prompt
- [ ] Chat API parses CHECKPOINT_ID and CHECKPOINT_STATUS tags
- [ ] StudentCheckpoint records created/updated correctly during chat
- [ ] Student checkpoint turnsSpent increments correctly

---

## 7. Notes for Implementation

- **Checkpoint prompt quality is critical.** The lint endpoint (haiku model) should catch obvious recall-only questions and suggest better alternatives.
- **Coverage rescue mode is essential** for sessions with many checkpoints and few exchanges. The heuristic (unseenCount × 2 + 2) can be tuned based on live data.
- **Tag emission in system prompt:** Make it clear to Claude that tags should be emitted as plain text within the response, not as separate structured outputs. They will be parsed post-hoc.
- **studentCheckpoints unique constraint:** The `@@unique([studentSessionId, checkpointId])` ensures only one record per student per checkpoint, preventing duplicates.
- **Ordering:** The orderIndex field controls display order on the instructor UI and influences checkpoint selection logic in the system prompt.

