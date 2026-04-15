# PHASE-MONITOR-AND-TRACE-FIXES — Activity Monitor, Trace Rendering, and Prompt Leak Fixes

## Overview

Six issues identified from the Student Activity Monitor and Interaction Trace. Two are critical (internal reasoning leaking to students, hidden scaffold message visible to instructors), two are rendering bugs (raw markdown, tag residue in trace), and two are UX polish (inconsistent "None" vs "0", compound question in prompt).

---

## Files to Change

- `src/lib/system-prompt.ts` — add meta-reasoning suppression rule, tighten compound question rule
- `src/components/instructor/exchange-replay.tsx` — filter hidden messages, render markdown, strip tags
- `src/app/instructor/[sessionId]/monitor/page.tsx` — pass hidden flag, fix "None" display
- `src/app/api/sessions/[sessionId]/students/route.ts` — include hidden field in message select
- `src/components/chat/message-bubble.tsx` — add catch-all tag stripping

---

## Change 1 (CRITICAL) — Prevent the tutor from narrating its own decision-making

### Problem

When the student said "whatever just tell me the answer," the tutor responded with: "The student is disengaged, not confused — so this isn't an error to flag." This is the model's internal reasoning about how to handle the situation, but it was emitted as visible response text. It has no bracket tags, so the tag-stripping logic doesn't catch it. The student saw the tutor talking about them in third person.

### Fix

Add a rule to the `STATIC_BASE_PROMPT` in `src/lib/system-prompt.ts`. Place it in the **TONE** section, immediately after the line about being direct about errors.

**Find:**

```
- Direct about errors. Warmth does not mean avoiding correction. A warm tutor who never tells you that you are wrong is not warm — they are unhelpful. The kindest thing you can do when a student misreads the text is to say so clearly and help them find the right reading.
```

If that line does not exist yet (it comes from PHASE-CORRECTIVE-FEEDBACK.md which may not be implemented), find this line instead:

```
- No emojis, no cheerleading, no condescension.
```

**Insert immediately after it:**

```
- Never narrate your own decision-making. Do not write sentences like "The student is disengaged, not confused" or "This isn't an error to flag" or "I should redirect here." These are internal reasoning — the student must never see them. If you need to note something for the system, emit it as a bracketed tag (e.g., [NOTE: disengaged, not a misconception]). Any unbracketed sentence that refers to "the student" in third person must be deleted before responding.
```

### Also add a catch-all tag to REQUIRED TAGS

In the REQUIRED TAGS section, add:

```
[NOTE: <internal reasoning>] when you need to record a diagnostic observation that is not a tag above. This will be stripped and never shown to the student.
```

### Also update the tag-stripping in `src/components/chat/message-bubble.tsx`

Add this regex to the `displayContent` chain, before `.trim()`:

```typescript
.replace(/\[NOTE:\s*[\s\S]*?\]/gi, "")
```

And add the same regex to the `parseTags` cleanup in `src/lib/attempt-tracker.ts`, in the `cleanedText` builder.

---

## Change 2 (CRITICAL) — Hide the scaffold kick-off message from the instructor trace

### Problem

The Interaction Trace renders ALL messages, including the hidden kick-off message that bootstraps the conversation ("Hi. My name is Sean. I'm ready to begin the session. OPENING SEQUENCE INSTRUCTION: This is the opening exchange..."). This exposes prompt engineering to instructors and looks unprofessional.

### Fix — Part A: Ensure `hidden` is available in the data

The `Message` model does not have a `hidden` field in Prisma — `hidden` is a client-side flag on the `Message` interface in `client-chat.tsx`. But the kick-off message is always the FIRST user message in the database, and its content starts with a predictable pattern.

In `src/components/instructor/exchange-replay.tsx`, filter it out by detecting the scaffold content pattern.

### Fix — Part B: Update the `ExchangeReplay` component

In `src/components/instructor/exchange-replay.tsx`, add a filter at the top of the component that removes the scaffold message. The scaffold message is always the first user message and contains the string "OPENING SEQUENCE INSTRUCTION".

**Find:**

```tsx
export function ExchangeReplay({ messages, misconceptions }: ReplayProps) {
  if (messages.length === 0) {
    return <p className="text-slate-500 text-sm">No messages yet.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {messages.map((message) => {
```

**Replace with:**

```tsx
export function ExchangeReplay({ messages, misconceptions }: ReplayProps) {
  if (messages.length === 0) {
    return <p className="text-slate-500 text-sm">No messages yet.</p>;
  }

  // Filter out the hidden scaffold message that bootstraps the conversation.
  // It's always the first user message and contains internal instructions.
  const visibleMessages = messages.filter(
    (message) =>
      !(
        message.role === "user" &&
        message.content.includes("OPENING SEQUENCE INSTRUCTION")
      )
  );

  if (visibleMessages.length === 0) {
    return <p className="text-slate-500 text-sm">No messages yet.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {visibleMessages.map((message) => {
```

---

## Change 3 — Render markdown in the Interaction Trace

### Problem

The trace renders message content as plain text via `<p className="whitespace-pre-wrap">{message.content}</p>`. Markdown syntax like `*italics*` and `**bold**` shows as literal asterisks instead of rendered formatting.

### Fix

Import ReactMarkdown and use it for assistant messages in the trace, with the same tag-stripping that `message-bubble.tsx` uses.

**In `src/components/instructor/exchange-replay.tsx`:**

Add the import at the top:

```typescript
import ReactMarkdown from "react-markdown";
```

Create a tag-stripping utility. Add this function before the component:

