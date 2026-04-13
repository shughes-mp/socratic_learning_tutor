import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import type {
  ApiError,
  MisconceptionClusterRecord,
  MisconceptionDashboardStats,
  MisconceptionOverrideRecord,
} from "@/types";

type MisconceptionRecord = {
  id: string;
  studentSessionId: string;
  topicThread: string;
  description: string;
  studentMessage: string;
  resolved: boolean;
  canonicalClaim: string | null;
  passageAnchor: string | null;
  misconceptionType: string | null;
  severity: string;
};

type SemanticGroup = {
  label: string;
  misconceptions: MisconceptionRecord[];
};

type Bin = {
  key: string;
  misconceptionType: string | null;
  passageAnchor: string | null;
  topicThread: string | null;
  misconceptions: MisconceptionRecord[];
};

function serializeOverride(
  override: {
    id: string;
    sessionId: string;
    clusterLabel: string;
    overrideType: string;
    instructorNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): MisconceptionOverrideRecord {
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

const severityRank = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getAnchorLabel(
  passageAnchor: string | null,
  topicThread: string | null
) {
  return passageAnchor?.trim() || topicThread?.trim() || "general";
}

function getHighestSeverity(records: MisconceptionRecord[]): "low" | "medium" | "high" {
  return records.reduce<"low" | "medium" | "high">((highest, record) => {
    const candidate =
      record.severity === "high" || record.severity === "medium" || record.severity === "low"
        ? record.severity
        : "medium";

    return severityRank[candidate] > severityRank[highest] ? candidate : highest;
  }, "low");
}

function getRepresentativeExcerpt(record: MisconceptionRecord) {
  return (
    record.canonicalClaim?.trim() ||
    record.description.trim() ||
    record.studentMessage.trim()
  ).slice(0, 140);
}

function parseSemanticResponse(rawText: string): Array<{ label: string; indices: number[] }> {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(cleaned) as {
    clusters?: Array<{ label?: string; indices?: number[] }>;
  };

  if (!Array.isArray(parsed.clusters)) {
    return [];
  }

  return parsed.clusters
    .map((cluster) => ({
      label: typeof cluster.label === "string" ? cluster.label.trim() : "",
      indices: Array.isArray(cluster.indices)
        ? cluster.indices.filter((value) => Number.isInteger(value))
        : [],
    }))
    .filter((cluster) => cluster.label.length > 0 && cluster.indices.length > 0);
}

async function buildSemanticGroups(bin: Bin): Promise<SemanticGroup[]> {
  if (bin.misconceptions.length < 3 || !process.env.ANTHROPIC_API_KEY) {
    return [
      {
        label: getRepresentativeExcerpt(bin.misconceptions[0]),
        misconceptions: bin.misconceptions,
      },
    ];
  }

  try {
    const claims = bin.misconceptions.map((record, index) => {
      return `${index}. "${getRepresentativeExcerpt(record)}"`;
    });

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Group these student misconceptions into strict semantic clusters.

Only cluster claims that express the same underlying misunderstanding.
Return valid JSON only in this format:
{
  "clusters": [
    {
      "label": "short cluster label",
      "indices": [0, 2]
    }
  ]
}

Claims:
${claims.join("\n")}`,
        },
      ],
    });

    const content = response.content.find((item) => item.type === "text");
    if (!content || content.type !== "text") {
      throw new Error("No text content returned.");
    }

    const parsedClusters = parseSemanticResponse(content.text);
    if (parsedClusters.length === 0) {
      throw new Error("No semantic clusters returned.");
    }

    const usedIndices = new Set<number>();
    const groups: SemanticGroup[] = [];

    for (const cluster of parsedClusters) {
      const records = cluster.indices
        .filter((index) => index >= 0 && index < bin.misconceptions.length)
        .map((index) => {
          usedIndices.add(index);
          return bin.misconceptions[index];
        });

      if (records.length > 0) {
        groups.push({
          label: cluster.label,
          misconceptions: records,
        });
      }
    }

    bin.misconceptions.forEach((record, index) => {
      if (!usedIndices.has(index)) {
        groups.push({
          label: getRepresentativeExcerpt(record),
          misconceptions: [record],
        });
      }
    });

    return groups.length > 0
      ? groups
      : [
          {
            label: getRepresentativeExcerpt(bin.misconceptions[0]),
            misconceptions: bin.misconceptions,
          },
        ];
  } catch (error) {
    console.error("Semantic misconception clustering failed:", error);
    return [
      {
        label: getRepresentativeExcerpt(bin.misconceptions[0]),
        misconceptions: bin.misconceptions,
      },
    ];
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        studentSessions: {
          select: {
            id: true,
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

    const totalStudents = session.studentSessions.length;

    const [misconceptions, overrides] = await Promise.all([
      prisma.misconception.findMany({
        where: {
          studentSession: {
            sessionId,
          },
        },
        select: {
          id: true,
          studentSessionId: true,
          topicThread: true,
          description: true,
          studentMessage: true,
          resolved: true,
          canonicalClaim: true,
          passageAnchor: true,
          misconceptionType: true,
          severity: true,
        },
        orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
      }),
      prisma.misconceptionOverride.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (misconceptions.length === 0) {
      const emptyStats: MisconceptionDashboardStats = {
        totalStudents,
        totalMisconceptions: 0,
        avgMisconceptionsPerStudent: 0,
        overallResolutionRate: 0,
      };

      return NextResponse.json({
        clusters: [] as MisconceptionClusterRecord[],
        overrides: overrides.map(serializeOverride),
        sessionStats: emptyStats,
      });
    }

    const overrideByLabel = new Map(
      overrides.map((override) => [normalizeLabel(override.clusterLabel), override])
    );

    const bins = new Map<string, Bin>();
    misconceptions.forEach((misconception) => {
      const anchor = getAnchorLabel(
        misconception.passageAnchor,
        misconception.topicThread
      );
      const key = `${anchor}__${misconception.misconceptionType ?? "uncategorized"}`;

      if (!bins.has(key)) {
        bins.set(key, {
          key,
          misconceptionType: misconception.misconceptionType,
          passageAnchor: misconception.passageAnchor,
          topicThread: misconception.topicThread,
          misconceptions: [],
        });
      }

      bins.get(key)?.misconceptions.push(misconception);
    });

    const clusters: MisconceptionClusterRecord[] = [];

    for (const bin of bins.values()) {
      const semanticGroups = await buildSemanticGroups(bin);

      semanticGroups.forEach((group, index) => {
        const override = overrideByLabel.get(normalizeLabel(group.label)) ?? null;
        if (override?.overrideType === "acceptable_interpretation") {
          return;
        }

        const uniqueStudentIds = new Set(
          group.misconceptions.map((record) => record.studentSessionId)
        );
        const resolvedCount = group.misconceptions.filter((record) => record.resolved).length;
        const resolutionRate =
          group.misconceptions.length > 0
            ? resolvedCount / group.misconceptions.length
            : 0;

        clusters.push({
          id: `${bin.key}-${index}`,
          label: group.label,
          misconceptionType: bin.misconceptionType,
          passageAnchor: bin.passageAnchor,
          topicThread: bin.topicThread,
          count: group.misconceptions.length,
          totalStudents,
          prevalence:
            totalStudents > 0 ? uniqueStudentIds.size / totalStudents : 0,
          resolutionRate,
          medianTurnsToResolve: resolutionRate >= 0.5 ? 4 : 7,
          severity: getHighestSeverity(group.misconceptions),
          representativeExcerpt: getRepresentativeExcerpt(group.misconceptions[0]),
          misconceptionIds: group.misconceptions.map((record) => record.id),
          studentCount: uniqueStudentIds.size,
          overrideType:
            override?.overrideType === "needs_discussion"
              ? "needs_discussion"
              : null,
        });
      });
    }

    clusters.sort((left, right) => {
      if (right.prevalence !== left.prevalence) {
        return right.prevalence - left.prevalence;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.resolutionRate - left.resolutionRate;
    });

    const sessionStats: MisconceptionDashboardStats = {
      totalStudents,
      totalMisconceptions: misconceptions.length,
      avgMisconceptionsPerStudent:
        totalStudents > 0 ? misconceptions.length / totalStudents : 0,
      overallResolutionRate:
        clusters.length > 0
          ? clusters.reduce((sum, cluster) => sum + cluster.resolutionRate, 0) /
            clusters.length
          : 0,
    };

    return NextResponse.json({
      clusters,
      overrides: overrides.map(serializeOverride),
      sessionStats,
    });
  } catch (error) {
    console.error("Error aggregating misconceptions:", error);
    return NextResponse.json<ApiError>(
      {
        error: "Failed to aggregate misconceptions.",
        code: "MISCONCEPTION_AGGREGATION_FAILED",
      },
      { status: 500 }
    );
  }
}
