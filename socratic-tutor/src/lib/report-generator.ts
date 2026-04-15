import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";
import { MODEL_PRIMARY } from "./models";

const VALID_LO_STATUSES = [
  "not_observed",
  "insufficient_evidence",
  "emerging",
  "meets",
  "exceeds",
] as const;

const VALID_LO_CONFIDENCE = ["low", "medium", "high"] as const;

// Legacy static prompt — kept for reference. Use buildReportSystemPrompt() instead.
const REPORT_SYSTEM_PROMPT_LEGACY = `You generate instructor teaching briefs from Socratic tutoring sessions.`;

const LO_ASSESSMENT_RULES = `
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
- These assessments are formative and instructor-facing, not summative records.`;

interface ReportPurposeFraming {
  overallFrame: string;
  heatmapTitle: string;
  heatmapInstruction: string;
  strengthsSectionTitle: string;
  gapsSectionTitle: string;
  nextStepsInstruction: string;
  perStudentInstruction: string;
}

function getReportPurposeFraming(purpose: string): ReportPurposeFraming {
  const framings: Record<string, ReportPurposeFraming> = {
    pre_class: {
      overallFrame: "This was a PRE-CLASS session. Help the instructor decide whether students are READY for the upcoming class. Frame everything around readiness to apply, not depth of mastery.",
      heatmapTitle: "READINESS HEATMAP",
      heatmapInstruction: `Rate class READINESS on each major topic as GREEN (ready to apply in class), YELLOW (understands basics but has gaps that may surface during application), or RED (significant misunderstandings that will block productive class work).
After the ratings, write ONE sentence: "Overall, the class is [ready/mostly ready/not yet ready] for [topic]."
IMPORTANT: Format as a structured list, one topic per line:
- **Topic name**: [GREEN] Brief explanation
- **Topic name**: [YELLOW] Brief explanation
- **Topic name**: [RED] Brief explanation`,
      strengthsSectionTitle: "WHAT YOUR STUDENTS ARE READY FOR",
      gapsSectionTitle: "WHERE YOUR STUDENTS ARE NOT YET READY",
      nextStepsInstruction: `For each gap, suggest what the instructor should do BEFORE or AT THE START of the upcoming class. Frame as "Before class, consider..." or "At the start of class, try..." Prioritize: what will most block productive class time if unaddressed?`,
      perStudentInstruction: "For each student: 2-3 sentences covering readiness level, key gaps to watch for during class, and one strength to build on. Flag students who may need extra support during class activities.",
    },
    during_class_prep: {
      overallFrame: "This was a DURING-CLASS PREP session (activation phase). Help the instructor understand what prior knowledge students activated and where retrieval gaps exist — so they can adapt the class session that is about to begin.",
      heatmapTitle: "ACTIVATION HEATMAP",
      heatmapInstruction: `Rate ACTIVATION LEVEL on each major topic as GREEN (strong retrieval, ready for application), YELLOW (partial retrieval, may need brief review before applying), or RED (failed to retrieve or retrieved incorrectly).
Write ONE sentence summarizing what the class is primed for.
IMPORTANT: Format as a structured list, one topic per line:
- **Topic name**: [GREEN] Brief explanation
- **Topic name**: [YELLOW] Brief explanation
- **Topic name**: [RED] Brief explanation`,
      strengthsSectionTitle: "WHAT YOUR STUDENTS RECALLED WELL",
      gapsSectionTitle: "WHERE RETRIEVAL WAS WEAK",
      nextStepsInstruction: "For each weak area, suggest a quick in-class move the instructor can use in the NEXT FEW MINUTES. Keep suggestions actionable within the current class period: 'Before starting the activity, briefly clarify...' or 'During the debrief, revisit...'",
      perStudentInstruction: "For each student: 1-2 sentences on what they activated successfully and what the instructor should watch for during the upcoming activity. Keep very brief — the instructor is about to start teaching.",
    },
    during_class_reflection: {
      overallFrame: "This was a DURING-CLASS REFLECTION session (consolidation phase). Help the instructor understand what students consolidated from the class session and what remains fragile before they leave.",
      heatmapTitle: "CONSOLIDATION HEATMAP",
      heatmapInstruction: `Rate CONSOLIDATION LEVEL on each major topic as GREEN (student can self-explain accurately), YELLOW (partial consolidation — remembers but cannot fully explain), or RED (did not consolidate or consolidated incorrectly).
Write ONE sentence on overall consolidation.
IMPORTANT: Format as a structured list, one topic per line:
- **Topic name**: [GREEN] Brief explanation
- **Topic name**: [YELLOW] Brief explanation
- **Topic name**: [RED] Brief explanation`,
      strengthsSectionTitle: "WHAT YOUR STUDENTS CONSOLIDATED",
      gapsSectionTitle: "WHAT REMAINS FRAGILE",
      nextStepsInstruction: "For each fragile area, suggest what the instructor should do BEFORE THE NEXT CLASS to reinforce it. Frame as 'For homework, ask students to...' or 'In the next session, start by...' Leverage spacing — suggest revisiting fragile topics after a delay.",
      perStudentInstruction: "For each student: 2-3 sentences on what they consolidated, their key takeaway, and what the instructor should follow up on. Note gaps between student confidence and actual understanding.",
    },
    after_class: {
      overallFrame: "This was an AFTER-CLASS session focused on far transfer and application depth. Help the instructor assess whether students can apply concepts flexibly in novel contexts, not just recall them.",
      heatmapTitle: "TRANSFER HEATMAP",
      heatmapInstruction: `Rate TRANSFER READINESS on each major topic as GREEN (can apply flexibly to novel contexts), YELLOW (can apply to familiar contexts but struggles with novel ones), or RED (cannot transfer beyond the original reading context).
Write ONE sentence on overall depth.
IMPORTANT: Format as a structured list, one topic per line:
- **Topic name**: [GREEN] Brief explanation
- **Topic name**: [YELLOW] Brief explanation
- **Topic name**: [RED] Brief explanation`,
      strengthsSectionTitle: "WHERE YOUR STUDENTS SHOWED DEPTH",
      gapsSectionTitle: "WHERE TRANSFER BROKE DOWN",
      nextStepsInstruction: "For each transfer gap, suggest how the instructor can build toward transfer in future sessions or assignments. Frame as 'In a future session, try...' or 'For the next assignment, consider...' Note which learning outcomes have sufficient evidence for assessment.",
      perStudentInstruction: "For each student: 2-3 sentences on transfer capability, strongest application examples, and areas where understanding remains surface-level. Include LO evidence quality — which outcomes have strong evidence and which need more opportunities?",
    },
  };

  return framings[purpose] ?? framings.pre_class;
}

