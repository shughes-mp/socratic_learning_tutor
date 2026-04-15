# Setup Flow — Codex Implementation Instructions

## Context

This file covers the full instructor-to-student setup flow across four files. The goal is
to make the flow immediately legible to first-time instructors and first-time students —
no documentation required.

The changes are split by file. Apply all changes in order. Do not modify any other files
unless explicitly noted.

Files modified in this document:
- `src/app/instructor/page.tsx` (session creation form)
- `src/app/instructor/[sessionId]/page.tsx` (session management / workspace)
- `src/app/s/[accessCode]/page.tsx` (student entry page — server component)
- `src/app/s/[accessCode]/student-entry-form.tsx` (student name entry form)

---

## FILE 1 — `src/app/instructor/page.tsx`

### CHANGE 1-A — Remove Course Context and Learning Goal from the creation form

**Problem:** The creation form asks for four fields: Session Name, Description, Course
Context, and Learning Goal. Course Context and Learning Goal are the hardest to answer
before the document is uploaded. They are also editable on the management page, making
them duplicates. Front-loading them increases abandonment and confusion.

**Fix:** Remove the `courseContext` and `learningGoal` state variables, their form fields,
and their submission data. The form should only have two fields: Session Name and Description.

Find and remove these two state declarations:

```typescript
  const [courseContext, setCourseContext] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
```

Find and remove `courseContext` and `learningGoal` from the fetch body:

```typescript
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          courseContext: courseContext.trim() || undefined,
          learningGoal: learningGoal.trim() || undefined,
        }),
```

Replace with:

```typescript
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
```

Find and remove both form field blocks entirely — the Course Context block:

```tsx
                <div>
                  <label htmlFor="course-context" className="minerva-label">
                    Course Context
                  </label>
                  <textarea
                    id="course-context"
                    value={courseContext}
                    onChange={(e) => setCourseContext(e.target.value)}
                    placeholder="How does this reading fit the broader arc of the course or unit?"
                    rows={4}
                    className="minerva-textarea"
                  />
                </div>
```

And the Learning Goal block:

```tsx
                <div>
                  <label htmlFor="learning-goal" className="minerva-label">
                    Learning Goal
                  </label>
                  <textarea
                    id="learning-goal"
                    value={learningGoal}
                    onChange={(e) => setLearningGoal(e.target.value)}
                    placeholder="What should students be able to explain, analyze, or apply after the session?"
                    rows={4}
                    className="minerva-textarea"
                  />
                </div>
```

Delete both blocks. Leave no placeholder divs.

**Acceptance criteria:**
- [ ] The creation form has exactly two fields: Session Name and Description
- [ ] `courseContext` and `learningGoal` are not referenced anywhere in the file
- [ ] The form still submits and creates a session successfully

---

### CHANGE 1-B — Rename the Description field label

**Problem:** "Description" is generic. Instructors don't know whether this text is shown
to students or is internal. It faces students — the label should reflect that.

Find:

```tsx
                <div>
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    Description
                  </label>
                  <textarea
                    id="session-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What should students understand about this session before they begin?"
                    rows={3}
                    className="minerva-textarea"
                  />
                </div>
```

Replace with:

```tsx
                <div>
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    What should students know before they begin?
                  </label>
                  <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                    Optional. This is shown to students on the session entry page.
                  </p>
                  <textarea
                    id="session-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Read the first three chapters before starting. Focus on how the author defines feedback loops."
                    rows={3}
                    className="minerva-textarea"
                  />
                </div>
```

**Acceptance criteria:**
- [ ] The label reads "What should students know before they begin?"
- [ ] A grey helper line below the label reads "Optional. This is shown to students on the session entry page."
- [ ] Placeholder text gives a concrete example

---

### CHANGE 1-C — Fix the page headline, eyebrow, and description copy

**Problem:** "Session Design" sounds technical. "Build a guided learning environment."
sounds like engineering infrastructure. The hint below the submit button is well-intentioned
but easy to miss.

Find:

