import { prisma } from "./db";
import { isSubstantiveResponse } from "./attempt-tracker";

export type TopicMasteryStatus =
  | "mastered"
  | "direct_answer_given"
  | "uncertain"
  | "in_progress";

export function determineNextHintLadderRung(
  currentRung: number,
  tags: {
    directAnswer: string | null;
    feedbackType: "corrective" | "extension" | "redirection" | null;
    isGenuineAttempt: boolean | null;
  }
): number {
  if (tags.directAnswer) {
    return 4;
  }

  if (
    tags.isGenuineAttempt &&
    tags.feedbackType &&
    tags.feedbackType !== "extension"
  ) {
    return Math.min(currentRung + 1, 4);
  }

  return currentRung;
}

export async function evaluateMastery(
  studentSessionId: string,
  topicThread: string | null,
  hintLadderRung: number
): Promise<void> {
  if (!topicThread) return;

  const [messages, misconceptions, confidenceChecks] = await Promise.all([
    prisma.message.findMany({
      where: { studentSessionId, topicThread },
      orderBy: { createdAt: "asc" },
    }),
    prisma.misconception.findMany({
      where: { studentSessionId, topicThread },
    }),
    prisma.confidenceCheck.findMany({
      where: { studentSessionId, topicThread },
    }),
  ]);

  let explainPassed = false;
  let transferPassed = false;

  for (let index = 0; index < messages.length - 1; index += 1) {
    const assistant = messages[index];
    const student = messages[index + 1];

    if (assistant.role !== "assistant" || student?.role !== "user") {
      continue;
    }

    const hasOpenMisconception = misconceptions.some(
      (item) => item.studentMessage === student.content && !item.resolved
    );

    if (hasOpenMisconception || !isSubstantiveResponse(student.content)) {
      continue;
    }

    if (
      assistant.questionType === "explain" ||
      assistant.questionType === "distinguish" ||
      assistant.selfExplainPrompted
    ) {
      explainPassed = true;
    }

    if (
      assistant.questionType === "apply" ||
      assistant.questionType === "predict"
    ) {
      transferPassed = true;
    }
  }

  const misconceptionsClear =
    misconceptions.length > 0 && misconceptions.every((item) => item.resolved);
  const directAnswerGiven = messages.some(
    (message) =>
      message.role === "assistant" &&
      message.mode === "socratic" &&
      (message.attemptNumber ?? 0) >= 3
  );
  const uncertain = confidenceChecks.some((item) => item.rating === "uncertain");

  const criteriaMet: string[] = [];
  if (explainPassed) criteriaMet.push("EXPLAIN_PASSED");
  if (transferPassed) criteriaMet.push("TRANSFER_PASSED");
  if (misconceptionsClear) criteriaMet.push("MISCONCEPTIONS_CLEAR");

  let status: TopicMasteryStatus = "in_progress";
  if (criteriaMet.length >= 2) {
    status = "mastered";
  } else if (directAnswerGiven) {
    status = "direct_answer_given";
  } else if (uncertain) {
    status = "uncertain";
  }

  await prisma.topicMastery.upsert({
    where: {
      studentSessionId_topicThread: {
        studentSessionId,
        topicThread,
      },
    },
    update: {
      status,
      criteriamet: JSON.stringify(criteriaMet),
      hintLadderRung,
    },
    create: {
      studentSessionId,
      topicThread,
      status,
      criteriamet: JSON.stringify(criteriaMet),
      hintLadderRung,
    },
  });
}
