# Chat Rendering Improvements

Improve how AI tutor responses are presented to students. Currently assistant messages render as plain text with raw markdown syntax visible (asterisks showing as literal characters) and no visual hierarchy between explanatory prose and the Socratic question. These changes fix both issues.

---

## FILE 1: Install react-markdown

In the project root, run:

```bash
npm install react-markdown
```

---

## FILE 2: `src/components/chat/message-bubble.tsx`

### Change 1 — Import react-markdown

At the top of the file, add:

```tsx
import ReactMarkdown from 'react-markdown'
```

### Change 2 — Render assistant messages through markdown

Find the section that renders the message content for assistant/tutor messages. It currently renders raw text, something like:

```tsx
<p>{message.content}</p>
```

or

```tsx
<span>{message.content}</span>
```

Replace the assistant message content rendering with:

```tsx
<ReactMarkdown
  components={{
    p: ({ children }) => (
      <p className="tutor-paragraph">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="tutor-question">{children}</strong>
    ),
  }}
>
  {message.content}
</ReactMarkdown>
```

Keep the user message rendering as plain text (do not apply ReactMarkdown to user bubbles).

### Change 3 — Add CSS classes for tutor message typography

In `src/app/globals.css`, add the following rules:

```css
/* Tutor message prose */
.tutor-paragraph {
  margin-bottom: 0.75rem;
  line-height: 1.65;
  color: inherit;
}

.tutor-paragraph:last-child {
  margin-bottom: 0;
}

/* Socratic question — visually distinct from prose */
.tutor-question {
  display: block;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid rgba(17, 120, 144, 0.6);
  background: rgba(17, 120, 144, 0.05);
  border-radius: 0 6px 6px 0;
  font-weight: 600;
  font-size: 0.975rem;
  color: inherit;
  line-height: 1.55;
}
```

**What this achieves:**
- `**bolded question text**` renders as a visually separated block with a teal left-border accent and subtle background tint
- Each paragraph of prose is properly spaced
- The question becomes the most visually salient element in the response — students can locate it instantly on re-read
- Aligns with the teal brand color used elsewhere in the app

---

## FILE 3: `src/lib/system-prompt.ts`

### Change 4 — Enforce question-on-its-own-line convention

In `STATIC_BASE_PROMPT`, find the TONE section and add the following rule:

```
- Always place your Socratic question on its own line, separated from the preceding prose by a blank line. Never embed the question inside a paragraph. The question must be wrapped in **double asterisks** so it renders as bold. Example structure:

  [1–3 sentences of orienting context]

  **[Your single Socratic question here?]**
```

**Why this matters:** The CSS rule for `.tutor-question` targets `<strong>` elements rendered from `**...**`. This system prompt rule ensures the AI reliably uses that formatting convention, so the visual separation is consistent across all responses.

---

## Summary of changes

| File | Change |
|------|--------|
| `package.json` | Add `react-markdown` dependency |
| `src/components/chat/message-bubble.tsx` | Import ReactMarkdown; render assistant messages through it with custom `p` and `strong` component overrides |
| `src/app/globals.css` | Add `.tutor-paragraph` and `.tutor-question` CSS classes |
| `src/lib/system-prompt.ts` | Add formatting rule: question on its own line, wrapped in `**double asterisks**` |

---

## Expected result

Before: a wall of text ending with `**What do you think might be inside a system that could drive its behavior?**` rendered as raw characters.

After:
- Prose renders cleanly with proper spacing
- The Socratic question appears as a visually separated block with a teal left border and subtle background — distinct from the explanatory text, easy to locate and return to while typing a response
- No raw asterisks visible anywhere