```tsx
            <p className="eyebrow eyebrow-teal">Session Design</p>
            <h1 className="section-title mt-5 max-w-[10ch]">
              Build a guided learning environment.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Define the reading context, the learning goal, and the boundaries
              for the tutoring conversation. You can upload files immediately
              after the session is created.
            </p>
```

Replace with:

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

Also update the hint text below the submit button:

Find:

```tsx
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    After creation, you can upload readings, add protected
                    assessments, and share the student link.
                  </p>
```

Replace with:

```tsx
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    Next: upload a reading, then share the link with your students.
                  </p>
```

**Acceptance criteria:**
- [ ] Eyebrow reads "New Session"
- [ ] Headline reads "Create a reading session."
- [ ] Description paragraph explains the two-step flow (create → upload → share)
- [ ] Hint below submit button is concise and action-oriented

---

## FILE 2 — `src/app/instructor/[sessionId]/page.tsx`

### CHANGE 2-A — Add setup progress strip

**Problem:** After creating a session, instructors land on the management page with no
indication of what to do next or how far along they are. The most important action
(uploading a reading) is below the fold with no visual signal.

**Fix:** Add a three-step progress indicator between the header card and the status bar.
It shows steps: "Session created", "Upload a reading", "Share with students."

**Step 2-A-i:** Ensure `readings`, `assessments`, and `isActive` are derived before the
early return guards, so they are available throughout the component. Find:

```typescript
  const readings = files.filter((f) => f.category === "reading");
  const assessments = files.filter((f) => f.category === "assessment");

  if (loading) {
```

Replace with:

```typescript
  const readings = files.filter((f) => f.category === "reading");
  const assessments = files.filter((f) => f.category === "assessment");
  const isActive = readings.length > 0;

  if (loading) {
```

**Step 2-A-ii:** Add the progress strip. Find the status bar block:

```tsx
        {/* Status bar */}
        <div className={`px-4 py-3 text-sm ${
          readings.length === 0
            ? "border border-[rgba(144,111,18,0.22)] bg-[rgba(144,111,18,0.08)] text-[#906f12]"
            : "border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.08)] text-[var(--teal)]"
        }`}>
```

Immediately before this block, insert:

