# PHASE-1C: Session Parameter Enhancements & Conversation Arc

**Phase:** 1 (No dependencies)  
**Priority:** Medium  
**Effort:** Medium-High  
**Focus:** Student-facing progress framing + tutor phase awareness for conversation arc management

---

## Overview

This change makes three improvements to how sessions manage conversation flow and student experience:

1. **Progress Indicator UI** — Replace exact exchange counter with a phase label ("Getting started", "Exploring the reading", etc.) to reduce anxiety and encourage deeper engagement
2. **Tutor Phase Awareness** — Give the tutor explicit guidance about which phase of the conversation it's in (orientation, exploration, wrap-up, closing) so it self-manages pacing
3. **Future-Proofing for Checkpoints** — Add a helper function for calculating checkpoint density (not yet implemented, but scaffolded for Phase 2)

---

## Change 1: Progress Indicator UI (Student Chat)

### Location: `src/app/s/[accessCode]/chat/client-chat.tsx`

#### 1a. Find and replace the exchange counter display

Locate the section that renders the exchange counter (currently shows "X / Y exchanges" or similar).

Replace it with a phase-based progress indicator:

```tsx
// Helper function to calculate conversation phase
const getConversationPhase = (exchangeCount: number, maxExchanges: number) => {
  const percentage = (exchangeCount / maxExchanges) * 100;
  
  if (percentage < 40) {
    return { phase: "Getting started", percentage };
  } else if (percentage < 70) {
    return { phase: "Exploring the reading", percentage };
  } else if (percentage < 90) {
    return { phase: "Wrapping up", percentage };
  } else {
    return { phase: "Final thoughts", percentage };
  }
};

// In the render section, replace the counter display with:
{maxExchanges && (
  <div className="mt-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">
        {getConversationPhase(exchangeCount, maxExchanges).phase}
      </span>
      <span className="text-xs text-gray-500 cursor-help" title={`${exchangeCount} / ${maxExchanges} exchanges`}>
        {exchangeCount} / {maxExchanges}
      </span>
    </div>
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all duration-300"
        style={{
          width: `${getConversationPhase(exchangeCount, maxExchanges).percentage}%`,
        }}
      />
    </div>
  </div>
)}
```

**Key features:**
- Phase label is prominent; exact count is in a tooltip on hover
- Progress bar fills as the conversation advances
- No "WARNING: You're running out of exchanges" message that creates urgency

#### 1b. Update or replace warning messages

If there's an existing warning message near the exchange limit (e.g., "2 exchanges remaining"), replace it with:

```tsx
{exchangeCount >= Math.floor(maxExchanges * 0.9) && (
  <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded text-sm text-amber-900">
    You're approaching the end of this session. Take a moment to synthesize what you've learned before your final exchange.
  </div>
)}
```

**Rationale:** Softens the language from "You're running out" to "approaching the end" to encourage reflection rather than panic.

---

## Change 2: Tutor Phase Awareness (System Prompt)

### Location: `src/lib/system-prompt.ts`

#### 2a. Add phase-calculation helper

Add this helper function at the module level (near other utilities):

```typescript
/**
 * Calculate the conversation phase based on exchange number and total exchanges.
 * Used by the tutor to understand where in the conversation it is.
 */
function getConversationPhase(
  exchangeNumber: number | undefined,
  maxExchanges: number | undefined
): {
  phase: "orientation" | "exploration" | "wrap-up" | "closing";
  guidance: string;
} {
  if (!exchangeNumber || !maxExchanges) {
    return {
      phase: "exploration",
      guidance:
        "PHASE: exploration. Work through checkpoints, probe understanding, address misconceptions.",
    };
  }

  // Exchanges 1-2: orientation
  if (exchangeNumber <= 2) {
    return {
      phase: "orientation",
      guidance:
        "PHASE: orientation. Greet, assess prior knowledge, select first checkpoint.",
    };
  }

  // Exchanges 3 to (maxExchanges - 4): exploration
  if (exchangeNumber < maxExchanges - 3) {
    return {
      phase: "exploration",
      guidance:
        "PHASE: exploration. Work through checkpoints, probe understanding, address misconceptions.",
    };
  }

  // Exchanges (maxExchanges - 3) to (maxExchanges - 1): wrap-up
  if (exchangeNumber < maxExchanges) {
    return {
      phase: "wrap-up",
      guidance: `PHASE: wrap-up. Address any unresolved high-severity misconceptions. On the final exchange (exchange ${maxExchanges}), ask the student to synthesize: "In your own words, what is the author's central argument and what is the strongest evidence for it?"`,
    };
  }

  // Last exchange: closing
  return {
    phase: "closing",
    guidance:
      "PHASE: closing. Provide a brief, warm closing. Do not ask another question.",
  };
}
```

#### 2b. Integrate phase guidance into buildContextInstruction()

In the `buildContextInstruction()` function, add phase guidance to the context lines. Add this **after** the exchange_number is logged:

```typescript
// After logging exchange_number, add phase guidance:
if (exchangeNumber !== undefined && session?.maxExchanges) {
  const phaseInfo = getConversationPhase(exchangeNumber, session.maxExchanges);
  contextLines.push(phaseInfo.guidance);
}
```

**Result:** The system prompt will include a line like:
```
PHASE: exploration. Work through checkpoints, probe understanding, address misconceptions.
```

This tells the tutor exactly what to do in its current position in the conversation.

---

## Change 3: Checkpoint Density Warning (Future-Proofing)

### Location: `src/app/instructor/[sessionId]/page.tsx`

#### 3a. Add helper function

