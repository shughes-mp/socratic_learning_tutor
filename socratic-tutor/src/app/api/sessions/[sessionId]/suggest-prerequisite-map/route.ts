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

  return JSON.parse(cleaned) as {
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

    const mapValue = parseMapResponse(text);

    if (!Array.isArray(mapValue.concepts)) {
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
