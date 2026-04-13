import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiError, MisconceptionOverrideRecord } from "@/types";

const VALID_OVERRIDE_TYPES = [
  "acceptable_interpretation",
  "needs_discussion",
] as const;

function serializeOverride(override: {
  id: string;
  sessionId: string;
  clusterLabel: string;
  overrideType: string;
  instructorNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MisconceptionOverrideRecord {
  return {
    id: override.id,
    sessionId: override.sessionId,
    clusterLabel: override.clusterLabel,
    overrideType:
      override.overrideType === "acceptable_interpretation"
        ? "acceptable_interpretation"
        : "needs_discussion",
    instructorNote: override.instructorNote,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const overrides = await prisma.misconceptionOverride.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      overrides: overrides.map(serializeOverride),
    });
  } catch (error) {
    console.error("Error fetching misconception overrides:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to fetch misconception overrides.",
        code: "MISCONCEPTION_OVERRIDES_FETCH_FAILED",
      },
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
      clusterLabel?: string;
      overrideType?: string;
      instructorNote?: string | null;
    };

    const clusterLabel = body.clusterLabel?.trim();
    const overrideType = body.overrideType?.trim() as
      | (typeof VALID_OVERRIDE_TYPES)[number]
      | undefined;

    if (!clusterLabel || !overrideType) {
      return NextResponse.json<ApiError>(
        {
          error: "clusterLabel and overrideType are required.",
          code: "OVERRIDE_FIELDS_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!VALID_OVERRIDE_TYPES.includes(overrideType)) {
      return NextResponse.json<ApiError>(
        {
          error: "overrideType must be acceptable_interpretation or needs_discussion.",
          code: "INVALID_OVERRIDE_TYPE",
        },
        { status: 400 }
      );
    }

    const override = await prisma.misconceptionOverride.create({
      data: {
        sessionId,
        clusterLabel,
        overrideType,
        instructorNote: body.instructorNote?.trim() || null,
      },
    });

    return NextResponse.json(
      { override: serializeOverride(override) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating misconception override:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to save misconception override.",
        code: "MISCONCEPTION_OVERRIDE_CREATE_FAILED",
      },
      { status: 500 }
    );
  }
}