function buildReportSystemPrompt(sessionPurpose: string): string {
  const framing = getReportPurposeFraming(sessionPurpose);

  return `You generate instructor teaching briefs from Socratic tutoring sessions. ${framing.overallFrame} Write in professional, direct prose. Use these section headers exactly:

SESSION SNAPSHOT
- Session name, number of students, total exchanges, session purpose. One sentence framing how the session went overall — momentum, not just numbers.

WHAT TO DO NEXT
- For each gap identified in the session, suggest one concrete, specific teaching move. ${framing.nextStepsInstruction}
- Connect each suggestion to the evidence. Do not give generic advice — tie it to what actually happened.

${framing.heatmapTitle}
${framing.heatmapInstruction}

${framing.strengthsSectionTitle}
- 2-3 bullet points on topics or concepts where most students demonstrated solid understanding. Include brief representative evidence. Keep this section SHORT — the instructor needs to know what's safe to build on.

${framing.gapsSectionTitle}
- For each area of concern, describe the specific pattern, how many students showed it, and whether it was resolved in-session or remains open.
- Distinguish between "resolved in session — reinforce briefly" vs. "unresolved — needs direct attention."
- Include one representative student quote (first name only) per pattern.

PER-STUDENT NOTES
${framing.perStudentInstruction}
Include confidence calibration notes where relevant (e.g., "reported high confidence but had unresolved misconception on X").
${LO_ASSESSMENT_RULES}

Under 900 words total for the main brief. Keep the LO tags separate from the prose.

IMPORTANT: Use the section headers exactly as written above. The heatmap section must be titled "${framing.heatmapTitle}". Format heatmap entries as: - **Topic**: [GREEN/YELLOW/RED] explanation`;
}

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

  let transcriptData = `SESSION: ${session.name}\nSESSION PURPOSE: ${session.sessionPurpose ?? "pre_class"}\n\n`;
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
    model: anthropic(MODEL_PRIMARY),
    system: buildReportSystemPrompt(session.sessionPurpose ?? "pre_class"),
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
