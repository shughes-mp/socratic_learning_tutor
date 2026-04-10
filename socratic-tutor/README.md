# Socratic Tutor

Socratic Tutor is an AI-powered learning app that helps students think through course material with guided questions instead of rushing straight to answers.

It is designed for instructors, adult learners, and professional learners who want a more reflective way to prepare for class, discussion, or assessment.

## What the App Does

An instructor creates a learning session, uploads readings and optional assessment materials, and shares a student link. Students then chat with the tutor about the material. The tutor pushes them to explain their thinking, identify misunderstandings, and build stronger understanding step by step. Afterward, the instructor can review student activity and generate a report.

This is not a generic chatbot. It is meant to behave like a guided tutor.

## How the Tutoring Approach Works

The app is built around a Socratic approach:

- It starts with guiding questions, prompts, and follow-up checks instead of immediately giving away answers.
- It asks students to explain what they already know before moving deeper into a topic.
- It tracks repeated attempts so the tutor can respond differently when a learner is genuinely stuck.
- It can probe confidence, surface misconceptions, and revisit weak areas later in the session.
- It protects uploaded assessment materials by avoiding direct answer-giving on those protected questions.

In short: the app is designed to support learning, not shortcut it.

## Core Features

- Instructor session creation with shareable student access links
- Upload support for `.pdf`, `.docx`, `.txt`, and `.md` files
- Reading-grounded tutoring conversations
- Optional assessment upload with answer-protection behavior
- Student chat sessions with exchange limits
- Prior-knowledge opening prompts and guided onboarding
- Attempt tracking, confidence checks, and misconception logging
- Topic mastery tracking and revisit prompts for shaky concepts
- Instructor monitoring view with student replay
- AI-generated session reports
- PDF export for instructor reports

## Who It Is For

- Instructors who want students to arrive better prepared
- Programs serving adult, executive, or professional learners
- Teams exploring whether guided AI tutoring improves comprehension and readiness

## Typical Workflow

### Instructor flow

1. Create a session.
2. Add a title, description, and optional course context or learning goal.
3. Upload one or more readings.
4. Optionally upload assessments the tutor should treat as protected.
5. Share the student link and access code.
6. Monitor student activity and generate a report afterward.

### Student flow

1. Open the shared session link.
2. Enter a name and begin the chat.
3. Answer opening prompts about prior knowledge and confidence.
4. Work through the reading with guided questions and feedback.
5. Leave with a clearer understanding of the material and where they were confused.

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
npm run db:push
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

- `npm run db:push` is for local SQLite schema sync during development
- Vercel builds only generate Prisma and build the app
- Turso schema rollout should be handled as a separate operational step

That keeps Prisma CLI on the path Prisma documents for Turso while still allowing the deployed app to use Turso at runtime.

## Quick Test Flow

Once the app is running:

1. Create an instructor session.
2. Upload a reading.
3. Open the student link in a second browser window.
4. Have a short tutoring conversation.
5. Return to the instructor area to monitor activity and generate a report.

## Caveats

- This is still an MVP and should be treated as an early production prototype.
- PDF extraction works best with text-based PDFs, not scanned-image PDFs.
- The quality of tutoring depends heavily on the quality of the uploaded source material.
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
