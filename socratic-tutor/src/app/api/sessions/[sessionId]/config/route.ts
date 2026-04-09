import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.maxExchanges !== undefined)
      updateData.maxExchanges = Math.max(1, Math.min(100, body.maxExchanges));
    if (body.opensAt !== undefined)
      updateData.opensAt = body.opensAt ? new Date(body.opensAt) : null;
    if (body.closesAt !== undefined)
      updateData.closesAt = body.closesAt ? new Date(body.closesAt) : null;

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      accessCode: updated.accessCode,
      maxExchanges: updated.maxExchanges,
    });
  } catch (error) {
    console.error("Error updating session config:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to update session.", code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
