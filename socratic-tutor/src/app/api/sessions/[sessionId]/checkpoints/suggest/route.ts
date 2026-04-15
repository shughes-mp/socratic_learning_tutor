import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import type { ApiError } from "@/types";
import { MODEL_FAST } from "@/lib/models";

type ProcessLevel = "retrieve" | "infer" | "integrate" | "evaluate";

interface SuggestionCandidate {
  prompt?: string;
  processLevel?: string;
  focusArea?: string;
  rationale?: string;
  expectations?: string[];
  misconceptions?: string[];
}

interface SuggestionResponse {
  suggestions?: SuggestionCandidate[];
}

interface SuggestionQuality {
  score: number;
  labels: string[];
  issues: string[];
}

function parseSuggestionResponse(text: string): SuggestionResponse {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(cleaned) as SuggestionResponse;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inferProcessLevel(prompt: string): ProcessLevel {
  const lower = prompt.toLowerCase();

  if (
    lower.includes("strength of") ||
    lower.includes("weakness") ||
    lower.includes("how convincing") ||
    lower.includes("assess") ||
    lower.includes("evaluate") ||
    lower.includes("valid") ||
    lower.includes("justified")
  ) {
    return "evaluate";
  }

  if (
    lower.includes("connect") ||
    lower.includes("relationship between") ||
    lower.includes("how does") ||
    lower.includes("relate to") ||
    lower.includes("compare") ||
    lower.includes("contrast") ||
    lower.includes("tension between") ||
    lower.includes("across")
  ) {
    return "integrate";
  }

  if (
    lower.includes("what does the author say") ||
    lower.includes("according to") ||
    lower.includes("find in the text") ||
    lower.includes("what is the definition") ||
    lower.includes("list the") ||
    lower.includes("identify the")
  ) {
    return "retrieve";
  }

  return "infer";
}

function scoreSuggestion(prompt: string, focusArea: string | null): SuggestionQuality {
  const lower = prompt.toLowerCase();
  const labels: string[] = [];
  const issues: string[] = [];
  let score = 0;

  const count = wordCount(prompt);
  if (count <= 28) {
    score += 2;
    labels.push("Concise");
  } else if (count <= 36) {
    score += 1;
  } else {
    issues.push("Too long");
  }

  if (prompt.includes("?")) {
    score += 1;
  } else {
    issues.push("Missing question mark");
  }

  const genericStarts = [
    "discuss ",
    "reflect on ",
    "what do you think about",
    "how do you feel about",
    "talk about ",
  ];
  if (genericStarts.some((pattern) => lower.startsWith(pattern))) {
    issues.push("Too generic");
  } else {
    score += 2;
    labels.push("Directly usable");
  }

  if (focusArea && focusArea.trim().length > 0) {
    score += 2;
    labels.push("Targets a key idea");
  } else {
    issues.push("No clear focus area");
  }

  if (
    lower.includes("difference") ||
    lower.includes("why") ||
    lower.includes("how") ||
    lower.includes("relationship") ||
    lower.includes("claim") ||
    lower.includes("argument") ||
    lower.includes("assumption") ||
    lower.includes("evidence") ||
    lower.includes("structure") ||
    lower.includes("implies")
  ) {
    score += 2;
    labels.push("Concept-focused");
  } else {
    issues.push("May not target a core concept");
  }

  if (lower.includes(" and ") && count > 18) {
    issues.push("May contain two ideas");
  } else {
    score += 1;
  }

  return { score, labels, issues };
}

function normalizeSuggestion(candidate: SuggestionCandidate) {
  const prompt =
    typeof candidate.prompt === "string"
      ? candidate.prompt.replace(/\s+/g, " ").trim()
      : "";
  const focusArea =
    typeof candidate.focusArea === "string" ? candidate.focusArea.trim() : null;
  const rationale =
    typeof candidate.rationale === "string" ? candidate.rationale.trim() : null;
  const processLevel = ["retrieve", "infer", "integrate", "evaluate"].includes(
    candidate.processLevel ?? ""
  )
    ? (candidate.processLevel as ProcessLevel)
    : inferProcessLevel(prompt);

  return {
    prompt,
    processLevel,
    focusArea,
    rationale,
    expectations: Array.isArray(candidate.expectations)
      ? candidate.expectations
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
      : [],
    misconceptions: Array.isArray(candidate.misconceptions)
      ? candidate.misconceptions
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
      : [],
  };
}

function dedupeSuggestions<T extends { prompt: string }>(suggestions: T[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.prompt.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateCandidates(params: {
  suggestCount: number;
  readingContent: string;
  existingQuestions: string;
  contextInfo: string;
  goalInfo: string;
  revisionMode?: boolean;
}) {
  const candidateCount = Math.min(Math.max(params.suggestCount + 2, 3), 6);
  const modeRules = params.revisionMode
    ? `You are revising weak question suggestions into stronger ones. Tighten wording, shorten length, and make each question immediately usable by an instructor without rewriting it.`
    : `You are generating first-draft question suggestions.`;

  const systemPrompt = `You are an expert in reading assessment design and Socratic instruction for adult and professional learners.

${modeRules}

Generate ${candidateCount} discussion questions for a Socratic tutoring session based on the provided reading.

NON-NEGOTIABLE RULES:
- Write for instructors working with adult or professional learners.
- Keep each question clear, instantly understandable, and directly usable.
- Keep each question concise: target 14 to 26 words, never exceed 32 words.
- Ask about one idea at a time. Avoid compound questions.
- Focus on the reading's central claim, key distinctions, causal logic, strongest evidence, or major implications.
- Avoid generic prompts that could fit any text.
- Avoid vague stems like "Discuss", "Reflect on", or "What do you think about".
- Prefer questions that help a learner reconstruct the author's reasoning.
- Use plain language unless the reading itself uses technical vocabulary.

For each suggestion include:
- prompt: the question itself
- processLevel: retrieve | infer | integrate | evaluate
- focusArea: the exact concept, distinction, claim, or passage focus in 2-6 words
- rationale: one short instructor-facing sentence explaining why this is a strong question
- expectations: up to 2 short bullets describing what a strong answer would show
- misconceptions: up to 2 likely misreadings

Respond ONLY with valid JSON:
{
  "suggestions": [
    {
      "prompt": "Question text",
      "processLevel": "infer",
      "focusArea": "central claim",
      "rationale": "Targets the author's main distinction in accessible language.",
      "expectations": ["Strong answer feature", "Second answer feature"],
      "misconceptions": ["Likely misunderstanding", "Second misunderstanding"]
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 1800,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Generate suggestions for this reading:\n\n${params.readingContent.slice(
          0,
          12000
        )}${params.existingQuestions}${params.contextInfo}${params.goalInfo}`,
      },
    ],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Suggestion model returned no text content.");
  }

  return parseSuggestionResponse(content.text);
}

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
    const suggestCount = Math.max(1, Math.min(4, recommendedCount - existingCount));

    const readingContent = session.readings
      .map((reading) => `=== ${reading.filename} ===\n${reading.content}`)
      .join("\n\n");

    const existingQuestions =
      session.checkpoints.length > 0
        ? `\n\nThe instructor has already written these questions. Do NOT duplicate them:\n${session.checkpoints
            .map((checkpoint, index) => `${index + 1}. ${checkpoint.prompt}`)
            .join("\n")}`
        : "";

    const contextInfo = session.courseContext
      ? `\n\nCourse context: ${session.courseContext}`
      : "";
    const goalInfo = session.learningGoal
      ? `\n\nSession goal: ${session.learningGoal}`
      : "";

    const firstPass = await generateCandidates({
      suggestCount,
      readingContent,
      existingQuestions,
      contextInfo,
      goalInfo,
    });

    let normalized = dedupeSuggestions(
      (firstPass.suggestions ?? [])
        .map(normalizeSuggestion)
        .filter((suggestion) => suggestion.prompt.length > 0)
    );

    let scored = normalized
      .map((suggestion) => {
        const quality = scoreSuggestion(suggestion.prompt, suggestion.focusArea);
        return {
          ...suggestion,
          qualityScore: quality.score,
          qualityLabels: quality.labels,
          qualityIssues: quality.issues,
        };
      })
      .filter((suggestion) => suggestion.qualityScore >= 5 && suggestion.qualityIssues.length <= 2);

    if (scored.length < suggestCount) {
      const revisedPass = await generateCandidates({
        suggestCount,
        readingContent,
        existingQuestions,
        contextInfo,
        goalInfo,
        revisionMode: true,
      });

      const revised = dedupeSuggestions(
        (revisedPass.suggestions ?? [])
          .map(normalizeSuggestion)
          .filter((suggestion) => suggestion.prompt.length > 0)
      ).map((suggestion) => {
        const quality = scoreSuggestion(suggestion.prompt, suggestion.focusArea);
        return {
          ...suggestion,
          qualityScore: quality.score,
          qualityLabels: quality.labels,
          qualityIssues: quality.issues,
        };
      });

      scored = dedupeSuggestions(
        [...scored, ...revised].sort((a, b) => b.qualityScore - a.qualityScore)
      );
    }

    const suggestions = scored
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, suggestCount)
      .map((suggestion) => ({
        prompt: suggestion.prompt,
        processLevel: suggestion.processLevel,
        focusArea: suggestion.focusArea,
        rationale:
          suggestion.rationale ||
          `Useful because it focuses on ${suggestion.focusArea || "a key idea"} in clear, instructor-ready language.`,
        qualityLabels: suggestion.qualityLabels.slice(0, 3),
        expectations: suggestion.expectations,
        misconceptions: suggestion.misconceptions,
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
