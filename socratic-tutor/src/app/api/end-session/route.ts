import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { MODEL_PRIMARY } from "@/lib/models";

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

    const prompt = `The student has just completed a Socratic reading session with an AI tutor. Generate a concise session summary using the transcript below.

Format the summary using markdown with these four sections. Use ## for section headers and - for bullet points. Write in second person (addressing the student as "you").

## Topics covered
List 2–4 main concepts or ideas explored during the session.

## Where you showed strong understanding
2–3 specific things the student reasoned through well. Be concrete — reference actual ideas from the transcript, not generic praise.

## What's worth revisiting
Concepts where the student struggled, hedged, or expressed low confidence. Be specific. If there are unresolved misconceptions listed below, name them here explicitly.

## A question to carry into class
One thought-provoking question the student can bring to the next class session. Make it genuinely open-ended.

Do not add any preamble before the first section header. Do not add any closing remarks after the final section. Keep each section brief — 2–4 bullet points maximum.

Unresolved misconceptions:
${unresolvedMisconceptions.map((item) => `- ${item.topicThread}: ${item.description}`).join("\n") || "None"}

Transcript:
${transcript}`;

    const { text } = await generateText({
      model: anthropic(MODEL_PRIMARY),
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
