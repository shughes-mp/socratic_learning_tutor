# PHASE-1B: Structured Misconception Logging

**Phase:** 1 (No dependencies)  
**Priority:** High  
**Effort:** Medium  
**Focus:** Upgrade misconception records from free-text to NAEP/PIRLS-aligned structured data

---

## Overview

This change restructures the Misconception model to capture **why** a student's understanding is incorrect, not just **that** it is. We add classification fields (type, severity, confidence) and passage-anchoring, enabling better diagnosis and targeted re-teaching.

The upgrade is **backward-compatible**: the existing `description` field remains, and new fields default to null.

---

## Feature: Structured Misconception Fields

### 1. Prisma Schema (`socratic-tutor/prisma/schema.prisma`)

In the `Misconception` model, add five new fields after the existing fields (keep `description` for backward compatibility):

```prisma
model Misconception {
  id                    String   @id @default(cuid())
  sessionId             String
  session               Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  topicThread           String?
  description           String? // Existing field — keep for backwards compatibility
  studentMessage        String?
  resolved              Boolean  @default(false)
  persistentlyUnresolved Boolean @default(false)
  
  // New fields — Phase 1B
  canonicalClaim        String?  // Normalized statement of what student believes (no hedging)
  passageAnchor         String?  // Paragraph/section reference from the reading
  misconceptionType     String?  // One of: misread, missing_warrant, wrong_inference, overgeneralization, ignored_counterevidence
  severity              String   @default("medium") // One of: low, medium, high
  confidence            String   @default("medium") // One of: low, medium, high
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

**Placement:** Add the new fields after the existing fields in the model. Keep the relationship and ID fields unchanged.

**Default values:**
- `severity`: "medium"
- `confidence`: "medium"
- Other new fields: nullable (default to null)

**Migration:** Run `npx prisma db push` after this change.

---

### 2. System Prompt (`src/lib/system-prompt.ts`)

#### Update STATIC_BASE_PROMPT

Locate the MISCONCEPTION tag instruction in `STATIC_BASE_PROMPT` (currently instructs to emit `[MISCONCEPTION: description]`).

Replace the entire MISCONCEPTION instruction section with:

```
MISCONCEPTION LOGGING:
When you detect a genuine misconception (student states something believed but incorrect):

Emit in order:
[MISCONCEPTION: description]
[MISCONCEPTION_CANONICAL: normalized one-sentence claim]
[MISCONCEPTION_PASSAGE: paragraph/section anchor]
[MISCONCEPTION_TYPE: type_code]
[MISCONCEPTION_SEVERITY: severity_code]

Definitions:

MISCONCEPTION_CANONICAL: Restate the student's belief in normalized form, removing hedging language. Example: Student says "I'm not sure, but maybe the author doesn't really care about evidence?" → Canonical: "The author does not value evidence." Canonical claims are assertions, not questions or uncertainties.

MISCONCEPTION_PASSAGE: Cite the specific paragraph, section, or line reference from the reading where this misconception should be challenged. Format: "paragraph N" or "section title" or "line X–Y" or "opening argument". If the misconception spans multiple passages, cite the most directly relevant one. If there is no passage (e.g., a general reasoning error), write "N/A — general reasoning".

MISCONCEPTION_TYPE (choose one):
- misread: Student misinterprets what the text literally says. Example: "The author says X" when the text says the opposite.
- missing_warrant: Student states a true or plausible conclusion but misses the author's supporting reasoning or evidence. Example: Student agrees with the conclusion but doesn't recognize which facts support it.
- wrong_inference: Student draws a logical conclusion not supported by the text. Example: "Because the author mentions X, the author must believe Y" (not stated).
- overgeneralization: Student extends the author's claim beyond its stated scope. Example: Author claims "Students in this district perform better with X" → Student: "All students benefit from X."
- ignored_counterevidence: Student overlooks evidence, qualifications, or counter-claims the author provides. Example: Author says "X is true, but only under conditions Y and Z" → Student focuses on X, ignoring Y and Z.

MISCONCEPTION_SEVERITY (choose one):
- low: Minor misunderstanding. Student's core reasoning is sound; they've misread a detail or overlooked a nuance. Correcting it won't derail their comprehension.
- medium: Moderate misunderstanding. Student's reasoning is partially correct but built on a flawed premise. Addressing it requires re-reading or clarification.
- high: Critical misunderstanding. Student's core claim contradicts the text or severely limits their ability to understand the author's argument. Addressing it is essential.

Confidence is automatically logged by the system (do not emit MISCONCEPTION_CONFIDENCE).
```

**Placement:** Replace the entire existing MISCONCEPTION section in STATIC_BASE_PROMPT. This new version is more detailed and structured.

---

### 3. Chat API (`src/app/api/chat/route.ts`)

#### Update tag parsing logic

Locate the section where tags are parsed from the streamed response and Misconception records are created (search for `MISCONCEPTION` tag handling and `prisma.misconception.create`).

Update the tag-parsing logic to extract the new tags. **Before the `prisma.misconception.create()` call**, add parsing for the new tags:

```typescript
// Existing pattern — adapt to your tag-parsing approach
const misconceptionMatches = fullResponse.match(/\[MISCONCEPTION: (.*?)\]/g) || [];
const canonicalMatches = fullResponse.match(/\[MISCONCEPTION_CANONICAL: (.*?)\]/g) || [];
const passageMatches = fullResponse.match(/\[MISCONCEPTION_PASSAGE: (.*?)\]/g) || [];
const typeMatches = fullResponse.match(/\[MISCONCEPTION_TYPE: (.*?)\]/g) || [];
const severityMatches = fullResponse.match(/\[MISCONCEPTION_SEVERITY: (.*?)\]/g) || [];

