# PHASE 2B: Learning Outcome Formative Assessment

**Status:** Phase 2 implementation (depends on Phase 1A and Phase 2A completion)  
**Scope:** Formative LO assessment in per-student reports  
**Priority:** High — bridges tutoring session to instructor feedback  
**Not Summative:** These assessments are for formative instructor review, not student records

---

## 1. Prerequisites

**Phase 1A:** Session model must have `learningOutcomes` field (String?, nullable)  
**Phase 2A:** Checkpoint system must be implemented (StudentCheckpoint model exists with status and evidence tracking)

---

## 2. Data Model Changes (Prisma Schema)

### 2.1 Add LOAssessment Model

In `socratic-tutor/prisma/schema.prisma`, add this model:

```prisma
model LOAssessment {
  id                String   @id @default(cuid())
  studentSessionId  String
  studentSession    StudentSession @relation(fields: [studentSessionId], references: [id], onDelete: Cascade)
  learningOutcome   String   // the specific LO text (verbatim from session.learningOutcomes)
  status            String   // "not_observed" | "insufficient_evidence" | "emerging" | "meets" | "exceeds"
  confidence        String   // "low" | "medium" | "high"
  evidenceSummary   String?  // JSON array: [{ exchangeNumber: int, excerpt: string, tags: string[] }, ...]
  processMetrics    String?  // JSON: { hintRungs: int, misconceptionCount: int, misconceptionsResolved: int, checkpointsAddressed: int }
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([studentSessionId])
}
```

### 2.2 Update StudentSession Model

In the `StudentSession` model in `socratic-tutor/prisma/schema.prisma`, add this relation field:

```prisma
loAssessments      LOAssessment[]
```

### 2.3 Run Migration

After schema changes, run:

```bash
cd socratic-tutor
npx prisma db push
```

---

## 3. Report Generation Changes

### 3.1 Locate Report Generation Endpoint

Find the report generation endpoint (likely one of):
- `src/app/api/sessions/[sessionId]/students/[studentSessionId]/report/route.ts`
- `src/app/api/sessions/[sessionId]/report/route.ts` (if all students together)
- Check the instructor UI to find where reports are fetched

**Current behavior:** Full transcript is sent to Claude, which generates a report markdown.

### 3.2 Update Report Generation Prompt

In the report generation system prompt (the one sent to Claude when generating the report), add this section after any existing instructions but before the final response format instructions:

```
LEARNING OUTCOME ASSESSMENT:

The session defines the following learning outcomes:
{learningOutcomes as numbered list}

For each learning outcome, you will produce a structured assessment. Evaluate the student's conversational evidence and produce:

- **status:** One of:
  - "not_observed" — The LO was never directly addressed in the conversation
  - "insufficient_evidence" — The LO was addressed but the student had fewer than 2 distinct opportunities to demonstrate understanding. Valid choice when session is short.
  - "emerging" — The student showed partial understanding or needed substantial scaffolding. Reasoning present but gaps exist.
  - "meets" — Clear understanding demonstrated with text grounding and reasoning quality. Student answered 2+ distinct types of questions on this LO well.
  - "exceeds" — Sophisticated engagement beyond expected level. Student made novel connections, noticed subtle implications, or transferred concepts independently.

- **confidence:** "low" | "medium" | "high"
  - How certain are you in this rating based on the evidence available?
  - Use "low" if the evidence is thin, contradictory, or if you're inferring beyond what was demonstrated.
  - Use "high" if the evidence is clear and multiple-sourced.

- **evidence:** 2-4 specific moments from the transcript that support your rating. For each moment:
  - Quote 1-2 brief excerpts (under 20 words each)
  - Cite the exchange number where it occurred
  - Note the question type (e.g., "explain", "challenge", "connect")

- **process_notes:** (optional, 1-2 sentences)
  - How much scaffolding did the student need? (e.g., "Required 3 hint rungs" or "Minimal scaffolding needed")
  - Were related misconceptions resolved? (e.g., "Initially claimed X, resolved in exchange 12")

CRITICAL RULES FOR RATING:
- "insufficient_evidence" is always a valid choice. Do not force a rating if the LO was under-addressed.
- Require at least TWO distinct question-type opportunities before rating "meets" or "exceeds". For example:
  - One "explain" question + one "challenge" question = valid basis for "meets"
  - Two "explain" questions alone = may still be "insufficient_evidence" if the prompts were too similar
- Score TEXT GROUNDING and REASONING QUALITY, not rhetorical polish or vocabulary.
- If unresolved high-severity misconceptions remain on a topic related to this LO, the maximum rating is "emerging".
- Grading curve: In a typical 15-25 exchange session, expect 40-60% of students to reach "meets" on each LO. "Exceeds" should be rare (10-15%).

RESPONSE FORMAT:
After your main report, emit LO assessments in this exact format (one per LO):

[LO_ASSESSMENT: {LO text} | {status} | {confidence} | {evidence summary}]

Where {evidence summary} is a 2-4 sentence summary, e.g.: "Student explained author's use of metaphor in exchange 4 (quote: 'It shows how X relates to Y'). Later challenged on inference about intent in exchange 9, correctly identified unstated assumption. Needed 1 hint on connecting to broader argument."
```