```tsx
        {/* Setup progress strip */}
        <div className="minerva-card px-6 py-4 md:px-8">
          <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
            {[
              { label: "Session created", done: true },
              { label: "Upload a reading", done: isActive },
              { label: "Share with students", done: isActive },
            ].map((step, i, arr) => (
              <li key={step.label} className="flex items-center gap-3 sm:flex-1">
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    step.done
                      ? "bg-[var(--teal)] text-white"
                      : "border-2 border-[var(--light-grey)] text-[var(--dim-grey)]"
                  }`}
                >
                  {step.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-[13px] font-medium ${
                    step.done ? "text-[var(--charcoal)]" : "text-[var(--dim-grey)]"
                  }`}
                >
                  {step.label}
                </span>
                {i < arr.length - 1 && (
                  <span className="hidden sm:block flex-1 border-t border-dashed border-[var(--rule)] mx-3" />
                )}
              </li>
            ))}
          </ol>
        </div>
```

**Acceptance criteria:**
- [ ] Three steps are shown: "Session created", "Upload a reading", "Share with students"
- [ ] Step 1 always shows a teal filled checkmark circle
- [ ] Steps 2 and 3 show a numbered outline circle when incomplete and a teal checkmark when a reading is uploaded
- [ ] On mobile the steps stack vertically; on sm+ they sit in a horizontal row
- [ ] The strip appears between the header card and the status bar

---

### CHANGE 2-B — Rename "Teaching Context" to "Tutor Configuration" and relabel its fields

**Problem:** "Teaching Context" sounds like a section describing the instructor's background,
not a configuration panel that controls AI behavior. The field labels "Course Context" and
"Session Learning Goal" are also abstract.

Find the Teaching Context heading:

```tsx
              <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching Context
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
              </p>
```

Replace with:

```tsx
              <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Tutor Configuration
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                What you write here shapes how the tutor opens the session, checks for
                understanding, and identifies gaps. Optional, but improves response quality.
              </p>
```

Find the Course Context label:

```tsx
            <label className="minerva-label">
              Course Context
            </label>
```

Replace with:

```tsx
            <label className="minerva-label">
              Where this fits in your course
            </label>
```

Find the Course Context textarea placeholder:

```
              placeholder="How this reading fits the broader course arc..."
```

Replace with:

```
              placeholder="e.g. This is Week 4 of a 10-week unit on systems thinking. Students have read Meadows chapters 1–3 and are familiar with stocks and flows, but have not yet covered feedback loops."
```

Find the Session Learning Goal label:

```tsx
            <label className="minerva-label">
              Session Learning Goal
            </label>
```

Replace with:

```tsx
            <label className="minerva-label">
              What you want students to be able to do
            </label>
```

Find the Session Learning Goal textarea placeholder:

```
              placeholder="What students should be able to explain or apply by the end of the session..."
```

Replace with:

```
              placeholder="e.g. Explain the difference between reinforcing and balancing feedback loops, and identify at least one example of each in the reading."
```

**Acceptance criteria:**
- [ ] Section heading reads "Tutor Configuration"
- [ ] The description line explains that this content shapes AI behaviour
- [ ] "Course Context" label → "Where this fits in your course"
- [ ] "Session Learning Goal" label → "What you want students to be able to do"
- [ ] Both placeholders now show concrete examples
- [ ] "Save Context" button label → change to "Save Configuration" (find `"Save Context"` in the button text and replace with `"Save Configuration"`)

---

## FILE 3 — `src/app/s/[accessCode]/page.tsx`

### CHANGE 3-A — Add a "not yet ready" guard for students

**Problem:** If an instructor shares the student link before uploading a reading, students
can enter and start a chat session, but the tutor has no document to work from. There is
no error — the session just lacks context. Students should see a clear "not ready yet"
message instead of the entry form.

**Fix:** Include a count of readings in the Prisma query and show a holding message if
the session has no readings.

Find the Prisma query:

```typescript
  const session = await prisma.session.findUnique({
    where: { accessCode },
    select: {
      id: true,
      name: true,
      description: true,
      closesAt: true,
    },
  });
```

Replace with:

```typescript
  const session = await prisma.session.findUnique({
    where: { accessCode },
    select: {
      id: true,
      name: true,
      description: true,
      closesAt: true,
      _count: {
        select: { readings: true },
      },
    },
  });
```

Then find the `session.closesAt` check block:

```typescript
  if (session.closesAt && new Date(session.closesAt) < new Date()) {
    return (
      <SessionMessage
        title="Session Closed"
        description="This tutoring session is no longer accepting new students. Please contact your instructor if you need access."
      />
    );
  }
```

After this block (before the final `return`), insert:

```typescript
  if (session._count.readings === 0) {
    return (
      <SessionMessage
        title="Session Not Ready Yet"
        description="Your instructor is still setting up this session. Check back shortly or ask your instructor when it will be available."
      />
    );
  }
```

**Acceptance criteria:**
- [ ] If a session has zero readings, students see "Session Not Ready Yet" with a helpful message
- [ ] If a session has one or more readings, the entry form displays as normal
- [ ] The Prisma query still compiles without TypeScript errors (the `_count` syntax is valid with Prisma 4+)

---

### CHANGE 3-B — Remove "Student Entry" eyebrow and improve behavioral expectations

**Problem:** "Student Entry" is institutional and cold. The behavioral expectations
paragraph is important but displayed as dense body text that students will skip.

Find the student entry left-column content:

```tsx
          <div className="px-4 py-14 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">Student Entry</p>
            <h1 className="section-title mt-5 max-w-[11ch]">{session.name}</h1>
            {session.description && (
              <p className="body-copy muted-copy mt-6 max-w-[26rem]">
                {session.description}
              </p>
            )}
            <p className="body-copy mt-8 max-w-[28rem]">
              You will be asked to explain what you think, respond to guided
              prompts, and work toward your own understanding before the tutor
              offers direct explanations.
            </p>
          </div>
```

Replace with:

```tsx
          <div className="px-4 py-14 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">Reading Session</p>
            <h1 className="section-title mt-5 max-w-[11ch]">{session.name}</h1>
            {session.description && (
              <p className="body-copy muted-copy mt-6 max-w-[26rem]">
                {session.description}
              </p>
            )}
            <div className="mt-8 space-y-3 max-w-[28rem]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--dim-grey)]">
                How this works
              </p>
              <ul className="space-y-2.5">
                {[
                  "Start by sharing what you already know about the topic.",
                  "The tutor will ask questions — not give you answers directly.",
                  "Work through the material at your own pace. There\u2019s no time limit.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(17,120,144,0.12)]">
                      <svg className="w-2.5 h-2.5 text-[var(--teal)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-[14px] leading-6 text-[var(--charcoal)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
```

**Acceptance criteria:**
- [ ] "Student Entry" eyebrow is replaced by "Reading Session"
- [ ] The paragraph of behavioral expectations is replaced by a three-item list
- [ ] Each list item has a small teal circle checkmark icon
- [ ] The section heading "How this works" appears above the list
- [ ] Session name and description display are unchanged

---

## FILE 4 — `src/app/s/[accessCode]/student-entry-form.tsx`

### CHANGE 4-A — Rename label, update button text, add reassurance note

**Problem:** "Your Name" is a bare label. "Start Session" sounds like activating software,
not beginning a tutoring conversation. There is no reassurance for students about data privacy
or account requirements.

Find the label:

```tsx
        <label htmlFor="student-name" className="minerva-label">
          Your Name
        </label>
```

Replace with:

```tsx
        <label htmlFor="student-name" className="minerva-label">
          What&apos;s your name?
        </label>
```

Find the submit button content:

```tsx
      <button
        type="submit"
        disabled={loading}
        className="minerva-button w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting...
          </span>
        ) : (
          "Start Session"
        )}
      </button>
```

Replace with:

```tsx
      <button
        type="submit"
        disabled={loading}
        className="minerva-button w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting...
          </span>
        ) : (
          "Begin"
        )}
      </button>
      <p className="text-center text-[11px] text-[var(--dim-grey)]">
        No account needed. Your responses are only visible to your instructor.
      </p>
```

**Acceptance criteria:**
- [ ] Label reads "What's your name?" (using the `&apos;` HTML entity for the apostrophe)
- [ ] Button text reads "Begin" when not loading, "Starting..." when loading
- [ ] A small grey line appears below the button: "No account needed. Your responses are only visible to your instructor."
- [ ] Form still submits and navigates to the chat page

---

## Verification checklist

After all changes, verify the complete instructor-to-student flow end-to-end:

**Instructor creation:**
- [ ] Creation form has exactly 2 fields: Session Name + "What should students know before they begin?"
- [ ] Eyebrow: "New Session", Headline: "Create a reading session."
- [ ] Submitting creates the session and redirects to the management page

**Session management:**
- [ ] Progress strip shows 3 steps; Steps 1 is checked on arrival
- [ ] Uploading a reading checks Steps 2 and 3
- [ ] Section previously called "Teaching Context" now reads "Tutor Configuration"
- [ ] Field labels use natural language ("Where this fits in your course", "What you want students to be able to do")
- [ ] Save button reads "Save Configuration"

**Student entry — before readings uploaded:**
- [ ] Visiting the student link shows "Session Not Ready Yet" with instructor guidance message
- [ ] Entry form is not shown

**Student entry — after readings uploaded:**
- [ ] Eyebrow reads "Reading Session"
- [ ] "How this works" section shows 3 bullet items with teal circle icons
- [ ] Label reads "What's your name?"
- [ ] Button reads "Begin"
- [ ] Reassurance note appears below button

**General:**
- [ ] `npm run dev` runs without TypeScript errors
- [ ] `npm run build` completes without errors
- [ ] No regressions on the monitor or report pages

## What NOT to change

- Do not modify any API route files
- Do not modify `globals.css` or any other CSS file
- Do not modify the chat page or chat client component
- Do not modify the monitor or report pages
- Do not change the `handleUpload`, `handleRemoveFile`, `generateSuggestedMap`, or
  `saveTeachingContext` function implementations
- Do not remove or rename the `accessCode` field displayed in the management page
