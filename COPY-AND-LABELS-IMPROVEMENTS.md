# Copy and Labels Improvements

Every user-facing term, label, description, placeholder, error message, and instruction in the app needs to be instantly understandable to two audiences: (1) instructors at partner institutions who may have limited technical vocabulary and no familiarity with learning science frameworks, and (2) students who range from 18-year-old undergrads to 55-year-old executives. This file covers all changes needed.

---

## FILE 1: `src/app/s/[accessCode]/page.tsx`

### Change 1 — Remove "Student Access" eyebrow from error states

Find the `SessionMessage` component. It renders:

```tsx
<p className="eyebrow eyebrow-rose">Student Access</p>
```

"Student Access" is institutional jargon. Students don't think of themselves as requesting "access."

**Replace with:**

```tsx
<p className="eyebrow eyebrow-rose">Session unavailable</p>
```

### Change 2 — Fix "no time limit" claim in the "How this works" bullet list

Find the third bullet item in the list:

```
"Work through the material at your own pace. There's no time limit."
```

This is misleading — there IS an exchange limit and students see a progress bar. Saying "no time limit" creates a trust problem when the session ends.

**Replace with:**

```
"Take your time with each response. Quality matters more than speed."
```

---

## FILE 2: `src/app/s/[accessCode]/chat/client-chat.tsx`

### Change 3 — Fix "Reflection summary" heading on session complete screen

Find:

```tsx
<h1 className="section-title mt-5 max-w-[11ch]">
  Reflection summary for {studentName ?? "this session"}.
</h1>
```

"Reflection" implies the student did something reflective. The summary is AI-generated, not student-authored.

**Replace with:**

```tsx
<h1 className="section-title mt-5 max-w-[11ch]">
  Session summary for {studentName ?? "you"}.
</h1>
```

### Change 4 — Fix orientation text in the "About this session" panel

Find:

```tsx
<p className="mt-3 max-w-[40rem] text-[14px] leading-7 text-[var(--dim-grey)]">
  Start by sharing what you already know about the topic.
  The tutor will ask questions — not give you answers.
  Work toward understanding before explanations are offered.
</p>
```

The third sentence is vague and passive. "Work toward understanding before explanations are offered" doesn't tell the student what to actually do.

**Replace with:**

```tsx
<p className="mt-3 max-w-[40rem] text-[14px] leading-7 text-[var(--dim-grey)]">
  Start by sharing what you already know about the topic.
  The tutor will ask questions — not give you answers.
  Try to explain your thinking before asking for help.
</p>
```

---

## FILE 3: `src/app/instructor/[sessionId]/page.tsx`

### Change 5 — Rename "Tutor Stance" section to "Interaction style"

Find wherever the stance selector section is labeled. Look for text containing "Tutor Stance" or "Stance".

**Replace the section heading with:** `Interaction style`

Also update the two option descriptions if they say "Best for undergraduate learners" and "Better for professional/executive learners" — reframe as:

- **Directed Tutor:** "Guides the student through probing questions. The tutor leads."
- **Peer Mentor:** "Engages as a thinking partner, challenging interpretations collaboratively. Good for experienced learners."

Remove age/population labels ("undergraduate", "professional/executive") — instructors should choose based on the interaction style they want, not guess which demographic bucket their students fall into.

### Change 6 — Add helper text to "Course Context" field

Find the label for the course context textarea. It likely says "Course Context" or similar.

**Add helper text below the label:**

```tsx
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  Background the tutor needs — what course this is for, where students are in the curriculum, what they've covered so far.
</p>
```

### Change 7 — Add helper text to "Learning Goal" field

Find the label for the learning goal textarea.

**Add helper text below the label:**

```tsx
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  What you want students to understand by the end of this session.
</p>
```

### Change 8 — Add helper text to "Learning Outcomes" field

Find the label for the learning outcomes textarea. It likely says "Learning Outcomes (optional)".

**Change the label to:** `Learning Outcomes`

**Add helper text below the label:**

```tsx
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  Optional. The specific skills or understandings students should demonstrate. These are referenced in student reports.
</p>
```

### Change 9 — Relabel process level options in checkpoint UI

Find the checkpoint creation and editing forms where process level is selected. The current options are academic taxonomy terms: "Retrieve", "Infer", "Integrate", "Evaluate".

**Replace with natural-language primary labels.** Update the `formatProcessLevelLabel` function (around line 41):

```tsx
function formatProcessLevelLabel(processLevel: CheckpointProcessLevel) {
  switch (processLevel) {
    case "retrieve":
      return "Find in the text";
    case "infer":
      return "Read between the lines";
    case "integrate":
      return "Connect ideas";
    case "evaluate":
      return "Judge the argument";
  }
}
```

If there is a dropdown or selector for process level in the checkpoint creation form that shows descriptions, update those descriptions to:

- **Find in the text** — "Can the student locate specific information?"
- **Read between the lines** — "Can the student draw conclusions the author implies but doesn't state?"
- **Connect ideas** — "Can the student link ideas across different parts of the reading?"
- **Judge the argument** — "Can the student assess the strength of the author's reasoning?"

### Change 10 — Relabel "Passage Anchors" field

Find the checkpoint form field labeled "Passage Anchors" or "passageAnchors".

**Change the label to:** `Which part of the reading?`

