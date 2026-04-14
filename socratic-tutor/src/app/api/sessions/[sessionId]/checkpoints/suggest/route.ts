import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import type { ApiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        readings: true,
        checkpoints: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (session.readings.length === 0) {
      return NextResponse.json<ApiError>(
        {
          error: "Upload a reading before generating questions.",
          code: "NO_READINGS",
        },
        { status: 400 }
      );
    }

    const maxExchanges = session.maxExchanges || 20;
    const recommendedCount = Math.max(2, Math.floor((maxExchanges - 4) / 4));
    const existingCount = session.checkpoints.length;
    const suggestCount = Math.max(
      1,
      Math.min(4, recommendedCount - existingCount)
    );

    const readingContent = session.readings
      .map((reading) => `=== ${reading.filename} ===\n${reading.content}`)
      .join("\n\n");

    const existingQuestions =
      session.checkpoints.length > 0
        ? `\n\nThe instructor has already written these questions (do NOT duplicate them):\n${session.checkpoints
            .map(
              (checkpoint, index) =>
                `${index + 1}. [${checkpoint.processLevel}] ${checkpoint.prompt}`
            )
            .join("\n")}`
        : "";

    const contextInfo = session.courseContext
      ? `\n\nCourse context: ${session.courseContext}`
      : "";
    const goalInfo = session.learningGoal
      ? `\n\nSession goal: ${session.learningGoal}`
      : "";

    const systemPrompt = `You are an expert in reading assessment design and Socratic instruction. Generate ${suggestCount} discussion questions for a Socratic tutoring session based on the provided reading.

RULES:
- Questions must require interpretation, inference, evaluation, or synthesis - NOT recall or lookup.
- Each question should target a different key idea or passage in the reading.
- Questions should be specific to this text - not generic questions that could apply to any reading.
- For each question, assign a process level and identify the relevant passage.
- A strong question makes the learner reconstruct the author's reasoning, not just locate a fact.

Process levels:
- retrieve: Locate specific information in the text (avoid this level - only use if essential)
- infer: Draw conclusions the author implies but doesn't state directly
- integrate: Link ideas across different parts of the reading
- evaluate: Assess the strength or validity of the author's reasoning

Respond ONLY with valid JSON:
{
  "suggestions": [
    {
      "prompt": "The discussion question text",
      "processLevel": "infer|integrate|evaluate",
      "passageAnchors": "Section/paragraph reference or null",
      "expectations": ["What a strong answer would demonstrate", "Another evidence feature"],
      "misconceptions": ["A likely misreading", "Another common error"]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate ${suggestCount} discussion questions for this reading:\n\n${readingContent.slice(
            0,
            12000
          )}${existingQuestions}${contextInfo}${goalInfo}`,
        },
      ],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      return NextResponse.json<ApiError>(
        {
          error: "Unexpected response.",
          code: "UNEXPECTED_MODEL_RESPONSE",
        },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content.text) as {
      suggestions?: Array<{
        prompt?: string;
        processLevel?: string;
        passageAnchors?: string | null;
        expectations?: string[];
        misconceptions?: string[];
      }>;
    };

    const validLevels = ["retrieve", "infer", "integrate", "evaluate"];
    const suggestions = (parsed.suggestions ?? [])
      .filter(
        (suggestion) =>
          typeof suggestion.prompt === "string" &&
          suggestion.prompt.trim().length > 0
      )
      .map((suggestion) => ({
        prompt: suggestion.prompt!.trim(),
        processLevel: validLevels.includes(suggestion.processLevel ?? "")
          ? suggestion.processLevel!
          : "infer",
        passageAnchors:
          typeof suggestion.passageAnchors === "string"
            ? suggestion.passageAnchors
            : null,
        expectations: Array.isArray(suggestion.expectations)
          ? suggestion.expectations.filter(
              (expectation): expectation is string =>
                typeof expectation === "string"
            )
          : [],
        misconceptions: Array.isArray(suggestion.misconceptions)
          ? suggestion.misconceptions.filter(
              (misconception): misconception is string =>
                typeof misconception === "string"
            )
          : [],
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error generating question suggestions:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to generate suggestions.",
        code: "SUGGESTION_FAILED",
      },
      { status: 500 }
    );
  }
}