### 3.3 Parse LO_ASSESSMENT Tags and Create Records

Update the report generation endpoint to parse tags and persist LOAssessment records.

**Location:** In the report route handler, after the report markdown is generated and before returning it to the client:

```typescript
// Parse LO_ASSESSMENT tags from the report
const loAssessmentMatches = reportMarkdown.matchAll(
  /\[LO_ASSESSMENT:\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\]/g
);

const loTexts = (session.learningOutcomes || "")
  .split("\n")
  .map((lo) => lo.trim())
  .filter((lo) => lo.length > 0);

for (const match of loAssessmentMatches) {
  const loText = match[1].trim();
  const status = match[2].trim();
  const confidence = match[3].trim();
  const evidenceSummary = match[4].trim();

  // Validate status and confidence values
  const validStatuses = ["not_observed", "insufficient_evidence", "emerging", "meets", "exceeds"];
  const validConfidence = ["low", "medium", "high"];

  if (!validStatuses.includes(status) || !validConfidence.includes(confidence)) {
    console.warn(`Invalid LO assessment: ${loText}`);
    continue;
  }

  // Check if this LO text matches one from the session (fuzzy match acceptable)
  const matchingLO = loTexts.find((lo) => lo.includes(loText.substring(0, 20)) || loText.includes(lo.substring(0, 20)));
  if (!matchingLO) {
    console.warn(`LO text not found in session: ${loText}`);
    continue;
  }

  // Create or update LOAssessment record
  await prisma.loAssessment.upsert({
    where: {
      // Note: You may need to add a unique constraint in Prisma schema for this upsert
      // For now, use a simpler approach: delete and recreate
    },
    create: {
      studentSessionId,
      learningOutcome: matchingLO,
      status,
      confidence,
      evidenceSummary, // Store the evidence summary text, or parse as JSON if structured differently
      processMetrics: null, // Can be populated from StudentCheckpoint and Misconception data if desired
    },
    update: {
      status,
      confidence,
      evidenceSummary,
      updatedAt: new Date(),
    },
  });
}

// Alternative: Delete and recreate to ensure clean state
await prisma.loAssessment.deleteMany({
  where: { studentSessionId },
});

for (const match of loAssessmentMatches) {
  const loText = match[1].trim();
  const status = match[2].trim();
  const confidence = match[3].trim();
  const evidenceSummary = match[4].trim();

  const validStatuses = ["not_observed", "insufficient_evidence", "emerging", "meets", "exceeds"];
  const validConfidence = ["low", "medium", "high"];

  if (!validStatuses.includes(status) || !validConfidence.includes(confidence)) {
    continue;
  }

  const loTexts = (session.learningOutcomes || "")
    .split("\n")
    .map((lo) => lo.trim())
    .filter((lo) => lo.length > 0);

  const matchingLO = loTexts.find((lo) =>
    lo.toLowerCase().includes(loText.toLowerCase().substring(0, 30))
  );

  if (!matchingLO) continue;

  // Optionally compute process metrics from checkpoint and misconception data
  const studentCheckpoints = await prisma.studentCheckpoint.findMany({
    where: { studentSessionId },
  });

  const misconceptions = await prisma.misconception.findMany({
    where: { studentSessionId },
  });

  const processMetrics = {
    hintRungs: 0, // Would need to extract from transcript or add hint tracking
    misconceptionCount: misconceptions.length,
    misconceptionsResolved: misconceptions.filter((m) => m.resolved).length,
    checkpointsAddressed: studentCheckpoints.filter((sc) => sc.status !== "unseen").length,
  };

  await prisma.loAssessment.create({
    data: {
      studentSessionId,
      learningOutcome: matchingLO,
      status,
      confidence,
      evidenceSummary,
      processMetrics: JSON.stringify(processMetrics),
    },
  });
}
```

