import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { MODEL_FAST } from "@/lib/models";

function hasCycle(mapValue: { concepts: Array<{ id: string; prerequisites: string[] }> }): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (conceptId: string): boolean => {
    if (visited.has(conceptId)) return false;
    if (visiting.has(conceptId)) return true;

    visiting.add(conceptId);
    const concept = mapValue.concepts.find((item) => item.id === conceptId);
    for (const prereqId of concept?.prerequisites ?? []) {
      if (visit(prereqId)) return true;
    }
    visiting.delete(conceptId);
    visited.add(conceptId);
    return false;
  };

  return mapValue.concepts.some((item) => visit(item.id));
}

function parseMapResponse(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  const directParse = () =>
    JSON.parse(cleaned) as {
      concepts: Array<{
        id: string;
        label: string;
        level: string;
        prerequisites: string[];
      }>;
    };

  try {
    return directParse();
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("Model did not return valid JSON.");
    }

    return JSON.parse(objectMatch[0]) as {
      concepts: Array<{
        id: string;
        label: string;
        level: string;
        prerequisites: string[];
      }>;
    };
  }
}

function normalizeMapValue(mapValue: {
  concepts?: Array<{
    id?: string;
    label?: string;
    level?: string;
    prerequisites?: string[];
  }>;
}) {
  const validLevels = new Set(["foundational", "intermediate", "advanced"]);
  const normalizedConcepts = (Array.isArray(mapValue.concepts) ? mapValue.concepts : [])
    .map((concept, index) => {
      const rawLabel =
        typeof concept.label === "string" && concept.label.trim().length > 0
          ? concept.label.trim()
          : null;
      const rawId =
        typeof concept.id === "string" && concept.id.trim().length > 0
          ? concept.id.trim()
          : rawLabel
            ? rawLabel
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "")
            : `concept_${index + 1}`;

      return {
 