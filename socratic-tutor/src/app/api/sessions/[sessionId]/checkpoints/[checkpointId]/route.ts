import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError } from "@/types";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ sessionId: string; checkpointId: string }> }
) {
  try {
    const { sessionId, checkpointId } = await params;
    const body = (await request.json()) as {
      prompt?: string;
      expectations?: string[] | null;
      misconceptionSeeds?: string[] | null;
      orderIndex?: number;
    };

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

    const updateData: Record<string, unknown> = {};

    if (body.prompt !== undefined) {
      const prompt = body.prompt.trim();
      if (!prompt) {
        return NextResponse.json<ApiError>(
          { error: "Checkpoint prompt cannot be empty.", code: "PROMPT_REQUIRED" },
          { status: 400 }
        );
      }
      updateData.prompt = prompt;
    }

    if (body.expectations !== undefined) {
      updateData.expectations =
        Array.isArray(body.expectations) && body.expectations.length > 0
          ? JSON.stringify(body.expectations)
          : null;
    }

    if (body.misconceptionSeeds !== undefined) {
      updateData.misconceptionSeeds =
        Array.isArray(body.misconceptionSeeds) && body.misconceptionSeeds.length > 0
          ? JSON.stringify(body.misconceptionSeeds)
          : null;
    }

    if (body.orderIndex !== undefined) {
      updateData.orderIndex = Math.max(0, Math.floor(body.orderIndex));
    }

    const updated = await prisma.checkpoint.update({
      where: { id: checkpointId },
      data: updateData,
    });

    return NextResponse.json({ checkpoint: updated });
  } catch (error) {
    console.error("Error updating checkpoint:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to update checkpoint.", code: "CHECKPOINT_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
