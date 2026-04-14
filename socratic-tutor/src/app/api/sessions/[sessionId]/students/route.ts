import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const p = await params;
    const { sessionId } = p;

    const studentSessions = await prisma.studentSession.findMany({
      where: { sessionId },
      include: {
        messages: {
          select: {
            id: true,
            studentSessionId: true,
            role: true,
            content: true,
            topicThread: true,
            attemptNumber: true,
            isGenuineAttempt: true,
            mode: true,
            questionType: true,
            feedbackType: true,
            expertModelType: true,
            selfExplainPrompted: true,
            cognitiveConflictStage: true,
            misconceptionResolved: true,
            isRevisitProbe: true,
            engagementFlag: true,
            engagementNote: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        misconceptions: {
          orderBy: { detectedAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(
      studentSessions.map((studentSession) => ({
        ...studentSession,
        messages: studentSession.messages.map((message, index) => ({
          ...message,
          hidden:
            index === 0 &&
            message.role === "user" &&
            message.content.includes("OPENING SEQUENCE INSTRUCTION"),
        })),
      }))
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch student sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch student sessions", details: message },
      { status: 500 }
    );
  }
}
