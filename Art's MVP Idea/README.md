# Socratic Tutor

A locally-hosted Socratic tutoring app for adult professional learners.
Upload course readings and the tutor guides students to understanding
through questioning rather than direct answers. Generates an instructor
debrief after each session.

## Requirements

- Python 3.9 or later
- An Anthropic API key (https://console.anthropic.com)

## Setup

1. Copy `.env.template` to `.env`:

   cp .env.template .env        # Mac/Linux
   copy .env.template .env      # Windows

2. Open `.env` and replace the placeholder with your API key:

   ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

3. Run the startup script:

   ./start.sh      # Mac/Linux
   start.bat       # Windows

4. Open http://localhost:7860 in your browser.

The startup script installs dependencies automatically on first run.

## Usage

### Instructor setup tab
- Enter a session name (shown in the report)
- Upload readings: PDF, TXT, or MD files students should know
- Upload assessments (optional): quizzes or discussion questions —
  the tutor will never answer these directly, only give feedback
  on student-provided answers

### Student session tab
- Students enter their name (optional, used in the report)
- The tutor greets them and guides the conversation Socratically
- After 3 genuine attempts at a question, direct answers unlock
- Shift+Enter for newlines, Enter to send

### Instructor report tab
- Summarizes the session: exchanges, misconceptions detected,
  direct answers given
- Generates a structured debrief with suggested teaching approaches
- Download as .txt for your records

## Changing the port

Edit `.env` and add:

   PORT=8080

## Notes

- PDF text extraction happens server-side; scanned (image-only) PDFs
  will not extract text
- Each reading is capped at 40,000 characters in the prompt (~30-40
  dense pages); for longer readings, the most important content
  should appear early in the document
- Session data is held in memory and resets when the server restarts;
  download reports before stopping the server if you want to keep them
