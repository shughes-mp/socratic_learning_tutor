import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueAccessCode } from "@/lib/access-codes";
import type { CreateSessionRequest, CreateSessionResponse, ApiError } from "@/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSessionRequest;

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json<ApiError>(
        { error: "Session name is required.", code: "MISSING_NAME" },
        { status: 400 }
      );
    }

    const accessCode = await generateUniqueAccessCode();

    const session = await prisma.session.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        courseContext: body.courseContext?.trim() || null,
        learningGoal: body.learningGoal?.trim() || null,
        accessCode,
      },
    });

    return NextResponse.json<CreateSessionResponse>(
      {
        id: session.id,
        name: session.name,
        accessCode: session.accessCode,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to create session.", code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
