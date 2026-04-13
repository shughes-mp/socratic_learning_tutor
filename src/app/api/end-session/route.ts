import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function POST(req: Request) {
  try {
    const { studentSessionId } = await req.json();

    if (!studentSessionId) {
      return NextResponse.json({ error: "Missing studentSessionId", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const studentSession = await prisma.studentSession.findUnique({
      where: { id: studentSessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        misconceptions: true,
      },
    });

    if (!studentSession) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (studentSession.sessionSummary) {
      return NextResponse.json({ summary: studentSession.sessionSummary }, { status: 200 });
    }

    // Format transcripts
    const transcript = studentSession.messages
      .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
      .join("\n\n");
    const unresolvedMisconceptions = studentSession.misconceptions.filter(
      (item) => !item.resolved || item.persistentlyUnresolved
    );

    const prompt = `The student is ending their session. Below is the transcript of their session with the tutor.
Provide a brief session summary with these four sections:

1. TOPICS COVERED: List the 2-4 main concepts discussed.
2. AREAS OF STRENGTH: Where the student demonstrated solid understanding.
3. AREAS TO REVISIT: Concepts where the student struggled or expressed low confidence. Be specific.
4. ONE QUESTION TO THINK ABOUT: A thought-provoking question the student can take into the class session.

Label the summary at the very beginning: "Here's a summary of your session that you may want to save or share with your instructor."

If there are unresolved misconceptions, name them specifically in AREAS TO REVISIT.

Unresolved misconceptions:
${unresolvedMisconceptions.map((item) => `- ${item.topicThread}: ${item.description}`).join("\n") || "None"}

Transcript:
${transcript}`;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      prompt,
    });

    // Save summary and mark endedAt
    await prisma.studentSession.update({
      where: { id: studentSessionId },
      data: {
        sessionSummary: text,
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ summary: text }, { status: 200 });
  } catch (error) {
    console.error("End Session Error:", error);
    return NextResponse.json({ error: "Failed to end session", code: "END_FAILED" }, { status: 500 });
  }
}
