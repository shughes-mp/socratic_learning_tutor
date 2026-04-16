# Socratic Tutor

Socratic Tutor is an AI-powered learning app that helps learners think through course material with guided questions instead of rushing straight to answers.

It is designed for instructors, adult learners, and professional learners who want a more reflective way to prepare for class, discussion, or assessment.

## What the App Does

An instructor creates a learning session, selects a session purpose (pre-class, in-class preparation, in-class reflection, or after-class), uploads readings and optional assessment materials, and shares a learner link. Learners then chat with the tutor about the material. The tutor pushes them to explain their thinking, identify misunderstandings, and build stronger understanding step by step. Afterward, the instructor can review learner activity, misconception patterns, teaching recommendations, and reports — all framed to match the cognitive goal of that session.

This is not a generic chatbot. It is meant to behave like a guided tutor calibrated to where students are in the learning cycle.

## How the Tutoring Approach Works

The app is built around a Socratic approach calibrated to the session purpose:

- It starts with guiding questions, prompts, and follow-up checks instead of immediately giving away answers.
- It asks learners to explain what they already know before moving deeper into a topic.
- It tracks repeated attempts so the tutor can respond differently when a learner is genuinely stuck.
- It can probe confidence, surface misconceptions, and revisit weak areas later in the session.
- It protects uploaded assessment materials by avoiding direct answer-giving on those protected questions.
- The session purpose shapes the tutor's cognitive target for the whole conversation. Pre-class sessions focus on comprehension and corrected understanding. In-class preparation sessions target activation and retrieval. In-class reflection sessions aim at consolidation and self-explanation. After-class sessions push toward transfer and application to novel contexts.

In short: the app is designed to support learning, not shortcut it — and the type of support adjusts based on where in the learning cycle the session sits.

## Core Features

