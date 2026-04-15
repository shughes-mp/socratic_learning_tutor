# BUGFIX-MISCONCEPTION-TAGS — Diagnose and Fix Missing Misconception Tracking

## The Problem

Misconceptions are not being logged. The misconception dashboard shows 0 logged misconceptions even when the tutor clearly corrects wrong answers during a session. This means the entire misconception tracking pipeline is broken.

## Your Task

Diagnose the root cause by tracing the full misconception detection flow, then fix it. The investigation below tells you exactly where to look and what to check. Follow it step by step.

---

## Step 1 — Verify the system prompt is missing misconception tag instructions

Open `src/lib/system-prompt.ts` and read the `STATIC_BASE_PROMPT` constant, specifically the `REQUIRED TAGS` section near the end.

**Check:** Does the REQUIRED TAGS section include any of these tags?
- `[MISCONCEPTION: ...]`
- `[MISCONCEPTION_CANONICAL: ...]`
- `[MISCONCEPTION_PASSAGE: ...]`
- `[MISCONCEPTION_TYPE: ...]`
- `[MISCONCEPTION_SEVERITY: ...]`
- `[MISCONCEPTION_RESOLVED: true]`

**Expected finding:** These tags are NOT listed in the REQUIRED TAGS section. The tutor is never told to emit them.

**Evidence this is a problem:** The function `extractStructuredMisconceptions()` in `src/app/api/chat/route.ts` parses these exact tag names from the tutor's raw response. If the tutor never emits them, the function always returns an empty array. This is the primary misconception detection path, and it is completely dead.

---

## Step 2 — Verify the fallback heuristic is too narrow

Open `src/app/api/chat/route.ts` and read the `shouldFallbackLogMisconception()` function.

**Check:** Look at the `correctiveLanguage` variable. It checks for hardcoded phrases like:
- "the text states the opposite"
- "not quite"
- "meadows argues the opposite"
- "the reading does not"
- etc.

**Now compare** these phrases to what the tutor actually says when correcting errors. In a real session, the tutor said: "That's actually the view Meadows is arguing against — external events as the cause." The phrase "arguing against" does not match any entry in the hardcoded list. "Meadows is arguing against" ≠ "meadows argues the opposite."

**Expected finding:** The fallback phrase list is too brittle and too specific. It was likely authored against a handful of test conversations and doesn't generalize to the tutor's actual corrective language patterns.

---

## Step 3 — Verify the Misconception model is complete in the schema

Open `prisma/schema.prisma` and check that the `Misconception` model is fully defined with all fields. If the model definition is incomplete or truncated, the migration would not have created the database table, and all `prisma.misconception.create()` calls would fail silently or throw.

**Check that these fields exist on the Misconception model:**
- `id` (String, @id)
- `studentSessionId` (String, relation to StudentSession)
- `topicThread` (String)
- `description` (String)
- `canonicalClaim` (String?)
- `passageAnchor` (String?)
- `misconceptionType` (String?)
- `severity` (String)
- `studentMessage` (String)
- `resolved` (Boolean, default false)
- `persistentlyUnresolved` (Boolean, default false)
- `detectedAt` (DateTime)
- `updatedAt` (DateTime)

If the model is truncated or incomplete, fix it before proceeding.

---

## Step 4 — Verify the post-streaming logic in route.ts actually creates records

In `src/app/api/chat/route.ts`, find the section AFTER the streaming loop completes (after the `for await (const event of anthropicStream)` block). This is where the app:

1. Calls `parseTags(fullResponse)` to extract metadata tags
2. Calls `extractStructuredMisconceptions(fullResponse)` to find misconception tags
3. Checks `shouldFallbackLogMisconception()` if no structured misconceptions were found
4. Creates `prisma.misconception.create()` records if either path detects something

**Check:** Is there actually a code path that calls `prisma.misconception.create()`? Trace it. Confirm that if `extractStructuredMisconceptions()` returned a non-empty array, the code would create misconception records. Then confirm that if `shouldFallbackLogMisconception()` returned true, the code would create a fallback misconception record.

If these code paths exist but are never reached (because the conditions are never met), the logic is structurally correct but functionally dead.

---

## Step 5 — Apply the fix

Once you have confirmed the diagnosis, apply this two-part fix:

### Fix A — Add misconception tag instructions to the system prompt

In `src/lib/system-prompt.ts`, find the `REQUIRED TAGS` section inside `STATIC_BASE_PROMPT`. Add the following tag instructions. Insert them AFTER the `[FEEDBACK_TYPE: ...]` line and BEFORE the `[DIRECT_ANSWER: ...]` line:

