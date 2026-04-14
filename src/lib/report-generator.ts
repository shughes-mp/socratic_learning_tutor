import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";

const VALID_LO_STATUSES = [
  "not_observed",
  "insufficient_evidence",
  "emerging",
  "meets",
  "exceeds",
] as const;

const VALID_LO_CONFIDENCE = ["low", "medium", "high"] as const;

const REPORT_SYSTEM_PROMPT = `You generate instructor teaching briefs from Socratic tutoring sessions. Your purpose is to help the instructor decide what to do NEXT - in the upcoming class discussion, in follow-up activities, or in the next session. Write in professional, direct prose. Use these section headers:

SESSION SNAPSHOT
- Session name, number of students, total exchanges. One sentence framing how the session went overall - momentum, not just numbers.

READINESS HEATMAP
- For each major topic from the readings, rate class readiness as GREEN, YELLOW, or RED.
- Use topic mastery signals as a primary indicator: mastered tends GREEN, direct_answer_given tends YELLOW, uncertain or persistently unresolved tends RED.
- After the ratings, write ONE sentence summarizing the overall readiness picture for the instructor.

WHAT YOUR STUDENTS UNDERSTOOD WELL
- 2-3 bullet points on topics or concepts where most students demonstrated solid understanding. Include brief representative evidence. Keep this section SHORT - the instructor needs to know what's safe to build on.

WHERE YOUR STUDENTS NEED HELP
- For each RED or YELLOW area, describe the specific misconception pattern, how many students showed it, and whether it was resolved in-session or remains open.
- Distinguish between "resolved in session - reinforce briefly" vs. "unresolved - needs direct attention."
- Include one representative student quote (first name only) per pattern.

WHAT TO DO NEXT
- For each gap identified above, suggest one concrete, specific teaching move. Frame as "In your next session, try..." or "Before the next class, consider..."
- Connect each suggestion to the evidence. Don't give generic advice - tie it to what actually happened.

PER-STUDENT NOTES
- For each student: 2-3 sentences covering key strengths, key gaps, and one thing the instructor should watch for. Focus on what's actionable.
- Include confidence calibration notes where relevant (for example: "reported high confidence but had unresolved misconception on X" or "uncertain but actually demonstrated solid understanding of Y").

LEARNING OUTCOME ASSESSMENT
- Assess each student's observed engagement against each outcome formatively.
- After the main brief, emit one tag per student per learning outcome using this exact format:
[LO_ASSESSMENT: student session id | learning outcome text | status | confidence | evidence summary]
- Do not use the pipe character inside the evidence summary.

For each learning outcome assessment:
- status must be one of: not_observed, insufficient_evidence, emerging, meets, exceeds
- confidence must be one of: low, medium, high
- evidence summary should be 2-4 short sentences with exchange references, brief quotes under 20 words, and question-type cues where possible

CRITICAL RATING RULES
- insufficient_evidence is always valid. Do not force a stronger rating.
- Require at least two distinct question-type opportunities before rating meets or exceeds.
- Score text grounding and reasoning quality, not polish or vocabulary.
- If unresolved high-severity misconceptions remain on a topic related to the learning outcome, the maximum rating is emerging.
- These assessments are formative and instructor-facing, not summative records.

Under 900 words total for the main brief. Keep the LO tags separate from the prose.`;