- Instructor session creation with shareable learner access links
- A guided setup flow with a shared four-step indicator: name it, add a reading, add questions, share the link
- Step-aware instructor setup progress on both the create page and the session workspace
- Upload support for `.pdf`, `.docx`, `.txt`, and `.md` files
- Reading-grounded tutoring conversations
- Optional assessment upload with answer-protection behavior
- Teaching context configuration with session goals, learning outcomes to assess, course framing, and selectable interaction style
- Instructor-authored key questions with plain-language process levels, reading anchors, and adaptive ordering
- AI-generated key-question suggestions derived from uploaded readings, with accept/dismiss review before adding them to the session
- AI-assisted checkpoint improvement suggestions for turning recall-heavy prompts into better interpretive questions
- Instructor-side confirmation feedback for uploads, key-question creation, and saved configuration changes
- Learner chat sessions with message limits
- Learner chat sessions with phase-based progress framing instead of countdown-style pressure
- Prior-knowledge opening prompts and guided onboarding
- Tutor responses that render as readable prose with the Socratic question visually separated
- AI-generated session summaries that render as markdown, support copy-to-clipboard, and provide a clean end-of-session exit path
- A bottom-anchored end-session control in learner chat, with confirmation actions kept near the input area instead of at the top of the screen
- Attempt tracking, confidence checks, and structured misconception logging
- A separate diagnostic pipeline that analyzes each exchange after the tutor responds, so misconception detection and resolution tracking do not depend on tutor-emitted inline tags
- Non-blocking post-response diagnostics scheduled after the response completes, so learners can type again as soon as the tutor finishes streaming
- Parallelized hot-path database reads in chat startup to reduce pre-stream latency before the model begins responding
- Instructor-side misconception dashboard with clustered patterns, learner-based prevalence, learner-based resolution rates, turn-based time-to-resolution metrics, and class-discussion triage
- Redesigned session analysis page structured as a three-section narrative — What happened, What it means, What to do — so instructors see evidence before recommendations
- A Quick Brief tab on the session analysis page that gives busy instructors the key finding and two action items in under two minutes, with a link to the full analysis for deeper review
- Consolidated recommendations section that merges previously separate recommendation areas into a single "What to do" section with timing badges and collapsible rationale
- Clear button affordances on misconception cards with verb-first labels ("Mark as acceptable" / "Flag for class discussion"), tooltips explaining consequences, and visual confirmation of instructor overrides
- Consistent status vocabulary across the session analysis page: severity uses High/Medium/Low with red/amber/green; readiness uses "Ready for class" / "Gaps remain" / "Not yet ready" with the same color scale
- Learning outcome scores now display rubric context showing what the current score means and what the next score level requires, plus an explained AI confidence indicator
- Session metadata (student count, exchange count) displayed as inline header text instead of hero-number dashboard cards, avoiding false statistical authority at low learner counts
- Dismissable orientation banner for first-time users explaining how to read the session analysis page
- Deduplicated key findings stated once authoritatively in a highlighted card, with other sections referencing rather than restating the same insight
- Checkpoint difficulty analysis that shows which instructor-authored key questions were easy, moderate, or hard for the class
- Engagement tracking on learner messages, with audit logs for each post-response diagnostic pass
- AI-generated teaching recommendations with 5-minute, 15-minute, and 30-minute active learning moves tied to misconception clusters, plus a fallback generation path when structured model output is incomplete
- Instructor-side recommendation actions for marking suggested activities as used or dismissed
- Tutor phase awareness that helps the conversation move from orientation to exploration to wrap-up
- Checkpoint-aware tutoring with learner-level checkpoint coverage tracking and rescue-mode pacing near the end of a session
- Formative learning outcome assessments generated per learner inside the instructor report
- Topic mastery tracking and revisit prompts for shaky concepts
- Instructor monitoring view with learner progress, live auto-refresh, engagement alerts, reply-wait warnings, and cleaned interaction traces
- Faster instructor monitoring through a lightweight learner-summary endpoint and lazy-loaded full traces only when an instructor expands a learner
- Expanded learner traces include confidence checks and topic-mastery summaries so instructors can scan both participation and understanding quickly
- Plain-language instructor navigation built around `Learner progress`, `Teaching brief`, and `Common misunderstandings`
- A redesigned session workspace that prioritizes access code sharing, readings, key questions, teaching context, and assessments in setup order
- A componentized session workspace with one canonical panel implementation per section, reducing duplicated UI paths and making instructor setup behavior easier to maintain
- Collapsible workspace sections that default closed for active sessions so returning instructors can get to monitoring faster
- Hidden scaffold messages are suppressed in instructor traces, and assistant trace messages render markdown instead of raw `*` / `**` syntax
- Shared tag-stripping keeps internal tags and diagnostic notes out of both learner chat bubbles and instructor replay views
- Prompt-side protections suppress visible meta-reasoning, so the tutor does not narrate its own internal handling decisions to learners
- Memoized chat message rendering and reduced scroll thrashing during streaming for smoother learner chat performance
- AI-generated teaching briefs with readiness heatmaps, next-step recommendations, and per-learner notes
- PDF export for instructor reports and session analysis
- Session purpose system with four modes — Pre-class, In-class Prep, In-class Reflection, After Class — selectable at session creation and editable in the workspace
- Purpose-adaptive tutor behavior where the cognitive target, question emphasis, resolution standard, and wrap-up guidance all shift based on the selected session purpose
- Purpose-adaptive teaching briefs with mode-specific section titles, heatmap names (Readiness, Activation, Consolidation, Transfer), framing language, and instructional recommendations
- Purpose badge visible on all instructor views — session workspace, learner progress, common misunderstandings, and teaching brief — so the session's learning goal is always in context
- Robust heatmap parsing with three-tier fallback that supports both structured and freeform model output, using app-native status colors for green/yellow/red indicators
- Teaching brief rendering with priority ordering — action items and the heatmap surface first, then gaps and strengths, then per-student notes

## Who It Is For

- Instructors who want learners to arrive better prepared
- Programs serving adult, executive, or professional learners
- Teams exploring whether guided AI tutoring improves comprehension and readiness

## Typical Workflow

### Instructor flow

