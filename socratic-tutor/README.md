# Socratic Tutor MVP

Socratic Tutor is an AI-assisted learning app that helps students work through course readings by thinking out loud, getting guided questions, and building their own understanding before receiving direct answers.

## What This App Does

This MVP is designed for instructors who want students to arrive better prepared for class, and for adult or professional learners who benefit from structured reflection instead of answer dumping.

The app supports a simple teaching workflow:

1. An instructor creates a session.
2. The instructor uploads readings and optional assessment materials.
3. The app generates a student access link and code.
4. Students join the session, enter their name, and chat with the tutor.
5. The tutor guides students through the material using a Socratic approach.
6. The instructor reviews student activity and an AI-generated session report.

## Why It Is “Socratic”

This tutor is built to coach thinking, not shortcut it.

- For conceptual questions, it starts with guiding questions instead of giving the answer immediately.
- If a student makes a genuine effort and is still stuck after repeated attempts, the tutor can provide a direct explanation.
- If the student is asking a straightforward comprehension question, the tutor can answer more directly.
- If assessment material has been uploaded, the tutor will not give away protected answers. It can give feedback on a student's reasoning, but it should not solve the assessment for them.

## MVP Features

- Instructor session creation
- Access-code based student entry
- Upload support for `.pdf`, `.docx`, `.txt`, and `.md` files
- Reading-aware chat grounded in uploaded materials
- Optional assessment upload with answer-protection behavior
- Student chat sessions with exchange limits
- Misconception logging and confidence checks
- Instructor activity monitor with replay view
- AI-generated instructor report
- PDF export for the report
- Local SQLite storage for MVP development

## Who It Is For

- Instructors who want a lightweight pre-class preparation tool
- Programs serving adult learners, executive learners, or professional students
- Teams testing whether AI-guided discussion improves reading comprehension and class readiness

## How A Typical Session Works

### For instructors

1. Open the app and create a new session.
2. Add a session name and optional description.
3. Upload at least one reading.
4. Optionally upload assessments you do not want the tutor to answer directly.
5. Copy the student link and share it with your learners.
6. Monitor participation and review the generated instructor report.

### For students

1. Open the shared session link.
2. Enter your name.
3. Ask questions about the reading or respond to the tutor's prompts.
4. Work through the material with guided follow-up questions.
5. Finish the session with a stronger grasp of the ideas before class.

## Local Setup

### What you need

- Node.js
- `pnpm`
- An Anthropic API key

This project uses a local SQLite database for MVP development. The database file is created locally and should not be committed to GitHub.

### Environment variables

Create a local `.env.local` file based on the example values below:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:./dev.db
```

Notes:

- `ANTHROPIC_API_KEY` is required for chat and report generation.
- `NEXT_PUBLIC_APP_URL` is optional for local development, but useful when sharing or generating links.
- `DATABASE_URL` is included for clarity, although the current MVP uses a local SQLite adapter and stores data in `dev.db`.

### Run the app

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Quick Start

Once the app is running locally:

1. Go to the home page.
2. Choose **Create a Session (Instructor)**.
3. Create a session and upload a reading.
4. Copy the student link.
5. Join as a student in a separate browser window if you want to test the full flow.
6. Return to the instructor view to monitor activity and generate a report.

## Important Caveats

- This is an MVP, optimized for fast iteration and local testing.
- The quality of the tutoring experience depends on the quality and clarity of the uploaded reading material.
- PDF support works best with text-based PDFs, not scanned-image PDFs.
- Report generation and chat both depend on Anthropic API availability and valid credentials.
- The app is currently set up for local SQLite-backed usage rather than a production multi-user deployment.

## Tech Stack

- Next.js 16
- React 19
- Prisma
- SQLite
- Anthropic SDK / AI SDK
- Tailwind CSS

## Repository Safety

This repository is intended to be safe to clone publicly.

- Do not commit `.env.local` or any real API keys.
- Do not commit local SQLite database files such as `dev.db`.
- Use placeholder credentials in examples only.
