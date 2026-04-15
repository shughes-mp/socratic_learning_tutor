# Chat Page & AI Response Quality — Codex Implementation Instructions

## Context

This file covers all recommendations from two sequential reviews:
1. UX/UI critique of the student chat page (`client-chat.tsx`, `message-bubble.tsx`)
2. Quality critique of AI-generated tutor responses (`system-prompt.ts`)

Apply every change in the order listed. Do not skip or reorder.

Files modified in this document:
- `src/app/s/[accessCode]/chat/client-chat.tsx`
- `src/components/chat/message-bubble.tsx`
- `src/lib/system-prompt.ts`

Do not modify any other files unless explicitly stated.

---

## FILE 1 — `src/app/s/[accessCode]/chat/client-chat.tsx`

### CHANGE 1 — Hide the initial kick-off message from students (Critical bug)

**Problem:** The `sendMessage` function adds every outgoing message to the visible React
state before sending to the API. The auto-sent opening prompt — which contains internal
tutor instructions ("OPENING SEQUENCE INSTRUCTION: 1. Greet me by name...") — is rendered
as a large red student bubble, exposing implementation details to students.

**Fix:** Add a `hidden` field to the Message interface. Mark the initial message as hidden.
Filter hidden messages before passing to `<ChatArea>`. The message stays in state so it
is still sent as conversation history on subsequent turns.

**Step 1-A:** Find the Message interface at the top of the file:

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
}
```

Replace with:

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  hidden?: boolean;
}
```

**Step 1-B:** Find the `sendMessage` function signature:

```typescript
  const sendMessage = async (
    contentToSend: string,
    sid: string | null = studentSessionId
  ) => {
```

Replace with:

```typescript
  const sendMessage = async (
    contentToSend: string,
    sid: string | null = studentSessionId,
    hidden = false
  ) => {
```

**Step 1-C:** Find the userMessage creation inside `sendMessage`:

```typescript
    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: contentToSend,
    };
```

Replace with:

```typescript
    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: contentToSend,
      hidden,
    };
```

**Step 1-D:** Find the initial `sendMessage` call in the `useEffect`:

```typescript
      sendMessage(
        `Hi. My name is ${sname || "a student"}. I'm ready to begin the session.
OPENING SEQUENCE INSTRUCTION: This is the opening exchange.
1. Greet me by name.
2. Ask ONE question about what I already know or believe about the main topic before doing the reading.
3. Do NOT ask about the reading content yet.
4. Wait for my response before bridging to the reading and asking the first Socratic question.
If course context is available, use it naturally in the first three exchanges.`,
        sid
      );
```

Replace with:

```typescript
      sendMessage(
        `Hi. My name is ${sname || "a student"}. I'm ready to begin the session.
OPENING SEQUENCE INSTRUCTION: This is the opening exchange.
1. Greet me by name.
2. Ask ONE question about what I already know or believe about the main topic before doing the reading.
3. Do NOT ask about the reading content yet.
4. Wait for my response before bridging to the reading and asking the first Socratic question.
If course context is available, use it naturally in the first three exchanges.`,
        sid,
        true
      );
```

**Step 1-E:** Find the `<ChatArea>` usage in the JSX:

```tsx
              <ChatArea messages={messages} isLoading={isLoading} />
```

Replace with:

```tsx
              <ChatArea messages={messages.filter((m) => !m.hidden)} isLoading={isLoading} />
```

**Step 1-F:** The exchange counter currently counts all user messages including the hidden
one, which would show "1 of 20 messages used" before the student types anything. Fix it
to exclude hidden messages. Find:

```typescript
  const exchangeCount = Math.ceil(
    messages.filter((message) => message.role === "user").length
  );
```

Replace with:

```typescript
  const exchangeCount = Math.ceil(
    messages.filter((message) => message.role === "user" && !message.hidden).length
  );
```

**Acceptance criteria:**
- [ ] No student-visible bubble appears when the page first loads
- [ ] The tutor's greeting still appears as the first message (AI response is not hidden)
- [ ] Subsequent turns work correctly — the hidden message is included in conversation history
- [ ] Exchange counter shows 0 until the student types their first message

---

### CHANGE 2 — Rename "Socratic Session" eyebrow

**Problem:** "Socratic Session" is internal product terminology. Students don't know what
Socratic method means and should not need to.

Find:

```tsx
            <p className="eyebrow eyebrow-teal">Socratic Session</p>
```

Replace with:

```tsx
            <p className="eyebrow eyebrow-teal">Reading Session</p>
```

