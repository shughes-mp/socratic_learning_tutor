import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";

const REPORT_SYSTEM_PROMPT = `You generate concise instructor debriefs from Socratic tutoring sessions. Write in professional, direct prose. Use these section headers:

SESSION OVERVIEW
- Session name, number of students, total exchanges, direct answers given, and whether the tutor relied more on corrective, extension, or redirection feedback.

READINESS HEATMAP
- For each major topic from the readings, rate class readiness as GREEN, YELLOW, or RED.
- Use topic mastery signals as a primary indicator: mastered tends GREEN, direct_answer_given tends YELLOW, uncertain or persistently unresolved tends RED.

MISCONCEPTIONS AND GAPS (clustered by topic)
- Group misconceptions by topic.
- Distinguish misconceptions that were resolved in-session from ones that remained persistently unresolved.
- Include representative student quotes (first name only) and how many students showed each pattern.

PER-STUDENT SUMMARY
- For each student: name, exchanges completed, confidence patterns, question types encountered, mastery status by topic, key strengths, and key gaps.
- Keep each student summary to 2-3 sentences.

SUGGESTED TEACHING APPROACHES
- For each RED or YELLOW topic, suggest one concrete next-step intervention tied to the misconception pattern.

Under 700 words total. Be specific and decision-ready.`;

export async function generateInstructorReport(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      studentSessions: {
        include: {
          messages: true,
          misconceptions: true,
          confidenceChecks: true,
          topicMastery: true,
        },
      },
      readings: true,
      assessments: true,
    },
  });

  if (!session) throw new Error("Session not found");

  let transcriptData = `SESSION: ${session.name}\n\n`;
  let totalExchanges = 0;
  let totalDirectAnswers = 0;
  let totalMisconceptions = 0;

  for (const student of session.studentSessions) {
    const exchanges = Math.floor(student.messages.length / 2);
    totalExchanges += exchanges;
    transcriptData += `--- STUDENT: ${student.studentName} (Exchanges: ${exchanges}) ---\n`;

    if (student.confidenceChecks.length > 0) {
      transcriptData += `Confidence ratings: ${student.confidenceChecks
        .map(
          (check) =>
            `[${check.topicThread}: ${check.rating}, probeAsked=${check.probeAsked}, probeResult=${check.probeResult || "pending"}]`
        )
        .join(", ")}\n`;
    }

    if (student.misconceptions.length > 0) {
      transcriptData += `Misconceptions:\n`;
      student.misconceptions.forEach((misconception) => {
        transcriptData += `- Topic: ${misconception.topicThread} | Gap: ${misconception.description} | Quote: "${misconception.studentMessage}" | Resolved: ${misconception.resolved} | Persistently unresolved: ${misconception.persistentlyUnresolved}\n`;
        totalMisconceptions += 1;
      });
    }

    const directAnswers = student.messages.filter(
      (message) =>
        message.role === "assistant" &&
        message.mode === "socratic" &&
        (message.attemptNumber ?? 0) >= 3
    );
    if (directAnswers.length > 0) {
      totalDirectAnswers += directAnswers.length;
      transcriptData += `Direct answers given: ${directAnswers.length}\n`;
    }

    const questionTypeCounts = student.messages
      .filter((message) => message.role === "assistant" && message.questionType)
      .reduce((acc, message) => {
        acc[message.questionType!] = (acc[message.questionType!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    const feedbackCounts = student.messages
      .filter((message) => message.role === "assistant" && message.feedbackType)
      .reduce((acc, message) => {
        acc[message.feedbackType!] = (acc[message.feedbackType!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    transcriptData += `Topics engaged: ${Array.from(
      new Set(student.messages.map((message) => message.topicThread).filter(Boolean))
    ).join(", ")}\n`;
    transcriptData += `Question types used: ${JSON.stringify(questionTypeCounts)}\n`;
    transcriptData += `Feedback breakdown: ${JSON.stringify(feedbackCounts)}\n`;

    if (student.topicMastery.length > 0) {
      transcriptData += `Mastery:\n`;
      student.topicMastery.forEach((mastery) => {
        transcriptData += `- ${mastery.topicThread}: ${mastery.status} (criteria: ${mastery.criteriamet}, rung: ${mastery.hintLadderRung})\n`;
      });
    }

    transcriptData += "\n";
  }

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: REPORT_SYSTEM_PROMPT,
    prompt: `Analyze the following session data and generate the instructor report:\n\n${transcriptData}`,
  });

  const stats = JSON.stringify({
    exchanges: totalExchanges,
    misconceptions: totalMisconceptions,
    directAnswers: totalDirectAnswers,
    studentsCount: session.studentSessions.length,
  });

  const report = await prisma.report.create({
    data: {
      sessionId,
      content: text,
      stats,
    },
  });

  return report;
}