```
[MISCONCEPTION: <brief description>] when the student expresses a misunderstanding of the reading. Only log genuine content misunderstandings — not off-task remarks, confusion about your question, or disengagement.
[MISCONCEPTION_CANONICAL: <normalized student claim>] the student's wrong claim restated as a clear declarative sentence
[MISCONCEPTION_PASSAGE: <passage reference>] which part of the reading the misconception relates to
[MISCONCEPTION_TYPE: misread|missing_warrant|wrong_inference|overgeneralization|ignored_counterevidence] the category of misunderstanding
[MISCONCEPTION_SEVERITY: low|medium|high] low = minor imprecision, medium = substantive misunderstanding, high = fundamental inversion of the text's argument
[MISCONCEPTION_RESOLVED: true] when a student who previously held a misconception demonstrates corrected understanding. Only emit this when the student articulates the correction themselves — not when you correct them.
```

### Fix B — Broaden the fallback heuristic (defense in depth)

In `src/app/api/chat/route.ts`, update the `correctiveLanguage` variable in `shouldFallbackLogMisconception()` to include additional phrases that the tutor actually uses in practice. Add these entries to the existing list:

```typescript
lowerResponse.includes("arguing against") ||
lowerResponse.includes("is arguing against") ||
lowerResponse.includes("the opposite of") ||
lowerResponse.includes("that's not supported") ||
lowerResponse.includes("the text says something different") ||
lowerResponse.includes("that misreads") ||
lowerResponse.includes("there's an error") ||
lowerResponse.includes("not what the text") ||
lowerResponse.includes("not what the author") ||
lowerResponse.includes("the same framing") ||
lowerResponse.includes("that contradicts") ||
lowerResponse.includes("the reading actually") ||
lowerResponse.includes("actually the opposite") ||
lowerResponse.includes("actually the view") ||
```

These additions cover the corrective language patterns actually observed in tutor responses, including the specific case that triggered this bug report ("That's actually the view Meadows is arguing against").

---

## Step 6 — Test the fix

### Test A — Run a session and give a wrong answer

1. Start a new student session with a reading uploaded.
2. Wait for the tutor's first Socratic question.
3. Give a clearly wrong answer that misrepresents the reading (e.g., state the opposite of what the author argues).
4. After the tutor responds, check the database:

```bash
npx prisma studio
```

Or query directly:

```sql
SELECT * FROM Misconception ORDER BY detectedAt DESC LIMIT 5;
```

**Expected:** At least one Misconception record exists with:
- `description` filled in
- `topicThread` matching the conversation topic
- `resolved` = false
- `studentMessage` containing your wrong answer

### Test B — Resolve a misconception

5. In the same session, now give the correct answer that demonstrates corrected understanding.
6. After the tutor responds, check the database again.

**Expected:** The misconception record now has `resolved` = true.

### Test C — Check the dashboard

7. Navigate to the misconception dashboard for this session.

**Expected:** The dashboard shows:
- Logged misconceptions: 1 (or more)
- Resolution rate: 100% (if you resolved it) or 0% (if you didn't)
- At least one cluster card with the misconception description

### Test D — Verify the fallback catches untagged corrections

8. If possible, test a scenario where the tutor corrects the student but does NOT emit misconception tags (this may require examining the raw response in the database or server logs). The fallback should still create a record.

**To verify fallback is working:** Add a temporary `console.log` inside `shouldFallbackLogMisconception()`:

```typescript
console.log("Fallback check:", {
  structuredCount: options.structuredMisconceptionsCount,
  isSubstantive: isSubstantiveMisunderstanding(options.lastUserMessage),
  feedbackType: options.tags.feedbackType,
  correctiveLanguage: /* log which phrase matched */
});
```

Run a session, give a wrong answer, and check the server console output.

---

## Step 7 — Clean up

Remove any temporary `console.log` statements added during testing.

Confirm the app builds cleanly:

```bash
npm run build
```

---

## Summary of Root Cause

Two compounding failures:

1. **Primary path dead:** The system prompt's REQUIRED TAGS section never included misconception tags (`[MISCONCEPTION: ...]`, etc.), so the tutor never emits them, so `extractStructuredMisconceptions()` always returns an empty array.

2. **Fallback too narrow:** The hardcoded phrase list in `shouldFallbackLogMisconception()` doesn't match the tutor's actual corrective language. Phrases like "arguing against" and "the same framing" are not in the list.

Both failures together mean zero misconception records are ever created, regardless of how many errors the student makes.