**Acceptance criteria:**
- [ ] The header eyebrow reads "Reading Session"

---

### CHANGE 3 — Remove "Access code" display from the chat header

**Problem:** The access code is shown below the session name in the header. The student
is already inside the session — displaying the code serves no purpose and creates confusion.

Find:

```tsx
            <p className="mt-2 text-[12px] text-[var(--dim-grey)]">
              Access code {accessCode}
            </p>
```

Delete this entire paragraph. Leave no placeholder.

**Acceptance criteria:**
- [ ] No access code text appears in the chat header
- [ ] The session name `h1` is still displayed correctly

---

### CHANGE 4 — Replace the native `confirm()` dialog with inline confirmation

**Problem:** Clicking "End Session" triggers a browser-native `confirm()` dialog — ugly,
inconsistent with the app's visual style, and disruptive on mobile.

**Step 4-A:** Add a new state variable. Find the existing state declarations near the top:

```typescript
  const [isEnding, setIsEnding] = useState(false);
```

After this line, add:

```typescript
  const [confirmingEnd, setConfirmingEnd] = useState(false);
```

**Step 4-B:** Replace the `handleEndClick` function:

```typescript
  const handleEndClick = () => {
    if (
      studentSessionId &&
      confirm("Are you sure you want to end this tutoring session?")
    ) {
      triggerEndSession(studentSessionId);
    }
  };
```

Replace with:

```typescript
  const handleEndClick = () => {
    if (!isEnding) {
      setConfirmingEnd(true);
    }
  };

  const handleConfirmEnd = () => {
    setConfirmingEnd(false);
    if (studentSessionId) {
      triggerEndSession(studentSessionId);
    }
  };

  const handleCancelEnd = () => {
    setConfirmingEnd(false);
  };
```

**Step 4-C:** Replace the End Session button in the header. Find:

```tsx
          <div className="px-4 py-5 md:px-8 md:text-right">
            {!isEnded && (
              <button
                onClick={handleEndClick}
                disabled={isEnding || isLoading}
                className="minerva-button minerva-button-secondary"
              >
                {isEnding ? "Ending..." : "End Session"}
              </button>
            )}
          </div>
```

Replace with:

```tsx
          <div className="px-4 py-5 md:px-8 md:text-right">
            {!isEnded && (
              confirmingEnd ? (
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-[13px] text-[var(--charcoal)]">End this session?</span>
                  <button
                    onClick={handleConfirmEnd}
                    className="minerva-button"
                    style={{ minHeight: "36px", padding: "0 14px", fontSize: "12px" }}
                  >
                    Yes, end it
                  </button>
                  <button
                    onClick={handleCancelEnd}
                    className="minerva-button minerva-button-secondary"
                    style={{ minHeight: "36px", padding: "0 14px", fontSize: "12px" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEndClick}
                  disabled={isEnding || isLoading}
                  className="minerva-button minerva-button-secondary"
                >
                  {isEnding ? "Ending..." : "End Session"}
                </button>
              )
            )}
          </div>
```

**Acceptance criteria:**
- [ ] Clicking "End Session" replaces the button with "End this session? | Yes, end it | Cancel"
- [ ] "Yes, end it" ends the session and triggers the summary flow
- [ ] "Cancel" dismisses the confirmation and restores the "End Session" button
- [ ] No native browser `confirm()` dialog appears anywhere
- [ ] `handleEndClick` no longer references `confirm()`

---

### CHANGE 5 — Make the Session Orientation section collapsible

**Problem:** The orientation strip (which includes the session description, the static
tutor description, and the "Why This Matters / Goal For This Session" side panel) takes
up roughly a third of the visible screen before the student has typed a word. It should
be collapsed by default, with an expand toggle.

**Step 5-A:** Add state. Find the state declarations:

```typescript
  const [confirmingEnd, setConfirmingEnd] = useState(false);
```

After this line, add:

```typescript
  const [orientationOpen, setOrientationOpen] = useState(false);
```

**Step 5-B:** Replace the entire orientation section. Find:

