import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const studentSessions = await prisma.studentSession.findMany({
      where: { sessionId },
      select: {
        id: true,
        studentName: true,
        startedAt: true,
        endedAt: true,
        _count: {
          select: {
            messages: true,
            misconceptions: true,
          },
        },
        messages: {
          select: {
            createdAt: true,
            engagementFlag: true,
            role: true,
          },
          orderBy: { createdAt: "desc" as const },
          take: 5,
        },
        loAssessments: {
          select: {
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(
      studentSessions.map((studentSession) => {
        const latestFlaggedMessage = studentSession.messages.find(
          (message) =>
            message.role === "user" &&
            message.engagementFlag &&
            message.engagementFlag !== "on_task"
        );
        const latestEngagement = studentSession.messages.find(
          (message) => message.role === "user" && message.engagementFlag
        );
        const lastMessage = studentSession.messages[0];
        const isWaitingForStudentReply = lastMessage?.role === "assistant";
        const secondsSinceLastMessage = lastMessage
          ? Math.floor(
              (Date.now() - new Date(lastMessage.createdAt).getTime()) / 1000
            )
          : null;

        return {
          id: studentSession.id,
          studentName: studentSession.studentName,
          startedAt: studentSession.startedAt,
          endedAt: studentSession.endedAt,
          messageCount: studentSession._count.messages,
          misconceptionCount: studentSession._count.misconceptions,
          lastActiveAt: lastMessage?.createdAt ?? studentSession.startedAt,
          latestEngagementFlag: latestEngagement?.engagementFlag ?? null,
          hasRecentEngagementConcern: !!latestFlaggedMessage,
          isWaitingForStudentReply,
          secondsSinceLastMessage,
          latestRubricScore: studentSession.loAssessments[0]?.status ?? null,
        };
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch student summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch student summary", details: message },
      { status: 500 }
    );
  }
}