**Change the placeholder to:** `e.g., Section 2, paragraphs 3–5`

### Change 11 — Fix checkpoint-related error messages and toasts

Find and replace these strings throughout the file:

| Current text | Replace with |
|---|---|
| `"Add a checkpoint prompt before saving."` | `"Write a question before saving."` |
| `"Checkpoint prompt cannot be empty."` | `"The question can't be empty."` |
| `"Checkpoint added."` | `"Question added."` |
| `"Checkpoint updated."` | `"Question updated."` |
| `"Checkpoint removed."` | `"Question removed."` |
| `"Suggestions applied to checkpoint."` | `"Suggestions applied."` |
| `"Failed to create checkpoint."` | `"Failed to add question."` |
| `"Failed to update checkpoint."` | `"Failed to update question."` |
| `"Failed to delete checkpoint."` | `"Failed to remove question."` |
| `"Failed to improve checkpoint."` | `"Failed to get suggestions."` |
| `"Failed to apply checkpoint suggestions."` | `"Failed to apply suggestions."` |
| `"Failed to reorder checkpoints."` | `"Failed to reorder questions."` |
| `"Failed to load checkpoints."` | `"Failed to load questions."` |

### Change 12 — Rename "Improve this checkpoint" button

Find the button or link that triggers the lint/improve flow for a checkpoint. It likely says "Improve this checkpoint" or similar.

**Replace with:** `Get feedback on this question`

If there is a shorter variant used elsewhere, use: `Suggest improvements`

### Change 13 — Update "Learning Checkpoints" section header and description

Find the section header for checkpoints. If it says "Learning Checkpoints", change it:

**Replace header with:** `Key Questions`

**Replace or add subtext:** `Questions students should be able to answer after working through the reading. With {maxExchanges} exchanges, aim for about {recommendedCount} questions.`

(The `recommendedCount` should come from the existing `getRecommendedCheckpoints()` function.)

### Change 14 — Relabel "Prerequisite Map" in advanced settings

Find the advanced settings section containing the prerequisite map textarea.

**Change the label from** "Prerequisite Map" **to:** `Concept dependencies`

**Add helper text:**

```tsx
<p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
  A map of which concepts build on others. You can generate this automatically from your reading.
</p>
```

### Change 15 — Fix toast message for saving configuration

Find:

```
"Tutor configuration saved."
```

**Replace with:**

```
"Settings saved."
```

Also find:

```
"Failed to save tutor configuration."
```

**Replace with:**

```
"Failed to save settings."
```

---

## FILE 4: `src/lib/system-prompt.ts`

### Change 16 — Fix system prompt opening line

Find the first line of `STATIC_BASE_PROMPT`:

```
You are a Socratic tutor for adult professional learners.
```

This hard-codes one audience. The tool serves both undergrads and professionals — the stance parameter handles audience-specific framing.

**Replace with:**

```
You are a Socratic reading tutor.
```

The rest of the sentence ("Your job is to help students construct durable understanding from the assigned readings.") is fine — keep it.

---

## FILE 5: `src/app/instructor/page.tsx`

No changes needed. The session creation form copy is clean and clear.

---

## Summary

| # | File | What changes |
|---|------|-------------|
| 1 | `s/[accessCode]/page.tsx` | "Student Access" → "Session unavailable" |
| 2 | `s/[accessCode]/page.tsx` | Fix "no time limit" claim |
| 3 | `s/[accessCode]/chat/client-chat.tsx` | "Reflection summary" → "Session summary" |
| 4 | `s/[accessCode]/chat/client-chat.tsx` | Fix vague orientation sentence |
| 5 | `instructor/[sessionId]/page.tsx` | "Tutor Stance" → "Interaction style", remove demographic labels |
| 6 | `instructor/[sessionId]/page.tsx` | Add helper text to Course Context |
| 7 | `instructor/[sessionId]/page.tsx` | Add helper text to Learning Goal |
| 8 | `instructor/[sessionId]/page.tsx` | Add helper text to Learning Outcomes |
| 9 | `instructor/[sessionId]/page.tsx` | Process levels: Retrieve → "Find in the text", etc. |
| 10 | `instructor/[sessionId]/page.tsx` | "Passage Anchors" → "Which part of the reading?" |
| 11 | `instructor/[sessionId]/page.tsx` | Replace all "checkpoint" in user-facing messages with "question" |
| 12 | `instructor/[sessionId]/page.tsx` | "Improve this checkpoint" → "Get feedback on this question" |
| 13 | `instructor/[sessionId]/page.tsx` | "Learning Checkpoints" → "Key Questions" |
| 14 | `instructor/[sessionId]/page.tsx` | "Prerequisite Map" → "Concept dependencies" |
| 15 | `instructor/[sessionId]/page.tsx` | "Tutor configuration saved" → "Settings saved" |
| 16 | `system-prompt.ts` | "Socratic tutor for adult professional learners" → "Socratic reading tutor" |

---

## Important note

The session management page file (`src/app/instructor/[sessionId]/page.tsx`) appears to be truncated — it ends at line 684 mid-JSX, cutting off inside a className attribute. If the file is incomplete, the remaining JSX may contain additional labels and copy that need the same treatment. After fixing the truncation, scan the rest of the file for any remaining instances of "checkpoint" in user-facing strings and replace with "question", and check that all field labels follow the same plain-language pattern established above.
