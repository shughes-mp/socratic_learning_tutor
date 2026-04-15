import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, studentName } = body;

    if (!sessionId || !studentName?.trim()) {
      return NextResponse.json<ApiError>(
        { error: "Session ID and student name are required.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if session is closed
    if (session.closesAt && new Date(session.closesAt) < new Date()) {
      return NextResponse.json<ApiError>(
        { error: "This session has closed.", code: "SESSION_CLOSED" },
        { status: 403 }
      );
    }

    const studentSession = await prisma.studentSession.create({
      data: {
        sessionId,
        studentName: studentName.trim(),
      },
    });

    return NextResponse.json(
      {
        id: studentSession.id,
        sessionId: studentSession.sessionId,
        studentName: studentSession.studentName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating student session:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to start session.", code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
