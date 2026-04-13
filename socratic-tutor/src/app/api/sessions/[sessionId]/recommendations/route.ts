import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import type {
  ApiError,
  MisconceptionClusterRecord,
  TeachingRecommendationConfidence,
  TeachingRecommendationRecord,
} from "@/types";

export const dynamic = "force-dynamic";

type ParsedRecommendation = Omit<
  TeachingRecommendationRecord,
  "id" | "sessionId" | "instructorAction" | "instructorNote" | "createdAt" | "updatedAt"
>;

type AggregateResponse = {
  clusters: MisconceptionClusterRecord[];
};

const VALID_CONFIDENCE: TeachingRecommendationConfidence[] = [
  "low",
  "medium",
  "high",
];

const teachingRecommendationClient = prisma as typeof prisma & {
  teachingRecommendation: any;
};

const RECOMMENDATION_SYSTEM_PROMPT = `You are an instructional design consultant for a discussion-based reading class.

You generate concrete teaching recommendations that respond to clustered student misconceptions.

Requirements:
- Produce at most 3 recommendations.
- Prioritize clusters flagged for discussion, then higher severity, then higher prevalence.
- Recommend active learning only. Never say "review the material", "re-explain the concept", or "lecture on it".
- Every move must require students to work with the reading itself.
- Keep "what to address" and "why it matters" to one sentence each.
- Keep evidence to at most 3 bullets.
- For each move, include exact timing and an instructor script that can be read aloud or adapted.
- Confidence must be low, medium, or high.

Output format:
[RECOMMENDATION_START]
[WHAT: one sentence]
[WHY: one sentence]
[EVIDENCE: bullet one. bullet two. bullet three.]
[SOURCE_CLUSTERS: cluster label one | cluster label two]
[CONFIDENCE: medium]
[MOVE_5MIN: activity name and description]
[MOVE_15MIN: activity name and description]
[MOVE_30MIN: activity name and description]
[SCRIPT_5MIN: script text]
[SCRIPT_15MIN: script text]
[SCRIPT_30MIN: script text]
[RECOMMENDATION_END]

Do not include any prose before or after the recommendation blocks.`;

function splitEvidence(rawValue: string): string[] {
  const bulletSplit = rawValue
    .split(/\s*[•\-]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (bulletSplit.length > 1) {
    return bulletSplit.slice(0, 3);
  }

  return rawValue
    .split(/\.\s+/)
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`\\[${tag}:\\s*([\\s\\S]*?)\\]`));
  return match?.[1]?.trim() ?? "";
}

function inferConfidenceFromClusters(
  sourceClusters: string[],
  clusters: MisconceptionClusterRecord[]
): TeachingRecommendationConfidence {
  const relatedClusters = clusters.filter((cluster) =>
    sourceClusters.some(
      (label) => label.trim().toLowerCase() === cluster.label.trim().toLowerCase()
    )
  );

  if (
    relatedClusters.some(
      (cluster) => cluster.prevalence >= 0.5 && cluster.severity === "high"
    )
  ) {
    return "high";
  }

  if (relatedClusters.length === 0) {
    return "medium";
  }

  if (relatedClusters.every((cluster) => cluster.prevalence < 0.2)) {
    return "low";
  }

  return "medium";
}

function parseRecommendations(
  text: string,
  clusters: MisconceptionClusterRecord[]
): ParsedRecommendation[] {
  const blocks = text
    .split("[RECOMMENDATION_START]")
    .slice(1)
    .map((block) => block.split("[RECOMMENDATION_END]")[0]?.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const whatToAddress = extractTag(block, "WHAT");
      const whyItMatters = extractTag(block, "WHY");
      const evidence = splitEvidence(extractTag(block, "EVIDENCE"));
      const sourceClustersRaw = extractTag(block, "SOURCE_CLUSTERS");
      const explicitConfidence = extractTag(block, "CONFIDENCE").toLowerCase();
      const sourceClusters = sourceClustersRaw
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

      const confidence = VALID_CONFIDENCE.includes(
        explicitConfidence as TeachingRecommendationConfidence
      )
        ? (explicitConfidence as TeachingRecommendationConfidence)
        : inferConfidenceFromClusters(sourceClusters, clusters);

      if (!whatToAddress || !whyItMatters) {
        return null;
      }

      return {
        whatToAddress,
        whyItMatters,
        evidence,
        moves: {
          fiveMin: {
            description: extractTag(block, "MOVE_5MIN"),
            script: extractTag(block, "SCRIPT_5MIN"),
          },
          fifteenMin: {
            description: extractTag(block, "MOVE_15MIN"),
            script: extractTag(block, "SCRIPT_15MIN"),
          },
          thirtyMin: {
            description: extractTag(block, "MOVE_30MIN"),
            script: extractTag(block, "SCRIPT_30MIN"),
          },
        },
        sourceClusters,
        confidence,
      } satisfies ParsedRecommendation;
    })
    .filter((item): item is ParsedRecommendation => item !== null)
    .slice(0, 3);
}

