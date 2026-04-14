# Socratic Tutor

Socratic Tutor is an AI-powered learning app that helps learners think through course material with guided questions instead of rushing straight to answers.

It is designed for instructors, adult learners, and professional learners who want a more reflective way to prepare for class, discussion, or assessment.

## What the App Does

An instructor creates a learning session, uploads readings and optional assessment materials, and shares a learner link. Learners then chat with the tutor about the material. The tutor pushes them to explain their thinking, identify misunderstandings, and build stronger understanding step by step. Afterward, the instructor can review learner activity, misconception patterns, teaching recommendations, and reports.

This is not a generic chatbot. It is meant to behave like a guided tutor.

## How the Tutoring Approach Works

The app is built around a Socratic approach:

- It starts with guiding questions, prompts, and follow-up checks instead of immediately giving away answers.
- It asks learners to explain what they already know before moving deeper into a topic.
- It tracks repeated attempts so the tutor can respond differently when a learner is genuinely stuck.
- It can probe confidence, surface misconceptions, and revisit weak areas later in the session.
- It protects uploaded assessment materials by avoiding direct answer-giving on those protected questions.

In short: the app is designed to support learning, not shortcut it.

## Core Features

- Instructor session creation with shareable learner access links
- A guided setup flow with a shared three-step indicator: name it, add a reading, share the link
- Step-aware instructor setup progress on both the create page and the session workspace
- Upload support for `.pdf`, `.docx`, `.txt`, and `.md` files
- Reading-grounded tutoring conversations
- Optional assessment upload with answer-protection behavior
- Tutor configuration with learning goals, learning outcomes, and selectable interaction style
- Instructor-authored key questions with plain-language process levels, reading anchors, and adaptive ordering
- AI-assisted checkpoint improvement suggestions for turning recall-heavy prompts into better interpretive questions
- Instructor-side confirmation feedback for uploads, key-question creation, and saved configuration changes
- Learner chat sessions with message limits
- Learner chat sessions with phase-based progress framing instead of countdown-style pressure
- Prior-knowledge opening prompts and guided onboarding
- Tutor responses that render as readable prose with the Socratic question visually separated
- AI-generated session summaries that render as markdown, support copy-to-clipboard, and provide a clean end-of-session exit path
- Attempt tracking, confidence checks, and structured misconception logging
- A separate diagnostic pipeline that analyzes each exchange after the tutor responds, so misconception detection and resolution tracking do not depend on tutor-emitted inline tags
- Instructor-side misconception dashboard with clustered patterns, learner-based prevalence, learner-based resolution rates, turn-based time-to-resolution metrics, and class-discussion triage
- Engagement tracking on learner messages, with audit logs for each post-response diagnostic pass
- AI-generated teaching recommendations with 5-minute, 15-minute, and 30-minute active learning moves tied to misconception clusters, plus a fallback generation path when structured model output is incomplete
- Instructor-side recommendation actions for marking suggested activities as used or dismissed
- Tutor phase awareness that helps the conversation move from orientation to exploration to wrap-up
- Checkpoint-aware tutoring with learner-level checkpoint coverage tracking and rescue-mode pacing near the end of a session
- Formative learning outcome assessments generated per learner inside the instructor report
- Topic mastery tracking and revisit prompts for shaky concepts
- Instructor monitoring view with student replay
- AI-generated session reports
- PDF export for instructor reports

## Who It Is For

- Instructors who want learners to arrive better prepared
- Programs serving adult, executive, or professional learners
- Teams exploring whether guided AI tutoring improves comprehension and readiness

## Typical Workflow

### Instructor flow

1. Create a session.
2. Add a title and an optional note learners will see before they begin.
3. Upload one or more readings.
4. Optionally upload assessments the tutor should treat as protected.
5. Add optional tutor configuration such as course framing, learning goals, institutional learning outcomes, and interaction style.
6. Add 2-4 key questions to define the important understandings students should reach.
7. Use the built-in question feedback tool if a prompt feels too recall-heavy or under-specified.
8. Get clear visual confirmation when readings, assessments, settings, or key questions are saved.
9. Share the learner link and access code.
10. Monitor learner activity, review clustered misconception patterns, and generate active-learning teaching recommendations from those patterns.
11. Generate a report afterward, including formative learning outcome assessments for each learner.
12. Review misconception examples, learner-resolution progress, and engagement patterns without needing raw internal model tags.

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

1. Create an instructor session.
2. Upload a reading.
3. Open the learner link in a second browser window.
4. Enter a learner name and begin the tutoring conversation.
5. Expand the "About this session" panel if you want to see the session description and instructor framing.
6. Have a short tutoring conversation and notice that each tutor question is visually separated from the surrounding explanation.
7. Watch the student-facing phase indicator move from "Getting started" toward wrap-up instead of showing a stressful countdown.
8. Return to the instructor area and add a few key questions, then try the question feedback tool on one of them.
9. Open the misconception dashboard, mark any acceptable interpretations, and generate teaching recommendations if you want lesson-ready follow-up moves.
10. Monitor activity and generate a report with session-level insights plus per-learner learning outcome assessments.
11. End the session and review the formatted summary screen with copy support.

## Caveats

- This is still an MVP and should be treated as an early production prototype.
- PDF extraction works best with text-based PDFs, not scanned-image PDFs.
- Scanned or image-based PDFs should be converted or replaced with DOCX, TXT, or Markdown when possible.
- The quality of tutoring depends heavily on the quality of the uploaded source material.
- Structured misconception logging is captured in the database and surfaced in an instructor dashboard that groups related misconceptions into broader themes for review.
- Misconception detection now runs in a separate post-response diagnostic pass. The tutor no longer needs to emit misconception tags for the dashboard to work.
- Resolution tracking now reflects whether affected learners actually corrected a misconception, not just whether a tutor response claimed it was resolved.
- Teaching recommendations are AI-generated planning aids based on misconception clusters and should still be reviewed and adapted by the instructor.
- When recommendation generation cannot be parsed into the preferred structured format, the app now falls back to deterministic recommendation cards so the dashboard remains usable.
- Key question coverage is now tracked per learner session, and instructor reports now include formative AI-generated learning outcome assessments.
- Learning outcome assessments are instructor-facing formative signals, not final grades or official learner records.
- The app depends on Anthropic API availability and valid credentials.
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