**Important note on upsert:** If you add a unique constraint to the Prisma schema like `@@unique([studentSessionId, learningOutcome])`, you can use upsert. For now, the simpler approach (delete all, recreate) is safer.

---

## 4. Report Display Changes

### 4.1 Locate Report Display Page

Find the instructor page that displays student reports. This is likely:
- `src/app/instructor/[sessionId]/students/[studentSessionId]/page.tsx`
- Or a modal/drawer that shows the report

### 4.2 Add Learning Outcome Assessment Section

In the report display page, after the main report markdown is rendered, add a new section:

```typescript
// Fetch LO assessments for this student
const loAssessments = await prisma.loAssessment.findMany({
  where: { studentSessionId },
  orderBy: { createdAt: "asc" },
});
```

**Render the LO Assessment section as follows:**

```tsx
{loAssessments && loAssessments.length > 0 && (
  <div className="mt-8 border-t pt-6">
    <h3 className="text-lg font-semibold mb-2">Learning Outcome Assessment</h3>
    <p className="text-sm text-gray-500 mb-4">
      These assessments are formative and AI-generated. They reflect observed engagement during the tutoring
      session and should be reviewed by the instructor before informing any grading decisions.
    </p>

    <div className="space-y-3">
      {loAssessments.map((lo) => (
        <LOAssessmentCard key={lo.id} assessment={lo} />
      ))}
    </div>
  </div>
)}
```

### 4.3 Create LOAssessmentCard Component