```tsx
            <div className="border-b border-[var(--rule)] px-4 py-6 md:px-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_300px]">
                <div>
                  <p className="eyebrow eyebrow-teal">Session Orientation</p>
                  {sessionDescription && (
                    <p className="body-copy mt-4 max-w-[40rem]">
                      {sessionDescription}
                    </p>
                  )}
                  <p className="mt-4 max-w-[40rem] text-[14px] leading-7 text-[var(--dim-grey)]">
                    This tutor is designed to help you articulate your thinking,
                    test your assumptions, and build stronger understanding from
                    the uploaded materials.
                  </p>
                </div>

                <div className="minerva-panel p-5">
                  <div className="space-y-4 text-[13px] leading-6">
                    {courseContext && (
                      <div>
                        <p className="eyebrow eyebrow-olive">Why This Matters</p>
                        <p className="mt-2 text-[var(--charcoal)]">
                          {courseContext}
                        </p>
                      </div>
                    )}
                    {learningGoal && (
                      <div>
                        <p className="eyebrow eyebrow-rose">Goal For This Session</p>
                        <p className="mt-2 text-[var(--charcoal)]">
                          {learningGoal}
                        </p>
                      </div>
                    )}
                    {studentName && (
                      <p className="border-t border-[var(--rule)] pt-4 text-[var(--dim-grey)]">
                        You are participating as <strong>{studentName}</strong>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
```

Replace with:

```tsx
            <div className="border-b border-[var(--rule)]">
              {/* Collapsed toggle bar — always visible */}
              <button
                type="button"
                onClick={() => setOrientationOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left md:px-8 hover:bg-[rgba(0,0,0,0.02)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                    About this session
                  </span>
                  {studentName && (
                    <span className="text-[12px] text-[var(--dim-grey)]">
                      · {studentName}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-[var(--dim-grey)] transition-transform ${orientationOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {orientationOpen && (
                <div className="px-4 pb-6 pt-2 md:px-8">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_300px]">
                    <div>
                      {sessionDescription && (
                        <p className="body-copy max-w-[40rem]">
                          {sessionDescription}
                        </p>
                      )}
                      <p className="mt-3 max-w-[40rem] text-[14px] leading-7 text-[var(--dim-grey)]">
                        Start by sharing what you already know about the topic.
                        The tutor will ask questions — not give you answers.
                        Work toward understanding before explanations are offered.
                      </p>
                    </div>

                    <div className="minerva-panel p-5">
                      <div className="space-y-4 text-[13px] leading-6">
                        {courseContext && (
                          <div>
                            <p className="eyebrow eyebrow-olive">Why This Matters</p>
                            <p className="mt-2 text-[var(--charcoal)]">{courseContext}</p>
                          </div>
                        )}
                        {learningGoal && (
                          <div>
                            <p className="eyebrow eyebrow-rose">Goal For This Session</p>
                            <p className="mt-2 text-[var(--charcoal)]">{learningGoal}</p>
                          </div>
                        )}
                        {studentName && (
                          <p className="border-t border-[var(--rule)] pt-4 text-[var(--dim-grey)]">
                            Participating as <strong>{studentName}</strong>.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
```

**Acceptance criteria:**
- [ ] On load, the orientation section shows only a single slim bar: "About this session · {studentName}"
- [ ] A chevron icon points down when collapsed, up when expanded
- [ ] Clicking the bar expands the full orientation content
- [ ] Clicking again collapses it
- [ ] The first thing students see below the header is the chat area, not a large orientation block
- [ ] "Session Orientation" eyebrow text is removed; replaced by "About this session" in the toggle bar

---

### CHANGE 6 — Change "exchanges" to "messages" throughout

**Problem:** "Exchanges" is product/pedagogical jargon. Students say "messages."

Find the counter in the footer:

```tsx
                <span>
                  {exchangeCount} of {maxExchanges} exchanges used
                </span>
```

Replace with:

```tsx
                <span>
                  {exchangeCount} of {maxExchanges} messages used
                </span>
```

Find the limit-reached message:

```tsx
                  <p className="text-[13px] font-semibold text-[var(--signal)]">
                    You have reached the exchange limit for this session.
                  </p>
```

Replace with:

```tsx
                  <p className="text-[13px] font-semibold text-[var(--signal)]">
                    You have reached the message limit for this session.
                  </p>
```

**Acceptance criteria:**
- [ ] Footer reads "{n} of {max} messages used"
- [ ] Limit message reads "You have reached the message limit for this session."
- [ ] The word "exchange" or "exchanges" does not appear anywhere visible to students

---

### CHANGE 7 — Update the footer grounding note

**Problem:** "This conversation is grounded in the instructor's uploaded materials" is
technically accurate but cold. Students benefit from a warmer, clearer framing.

Find:

```tsx
                <span>
                  This conversation is grounded in the instructor&apos;s uploaded
                  materials.
                </span>
```

Replace with:

```tsx
                <span>
                  Your tutor is based only on the materials your instructor uploaded.
                </span>
```

**Acceptance criteria:**
- [ ] Footer note reads "Your tutor is based only on the materials your instructor uploaded."

