# PHASE-UI-CREATE-SESSION — Create Session Page Improvements

## Overview

The create session page is the instructor's first moment in the app. Currently it presents itself as a standalone form with no sense of context, sequence, or forward momentum. From an instructor's perspective, they don't yet know what steps follow — they don't know they'll need to upload a reading, or that there's a link to share, or how many steps are involved. The form also references "students" throughout the app when the intended audience includes professional adult learners.

This file makes four categories of changes:
1. **Step indicator** — a persistent "you are here" marker showing the three-step setup flow
2. **Copy updates** — "students" → "learners" throughout, tighten the description field label
3. **Field order and helper text** — the description field needs better framing so instructors understand its purpose
4. **Structural cleanup** — remove redundancy between the left-panel description and the form's own footer hint

---

## File to Change

`src/app/instructor/page.tsx`

---

## Change 1 — Add a step indicator component

The three-step flow is: (1) Name your session → (2) Upload a reading → (3) Share the link. This should be visible on every setup step so instructors know where they are.

Add this inline component **before** the `export default function InstructorCreatePage()` declaration:

```tsx
function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { number: 1, label: "Name it" },
    { number: 2, label: "Add a reading" },
    { number: 3, label: "Share the link" },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.number === currentStep
                  ? "bg-[var(--teal)] text-white"
                  : step.number < currentStep
                  ? "bg-[var(--teal)] text-white opacity-40"
                  : "border border-[var(--rule)] text-[var(--dim-grey)]"
              }`}
            >
              {step.number < currentStep ? (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-[12px] ${
                step.number === currentStep
                  ? "font-semibold text-[var(--charcoal)]"
                  : "text-[var(--dim-grey)]"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="mx-3 h-px w-8 bg-[var(--rule)]" />
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Change 2 — Replace the left-panel copy

**Find:**

```tsx
            <p className="eyebrow eyebrow-teal">New Session</p>
            <h1 className="section-title mt-5 max-w-[10ch]">
              Create a reading session.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Name your session and add an optional note for students. After
              you create it, upload your reading and share the link.
            </p>
```

**Replace with:**

```tsx
            <p className="eyebrow eyebrow-teal">Setup</p>
            <h1 className="section-title mt-5 max-w-[10ch]">
              Create a reading session.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Three steps: name your session, upload a reading, then share the link with your learners.
            </p>
            <div className="mt-8">
              <StepIndicator currentStep={1} />
            </div>
```

---

## Change 3 — Update the Session Name field

The field itself is fine. Update only the placeholder to be more concrete and instructive:

**Find:**

```tsx
                    placeholder="Week 3: Systems Thinking"
```

**Replace with:**

```tsx
                    placeholder="e.g. Week 3: Systems Thinking"
```

---

## Change 4 — Update the description field label and helper text

The current label is a question ("What should students know before they begin?") which is good, but it says "students." The helper text is accurate but could be clearer about when to use this field.

**Find:**

```tsx
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    What should students know before they begin?
                  </label>
                  <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                    Optional. This is shown to students on the session entry page.
                  </p>
```

**Replace with:**

```tsx
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    Instructions for learners
                  </label>
                  <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                    Optional. Shown on the entry page before learners begin. Use this to set expectations — e.g. which sections to read, what to focus on.
                  </p>
```

---

## Change 5 — Update the textarea placeholder

**Find:**

```tsx
                    placeholder="e.g. Read the first three chapters before starting. Focus on how the author defines feedback loops."
```

**Replace with:**

```tsx
                    placeholder="e.g. Read the first two sections before starting. Pay attention to how the author defines core terms — the tutor will ask you about them."
```

---

## Change 6 — Update the form footer hint and button

The footer currently says "Next: upload a reading, then share the link with your students." Update to remove "students" and make it consistent with the step indicator framing.

**Find:**

```tsx
                  <div className="flex flex-col gap-3 border-t border-[var(--rule)] pt-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    Next: upload a reading, then share the link with your students.
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="minerva-button"
                  >
                    {loading ? "Creating..." : "Create Session"}
                  </button>
                </div>
```

**Replace with:**

```tsx
                  <div className="flex flex-col gap-3 border-t border-[var(--rule)] pt-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    Next: upload a reading, then share the link.
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="minerva-button"
                  >
                    {loading ? "Creating…" : "Continue"}
                  </button>
                </div>
```

Note: "Creating..." → "Creating…" uses a real ellipsis character. "Create Session" → "Continue" better reflects the forward-momentum framing of a multi-step flow.

---

## Change 7 — Add step indicator to the instructor session management page

The step indicator should appear on the main instructor session page (`src/app/instructor/[sessionId]/page.tsx`) when a session has no reading uploaded yet, showing "Step 2: Add a reading" as the active step. And when a reading exists but no learners have joined, show "Step 3: Share the link."

This is a conditional enhancement. In `src/app/instructor/[sessionId]/page.tsx`:

**Copy the `StepIndicator` component** from `src/app/instructor/page.tsx` into a new shared file: `src/components/ui/step-indicator.tsx`.

```tsx
// src/components/ui/step-indicator.tsx
export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { number: 1, label: "Name it" },
    { number: 2, label: "Add a reading" },
    { number: 3, label: "Share the link" },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.number === currentStep
                  ? "bg-[var(--teal)] text-white"
                  : step.number < currentStep
                  ? "bg-[var(--teal)] text-white opacity-40"
                  : "border border-[var(--rule)] text-[var(--dim-grey)]"
              }`}
            >
              {step.number < currentStep ? (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-[12px] ${
                step.number === currentStep
                  ? "font-semibold text-[var(--charcoal)]"
                  : "text-[var(--dim-grey)]"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="mx-3 h-px w-8 bg-[var(--rule)]" />
          )}
        </div>
      ))}
    </div>
  );
}
```

Then in `src/app/instructor/page.tsx`, replace the inline `StepIndicator` definition with an import:

```tsx
import { StepIndicator } from "@/components/ui/step-indicator";
```

In `src/app/instructor/[sessionId]/page.tsx`, add this import and then render the step indicator conditionally in the page header area. The logic:

- If `session.readings.length === 0` → `currentStep={2}` (needs a reading)
- If `session.readings.length > 0 && session.studentSessions.length === 0` → `currentStep={3}` (needs learners)
- If `session.studentSessions.length > 0` → don't show the step indicator (setup is done)

Determine the current step server-side:

```tsx
// In the server component, after fetching the session:
const setupStep: 1 | 2 | 3 | null =
  session.readings.length === 0
    ? 2
    : session.studentSessions.length === 0
    ? 3
    : null;
```

Pass `setupStep` to the client component and render:

```tsx
{setupStep !== null && (
  <div className="mt-4">
    <StepIndicator currentStep={setupStep} />
  </div>
)}
```

Place this in the left-panel or immediately below the session name heading, wherever the existing header copy sits.

---

## Verification Checklist

After implementing these changes, verify:

- [ ] Create session page shows "Setup" eyebrow and the step indicator with Step 1 highlighted
- [ ] Step indicator shows correct teal/grey states for active vs future steps
- [ ] "Students" does not appear anywhere in the create session page
- [ ] "Continue" button replaces "Create Session" and loading state shows "Creating…"
- [ ] Description field label reads "Instructions for learners" with updated helper text
- [ ] After creating a session, the session management page shows step indicator at Step 2 (no reading yet)
- [ ] After uploading a reading, step indicator advances to Step 3
- [ ] After a learner joins, step indicator disappears
- [ ] `StepIndicator` is defined in a shared component file, not duplicated in two pages
- [ ] TypeScript builds cleanly — `currentStep` prop is typed as `1 | 2 | 3`