// For each misconception detected, pair the tags:
misconceptionMatches.forEach((match, index) => {
  const description = match.replace(/\[MISCONCEPTION: (.*?)\]/, "$1").trim();
  const canonicalClaim = canonicalMatches[index]?.replace(/\[MISCONCEPTION_CANONICAL: (.*?)\]/, "$1").trim() || null;
  const passageAnchor = passageMatches[index]?.replace(/\[MISCONCEPTION_PASSAGE: (.*?)\]/, "$1").trim() || null;
  let misconceptionType = typeMatches[index]?.replace(/\[MISCONCEPTION_TYPE: (.*?)\]/, "$1").trim() || null;
  let severity = severityMatches[index]?.replace(/\[MISCONCEPTION_SEVERITY: (.*?)\]/, "$1").trim() || "medium";

  // Validate type (only accept valid values)
  const validTypes = ["misread", "missing_warrant", "wrong_inference", "overgeneralization", "ignored_counterevidence"];
  if (!misconceptionType || !validTypes.includes(misconceptionType)) {
    misconceptionType = null;
  }

  // Validate severity
  const validSeverities = ["low", "medium", "high"];
  if (!validSeverities.includes(severity)) {
    severity = "medium";
  }

  // Create misconception record with new fields
  await prisma.misconception.create({
    data: {
      sessionId,
      topicThread: currentTopicThread || null,
      description,
      canonicalClaim,
      passageAnchor,
      misconceptionType,
      severity,
      studentMessage: userMessage,
      resolved: false,
      persistentlyUnresolved: false,
    },
  });
});
```

**Important:**
- Parse tags in order and pair them by index (1st MISCONCEPTION matches with 1st CANONICAL, etc.)
- Use regex matching consistent with your existing tag-parsing approach (may vary based on current implementation)
- Validate `misconceptionType` against the allowed values; if invalid or missing, store as null
- Validate `severity` against allowed values; default to "medium" if invalid
- `confidence` is not emitted by the tutor; it will be managed separately in future phases

---

### 4. Backward Compatibility

**No breaking changes:**
- Existing Misconception records retain their `description` field
- New fields default to null or "medium", so old records are not invalidated
- The tutor will begin emitting new tags, but old records won't have them
- Queries filtering by type, severity, or passage will naturally return null/empty for old records

---

## Testing Checklist

- [ ] **Schema migration:**
  - `npx prisma db push` completes without errors
  - New fields appear in Misconception model introspection
  - Existing records are not deleted or modified
  - Default values apply (severity = "medium", confidence = "medium")

- [ ] **System prompt update:**
  - New MISCONCEPTION instruction is injected into STATIC_BASE_PROMPT
  - Instruction text includes all five tag definitions with examples
  - Type validation list is present in prompt

- [ ] **Tag parsing in Chat API:**
  - Chat response includes all five tags when misconception is detected
  - Tags are parsed correctly by regex (check format: `[TAG: value]`)
  - Fields are extracted and passed to `prisma.misconception.create()`
  - Invalid values (e.g., unknown type) default to null/"medium"
  - Misconception records appear in database with correct field values

- [ ] **Manual verification:**
  - Create a session, trigger a misconception in chat
  - Verify database record includes:
    - `description`, `canonicalClaim`, `passageAnchor`
    - `misconceptionType` (one of the five valid values)
    - `severity` and `confidence` with valid values
  - Instructor can view misconception details (future UI; for now, check database)

---

## Example Misconception Emission

**Student:** "The author doesn't really provide evidence for the main claim."

**Tutor emission:**
```
[MISCONCEPTION: The student believes the author provides insufficient evidence for the main claim.]
[MISCONCEPTION_CANONICAL: The author fails to provide evidence for the main claim.]
[MISCONCEPTION_PASSAGE: paragraph 2, where the author lists four supporting studies]
[MISCONCEPTION_TYPE: misread]
[MISCONCEPTION_SEVERITY: high]
```

**Resulting database record:**
```
{
  description: "The student believes the author provides insufficient evidence for the main claim.",
  canonicalClaim: "The author fails to provide evidence for the main claim.",
  passageAnchor: "paragraph 2, where the author lists four supporting studies",
  misconceptionType: "misread",
  severity: "high",
  confidence: "medium" (auto-set by system)
}
```

---

## Notes

- **Confidence** field is auto-set to "medium" during creation; future phases may add confidence scoring
- **TopicThread** is already logged; new fields enhance the same record
- This structure enables **filtering and reporting** on misconception patterns (e.g., "which passages trigger the most overgeneralizations?")
- Type classification aligns with NAEP/PIRLS reading comprehension dimensions
