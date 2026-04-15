# Session Workspace — Codex Implementation Instructions

## Context

The instructor session management page (`src/app/instructor/[sessionId]/page.tsx`) has been
reviewed against UX/UI best practices and the needs of higher-education instructors. The file
currently contains 550 lines. Work exclusively in this file unless a change explicitly names
a different file.

Do not modify: student-facing pages, API routes, the monitor page, the report page, or any
CSS files, unless a change explicitly names them.

---

## CHANGE 1 — Fix the raw error banner (Critical)

**Problem:** When a server-side error occurs, the API may return an HTML page instead of JSON.
The current `fetchSession` function calls `res.json()` without guarding against non-JSON
responses. This causes a raw JavaScript error (`Unexpected token '<', '<!DOCTYPE'...`) to
appear in the UI, which is meaningless to instructors.

**Fix:** Replace the `fetchSession` function body with a version that guards against
non-JSON responses and translates all errors into plain English.

Find this entire function:

```typescript
  const fetchSession = useCallback(async () => {
    try {
      // Fetch session details from the files endpoint (which includes session info)
      const res = await fetch(`/api/sessions/${sessionId}/files`);
      if (!res.ok) throw new Error("Session not found.");
      const data = await res.json();
      setFiles(data.files);

      // Fetch session config separately
      const configRes = await fetch(`/api/sessions/${sessionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty patch to get current data
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        setSession({
          id: configData.id,
          name: configData.name,
          description: configData.description,
          courseContext: configData.courseContext,
          learningGoal: configData.learningGoal,
          prerequisiteMap: configData.prerequisiteMap,
          accessCode: configData.accessCode,
          createdAt: "",
          maxExchanges: configData.maxExchanges,
          readingsCount: data.files.filter((f: FileInfo) => f.category === "reading").length,
          assessmentsCount: data.files.filter((f: FileInfo) => f.category === "assessment").length,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);
```

Replace with:

```typescript
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files`);

      // Guard against HTML error pages (e.g. database not yet reachable)
      const filesContentType = res.headers.get("content-type") ?? "";
      if (!filesContentType.includes("application/json")) {
        throw new Error(
          "The server is not responding correctly. Please refresh the page or contact support if the issue persists."
        );
      }

      const filesData = await res.json();
      if (!res.ok) {
        throw new Error(filesData.error || "Failed to load session files.");
      }
      setFiles(filesData.files);

      // Fetch session config
      const configRes = await fetch(`/api/sessions/${sessionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (configRes.ok) {
        const configData = await configRes.json().catch(() => null);
        if (configData) {
          setSession({
            id: configData.id,
            name: configData.name,
            description: configData.description,
            courseContext: configData.courseContext,
            learningGoal: configData.learningGoal,
            prerequisiteMap: configData.prerequisiteMap,
            accessCode: configData.accessCode,
            createdAt: "",
            maxExchanges: configData.maxExchanges,
            readingsCount: filesData.files.filter((f: FileInfo) => f.category === "reading").length,
            assessmentsCount: filesData.files.filter((f: FileInfo) => f.category === "assessment").length,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session.";
      // Never show raw JavaScript errors or HTML to the user
      if (message.includes("<!DOCTYPE") || message.includes("Unexpected token")) {
        setError(
          "The server returned an unexpected response. Please refresh the page."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);
```

**Acceptance criteria:**
- [ ] The error banner never shows raw JavaScript parse errors or HTML fragments
- [ ] If the database is unreachable, the error banner shows a plain English message
- [ ] If the session is not found, the error banner shows "Failed to load session files." or similar

---

## CHANGE 2 — Disable "Student Activity" and "Report" buttons when session is inactive

**Problem:** The "Student Activity" and "Report" buttons link to pages that will have no
data until at least one reading is uploaded. They look active and clickable at all times,
misleading instructors into clicking them prematurely.

**Fix:** Add `aria-disabled` and a visual disabled style when `readings.length === 0`.
Note: `readings` is derived from `files` on line 193 of the original file — it is available
in the render scope. However because `readings` is derived after the early returns, you
must derive it before the `if (loading)` check, or use `files` directly in the header.
The safest approach is to derive `readings` and `assessments` before the early returns.

Find:

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

Then find the two Link buttons in the header:

```tsx
            <div className="flex gap-2">
              <Link
                href={`/instructor/${sessionId}/monitor`}
                className="minerva-button minerva-button-secondary"
              >
                Student Activity
              </Link>
              <Link
                href={`/instructor/${sessionId}/report`}
                className="minerva-button minerva-button-secondary"
              >
                Report
              </Link>
            </div>
```

Replace with:

```tsx
            <div className="flex gap-2">
              <Link
                href={isActive ? `/instructor/${sessionId}/monitor` : "#"}
                aria-disabled={!isActive}
                title={!isActive ? "Upload a reading to activate this session first" : undefined}
                className={`minerva-button minerva-button-secondary ${
                  !isActive ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Student Activity
              </Link>
              <Link
                href={isActive ? `/instructor/${sessionId}/report` : "#"}
                aria-disabled={!isActive}
                title={!isActive ? "Upload a reading to activate this session first" : undefined}
                className={`minerva-button minerva-button-secondary ${
                  !isActive ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Report
              </Link>
            </div>
```

**Acceptance criteria:**
- [ ] Before any reading is uploaded, both buttons are visually dimmed (opacity ~40%)
- [ ] Clicking the dimmed buttons does nothing (pointer-events-none)
- [ ] Hovering the dimmed buttons shows a tooltip: "Upload a reading to activate this session first"
- [ ] After a reading is uploaded, both buttons become fully active and navigate correctly

---

## CHANGE 3 — Move access code card below the status bar, lock it when inactive

**Problem:** The access code and "Copy Student Link" button are displayed prominently at the
top of the page, before the instructor has even uploaded a reading. An instructor could share
the link before the session is usable.

**Fix:** Move the access code card to below the status bar. When the session is inactive
(no readings), render it in a locked/muted state with explanatory copy instead of the
copy button.

Find the share link card section:

```tsx
          {/* Share link card */}
          <div className="minerva-panel mt-6 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="eyebrow eyebrow-teal">
                  Access Code
                </p>
                <p className="mt-1 text-lg font-mono font-semibold text-[var(--charcoal)]">
                  {session.accessCode}
                </p>
              </div>
              <button
                onClick={copyLink}
                className="minerva-button"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Student Link
                  </>
                )}
              </button>
            </div>
          </div>
```

Delete this entire block (from `{/* Share link card */}` to the closing `</div>`). Do not
leave a placeholder.

Then find the error banner block:

```tsx
        {error && (
          <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
            {error}
          </div>
        )}
```

After this block, insert the access code card in its new position:

```tsx
        {/* Share link card — shown after status bar */}
        {session && (
          <div className="minerva-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className={`eyebrow ${isActive ? "eyebrow-teal" : "eyebrow-rose"}`}>
                  {isActive ? "Access Code" : "Access Code — Not yet active"}
                </p>
                <p className={`mt-1 text-lg font-mono font-semibold ${
                  isActive ? "text-[var(--charcoal)]" : "text-[var(--dim-grey)] select-none blur-[3px]"
                }`}>
                  {session.accessCode}
                </p>
                {!isActive && (
                  <p className="mt-1 text-xs text-[var(--dim-grey)]">
                    Upload at least one reading below to activate this session.
                  </p>
                )}
              </div>
              {isActive && (
                <button
                  onClick={copyLink}
                  className="minerva-button"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Student Link
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
```

**Acceptance criteria:**
- [ ] When no readings are uploaded: access code is blurred and the copy button is hidden
- [ ] When no readings are uploaded: "Access Code — Not yet active" eyebrow is shown in rose
- [ ] When readings are uploaded: access code is clear, copy button is shown in teal
- [ ] The status bar now appears before the access code card in the page flow

---

## CHANGE 4 — Remove redundant "Teaching Context" eyebrow label

**Problem:** The Teaching Context card has both a small teal eyebrow that says "Teaching
Context" and a large serif heading that also says "Teaching Context". This is duplicated
information that wastes vertical space.

Find:

```tsx
            <div>
              <p className="eyebrow eyebrow-teal">Teaching Context</p>
              <h2 className="mt-3 font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching Context
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
              </p>
            </div>
```

Replace with:

```tsx
            <div>
              <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching Context
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
              </p>
            </div>
```

**Acceptance criteria:**
- [ ] The Teaching Context card has one heading only — the large serif one
- [ ] The teal eyebrow that repeated the heading has been removed
- [ ] The descriptive subtitle remains

---

## CHANGE 5 — Move "Save Context" button below the form fields

**Problem:** The "Save Context" button sits in the top-right corner of the Teaching Context
card, spatially disconnected from the form fields it saves. Instructors expect a save button
to appear after the last field they fill in, not at the top.

Find the card opening — the flex row containing the heading and the Save Context button:

```tsx
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching Context
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
              </p>
            </div>
            <button
              onClick={saveTeachingContext}
              disabled={savingConfig}
              className="minerva-button"
            >
              {savingConfig ? "Saving..." : "Save Context"}
            </button>
          </div>
```

Replace with (heading only, no button):

```tsx
          <div>
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Teaching Context
            </h2>
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
            </p>
          </div>
```

Then find the Prerequisite Map section closing tags — it ends with:

```tsx
            <textarea
              value={session.prerequisiteMap ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                )
              }
              rows={10}
              placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
              className="minerva-textarea resize-y font-mono text-xs"
            />
          </div>
        </div>
```

Replace with:

```tsx
            <textarea
              value={session.prerequisiteMap ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                )
              }
              rows={10}
              placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
              className="minerva-textarea resize-y font-mono text-xs"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={saveTeachingContext}
              disabled={savingConfig}
              className="minerva-button"
            >
              {savingConfig ? "Saving..." : "Save Context"}
            </button>
          </div>
        </div>
```

**Acceptance criteria:**
- [ ] The "Save Context" button appears at the bottom of the Teaching Context card
- [ ] The button is no longer in the top-right corner of the card
- [ ] The button still calls `saveTeachingContext` when clicked
- [ ] The `disabled={savingConfig}` state is preserved

---

## CHANGE 6 — Hide "Prerequisite Map JSON" behind an Advanced Settings toggle

**Problem:** A raw JSON textarea labeled "Prerequisite Map JSON" is exposed to instructors
by default. Higher education instructors are not JSON authors. Even labeled "Optional
advanced," this textarea will confuse and alienate the target audience.

**Fix:** Add a `showAdvanced` boolean state. Hide the entire Prerequisite Map section
behind a toggle that instructors can expand if they want to use it.

**Step 6a** — Add the state variable. Find the existing state declarations near the top
of the component:

```typescript
  const [generatingMap, setGeneratingMap] = useState(false);
```

After this line, add:

```typescript
  const [showAdvanced, setShowAdvanced] = useState(false);
```

**Step 6b** — Wrap the Prerequisite Map block. Find this entire block:

```tsx
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <label className="minerva-label">
                  Prerequisite Map JSON
                </label>
                <p className="mt-1 text-xs text-[var(--dim-grey)]">
                  Optional advanced map for prerequisite-aware scaffolding.
                </p>
              </div>
              <button
                onClick={generateSuggestedMap}
                disabled={generatingMap || readings.length === 0}
                className="minerva-button minerva-button-secondary"
              >
                {generatingMap ? "Generating..." : "Generate Suggested Map"}
              </button>
            </div>
            <textarea
              value={session.prerequisiteMap ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                )
              }
              rows={10}
              placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
              className="minerva-textarea resize-y font-mono text-xs"
            />
          </div>
```

Replace with:

```tsx
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--dim-grey)] hover:text-[var(--charcoal)] transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced settings
            </button>

            {showAdvanced && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <label className="minerva-label">
                      Prerequisite Map JSON
                    </label>
                    <p className="mt-1 text-xs text-[var(--dim-grey)]">
                      Optional. Maps concept dependencies so the tutor can scaffold prerequisite gaps.
                    </p>
                  </div>
                  <button
                    onClick={generateSuggestedMap}
                    disabled={generatingMap || readings.length === 0}
                    title={readings.length === 0 ? "Upload a reading first to generate a map" : undefined}
                    className="minerva-button minerva-button-secondary"
                  >
                    {generatingMap ? "Generating..." : "Generate from readings"}
                  </button>
                </div>
                <textarea
                  value={session.prerequisiteMap ?? ""}
                  onChange={(e) =>
                    setSession((prev) =>
                      prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                    )
                  }
                  rows={8}
                  placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
                  className="minerva-textarea resize-y font-mono text-xs"
                />
              </>
            )}
          </div>
```

**Acceptance criteria:**
- [ ] By default, the Advanced settings section is collapsed and the JSON textarea is hidden
- [ ] Clicking "Advanced settings" expands the section and shows the textarea
- [ ] Clicking again collapses it
- [ ] The chevron icon rotates 90° when expanded
- [ ] "Generate Suggested Map" button is now labelled "Generate from readings"
- [ ] When collapsed, the Teaching Context card is significantly shorter

---

## CHANGE 7 — Improve Assessments section description

**Problem:** The Assessments section has one-line copy: "The tutor will never answer these
directly." This is accurate but undersells a key pedagogical feature — protecting the
integrity of assessed work.

Find:

```tsx
          <div>
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Assessments
            </h2>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              The tutor will never answer these directly.
            </p>
          </div>
```

Replace with:

```tsx
          <div>
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Assessments
            </h2>
            <p className="mt-1 text-sm text-[var(--dim-grey)] max-w-[38rem]">
              Upload your assignments or exam questions. The tutor reads them to understand
              what students are working toward — but will never reveal or directly answer them.
            </p>
          </div>
```

**Acceptance criteria:**
- [ ] The Assessments description is two sentences and explains the pedagogical rationale
- [ ] The text does not overflow on narrow screens (max-w constraint)

---

## CHANGE 8 — Replace "Instructor Workspace" eyebrow with a breadcrumb

**Problem:** "Instructor Workspace" as an eyebrow label tells the instructor nothing they
don't already know. A breadcrumb (`Sessions / Week 1 (Systems Thinking)`) gives them
navigation context and a path back to the sessions list.

Find:

```tsx
            <div>
              <p className="eyebrow eyebrow-teal">Instructor Workspace</p>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                {session.name}
              </h1>
```

Replace with:

```tsx
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="hover:text-[var(--teal)] transition-colors">
                  Sessions
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">{session.name}</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                {session.name}
              </h1>
```

**Acceptance criteria:**
- [ ] "Instructor Workspace" text is gone
- [ ] A breadcrumb "Sessions / Week 1 (Systems Thinking)" appears in its place
- [ ] "Sessions" is a clickable link to `/instructor`
- [ ] The session name in the breadcrumb is plain text (not a link)
- [ ] The h1 heading below is unchanged

---

## Verification checklist

After all changes, verify:

- [ ] No raw JavaScript parse errors appear in the error banner
- [ ] "Student Activity" and "Report" buttons are dimmed when no readings are uploaded
- [ ] Access code is blurred / locked until a reading is uploaded
- [ ] Access code is clearly visible and copyable after uploading a reading
- [ ] Teaching Context card has one heading, not two
- [ ] "Save Context" button is at the bottom of the Teaching Context card
- [ ] Prerequisite Map JSON is hidden by default behind "Advanced settings" toggle
- [ ] "Generate Suggested Map" is renamed "Generate from readings"
- [ ] Assessments section has two-sentence descriptive copy
- [ ] "Instructor Workspace" label is replaced by a breadcrumb with a working link to /instructor
- [ ] `npm run dev` runs without TypeScript errors
- [ ] `npm run build` completes without errors
- [ ] Uploading a reading activates the session and un-locks the access code card

## What NOT to change

- Do not modify the drag-and-drop logic or file upload handlers
- Do not modify the Readings section layout or file list display
- Do not modify the `saveTeachingContext` or `generateSuggestedMap` async functions
- Do not modify the status bar (yellow/teal alert above the error banner)
- Do not change any API route files
- Do not change `globals.css` or any other CSS file
- Do not change the Course Context or Session Learning Goal textarea fields
