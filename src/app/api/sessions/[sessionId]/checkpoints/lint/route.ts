import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import type { ApiError, CheckpointLintResult } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json<ApiError>(
        { error: "prompt (string) is required.", code: "PROMPT_REQUIRED" },
        { status: 400 }
      );
    }

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

    const systemPrompt = `You are an expert in reading assessment design and Socratic instruction. You are analyzing a checkpoint prompt for a reading comprehension session.

Your job is to:
1. Detect if the question is recall-only and can be answered by lookup
2. If it is recall-only, suggest a rewrite that promotes interpretation or inference
3. Suggest 2-3 expected evidence features students should demonstrate
4. Suggest 1-2 common misreadings or misinterpretations

Respond ONLY with valid JSON:
{
  "isRecallOnly": boolean,
  "suggestedRewrite": "rewritten prompt that promotes higher-order thinking",
  "suggestedExpectations": ["evidence feature 1", "evidence feature 2"],
  "suggestedMisconceptions": ["misreading 1", "misreading 2"]
}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze this checkpoint prompt for a reading comprehension session:\n\n"${prompt}"`,
        },
      ],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      return NextResponse.json<ApiError>(
        {
          error: "Unexpected response type from Anthropic.",
          code: "UNEXPECTED_MODEL_RESPONSE",
        },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content.text) as Partial<CheckpointLintResult>;
    const result: CheckpointLintResult = {
      isRecallOnly: Boolean(parsed.isRecallOnly),
      suggestedRewrite:
        typeof parsed.suggestedRewrite === "string" ? parsed.suggestedRewrite : prompt,
      suggestedExpectations: Array.isArray(parsed.suggestedExpectations)
        ? parsed.suggestedExpectations.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : [],
      suggestedMisconceptions: Array.isArray(parsed.suggestedMisconceptions)
        ? parsed.suggestedMisconceptions.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error linting checkpoint:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to analyze checkpoint.", code: "CHECKPOINT_LINT_FAILED" },
      { status: 500 }
    );
  }
}
