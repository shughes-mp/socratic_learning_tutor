import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { sessionId } = await params;

    const checkpoints = await prisma.checkpoint.findMany({
      where: { sessionId },
      include: {
        studentCheckpoints: {
          select: {
            status: true,
            turnsSpent: true,
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    const difficulty = checkpoints.map((checkpoint) => {
      const total = checkpoint.studentCheckpoints.length;
      const addressed = checkpoint.studentCheckpoints.filter(
        (studentCheckpoint) => studentCheckpoint.status !== "unseen"
      ).length;
      const mastered = checkpoint.studentCheckpoints.filter((studentCheckpoint) =>
        ["mastered", "passed", "evidence_sufficient"].includes(
          studentCheckpoint.status
        )
      ).length;
      const struggling = checkpoint.studentCheckpoints.filter((studentCheckpoint) =>
        ["in_progress", "stuck", "evidence_insufficient", "probing"].includes(
          studentCheckpoint.status
        )
      ).length;
      const avgTurns =
        addressed > 0
          ? checkpoint.studentCheckpoints
              .filter((studentCheckpoint) => studentCheckpoint.status !== "unseen")
              .reduce(
                (sum, studentCheckpoint) => sum + studentCheckpoint.turnsSpent,
                0
              ) / addressed
          : 0;

      return {
        checkpointId: checkpoint.id,
        prompt: checkpoint.prompt,
        totalStudents: total,
        addressedCount: addressed,
        masteredCount: mastered,
        strugglingCount: struggling,
        averageTurnsSpent: Math.round(avgTurns * 10) / 10,
        difficultySignal:
          total === 0
            ? "no_data"
            : mastered / Math.max(addressed, 1) > 0.7
              ? "easy"
              : struggling / Math.max(addressed, 1) > 0.5
                ? "hard"
                : "moderate",
      };
    });

    return NextResponse.json(difficulty);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to compute checkpoint difficulty:", error);
    return NextResponse.json(
      { error: "Failed to compute checkpoint difficulty", details: message },
      { status: 500 }
    );
  }
}
