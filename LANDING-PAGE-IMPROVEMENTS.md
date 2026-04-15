# Landing Page — Codex Implementation Instructions

## Context

The landing page (`src/app/page.tsx`) and global styles (`src/app/globals.css`) have been
reviewed against UX/UI best practices and audience fit for higher education instructors.
The dot background from a previous version has already been removed — do not add it back.
This document specifies the remaining changes only.

Work exclusively in these two files unless otherwise noted:
- `src/app/globals.css`
- `src/app/page.tsx`

Do not modify any other files.

---

## CHANGE 1 — Fix the primary button colour (globals.css)

**Problem:** The primary CTA button (`minerva-button`) uses `--signal` (`#df2f26`), which is
red. Red carries warning and danger semantics in most design systems. For a positive primary
action ("Create a Session", "Start Building"), red is wrong.

**Fix:** Change the `minerva-button` background and border to use `--teal` (`#117890`) and
update the hover shadow to match.

Find this block in `globals.css`:

```css
.minerva-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--signal);
  background: var(--signal);
  color: white;
  min-height: 48px;
  padding: 0 22px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.01em;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease;
}

.minerva-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 35px rgba(223, 47, 38, 0.16);
}
```

Replace it with:

```css
.minerva-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--teal);
  background: var(--teal);
  color: white;
  min-height: 48px;
  padding: 0 22px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.01em;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease;
}

.minerva-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 35px rgba(17, 120, 144, 0.2);
}
```

**Acceptance criteria:**
- [ ] Primary buttons ("Create a Session", "Start Building") are teal, not red
- [ ] Hover shadow is a teal glow, not a red glow
- [ ] `--signal` red remains defined in `:root` (used elsewhere in the app for warnings/errors)

---

## CHANGE 2 — Remove the decorative background gradients from .minerva-page (globals.css)

**Problem:** `.minerva-page` has two `radial-gradient` layers that create faint olive and rose
colour washes in the top-right corner of the page. While subtle, they are not needed and
contribute to the visual noise the user has asked to eliminate.

**Fix:** Replace the `background` value in `.minerva-page` with a plain background colour.

Find:

```css
.minerva-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 88% 14%, rgba(114, 133, 3, 0.06), transparent 20rem),
    radial-gradient(circle at 92% 10%, rgba(165, 65, 125, 0.05), transparent 16rem),
    var(--lightest-gray);
}
```

Replace with:

```css
.minerva-page {
  min-height: 100vh;
  background: var(--lightest-gray);
}
```

**Acceptance criteria:**
- [ ] No gradient or coloured wash visible in the hero background
- [ ] Page background is a flat, clean off-white

---

## CHANGE 3 — Fix header label (page.tsx)

**Problem:** "Instructor-Facing Learning Tool" in the top-right of the header is verbose and
internal-sounding. Instructors don't describe tools this way.

Find in `page.tsx`:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
  Instructor-Facing Learning Tool
</p>
```

Replace with:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
  Learning System
</p>
```

---

## CHANGE 4 — Fix "Immediate Product Proof" section label (page.tsx)

**Problem:** "Immediate Product Proof" is internal product-team language, not something that
means anything to an instructor reading it cold.

Find:

```tsx
<p className="eyebrow eyebrow-teal">Immediate Product Proof</p>
```

Replace with:

```tsx
<p className="eyebrow eyebrow-teal">What&rsquo;s Included</p>
```

---

## CHANGE 5 — Fix jargon word "legible" in final CTA section (page.tsx)

**Problem:** "The app is strongest when it makes student preparation legible enough to shape
what happens next." — "legible" is academic jargon. Most instructors say "visible" or "clear".

Find:

```tsx
<p className="body-copy muted-copy mt-6 max-w-[38rem]">
  Start with one reading, one instructor goal, and one session.
  The app is strongest when it makes student preparation legible
  enough to shape what happens next.
</p>
```

Replace with:

```tsx
<p className="body-copy muted-copy mt-6 max-w-[38rem]">
  Start with one reading, one instructor goal, and one session.
  The app is most useful when student preparation is visible
  enough to shape what actually happens in class.
</p>
```

---

