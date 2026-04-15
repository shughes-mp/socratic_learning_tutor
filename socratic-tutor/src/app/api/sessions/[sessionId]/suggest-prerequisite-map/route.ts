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
        id: rawId || `concept_${index + 1}`,
        label: rawLabel || `Concept ${index + 1}`,
        level:
          typeof concept.level === "string" && validLevels.has(concept.level)
            ? concept.level
            : index === 0
              ? "foundational"
              : "intermediate",
        prerequisites: Array.isArray(concept.prerequisites)
          ? concept.prerequisites.filter(
              (prerequisite): prerequisite is string =>
                typeof prerequisite === "string" && prerequisite.trim().length > 0
            )
          : [],
      };
    })
    .filter((concept) => concept.label.length > 0);

  const idSet = new Set(normalizedConcepts.map((concept) => concept.id));
  return {
    concepts: normalizedConcepts.map((concept) => ({
      ...concept,
      prerequisites: concept.prerequisites.filter((prerequisite) =>
        idSet.has(prerequisite)
      ),
    })),
  } as {
    concepts: Array<{
      id: string;
      label: string;
      level: string;
      prerequisites: string[];
    }>;
  };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  await ensureDatabaseReady();
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { readings: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.readings.length === 0) {
    return NextResponse.json(
      { error: "Upload a reading before generating a concept map." },
      { status: 400 }
    );
  }

  const prompt = `Based on these readings, identify the key concepts and their prerequisite relationships.
Return ONLY valid JSON matching this shape:
{"concepts":[{"id":"string","label":"string","level":"foundational|intermediate|advanced","prerequisites":["string"]}]}

Avoid circular prerequisites.

Reading titles and excerpts:
${session.readings
  .map((reading) => `${reading.filename}: ${reading.content.slice(0, 500)}`)
  .join("\n\n")}`;

  try {
    const { text } = await generateText({
      model: anthropic(MODEL_FAST),
      prompt,
    });

    const mapValue = normalizeMapValue(parseMapResponse(text));

    if (!Array.isArray(mapValue.concepts) || mapValue.concepts.length === 0) {
      throw new Error("Generated map was not valid.");
    }

    if (hasCycle(mapValue)) {
      throw new Error("Generated prerequisite map contains a cycle.");
    }

    return NextResponse.json({ map: mapValue });
  } catch (error) {
    console.error("Failed to suggest prerequisite map:", error);
    return NextResponse.json(
      { error: "Failed to generate prerequisite map." },
      { status: 500 }
    );
  }
}