Add this helper function at the module level (near other utilities):

```typescript
/**
 * Calculate recommended number of checkpoints based on total exchanges.
 * Assumes ~4 exchanges per checkpoint, plus 4 exchanges for orientation/wrap-up.
 * Returns the number of substantive checkpoints that can be covered.
 */
function getRecommendedCheckpoints(maxExchanges: number): number {
  if (maxExchanges < 8) {
    return 1; // Minimum: one checkpoint + orientation/wrap-up
  }
  return Math.floor((maxExchanges - 4) / 4);
}
```

#### 3b. Display checkpoint guidance

In the session configuration section (near where maxExchanges is displayed or edited), add informational text:

```tsx
{teachingContext.maxExchanges && (
  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
    <p className="font-medium mb-1">Checkpoint Capacity</p>
    <p>
      With <strong>{teachingContext.maxExchanges} exchanges</strong>, this session can meaningfully
      cover approximately <strong>{getRecommendedCheckpoints(teachingContext.maxExchanges)} learning checkpoints</strong>.
      (This assumes ~4 exchanges per checkpoint, plus exchanges for orientation and wrap-up.)
    </p>
  </div>
)}
```

**Placement:** Insert after the maxExchanges input field or setting.

**Rationale:** 
- Guides instructors on session design (don't pack too many checkpoints into too few exchanges)
- Prepares the schema for Phase 2 when checkpoints are added
- Educational: helps instructors understand the pacing model

---

## Implementation Sequence

1. **Add helper functions** to both files (`client-chat.tsx` and `system-prompt.ts`)
2. **Update Chat UI** to use the phase indicator
3. **Update System Prompt** to inject phase guidance
4. **Add checkpoint guidance** to the instructor UI (informational only)
5. **Test conversation arcs** at different exchange counts (e.g., 4, 8, 12, 20)

---

## Testing Checklist

### Change 1: Progress Indicator UI

- [ ] **Phase label rendering:**
  - Phase label displays correctly based on progress (0–40% → "Getting started", etc.)
  - Progress bar fills smoothly from 0% to 100%
  - Exact count is visible in tooltip on hover

- [ ] **Warning message:**
  - Softened warning appears at 90% progress
  - Language is encouraging, not alarming
  - Disappears before the final exchange

- [ ] **Edge cases:**
  - Sessions with 1 exchange: phase indicator still renders correctly
  - Sessions with 100+ exchanges: percentage calculation is accurate
  - Exchange count increments and progress bar updates in real-time

### Change 2: Phase Awareness

- [ ] **Phase guidance in system prompt:**
  - Prompt includes phase guidance line for each exchange
  - Orientation phase (exchanges 1–2): tutor greets and assesses
  - Exploration phase: tutor probes and addresses misconceptions
  - Wrap-up phase: tutor asks synthesis question on final exchange
  - Closing phase: tutor provides brief closing without new questions

- [ ] **Tutor behavior:**
  - Manually verify chat logs: tutor behavior changes based on phase
  - Orientation: tutor asks icebreaker-style questions
  - Exploration: tutor digs into checkpoints
  - Wrap-up (final exchange): tutor asks "What is the author's central argument and strongest evidence?"
  - Closing: tutor provides summary and warm farewell (no new questions)

### Change 3: Checkpoint Guidance

- [ ] **Helper function:**
  - `getRecommendedCheckpoints(8)` returns 1
  - `getRecommendedCheckpoints(12)` returns 2
  - `getRecommendedCheckpoints(20)` returns 4

- [ ] **UI display:**
  - Guidance text appears under maxExchanges field
  - Calculation is correct for various exchange counts
  - Text is clear and helpful to instructors

---

## Example Conversation Arcs

### 4-Exchange Session
- **Exchange 1–2 (Orientation):** Tutor greets, assesses prior knowledge
- **Exchange 3 (Wrap-up):** Tutor begins wrap-up; addresses key misconceptions
- **Exchange 4 (Closing):** Tutor provides warm closing (no new questions)
- **Checkpoint capacity:** 1

### 12-Exchange Session
- **Exchange 1–2 (Orientation):** Tutor greets, assesses prior knowledge
- **Exchange 3–8 (Exploration):** Tutor works through 2 checkpoints, probes understanding
- **Exchange 9–11 (Wrap-up):** Tutor addresses unresolved misconceptions, synthesis question on exchange 12
- **Exchange 12 (Closing):** Tutor provides warm closing
- **Checkpoint capacity:** 2

### 20-Exchange Session
- **Exchange 1–2 (Orientation):** Tutor greets, assesses prior knowledge
- **Exchange 3–16 (Exploration):** Tutor works through ~4 checkpoints
- **Exchange 17–19 (Wrap-up):** Tutor addresses misconceptions, synthesis question on exchange 20
- **Exchange 20 (Closing):** Tutor provides warm closing
- **Checkpoint capacity:** 4

---

## Notes

- **Phase guidance is explicit:** The tutor sees the phase in the system prompt and adjusts its approach
- **Student UI is implicit:** Students see progress, not phases — reducing cognitive load
- **Checkpoint guidance is forward-looking:** The function scaffolds Phase 2 work without breaking Phase 1
- **All three changes are independent:** Can be implemented and tested separately
- **No database schema changes** are required for this phase

---

## Future Enhancements (Phase 2+)

- Add actual "checkpoint" model to Prisma schema
- Instructors will select/order checkpoints in the session configuration
- System prompt will inject checkpoint-specific guidance based on conversation state
- Student progress will highlight which checkpoints have been covered
- Analytics will track checkpoint mastery rates