---

## FILE 2 — `src/components/chat/message-bubble.tsx`

### CHANGE 8 — Change student bubble color from red to teal

**Problem:** Student messages render with a strong red background
(`bg-[rgba(223,47,38,0.92)]`). Red carries warning and error semantics in every design
system. A student's own words in a red bubble subconsciously signals something is wrong.
The student bubble should be teal — the app's primary positive action color.

Find:

```tsx
          isUser
            ? "border border-[rgba(223,47,38,0.25)] bg-[rgba(223,47,38,0.92)] text-white shadow-[0_20px_35px_rgba(223,47,38,0.12)] rounded-tr-sm"
```

Replace with:

```tsx
          isUser
            ? "border border-[rgba(17,120,144,0.25)] bg-[rgba(17,120,144,0.92)] text-white shadow-[0_20px_35px_rgba(17,120,144,0.12)] rounded-tr-sm"
```

**Acceptance criteria:**
- [ ] Student message bubbles are teal, not red
- [ ] AI response bubbles (white/light) are unchanged
- [ ] System message bubbles are unchanged
- [ ] White text on teal background has sufficient contrast

---

## FILE 3 — `src/lib/system-prompt.ts`

All changes are to the `STATIC_BASE_PROMPT` string constant. Make surgical replacements
only to the sections named. Do not modify any exported functions, the TypeScript
interfaces, or `buildContextInstruction`.

### CHANGE 9 — Add response length limit and markdown constraint to TONE

**Problem:** The AI produces responses of 200–250 words when the pedagogical ideal is
under 100 words. The TONE section does not include a word count constraint, so it is
not being enforced. Markdown is also overused — bold phrases mid-paragraph make responses
feel like documents rather than conversation.

Find in `STATIC_BASE_PROMPT`:

```
TONE
- Warm, direct, and professional.
- Concise rather than performative.
- No emojis, no cheerleading, no condescension.
```

Replace with:

```
TONE
- Warm, direct, and professional.
- Concise rather than performative. Keep every response under 100 words. If you exceed this, cut setup and context — never the question. The question is the response.
- No emojis, no cheerleading, no condescension.
- Avoid double affirmation before a challenge. One specific acknowledgment of what is correct is enough before pushing further. Never follow "that's right" with "you've captured it accurately" — pick one.
- Use markdown sparingly. Bold may be used to highlight the question text only. Do not bold or italicise mid-paragraph phrases.
```

**Acceptance criteria:**
- [ ] TONE section now includes a 100-word limit instruction
- [ ] TONE section includes a single-affirmation rule
- [ ] TONE section includes a markdown constraint

---

### CHANGE 10 — Add a hard one-question-per-response rule

**Problem:** The system prompt states "Ask ONE question" in the opening orientation but
this rule is not applied globally. In practice the AI routinely appends a second question
with "and" or a second "?" — which confuses students about what to respond to.

Find in `STATIC_BASE_PROMPT`:

```
Never ask a question that can be answered by copying a sentence from the reading.
```

Replace with:

```
Never ask a question that can be answered by copying a sentence from the reading.
HARD RULE — ONE QUESTION ONLY: Every response must end with exactly one question. Two questions joined by "and", two sentences ending with "?", or a compound question separated by "—" all count as two questions. If you find a second question forming, delete it entirely. This rule has no exceptions.
```

**Acceptance criteria:**
- [ ] The one-question rule is stated as a HARD RULE with no exceptions
- [ ] The rule explicitly names the patterns that count as two questions (and, compound, second ?)

---

### CHANGE 11 — Revise the EXPERT MODELING instruction

**Problem:** The current expert modeling instruction produces long demonstrations that
(a) use generic examples not from the reading, (b) model the analytical framework the
student should apply before they attempt it, and (c) take more than one sentence, violating
the overall conciseness rule. The original instruction says "briefly" but the AI does not
interpret "briefly" as "one sentence."

Find in `STATIC_BASE_PROMPT`:

```
EXPERT MODELING
- At the first true Socratic question of the session, briefly model how an expert reader would approach the material. Tag [EXPERT_MODEL: OPENING].
- When you give a direct answer in Socratic mode, show a short reasoning trace before the answer. Tag [EXPERT_MODEL: REASONING].
- Keep expert modeling specific to the actual readings, never generic.
```

Replace with:

