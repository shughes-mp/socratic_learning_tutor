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
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(
      studentSessions.map((studentSession) => ({
        id: studentSession.id,
        studentName: studentSession.studentName,
        startedAt: studentSession.startedAt,
        endedAt: studentSession.endedAt,
        messageCount: studentSession._count.messages,
        misconceptionCount: studentSession._count.misconceptions,
        lastActiveAt: studentSession.messages[0]?.createdAt ?? studentSession.startedAt,
      }))
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