function normalizeLearningOutcomes(rawValue: string | null | undefined): string[] {
  if (!rawValue) return [];

  return rawValue
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[\d\-*.()\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingLearningOutcome(
  candidate: string,
  learningOutcomes: string[]
): string | null {
  const normalizedCandidate = normalizeForMatch(candidate);
  if (!normalizedCandidate) return null;

  for (const learningOutcome of learningOutcomes) {
    const normalizedOutcome = normalizeForMatch(learningOutcome);
    if (
      normalizedOutcome.includes(normalizedCandidate.slice(0, 30)) ||
      normalizedCandidate.includes(normalizedOutcome.slice(0, 30))
    ) {
      return learningOutcome;
    }
  }

  return null;
}

function extractLOAssessmentTags(reportText: string) {
  return Array.from(
    reportText.matchAll(
      /\[LO_ASSESSMENT:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\]/g
    )
  );
}

function stripLOAssessmentTags(reportText: string): string {
  return reportText.replace(
    /\n?\[LO_ASSESSMENT:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\]/g,
    ""
  ).trim();
}

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
          studentCheckpoints: true,
        },
      },
      readings: true,
      assessments: true,
    },
  });

  if (!session) throw new Error("Session not found");

  const learningOutcomes = normalizeLearningOutcomes(session.learningOutcomes);

  let transcriptData = `SESSION: ${session.name}\n\n`;
  let totalExchanges = 0;
  let totalDirectAnswers = 0;
  let totalMisconceptions = 0;

  if (learningOutcomes.length > 0) {
    transcriptData += "LEARNING OUTCOMES:\n";
    learningOutcomes.forEach((learningOutcome, index) => {
      transcriptData += `${index + 1}. ${learningOutcome}\n`;
    });
    transcriptData += "\n";
  }

  for (const student of session.studentSessions) {
    const exchanges = Math.floor(student.messages.length / 2);
    totalExchanges += exchanges;
    transcriptData += `--- STUDENT: ${student.studentName} (Session ID: ${student.id}, Exchanges: ${exchanges}) ---\n`;

    if (student.confidenceChecks.length > 0) {
      transcriptData += `Confidence ratings: ${student.confidenceChecks
        .map(
          (check) =>
            `[${check.topicThread}: ${check.rating}, probeAsked=${check.probeAsked}, probeResult=${check.probeResult || "pending"}]`
        )
        .join(", ")}\n`;
    }

    if (student.misconceptions.length > 0) {
      transcriptData += "Misconceptions:\n";
      student.misconceptions.forEach((misconception) => {
        transcriptData += `- Topic: ${misconception.topicThread} | Gap: ${misconception.description} | Severity: ${misconception.severity} | Quote: "${misconception.studentMessage}" | Resolved: ${misconception.resolved} | Persistently unresolved: ${misconception.persistentlyUnresolved}\n`;
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
      transcriptData += "Mastery:\n";
      student.topicMastery.forEach((mastery) => {
        transcriptData += `- ${mastery.topicThread}: ${mastery.status} (criteria: ${mastery.criteriamet}, rung: ${mastery.hintLadderRung})\n`;
      });
    }

    if (student.studentCheckpoints.length > 0) {
      transcriptData += "Checkpoint coverage:\n";
      student.studentCheckpoints.forEach((checkpoint) => {
        transcriptData += `- ${checkpoint.checkpointId}: ${checkpoint.status} (turnsSpent: ${checkpoint.turnsSpent})\n`;
      });
    }

    transcriptData += "Transcript excerpt log:\n";
    student.messages.forEach((message, index) => {
      const exchangeNumber =
        message.role === "assistant" ? Math.ceil((index + 1) / 2) : Math.ceil((index + 1) / 2);
      transcriptData += `[Exchange ${exchangeNumber}] ${message.role.toUpperCase()}: ${message.content}\n`;
    });

    transcriptData += "\n";
  }

  const prompt =
    learningOutcomes.length > 0
      ? `Analyze the following session data and generate the instructor report. Include LO assessments for each student using the required tag format.\n\n${transcriptData}`
      : `Analyze the following session data and generate the instructor report.\n\n${transcriptData}`;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: REPORT_SYSTEM_PROMPT,
    prompt,
  });

  const assessmentMatches = extractLOAssessmentTags(text);
  const cleanReportText = stripLOAssessmentTags(text);

  const stats = JSON.stringify({
    exchanges: totalExchanges,
    misconceptions: totalMisconceptions,
    directAnswers: totalDirectAnswers,
    studentsCount: session.studentSessions.length,
  });

  const report = await prisma.report.create({
    data: {
      sessionId,
      content: cleanReportText,
      stats,
    },
  });

  if (learningOutcomes.length > 0) {
    const studentSessionMap = new Map(
      session.studentSessions.map((student) => [student.id, student])
    );

    await prisma.lOAssessment.deleteMany({
      where: {
        studentSession: {
          sessionId,
        },
      },
    });

    for (const match of assessmentMatches) {
      const studentSessionId = match[1]?.trim() ?? "";
      const loText = match[2]?.trim() ?? "";
      const status = match[3]?.trim().toLowerCase() ?? "";
      const confidence = match[4]?.trim().toLowerCase() ?? "";
      const evidenceSummary = match[5]?.trim() ?? null;

      if (
        !VALID_LO_STATUSES.includes(status as (typeof VALID_LO_STATUSES)[number]) ||
        !VALID_LO_CONFIDENCE.includes(
          confidence as (typeof VALID_LO_CONFIDENCE)[number]
        )
      ) {
        continue;
      }

      const student = studentSessionMap.get(studentSessionId);
      if (!student) continue;

      const matchingLearningOutcome = findMatchingLearningOutcome(
        loText,
        learningOutcomes
      );
      if (!matchingLearningOutcome) continue;

      const processMetrics = {
        hintRungs: Math.max(
          0,
          ...student.topicMastery.map((item) => item.hintLadderRung)
        ),
        misconceptionCount: student.misconceptions.length,
        misconceptionsResolved: student.misconceptions.filter((item) => item.resolved)
          .length,
        checkpointsAddressed: student.studentCheckpoints.filter(
          (item) => item.status !== "unseen"
        ).length,
      };

      await prisma.lOAssessment.create({
        data: {
          studentSessionId: student.id,
          learningOutcome: matchingLearningOutcome,
          status,
          confidence,
          evidenceSummary,
          processMetrics: JSON.stringify(processMetrics),
        },
      });
    }
  }

  return report;
}