```
EXPERT MODELING
- At the first true Socratic question of the session, add ONE sentence showing how an expert reader would orient to this specific text. This is orientation only — do not demonstrate the analytical framework the student should apply, and do not give examples that scaffold the answer. One sentence, grounded in the actual reading. Tag [EXPERT_MODEL: OPENING].
- When you give a direct answer in Socratic mode, show a short reasoning trace before the answer. Tag [EXPERT_MODEL: REASONING].
- Expert modeling must reference specific content from the actual reading. Never use generic real-world examples (traffic jams, market crashes, etc.) as expert modeling material — those belong in student transfer questions, not in expert framing.
- Do not model the reasoning pathway the student is being asked to find. Orient, do not scaffold.
```

**Acceptance criteria:**
- [ ] EXPERT_MODEL: OPENING is now constrained to one sentence
- [ ] The instruction explicitly prohibits demonstrating the analytical framework
- [ ] The instruction explicitly prohibits generic examples in expert modeling
- [ ] The distinction between orienting and scaffolding is stated

---

### CHANGE 12 — Add scenario framing discipline to DIAGNOSTIC QUESTION TYPES

**Problem:** When using transfer scenarios, the AI pre-loads the analytical contrast
the student is supposed to identify. For example: *"A fishery collapses. A common
explanation is that a storm, a bad economy, or new technology triggered it. If Meadows
is right..."* — by naming the external factors, the AI sets up the internal/external
contrast before the student has been asked to surface it.

Find in `STATIC_BASE_PROMPT`:

```
HARD RULE — ONE QUESTION ONLY: Every response must end with exactly one question. Two questions joined by "and", two sentences ending with "?", or a compound question separated by "—" all count as two questions. If you find a second question forming, delete it entirely. This rule has no exceptions.
```

After this line (still inside the DIAGNOSTIC QUESTION TYPES section), add:

```
SCENARIO DISCIPLINE: When posing a transfer scenario, present it minimally. Do not name the factors, contrasts, or mechanisms the student is supposed to identify — let the student surface them. Correct: "A fishery collapses. What does Meadows' framework say about why?" Incorrect: "A fishery collapses. Common explanations include storms and bad technology. If Meadows is right that behavior is intrinsic, what would that mean?" The second version removes the diagnostic value by pre-loading the contrast.
```

**Acceptance criteria:**
- [ ] The scenario discipline instruction appears in the system prompt
- [ ] The correct vs. incorrect examples are present
- [ ] The rule explains why pre-loading the contrast removes diagnostic value

---

## Verification checklist

After all changes, test the complete student flow:

**Hidden prompt:**
- [ ] Page loads → tutor greeting appears with no student bubble visible
- [ ] Student types their first message → it appears as a teal bubble
- [ ] Exchange counter starts at 0 on load; increments when student sends a message

**Visual:**
- [ ] Student bubbles are teal, not red
- [ ] AI bubbles remain white/light
- [ ] Header shows "Reading Session" eyebrow, session name only (no access code)

**Session orientation:**
- [ ] On load, only the slim "About this session · {name}" bar is visible
- [ ] Clicking it expands the full orientation content
- [ ] Clicking again collapses it

**End session:**
- [ ] Clicking "End Session" shows inline "End this session? | Yes, end it | Cancel"
- [ ] "Yes, end it" ends the session and navigates to the summary screen
- [ ] "Cancel" dismisses and restores the original button

**Footer:**
- [ ] Counter reads "{n} of {max} messages used"
- [ ] Grounding note reads "Your tutor is based only on the materials your instructor uploaded."

**System prompt (verify by starting a new session and observing AI behaviour):**
- [ ] The tutor's opening message is under 100 words
- [ ] The expert modeling line is one sentence only and references the actual reading
- [ ] Each AI turn asks exactly one question — no compound questions
- [ ] If the AI uses a transfer scenario, the scenario is presented without naming the factors the student should identify
- [ ] Student affirmation is one acknowledgment only, not two in sequence
- [ ] Bold markdown is used only to highlight the question, not mid-paragraph

**Build:**
- [ ] `npm run dev` runs without TypeScript errors
- [ ] `npm run build` completes without errors
- [ ] No regressions on the session end / summary screen

## What NOT to change

- Do not modify the `triggerEndSession` async function implementation
- Do not modify the `ChatArea` or `TypingIndicator` components
- Do not modify the `ChatInput` component
- Do not modify the exchange limit check in `handleSubmit`
- Do not modify the session summary / ended state rendering
- Do not modify any API route files
- Do not modify `globals.css` or any other CSS file
- Do not modify the tag-stripping regex in `message-bubble.tsx` — only change the color class
- Do not modify any exported function signatures in `system-prompt.ts`
