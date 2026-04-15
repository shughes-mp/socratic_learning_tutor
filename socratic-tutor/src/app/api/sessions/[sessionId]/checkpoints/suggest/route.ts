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
  const modeRules