import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError, FileInfo } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        readings: {
          select: { id: true, filename: true, content: true, uploadedAt: true },
          orderBy: { uploadedAt: "asc" },
        },
        assessments: {
          select: { id: true, filename: true, content: true, uploadedAt: true },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const files: FileInfo[] = [
      ...session.readings.map((r) => ({
        id: r.id,
        filename: r.filename,
        category: "reading" as const,
        preview: r.content.substring(0, 100),
        uploadedAt: r.uploadedAt.toISOString(),
      })),
      ...session.assessments.map((a) => ({
        id: a.id,
        filename: a.filename,
        category: "assessment" as const,
        preview: a.content.substring(0, 100),
        uploadedAt: a.uploadedAt.toISOString(),
      })),
    ];

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to list files.", code: "LIST_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const category = searchParams.get("category");

    if (!fileId || !category) {
      return NextResponse.json<ApiError>(
        { error: "fileId and category query params are required.", code: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    // Verify ownership
    if (category === "reading") {
      const reading = await prisma.reading.findFirst({
        where: { id: fileId, sessionId },
      });
      if (!reading) {
        return NextResponse.json<ApiError>(
          { error: "File not found.", code: "FILE_NOT_FOUND" },
          { status: 404 }
        );
      }
      await prisma.reading.delete({ where: { id: fileId } });
    } else if (category === "assessment") {
      const assessment = await prisma.assessment.findFirst({
        where: { id: fileId, sessionId },
      });
      if (!assessment) {
        return NextResponse.json<ApiError>(
          { error: "File not found.", code: "FILE_NOT_FOUND" },
          { status: 404 }
        );
      }
      await prisma.assessment.delete({ where: { id: fileId } });
    } else {
      return NextResponse.json<ApiError>(
        { error: "Invalid category.", code: "INVALID_CATEGORY" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to delete file.", code: "DELETE_FAILED" },
      { status: 500 }
    );
  }
}
