import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";

const REPORT_SYSTEM_PROMPT = `You generate concise instructor debriefs from Socratic tutoring sessions. Write in professional, direct prose. Use these section headers:

SESSION OVERVIEW
- Session name, number of students, total exchanges, direct answers given.

READINESS HEATMAP
- For each major topic from the readings, rate class readiness as GREEN (most students understood), YELLOW (mixed understanding), or RED (widespread confusion). Include the topic name and a one-sentence explanation.

MISCONCEPTIONS AND GAPS (clustered by topic)
- Group all detected misconceptions by topic. Under each topic, list the specific misconceptions with representative student quotes (first name only). Note how many students exhibited each misconception.

PER-STUDENT SUMMARY
- For each student: name, exchanges completed, topics engaged, confidence self-ratings, key strengths, key gaps. Keep to 2-3 sentences per student.

SUGGESTED TEACHING APPROACHES
- For each RED or YELLOW topic, suggest a concrete teaching approach. Reference the specific misconceptions detected. Be actionable — the instructor reads this 5 minutes before class.

Under 600 words total. Be specific — name the actual concepts and misconceptions.`;

export async function generateInstructorReport(sessionId: string) {
  // 1. Gather all data
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      studentSessions: {
        include: {
          messages: true,
          misconceptions: true,
          confidenceChecks: true,
        },
      },
      readings: true,
      assessments: true,
    },
  });

  if (!session) throw new Error("Session not found");

  // Format data for the AI
  let transcriptData = `SESSION: ${session.name}\n\n`;
  let totalExchanges = 0;
  let totalDirectAnswers = 0;
  let totalMisconceptions = 0;

  for (const stu of session.studentSessions) {
    const exchanges = Math.floor(stu.messages.length / 2);
    totalExchanges += exchanges;
    transcriptData += `--- STUDENT: ${stu.studentName} (Exchanges: ${exchanges}) ---\n`;
    
    if (stu.confidenceChecks.length > 0) {
      transcriptData += `Confidence Ratings: ${stu.confidenceChecks.map((c) => '[' + c.topicThread + ': ' + c.rating + ']').join(", ")}\n`;
    }

    if (stu.misconceptions.length > 0) {
      transcriptData += `Misconceptions Detected:\n`;
      stu.misconceptions.forEach((m) => {
        transcriptData += `- Topic: ${m.topicThread} | Gap: ${m.description} | Quote: "${m.studentMessage}"\n`;
        totalMisconceptions++;
      });
    }

    const directAns = stu.messages.filter((m) => m.role === "assistant" && m.mode === "socratic" && m.attemptNumber && m.attemptNumber >= 3);
    if (directAns.length > 0) {
      totalDirectAnswers += directAns.length;
      transcriptData += `Direct Answers Given: ${directAns.length}\n`;
    }

    transcriptData += `Topics engaged: ${Array.from(new Set(stu.messages.map(m => m.topicThread).filter(Boolean))).join(", ")}\n\n`;
  }

  // 2. Instruct the AI
  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: REPORT_SYSTEM_PROMPT,
    prompt: `Analyze the following session data and generate the instructor report:\n\n${transcriptData}`,
    maxTokens: 2048,
  });

  // 3. Store and return
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
