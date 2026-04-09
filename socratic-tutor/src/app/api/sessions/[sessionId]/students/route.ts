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
          orderBy: { createdAt: "asc" },
        },
        misconceptions: {
          orderBy: { detectedAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(studentSessions);

  } catch (error: any) {
    console.error("Failed to fetch student sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch student sessions", details: error.message },
      { status: 500 }
    );
  }
}
