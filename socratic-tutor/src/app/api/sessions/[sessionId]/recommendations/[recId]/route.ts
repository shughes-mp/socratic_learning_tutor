import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import type { ApiError, TeachingRecommendationAction } from "@/types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["used", "dismissed", "edited"] as const;
const teachingRecommendationClient = prisma as typeof prisma & {
  teachingRecommendation: any;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; recId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId, recId } = await params;
    const body = (await request.json()) as {
      instructorAction?: string | null;
      instructorNote?: string | null;
    };

    const existing = await teachingRecommendationClient.teachingRecommendation.findUnique({
      where: { id: recId },
      select: { id: true, sessionId: true },
    });

    if (!existing || existing.sessionId !== sessionId) {
      return NextResponse.json<ApiError>(
        {
          error: "Recommendation not found.",
          code: "RECOMMENDATION_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const action = body.instructorAction?.trim() || null;
    if (
      action !== null &&
      !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])
    ) {
      return NextResponse.json<ApiError>(
        {
          error: "instructorAction must be used, dismissed, or edited.",
          code: "INVALID_RECOMMENDATION_ACTION",
        },
        { status: 400 }
      );
    }

    const updated = await teachingRecommendationClient.teachingRecommendation.update({
      where: { id: recId },
      data: {
        instructorAction: action as TeachingRecommendationAction,
        instructorNote: body.instructorNote?.trim() || null,
      },
    });

    return NextResponse.json({
      recommendation: {
        id: updated.id,
        sessionId: updated.sessionId,
        instructorAction:
          updated.instructorAction === "used" ||
          updated.instructorAction === "dismissed" ||
          updated.instructorAction === "edited"
            ? updated.instructorAction
            : null,
        instructorNote: updated.instructorNote,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to update recommendation.",
        code: "RECOMMENDATION_UPDATE_FAILED",
      },
      { status: 500 }
    );
  }
}
