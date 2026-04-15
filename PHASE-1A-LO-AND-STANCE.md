# PHASE-1A: Learning Outcomes & Tutor Stance Configuration

**Phase:** 1 (No dependencies)  
**Priority:** High  
**Effort:** Medium  
**Features:** Learning Outcomes field + Tutor Stance parameter

---

## Overview

This change adds two session-configuration features that shape how the tutor interacts with students:

1. **Learning Outcomes Field** — Allows instructors to input institutional/course-level LOs that the tutor references in feedback and synthesis
2. **Tutor Stance** — Lets instructors choose between "Directed Tutor" (authority-driven) and "Peer Mentor" (collaborative) framing

Both are independent UI/database additions that modify session context without changing the underlying pedagogical engine.

---

## Feature A: Learning Outcomes Field

### 1. Prisma Schema (`socratic-tutor/prisma/schema.prisma`)

In the `Session` model, add a new optional string field after `learningGoal`:

```prisma
learningGoal      String?
learningOutcomes  String?
prerequisiteMap   String?
```

**Rationale:** Stores instructor-provided institutional learning outcomes that will be passed to the tutor's system prompt.

**Migration:** Run `npx prisma db push` after this change.

---

### 2. Config API (`src/app/api/sessions/[sessionId]/config/route.ts`)

In the PATCH handler, add `learningOutcomes` to the list of updateable fields. It should follow the same pattern as `learningGoal`:

```typescript
// In the field update logic:
if (learningOutcomes !== undefined) {
  updateData.learningOutcomes = learningOutcomes || null;
}
```

Include `learningOutcomes` in the destructured body:
```typescript
const { name, description, courseContext, learningGoal, learningOutcomes, prerequisiteMap, maxExchanges, opensAt, closesAt } = body;
```

---

### 3. Session Management Page (`src/app/instructor/[sessionId]/page.tsx`)

In the **Tutor Configuration** section, add a new textarea between "Learning Goal" and the "Advanced Settings" toggle:

**Location:** After the existing learningGoal textarea component.

**Component:**
```tsx
<div className="space-y-2">
  <label htmlFor="learningOutcomes" className="block text-sm font-medium">
    Learning Outcomes <span className="text-gray-500">(optional)</span>
  </label>
  <textarea
    id="learningOutcomes"
    name="learningOutcomes"
    value={teachingContext.learningOutcomes || ""}
    onChange={(e) =>
      setTeachingContext({
        ...teachingContext,
        learningOutcomes: e.target.value,
      })
    }
    placeholder="e.g., Students will be able to reconstruct the author's central argument, identify unstated assumptions, and evaluate the strength of the evidence presented."
    className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
    rows={3}
  />
</div>
```

**In `saveTeachingContext()` function:** Ensure the PATCH body includes `learningOutcomes`:
```typescript
learningOutcomes: teachingContext.learningOutcomes || null,
```

---

### 4. System Prompt (`src/lib/system-prompt.ts`)

In the `buildContextInstruction()` function, after the learningGoal block, add:

```typescript
if (session?.learningOutcomes) {
  contextLines.push(
    `LEARNING_OUTCOMES: The institutional learning outcomes for this session are: ${session.learningOutcomes}. When providing feedback, reference these outcomes where relevant. In your closing synthesis, note which outcomes the student engaged with.`
  );
}
```

**Placement:** Insert this after the learningGoal logic and before prerequisiteMap logic.

**Effect:** The tutor will now see institutional outcomes in the system prompt context and reference them in feedback and synthesis.

---

## Feature B: Tutor Stance (Directed vs. Peer Mentor)

### 1. Prisma Schema (`socratic-tutor/prisma/schema.prisma`)

In the `Session` model, add:

```prisma
stance String @default("directed")
```

**Placement:** Anywhere in the Session model (suggest after `maxExchanges` for logical grouping with other tutor-behavior parameters).

**Valid values:** "directed" or "mentor"

---

### 2. Config API (`src/app/api/sessions/[sessionId]/config/route.ts`)

In the PATCH handler:

**Destructure stance:**
```typescript
const { name, description, courseContext, learningGoal, learningOutcomes, prerequisiteMap, maxExchanges, opensAt, closesAt, stance } = body;
```

**Add validation and update logic:**
```typescript
if (stance !== undefined) {
  if (!["directed", "mentor"].includes(stance)) {
    return NextResponse.json(
      { error: "stance must be 'directed' or 'mentor'" },
      { status: 400 }
    );
  }
  updateData.stance = stance;
}
```