1. Create a session and select a session purpose from the four-card purpose selector.
2. Add a title and an optional note learners will see before they begin.
3. Upload one or more readings.
4. Optionally upload assessments the tutor should treat as protected.
5. Add 2-4 key questions to define the important understandings learners should reach, or generate suggested questions from the reading and accept the ones you want.
6. Use the built-in question feedback tool if a prompt feels too recall-heavy or under-specified.
7. Add optional teaching context such as course framing, session goals, institutional learning outcomes, and interaction style.
8. Change the session purpose at any time from the teaching context panel — the tutor and teaching brief will adapt automatically.
9. Get clear visual confirmation when readings, assessments, settings, or key questions are saved.
10. Share the learner link and access code.
11. Monitor learner progress live, including engagement concerns and learners who have been waiting several minutes to reply. The purpose badge in the header keeps the session's cognitive goal visible while monitoring.
12. Review the session analysis page, which walks through What happened (key finding, strengths, per-student notes), What it means (class readiness, misconception patterns with override controls, question difficulty, learning outcomes with rubric context), and What to do (consolidated, timing-tagged recommendations). Use the Quick Brief tab for a two-minute pre-class scan.
13. Generate a teaching brief afterward. The brief title, heatmap name, section headings, and instructional framing all adapt to the session purpose. Action items and the heatmap surface at the top so the most actionable signals appear first.
14. Review learner-resolution progress, confidence checks, topic mastery, and cleaned interaction traces without needing raw internal model tags.

### Learner flow

1. Open the shared session link.
2. If the instructor has not uploaded a reading yet, see a clear "Session Not Ready Yet" message instead of entering a broken session.
3. Enter a name and begin the chat with no account required.
4. Start by sharing prior knowledge before the tutor moves into the reading.
5. Work through the material with guided questions, confidence checks, and targeted feedback.
6. End the session and receive a formatted session summary with copy and done actions.

## Local Development Setup

### What you need

- Node.js
- npm
- An Anthropic API key

### Environment variables

Create a local `.env.local` file.

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCAL_DATABASE_URL=file:./prisma/dev.db
DATABASE_URL=file:./prisma/dev.db
TURSO_DATABASE_URL=libsql://your-production-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

What these are for:

- `ANTHROPIC_API_KEY`: required for tutoring and report generation
- `ANTHROPIC_MODEL_PRIMARY`: optional override for the main tutoring and report model. Defaults to `claude-sonnet-4-6`.
- `ANTHROPIC_MODEL_FAST`: optional override for fast-path features such as diagnostics, question generation, and concept-map generation. Defaults to `claude-haiku-4-5`.
- `NEXT_PUBLIC_APP_URL`: optional locally, useful for links
- `LOCAL_DATABASE_URL`: used by Prisma CLI commands during local schema work
- `DATABASE_URL`: local SQLite fallback
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: used by the app in production

Do not commit `.env.local`.

### Install and run

```bash
npm install
npx prisma migrate dev
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Database Setup

The app uses two database modes:

- Local development: `better-sqlite3` with a local SQLite file
- Production: Turso Cloud through Prisma's libsql adapter

Important detail: Prisma CLI schema commands run against the local SQLite database. The production app runtime connects to Turso.

This split is intentional:

- Prisma CLI uses the local SQLite URL from `LOCAL_DATABASE_URL` or `DATABASE_URL`
- The deployed app uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- The SQLite adapter is loaded lazily so Vercel does not try to load the native local-development driver in production
- The app also includes a runtime Turso bootstrap path so newly added production columns and tables can be created safely outside the local SQLite workflow
- Hot-path foreign-key indexes are created for both Prisma-managed schema updates and the runtime Turso bootstrap path so chat and monitoring queries stay fast as data grows
- Runtime schema upgrade checks are batched per table to reduce cold-start overhead in production

## Production Deployment

This project is set up for deployment on Vercel.

Set these environment variables in Vercel:

- `ANTHROPIC_API_KEY`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXT_PUBLIC_APP_URL`

The production build runs:

```bash
prisma generate && next build
```

### Schema changes in production

Do not rely on `prisma db push` during the Vercel build for Turso schema creation.

In this project:

- `npx prisma migrate dev` is the local schema workflow for development
- Vercel builds only generate Prisma and build the app
- Turso schema rollout should be handled as a separate operational step

That keeps Prisma CLI on the path Prisma documents for Turso while still allowing the deployed app to use Turso at runtime.

## Quick Test Flow

Once the app is running:

1. Create an instructor session. Select a session purpose from the four-card selector on the create page — try "Pre-class" to start.
2. Upload a reading in the session workspace.
3. Add a few key questions manually or use the reading-based suggestion tool.
4. Open the learner link in a second browser window.
5. Enter a learner name and begin the tutoring conversation.
6. Expand the "About this session" panel if you want to see the session description and instructor framing.
7. Have a short tutoring conversation and notice that each tutor question is visually separated from the surrounding explanation.
8. Watch the learner-facing phase indicator move from "Getting started" toward wrap-up instead of showing a stressful countdown.
9. Return to the instructor area and use the collapsible workspace sections to review readings, questions, teaching context, and assessments.
10. Open the session analysis page. Notice it walks through three numbered sections — What happened, What it means, What to do — with the key finding stated once at the top. Try the Quick Brief tab for a fast pre-class scan.
11. In the misconception patterns, use "Mark as acceptable" or "Flag for class discussion" on each pattern and notice the visual confirmation of your override. Expand the reading anchor to see the source text.
12. Check the learning outcome card — notice the rubric context showing what the current score means and what the next level requires.
13. Monitor learner progress live if needed. Notice the purpose badge in the headers of the learner progress and common misunderstandings views.
14. Generate a teaching brief and notice the heatmap title, section headings, and instructional framing have adapted to the session purpose. Action items appear at the top.
15. End the session and review the formatted summary screen with copy support.

## Caveats

- This is still an MVP and should be treated as an early production prototype.
- PDF extraction works best with text-based PDFs, not scanned-image PDFs.
- Scanned or image-based PDFs should be converted or replaced with DOCX, TXT, or Markdown when possible.
- The quality of tutoring depends heavily on the quality of the uploaded source material.
- Structured misconception logging is captured in the database and surfaced in an instructor dashboard that groups related misconceptions into broader themes for review.
- The main instructor surfaces serve different jobs: `Session analysis` for post-session review (three-section narrative with Quick Brief option), `Learner progress` for live monitoring, `Teaching brief` for forward-looking synthesis, and `Common misunderstandings` for class-level diagnostic patterns.
- Misconception detection now runs in a separate post-response diagnostic pass. The tutor no longer needs to emit misconception tags for the dashboard to work.
- Resolution tracking now reflects whether affected learners actually corrected a misconception, not just whether a tutor response claimed it was resolved.
- The tutor prompt now explicitly forbids unbracketed meta-reasoning such as "the learner is disengaged" from appearing in learner-visible responses.
- Internal tag cleanup is centralized so new bracketed system tags are less likely to leak into the learner chat or instructor trace.
- Instructor monitor tables now load summary data first and fetch full interaction traces on demand, which improves responsiveness for larger cohorts.
- Live monitoring highlights recent engagement concerns and long reply gaps, but those signals are intentionally lightweight heuristics rather than definitive judgments.
- Teaching recommendations are AI-generated planning aids based on misconception clusters and should still be reviewed and adapted by the instructor.
- When recommendation generation cannot be parsed into the preferred structured format, the app now falls back to deterministic recommendation cards so the dashboard remains usable.
- Key question coverage is now tracked per learner session, and instructor reports now include formative AI-generated learning outcome assessments.
- Learning outcome assessments are instructor-facing formative signals, not final grades or official learner records. The session analysis page now shows rubric context alongside scores so instructors can meaningfully evaluate the AI's assessment.
- The session analysis Quick Brief tab is designed for instructors checking in before class. It condenses the full analysis into a key finding and two actions. Instructors who want detail should use the Full Analysis tab.
- Session purpose defaults to `pre_class` when not explicitly set. Changing the purpose after a session is already active will affect the teaching brief framing but will not retroactively alter conversations already recorded.
- The four session purposes target different cognitive levels: comprehension (pre-class), activation (in-class prep), consolidation (in-class reflection), and transfer (after-class). Choosing the wrong purpose for the learning context will produce a teaching brief with mismatched framing and recommendations.
- The app depends on Anthropic API availability and valid credentials.
- Fast-path AI features rely on a current Anthropic Haiku model alias. If you override `ANTHROPIC_MODEL_FAST`, make sure the chosen model is still available in your Anthropic account.
- Assessment protection is designed to reduce answer leakage, but instructors should still review how they want the tool used in their course context.

## Tech Stack

- Next.js 16
- React 19
- Prisma
- SQLite for local development
- Turso/libsql for production
- Anthropic SDK and AI SDK
- Tailwind CSS

## Repository Safety

- Keep `.env.local` out of Git.
- Never commit real API keys or Turso tokens.
- Do not commit local database files.
- Use placeholder credentials in examples only.