```typescript
function stripTags(content: string): string {
  return content
    .replace(/\[MODE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[TOPIC_THREAD:\s*[\s\S]*?\]/gi, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_CANONICAL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_PASSAGE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_SEVERITY:\s*[\s\S]*?\]/gi, "")
    .replace(/\[DIRECT_ANSWER:\s*[\s\S]*?\]/gi, "")
    .replace(/\[QTYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[FEEDBACK_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[EXPERT_MODEL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[SELF_EXPLAIN_PROMPTED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[COGNITIVE_CONFLICT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_RESOLVED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_ID:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_STATUS:\s*[\s\S]*?\]/gi, "")
    .replace(/\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*[\s\S]*?\]/gi, "")
    .replace(/\[NOTE:\s*[\s\S]*?\]/gi, "")
    .trim();
}
```

**Note:** Ideally, extract this tag-stripping function into a shared utility file (`src/lib/strip-tags.ts`) and import it in both `message-bubble.tsx` and `exchange-replay.tsx` so it's defined in one place. If you do this, update `message-bubble.tsx` to import from the shared file instead of inlining the regexes.

Then replace the message content rendering in the bubble. **Find:**

```tsx
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                isStudent
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-tr-sm"
                  : "bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {message.content}
              </p>
            </div>
```

**Replace with:**

```tsx
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                isStudent
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-tr-sm"
                  : "bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
              }`}
            >
              {isStudent ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {message.content}
                </p>
              ) : (
                <div className="prose prose-sm max-w-none text-[15px] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
                  <ReactMarkdown>{stripTags(message.content)}</ReactMarkdown>
                </div>
              )}
            </div>
```

---

## Change 4 — Fix "None" vs "0" inconsistency in the student table

### Problem

The Misconceptions Logged column shows the string "None" when there are no misconceptions, while the dashboard uses "0". Numeric values are more scannable and consistent.

### Fix

In `src/app/instructor/[sessionId]/monitor/page.tsx`, find:

```tsx
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
```

**Replace with:**

```tsx
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
```

---

## Change 5 — Tighten the compound question rule in the system prompt

### Problem

The tutor's first Socratic question was: "According to the reading, what drives a system's behavior — and how does that differ from how we usually explain why things go wrong?" This is two questions joined by "and" with an em dash. The HARD RULE already prohibits this, but the model isn't following it consistently.

### Fix

Strengthen the rule in `src/lib/system-prompt.ts`. Find the HARD RULE line:

```
HARD RULE — ONE QUESTION ONLY: Every response must end with exactly one question. Two questions joined by "and", two sentences ending with "?", or a compound question separated by "—" all count as two questions. If you find a second question forming, delete it entirely. This rule has no exceptions.
```

**Replace with:**

```
HARD RULE — ONE QUESTION ONLY: Every response must end with exactly one question. These ALL count as two questions and are FORBIDDEN:
- Two sentences each ending with "?"
- One sentence with two question marks
- "What X — and how/why Y?" (compound question with em dash)
- "What X, and what Y?" (compound question with comma)
- "What X? Also, Y?" (sequential questions)
If you draft a response and find it contains two questions in any form, delete the weaker one entirely. Keep the one that is harder for the student to answer. This rule has no exceptions.
```

---

## Change 6 — Add a catch-all tag-stripping regex

### Problem

If the model invents a new tag format we haven't anticipated, or if a future prompt change adds tags that aren't in the stripping list, they'll leak through to the student and the trace.

### Fix

In both `message-bubble.tsx` and the new shared `stripTags()` function, add a catch-all regex as the LAST entry before `.trim()`:

```typescript
// Catch-all: strip any remaining [UPPERCASE_TAG: ...] patterns
.replace(/\[[A-Z][A-Z_]*:\s*[\s\S]*?\]/g, "")
```

This matches any bracketed tag where the tag name starts with a capital letter and contains only uppercase letters and underscores. It won't match normal text in brackets (like citations `[1]` or asides `[see above]`) because those don't follow the `ALL_CAPS:` pattern.

---

## Verification Checklist

After implementing these changes:

- [ ] **Scaffold message hidden:** Open the Activity Monitor, expand a student trace. Confirm the first visible message is the tutor's greeting, NOT the "Hi. My name is Sean. I'm ready to begin the session. OPENING SEQUENCE INSTRUCTION..." message
- [ ] **Markdown rendered in trace:** Confirm that `*italics*` renders as italics and `**bold**` renders as bold in the interaction trace for assistant messages
- [ ] **Tags stripped from trace:** Confirm that assistant messages in the trace do NOT show `[MODE: ...]`, `[TOPIC_THREAD: ...]`, or any other bracketed tags in the message bubble text (they should only appear as the colored badge pills above the bubble)
- [ ] **"0" not "None":** Confirm the Misconceptions Logged column shows "0" (not "None") when a student has no logged misconceptions
- [ ] **Meta-reasoning suppressed:** Run a new session. Send a disengaged message like "I don't care" or "whatever." Check that the tutor's response does NOT contain third-person references like "The student is disengaged" or "This isn't an error to flag." If the tutor needs to note this, it should appear as a stripped `[NOTE: ...]` tag
- [ ] **Catch-all tag stripping:** Temporarily add a fake tag like `[TEST_TAG: something]` to a tutor response in the database. Confirm it does NOT appear in either the student chat or the instructor trace
- [ ] **Compound question rule:** Run several exchanges and verify the tutor never asks compound questions with em dashes or "and" joining two question clauses
- [ ] **Shared strip function:** Confirm that the tag-stripping logic is defined in ONE place (e.g., `src/lib/strip-tags.ts`) and imported by both `message-bubble.tsx` and `exchange-replay.tsx`
- [ ] **TypeScript builds cleanly:** `npm run build` completes with no errors