---

### 3. Session Management Page (`src/app/instructor/[sessionId]/page.tsx`)

**Location:** In the Tutor Configuration section, add this at the very top, before Course Context.

**Component — Radio-style toggle with descriptions:**

```tsx
<fieldset className="space-y-3 rounded border border-gray-300 p-4">
  <legend className="text-sm font-medium">Tutor Stance</legend>
  
  <div className="space-y-2">
    <label className="flex items-start space-x-3 cursor-pointer">
      <input
        type="radio"
        name="stance"
        value="directed"
        checked={teachingContext.stance === "directed"}
        onChange={(e) =>
          setTeachingContext({
            ...teachingContext,
            stance: e.target.value,
          })
        }
        className="mt-1"
      />
      <div>
        <div className="font-medium text-sm">Directed Tutor</div>
        <div className="text-xs text-gray-600">
          The tutor guides the student through probing questions. Best for
          undergraduate learners.
        </div>
      </div>
    </label>

    <label className="flex items-start space-x-3 cursor-pointer">
      <input
        type="radio"
        name="stance"
        value="mentor"
        checked={teachingContext.stance === "mentor"}
        onChange={(e) =>
          setTeachingContext({
            ...teachingContext,
            stance: e.target.value,
          })
        }
        className="mt-1"
      />
      <div>
        <div className="font-medium text-sm">Peer Mentor</div>
        <div className="text-xs text-gray-600">
          The tutor engages as a thinking partner, challenging interpretations
          collaboratively. Better for professional/executive learners.
        </div>
      </div>
    </label>
  </div>
</fieldset>
```

**In `saveTeachingContext()` function:** Include `stance` in the PATCH body:
```typescript
stance: teachingContext.stance || "directed",
```

---

### 4. System Prompt (`src/lib/system-prompt.ts`)

**In `STATIC_BASE_PROMPT`:** Add a new section with placeholder:

```
STANCE: {STANCE_INSTRUCTION}
```

This should be placed near other role/behavior definitions in the prompt (e.g., after pedagogical constraints).

**In `buildSystemPrompt()` function:** Replace the `{STANCE_INSTRUCTION}` placeholder with the appropriate stance instruction. Add this logic after other context-building steps:

```typescript
let stanceInstruction = "";

if (session?.stance === "mentor") {
  stanceInstruction = `You are a peer mentor interrogating the text alongside the learner. Frame questions as mutual inquiry. When the learner offers sophisticated insights beyond the reading, acknowledge them and ask for text anchoring rather than correcting: "That's a plausible extension — which passage supports that connection, or is it your extrapolation beyond the author?" Treat the learner's professional experience as an asset. Every 4th response, include a one-sentence micro-rationale for your question: "I'm pushing on this because the author's conclusion depends on it."`;
} else {
  // Default: directed
  stanceInstruction = `You are a directed Socratic tutor. You are the authority guiding the student's understanding. Frame questions as probes of their comprehension. Example framing: "What evidence does the author provide for this claim?" or "Can you explain why the author rejects that interpretation?"`;
}

// Replace the placeholder in the prompt
const finalPrompt = basePrompt.replace("{STANCE_INSTRUCTION}", stanceInstruction);
```

---

### 5. Chat API (`src/app/api/chat/route.ts`)

**No changes required** — The buildSystemPrompt is already called with the session object, so the stance logic will be applied automatically.

If you need to verify: Confirm that `buildSystemPrompt(session)` is called and that the session object is passed through. If the session is already available in scope, no additional changes needed.

---

## Testing Checklist

- [ ] **Learning Outcomes field:**
  - Schema migrates cleanly with `npx prisma db push`
  - Textarea renders in instructor UI
  - Data persists when saved
  - Learning outcomes appear in system prompt (check via debug/logging)
  - Tutor references outcomes in feedback

- [ ] **Tutor Stance:**
  - Schema migrates with default value "directed"
  - Radio toggle renders correctly
  - Stance persists when saved
  - Different stance instructions appear in system prompt for "directed" vs "mentor"
  - Chat behavior reflects stance (manually verified via conversation)

- [ ] **Database migrations:**
  - `npx prisma db push` completes without errors
  - Existing sessions get default values
  - New sessions can set both fields

---

## Notes

- Both features are independent: instructors can use one without the other
- Stance is a **runtime** behavior change, not a pedagogical engine change
- Learning Outcomes are **reference data** for feedback and synthesis, not enforcement rules
- Default stance is "directed" for backward compatibility