function serializeRecommendation(
  record: {
    id: string;
    sessionId: string;
    whatToAddress: string;
    whyItMatters: string;
    evidence: string;
    moveFiveMin: string;
    moveFifteenMin: string;
    moveThirtyMin: string;
    sourceClusters: string;
    confidence: string;
    instructorAction: string | null;
    instructorNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): TeachingRecommendationRecord {
  return {
    id: record.id,
    sessionId: record.sessionId,
    whatToAddress: record.whatToAddress,
    whyItMatters: record.whyItMatters,
    evidence: JSON.parse(record.evidence) as string[],
    moves: {
      fiveMin: JSON.parse(record.moveFiveMin) as TeachingRecommendationRecord["moves"]["fiveMin"],
      fifteenMin: JSON.parse(
        record.moveFifteenMin
      ) as TeachingRecommendationRecord["moves"]["fifteenMin"],
      thirtyMin: JSON.parse(
        record.moveThirtyMin
      ) as TeachingRecommendationRecord["moves"]["thirtyMin"],
    },
    sourceClusters: JSON.parse(record.sourceClusters) as string[],
    confidence: VALID_CONFIDENCE.includes(
      record.confidence as TeachingRecommendationConfidence
    )
      ? (record.confidence as TeachingRecommendationConfidence)
      : "medium",
    instructorAction:
      record.instructorAction === "used" ||
      record.instructorAction === "dismissed" ||
      record.instructorAction === "edited"
        ? record.instructorAction
        : null,
    instructorNote: record.instructorNote,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function fetchClusters(origin: string, sessionId: string) {
  const response = await fetch(
    `${origin}/api/sessions/${sessionId}/misconceptions/aggregate`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = (await response.json().catch(() => null)) as
    | AggregateResponse
    | ApiError
    | null;

  if (!response.ok || !data || !("clusters" in data)) {
    throw new Error(
      (data && "error" in data && data.error) ||
        "Failed to fetch misconception clusters."
    );
  }

  return data.clusters;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const recommendations = await teachingRecommendationClient.teachingRecommendation.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      recommendations: recommendations.map(serializeRecommendation),
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to fetch recommendations.",
        code: "RECOMMENDATIONS_FETCH_FAILED",
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
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        studentSessions: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 10,
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json<ApiError>(
        { error: "Session not found.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const origin = new URL(request.url).origin;
    const clusters = await fetchClusters(origin, sessionId);

    const relevantClusters = clusters.slice(0, 8);
    if (relevantClusters.length === 0) {
      await teachingRecommendationClient.teachingRecommendation.deleteMany({ where: { sessionId } });
      return NextResponse.json({
        recommendations: [] as TeachingRecommendationRecord[],
        message:
          "No misconceptions need recommendations yet, or all current clusters have been marked as acceptable interpretations.",
      });
    }

    const transcriptContext = session.studentSessions
      .slice(0, 5)
      .map((studentSession) => {
        const excerpt = studentSession.messages
          .slice(0, 8)
          .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
          .join("\n");

        return `Student ${studentSession.studentName} (${studentSession.id})\n${excerpt}`;
      })
      .join("\n\n");

    const clusterContext = relevantClusters
      .map((cluster) => {
        const discussionPriority =
          cluster.overrideType === "needs_discussion" ? "[PRIORITY] " : "";
        return `${discussionPriority}Cluster: "${cluster.label}"
- Type: ${cluster.misconceptionType ?? "unclassified"}
- Prevalence: ${cluster.studentCount}/${cluster.totalStudents} students (${Math.round(
          cluster.prevalence * 100
        )}%)
- Resolution rate: ${Math.round(cluster.resolutionRate * 100)}%
- Severity: ${cluster.severity}
- Reading anchor: ${cluster.passageAnchor ?? cluster.topicThread ?? "general"}
- Representative language: "${cluster.representativeExcerpt}"`;
      })
      .join("\n\n");

    const prompt = `Create teaching recommendations for this reading session.

SESSION
- Name: ${session.name}
- Description: ${session.description ?? "No description provided"}
- Learning outcomes: ${session.learningOutcomes ?? "Not specified"}
- Course context: ${session.courseContext ?? "Not specified"}
- Students: ${session.studentSessions.length}

MISCONCEPTION CLUSTERS
${clusterContext}

SAMPLE TRANSCRIPTS
${transcriptContext || "No transcript excerpts available."}`;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: RECOMMENDATION_SYSTEM_PROMPT,
      prompt,
    });

    const parsedRecommendations = parseRecommendations(text, relevantClusters);

    if (parsedRecommendations.length === 0) {
      return NextResponse.json<ApiError>(
        {
          error: "Failed to parse generated recommendations.",
          code: "RECOMMENDATIONS_PARSE_FAILED",
        },
        { status: 500 }
      );
    }

    await teachingRecommendationClient.teachingRecommendation.deleteMany({
      where: { sessionId },
    });

    const savedRecommendations = [];
    for (const recommendation of parsedRecommendations) {
      const saved = await teachingRecommendationClient.teachingRecommendation.create({
        data: {
          sessionId,
          whatToAddress: recommendation.whatToAddress,
          whyItMatters: recommendation.whyItMatters,
          evidence: JSON.stringify(recommendation.evidence),
          moveFiveMin: JSON.stringify(recommendation.moves.fiveMin),
          moveFifteenMin: JSON.stringify(recommendation.moves.fifteenMin),
          moveThirtyMin: JSON.stringify(recommendation.moves.thirtyMin),
          sourceClusters: JSON.stringify(recommendation.sourceClusters),
          confidence: recommendation.confidence,
        },
      });

      savedRecommendations.push(serializeRecommendation(saved));
    }

    return NextResponse.json({
      recommendations: savedRecommendations,
      clusterCount: relevantClusters.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to generate recommendations.",
        code: "RECOMMENDATIONS_GENERATE_FAILED",
      },
      { status: 500 }
    );
  }
}
