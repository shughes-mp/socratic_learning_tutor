import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError, CheckpointProcessLevel } from "@/types";

const VALID_PROCESS_LEVELS: CheckpointProcessLevel[] = [
  "retrieve",
  "infer",
  "integrate",
  "evaluate",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const checkpoints = await prisma.checkpoint.findMany({
      where: { sessionId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ checkpoints });
  } catch (error) {
    console.error("Error loading checkpoints:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to load checkpoints.", code: "CHECKPOINTS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as {
      prompt?: string;
      processLevel?: string;
      passageAnchors?: string | null;
      expectations?: string[] | null;
      misconceptionSeeds?: string[] | null;
    };

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json<ApiError>(
        { error: "Checkpoint prompt is required.", code: "PROMPT_REQUIRED" },
        { status: 400 }
      );
    }

    const processLevel = body.processLevel?.trim() as CheckpointProcessLevel | undefined;
    if (!processLevel || !VALID_PROCESS_LEVELS.includes(processLevel)) {
      return NextResponse.json<ApiError>(
        {
          error: `Process level must be one of: ${VALID_PROCESS_LEVELS.join(", ")}.`,
          code: "INVALID_PROCESS_LEVEL",
        },
        { status: 400 }
      );
    }

    const maxCheckpoint = await prisma.checkpoint.findFirst({
      where: { sessionId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const checkpoint = await prisma.checkpoint.create({
      data: {
        sessionId,
        orderIndex: (maxCheckpoint?.orderIndex ?? -1) + 1,
        prompt,
        processLevel,
        passageAnchors: body.passageAnchors?.trim() || null,
        expectations:
          Array.isArray(body.expectations) && body.expectations.length > 0
            ? JSON.stringify(body.expectations)
            : null,
        misconceptionSeeds:
          Array.isArray(body.misconceptionSeeds) && body.misconceptionSeeds.length > 0
            ? JSON.stringify(body.misconceptionSeeds)
            : null,
      },
    });

    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch (error) {
    console.error("Error creating checkpoint:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to create checkpoint.", code: "CHECKPOINT_CREATE_FAILED" },
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
    const body = (await request.json()) as { checkpointId?: string };

    const checkpointId = body.checkpointId?.trim();
    if (!checkpointId) {
      return NextResponse.json<ApiError>(
        { error: "checkpointId is required.", code: "CHECKPOINT_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const checkpoint = await prisma.checkpoint.findUnique({
      where: { id: checkpointId },
      select: { id: true, sessionId: true },
    });

    if (!checkpoint || checkpoint.sessionId !== sessionId) {
      return NextResponse.json<ApiError>(
        { error: "Checkpoint not found.", code: "CHECKPOINT_NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.checkpoint.delete({
      where: { id: checkpointId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting checkpoint:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to delete checkpoint.", code: "CHECKPOINT_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