Create a new component file `src/components/LOAssessmentCard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

const statusColors: Record<string, string> = {
  not_observed: "bg-gray-100 text-gray-700",
  insufficient_evidence: "bg-yellow-100 text-yellow-800",
  emerging: "bg-orange-100 text-orange-800",
  meets: "bg-green-100 text-green-800",
  exceeds: "bg-blue-100 text-blue-800",
};

const statusLabels: Record<string, string> = {
  not_observed: "Not Observed",
  insufficient_evidence: "Insufficient Evidence",
  emerging: "Emerging",
  meets: "Meets",
  exceeds: "Exceeds",
};

const confidenceDotColor: Record<string, string> = {
  low: "bg-red-500",
  medium: "bg-yellow-500",
  high: "bg-green-500",
};

interface LOAssessment {
  id: string;
  learningOutcome: string;
  status: string;
  confidence: string;
  evidenceSummary: string | null;
  processMetrics: string | null;
}

export function LOAssessmentCard({ assessment }: { assessment: LOAssessment }) {
  const [expanded, setExpanded] = useState(false);

  let processMetrics: any = null;
  try {
    if (assessment.processMetrics) {
      processMetrics = JSON.parse(assessment.processMetrics);
    }
  } catch (e) {
    // Invalid JSON, skip
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">{assessment.learningOutcome}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${statusColors[assessment.status]}`}>
              {statusLabels[assessment.status]}
            </span>
            <div className={`w-2 h-2 rounded-full ${confidenceDotColor[assessment.confidence]}`} title={`${assessment.confidence} confidence`} />
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Expand evidence"
        >
          <ChevronDownIcon className={`w-4 h-4 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm space-y-2">
          {assessment.evidenceSummary && (
            <div>
              <p className="font-medium text-gray-700 mb-1">Evidence:</p>
              <p className="text-gray-600 text-xs">{assessment.evidenceSummary}</p>
            </div>
          )}

          {processMetrics && (
            <div className="mt-3 bg-gray-50 p-2 rounded text-xs space-y-1">
              <p className="font-medium text-gray-700">Process Metrics:</p>
              {processMetrics.misconceptionCount !== undefined && (
                <p>
                  Misconceptions: {processMetrics.misconceptionsResolved}/{processMetrics.misconceptionCount} resolved
                </p>
              )}
              {processMetrics.checkpointsAddressed !== undefined && (
                <p>Checkpoints addressed: {processMetrics.checkpointsAddressed}</p>
              )}
              {processMetrics.hintRungs !== undefined && processMetrics.hintRungs > 0 && (
                <p>Hint rungs used: {processMetrics.hintRungs}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4.4 Import and Use the Component

In the report display page, import and render the LOAssessmentCard component.

---

## 5. Data Flow Summary

1. **Report Generation:**
   - Instructor requests report for a student
   - Report endpoint fetches session, studentSession, and full transcript
   - System prompt includes learningOutcomes and LO assessment instructions
   - Claude generates report markdown with embedded `[LO_ASSESSMENT: ...]` tags

2. **Tag Parsing:**
   - Report endpoint parses LO_ASSESSMENT tags from the markdown
   - For each tag, creates or updates a LOAssessment record in the database
   - Process metrics are optionally populated from checkpoint and misconception data

3. **Report Display:**
   - Instructor views the student's report page
   - Main report markdown is rendered
   - LO assessments are fetched from database and displayed in a dedicated section
   - Each assessment card shows LO text, status badge, confidence indicator, and expandable evidence

---

## 6. Validation Rules

### 6.1 Status Values

Valid status values for LOAssessment.status:
- `not_observed`: LO not addressed in the conversation
- `insufficient_evidence`: Addressed but fewer than 2 distinct demonstration opportunities
- `emerging`: Partial understanding shown; gaps present
- `meets`: Clear understanding with 2+ distinct question types answered well
- `exceeds`: Sophisticated engagement with novel connections or independent transfer

### 6.2 Confidence Values

Valid confidence values for LOAssessment.confidence:
- `low`: Thin, contradictory, or inferred evidence
- `medium`: Moderate clarity, some gaps in evidence
- `high`: Clear, multiple-sourced evidence

### 6.3 Evidence Summary Format

The evidenceSummary field should be a free-text field (not JSON) containing:
- 2-4 specific moments from the transcript
- Brief quotes (under 20 words each)
- Exchange numbers or context markers
- Question types (explain, challenge, connect, etc.)
- Optional scaffolding notes

Example:
```
"Student explained author's use of metaphor in exchange 4 (quote: 'It shows how X relates to Y'). Later challenged on inference about intent in exchange 9, correctly identified unstated assumption. Needed 1 hint on connecting to broader argument."
```

---

## 7. Integration with Phase 2A

The LOAssessment system complements the Checkpoint system:

- **Checkpoints:** Discrete, instructor-defined questions that structure the session
- **LO Assessments:** Holistic view of learning outcome achievement across all exchanges

**Process metrics bridge them:**
- `checkpointsAddressed` from StudentCheckpoint data
- `misconceptionCount` and `misconceptionsResolved` from Misconception data
- Hint usage can be extracted from the transcript during report generation

---

## 8. Verification Checklist

- [ ] Prisma schema updated with LOAssessment model
- [ ] LOAssessment relation added to StudentSession model
- [ ] `npx prisma db push` executed successfully
- [ ] Report generation prompt includes LO assessment section with all rules
- [ ] Report endpoint parses `[LO_ASSESSMENT: ...]` tags correctly
- [ ] LOAssessment records created for each parsed tag
- [ ] Report display page fetches and renders LOAssessmentCard components
- [ ] LOAssessmentCard component displays status badges with correct colors
- [ ] Confidence indicator renders as colored dot
- [ ] Evidence section expands/collapses correctly
- [ ] Process metrics display when available
- [ ] Disclaimer message appears above LO section
- [ ] All validation rules enforced (valid status/confidence values)

---

## 9. Implementation Notes

### 9.1 Tag Parsing Robustness

The regex pattern for parsing LO_ASSESSMENT tags is:
```regex
/\[LO_ASSESSMENT:\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\]/g
```

This assumes:
- Pipe (`|`) delimiters between fields
- No newlines within the tag
- Status and confidence are single words (no spaces)

If Claude's output format is slightly different, adjust the regex accordingly. Test with a few sample reports to ensure reliability.

### 9.2 LO Text Matching

When matching parsed LO text to session.learningOutcomes, use a fuzzy match (substring check) rather than exact match. This allows for minor wording variations in Claude's output.

### 9.3 Process Metrics Computation

The processMetrics JSON includes:
- `misconceptionCount`: Total misconceptions encountered (from Misconception table)
- `misconceptionsResolved`: Count where Misconception.resolved = true
- `checkpointsAddressed`: StudentCheckpoints with status != "unseen"
- `hintRungs`: Would require separate hint tracking (not yet implemented; leave as 0 for now)

### 9.4 Formative vs. Summative

Emphasize to instructors (via disclaimer and documentation) that these assessments are:
- **Formative:** For instructor reflection and feedback, not official grades
- **AI-generated:** Subject to errors; instructor review is required
- **Session-based:** Reflect engagement during ONE tutoring session, not comprehensive mastery
- **Not for records:** Should not be copied to official grading systems without instructor validation

---

## 10. Future Enhancements

- Add instructor override capability (manually adjust LO assessments)
- Export LO assessments as CSV for grade book integration
- Track LO achievement trends across multiple sessions for the same student
- Compare LO achievement across different student cohorts
- Integrate hint usage and misconception resolution rates as explicit process metrics on the card