## CHANGE 6 — Add setup time signal to hero (page.tsx)

**Problem:** There is no indication of how long setup takes. Instructors adopt tools when they
can picture themselves using it in under 10 minutes. The current copy asks for commitment
before establishing ease.

Find the paragraph below the CTA buttons:

```tsx
<p className="mt-5 text-[13px] leading-6 text-[var(--dim-grey)]">
  Students join with a shared link. Instructors manage the setup and
  review the results.
</p>
```

Replace with:

```tsx
<p className="mt-5 text-[13px] leading-6 text-[var(--dim-grey)]">
  Setup takes under five minutes. Upload a reading, set a goal,
  share a link — students join with an access code, no account required.
</p>
```

---

## CHANGE 7 — Improve "Best For" sidebar label and quickFacts entries (page.tsx)

**Problem:** "Primary User", "Student Experience", and "Instructor Output" are clinical category
labels, not how an instructor would naturally read information about a tool.

Find the `quickFacts` array at the top of `page.tsx`:

```tsx
const quickFacts = [
  {
    label: "Primary User",
    value: "Instructors running reading-based or discussion-based courses",
    color: "var(--teal)",
  },
  {
    label: "Student Experience",
    value: "Guided reasoning before direct explanations",
    color: "var(--olive)",
  },
  {
    label: "Instructor Output",
    value: "Replay, misconceptions, confidence, and report summaries",
    color: "var(--rose)",
  },
];
```

Replace with:

```tsx
const quickFacts = [
  {
    label: "Who uses it",
    value: "Instructors running reading-based or discussion-based courses",
    color: "var(--teal)",
  },
  {
    label: "What students do",
    value: "Explain their thinking and work through guided questions before class",
    color: "var(--olive)",
  },
  {
    label: "What instructors see",
    value: "Replay, misconceptions, confidence ratings, and session summaries",
    color: "var(--rose)",
  },
];
```

Also change the eyebrow label above the sidebar from "Best For" to "At a Glance":

Find:
```tsx
<p className="eyebrow eyebrow-teal">Best For</p>
```

Replace with:
```tsx
<p className="eyebrow eyebrow-teal">At a Glance</p>
```

---

## CHANGE 8 — Strengthen the "How It Works — For Students" copy (page.tsx)

**Problem:** "The tutor pushes for reasoning before it gives explanations" is accurate but
passive. It undersells the key thing instructors care about: students can't just copy an
answer.

Find:

```tsx
<p className="body-copy mt-5 max-w-[29rem]">
  Students begin by stating what they already know, then move
  into guided questions tied to the uploaded reading. The tutor
  pushes for reasoning before it gives explanations.
</p>
```

Replace with:

```tsx
<p className="body-copy mt-5 max-w-[29rem]">
  Students begin by stating what they already know, then work through
  questions tied to the uploaded reading. The tutor asks for reasoning
  first — students can&apos;t skip straight to the answer.
</p>
```

---

## Verification checklist

After making all changes, verify:

- [ ] Primary buttons are teal, not red, on the landing page
- [ ] No gradient or coloured wash in the hero background
- [ ] "Instructor-Facing Learning Tool" → "Learning System" in header
- [ ] "Immediate Product Proof" → "What's Included" in proof section
- [ ] "legible" → "visible" in final CTA copy
- [ ] Setup time copy is present below the CTA buttons
- [ ] "Primary User / Student Experience / Instructor Output" → natural language labels
- [ ] "Best For" → "At a Glance"
- [ ] Students copy updated in How It Works section
- [ ] No regressions in other pages (instructor page, student chat, monitor, report)
- [ ] `npm run dev` runs without errors
- [ ] `npm run build` completes without errors

## What NOT to change

- Do not modify the three-step workflow (`workflow` array) — the copy is clear
- Do not modify the `capabilities` array content — "Grounded tutoring", "Assessment protection",
  "Learning signals" are accurate and accessible
- Do not modify the final CTA headline "Use pre-class tutoring to arrive at better class
  discussion, not just more logged-in activity." — this is strong
- Do not add a product screenshot (this requires design assets not yet available)
- Do not change the layout structure, font choices, or colour tokens
