import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { parseFile, validateFile } from "@/lib/file-parser";
import type { ApiError, FileCategory } from "@/types";

const MAX_FILES_PER_TYPE = 10;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await ensureDatabaseReady();

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        readings: { select: { id: true } },
        assessments: { select: { id: true } },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as FileCategory | null;

    if (!file) {
      return NextResponse.json<ApiError>(
        { error: "No file provided.", code: "NO_FILE" },
        { status: 400 }
      );
    }

    if (!category || !["reading", "assessment"].includes(category)) {
      return NextResponse.json<ApiError>(
        { error: "Category must be 'reading' or 'assessment'.", code: "INVALID_CATEGORY" },
        { status: 400 }
      );
    }

    // Validate file type and size
    const validation = validateFile(file.name, file.size);
    if (!validation.valid) {
      return NextResponse.json<ApiError>(
        { error: validation.error!, code: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // Check file count limits
    const currentCount =
      category === "reading"
        ? session.readings.length
        : session.assessments.length;

    if (currentCount >= MAX_FILES_PER_TYPE) {
      return NextResponse.json<ApiError>(
        {
          error: `Maximum ${MAX_FILES_PER_TYPE} ${category} files per session.`,
          code: "FILE_LIMIT",
        },
        { status: 400 }
      );
    }

    // Parse file content
    const buffer = Buffer.from(await file.arrayBuffer());
    let content: string;

    try {
      content = await parseFile(buffer, file.name);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse file.";
      return NextResponse.json<ApiError>(
        { error: message, code: "PARSE_FAILED" },
        { status: 400 }
      );
    }

    // Store in the appropriate table
    if (category === "reading") {
      const reading = await prisma.reading.create({
        data: {
          sessionId,
          filename: file.name,
          content,
        },
      });
      return NextResponse.json(
        {
          id: reading.id,
          filename: reading.filename,
          category: "reading",
          preview: content.substring(0, 100),
          uploadedAt: reading.uploadedAt.toISOString(),
        },
        { status: 201 }
      );
    } else {
      const assessment = await prisma.assessment.create({
        data: {
          sessionId,
          filename: file.name,
          content,
        },
      });
      return NextResponse.json(
        {
          id: assessment.id,
          filename: assessment.filename,
          category: "assessment",
          preview: content.substring(0, 100),
          uploadedAt: assessment.uploadedAt.toISOString(),
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error uploading file:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "UnknownError",
      stack: error instanceof Error ? error.stack : undefined,
      cause:
        error instanceof Error && "cause" in error
          ? error.cause
          : undefined,
    });
    return NextResponse.json<ApiError>(
      { error: "Failed to upload file.", code: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
