import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSessionPurpose, normalizeSessionPurpose } from "@/lib/session-purpose";
import type { ApiError } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const {
      name,
      description,
      courseContext,
      learningGoal,
      learningOutcomes,
      prerequisiteMap,
      maxExchanges,
      opensAt,
      closesAt,
      stance,
      sessionPurpose,
    } = body as {
      name?: string;
      description?: string | null;
      courseContext?: string | null;
      learningGoal?: string | null;
      learningOutcomes?: string | null;
      prerequisiteMap?: string | null;
      maxExchanges?: number;
      opensAt?: string | null;
      closesAt?: string | null;
      stance?: string;
      sessionPurpose?: string;
    };

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

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (courseContext !== undefined) updateData.courseContext = courseContext?.trim() || null;
    if (learningGoal !== undefined) updateData.learningGoal = learningGoal?.trim() || null;
    if (learningOutcomes !== undefined)
      updateData.learningOutcomes = learningOutcomes?.trim() || null;
    if (prerequisiteMap !== undefined)
      updateData.prerequisiteMap = prerequisiteMap?.trim() || null;
    if (maxExchanges !== undefined)
      updateData.maxExchanges = Math.max(1, Math.min(100, maxExchanges));
    if (opensAt !== undefined) updateData.opensAt = opensAt ? new Date(opensAt) : null;
    if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null;
    if (stance !== undefined) {
      if (!["directed", "mentor"].includes(stance)) {
        return NextResponse.json(
          { error: "stance must be 'directed' or 'mentor'" },
          { status: 400 }
        );
      }
      updateData.stance = stance;
    }
    if (sessionPurpose !== undefined) {
      if (!isValidSessionPurpose(sessionPurpose)) {
        return NextResponse.json<ApiError>(
          {
            error:
              "sessionPurpose must be pre_class, during_class_prep, during_class_reflection, or after_class.",
            code: "INVALID_SESSION_PURPOSE",
          },
          { status: 400 }
        );
      }
      updateData.sessionPurpose = sessionPurpose;
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: update