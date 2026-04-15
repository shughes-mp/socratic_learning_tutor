import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { isValidSessionPurpose, normalizeSessionPurpose } from "@/lib/session-purpose";
import type { ApiError } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        readings: {
          select: { id: true },
        },
        assessments: {
          select: { id: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: session.id,
      name: session.name,
      description: session.description,
      courseContext: session.courseContext,
      learningGoal: session.learningGoal,
      learningOutcomes: session.learningOutcomes,
      prerequisiteMap: session.prerequisiteMap,
      accessCode: session.accessCode,
      createdAt: session.createdAt.toISOString(),
      maxExchanges: session.maxExchanges,
      stance: session.stance,
      sessionPurpose: normalizeSessionPurpose(session.sessionPurpose),
      opensAt: session.opensAt?.toISOString() ?? null,
      closesAt: session.closesAt?.toISOString() ?? null,
      readingsCount: session.readings.length,
      assessmentsCount: session.assessments.length,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to fetch session.", code: "SESSION_FETCH_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
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

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (courseContext !== undefined) updateData.courseContext = courseContext?.trim() || null;
    if (learningGoal !== undefined) updateData.learningGoal = learningGoal?.trim() || null;
    if (learningOutcomes !== undefined) {
      updateData.learningOutcomes = learningOutcomes?.trim() || null;
    }
    if (prerequisiteMap !== undefined) {
      updateData.prerequisiteMap = prerequisiteMap?.trim() || null;
    }
    if (maxExchanges !== undefined) {
      updateData.maxExchanges = Math.max(1, Math.min(100, maxExchanges));
    }
    if (opensAt !== undefined) updateData.opensAt = opensAt ? new Date(opensAt) : null;
    if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null;
    if (stance !== undefined) {
      if (!["directed", "mentor"].includes(stance)) {
        return NextResponse.json<ApiError>(
          { error: "stance must be 'directed' or 'mentor'.", code: "INVALID_STANCE" },
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
      include: {
        readings: { select: { id: true } },
        assessments: { select: { id: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      courseContext: updated.courseContext,
      learningGoal: updated.learningGoal,
      learningOutcomes: updated.learningOutcomes,
      prerequisiteMap: updated.prerequisiteMap,
      accessCode: updated.accessCode,
      createdAt: updated.createdAt.toISOString(),
      maxExchanges: updated.maxExchanges,
      stance: updated.stance,
      sessionPurpose: normalizeSessionPurpose(updated.sessionPurpose),
      opensAt: updated.opensAt?.toISOString() ?? null,
      closesAt: updated.closesAt?.toISOString() ?? null,
      readingsCount: updated.readings.length,
      assessmentsCount: updated.assessments.length,
    });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to update session.", code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
