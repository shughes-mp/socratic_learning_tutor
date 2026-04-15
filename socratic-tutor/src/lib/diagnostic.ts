import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import { MODEL_FAST } from "@/lib/models";

interface DiagnosticInput {
  studentSessionId: string;
  sessionId: string;
  studentMessage: string;
  assistantMessage: string;
  topicThread: string | null;
  exchangeIndex: number;
  readingContent: string;
  checkpoints: Array<{
    id: string;
    prompt: string;
  }>;
  unresolvedMisconceptionIds: string[];
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface DetectedMisconception {
  description: string;
  canonicalClaim: string;
  passageAnchor: string | null;
  misconceptionType:
    | "misread"
    | "missing_warrant"
    | "wrong_inference"
    | "overgeneralization"
    | "ignored_counterevidence";
  severity: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
}

interface ResolvedMisconception {
  misconceptionId: string;
  confidence: "high" | "medium" | "low";
  evidenceSummary: string;
}

interface DiagnosticResult {
  newMisconceptions: DetectedMisconception[];
  resolvedMisconceptions: ResolvedMisconception[];
  engagementFlag: "on_task" | "shallow" | "disengaged" | "off_topic" | "hostile";
  engagementNote: string | null;
  diagnosticTurnIndex: number;
}

const VALID_MISCONCEPTION_TYPES = [
  "misread",
  "missing_warrant",
  "wrong_inference",
  "overgeneralization",
  "ignored_counterevidence",
] as const;

const VALID_SEVERITIES = ["low", "medium", "high"] as const;
const VALID_CONFIDENCES = ["high", "medium", "low"] as const;
const VALID_ENGAGEMENT_FLAGS = [
  "on_task",
  "shallow",
  "disengaged",
  "off_topic",
  "hostile",
] as const;

function buildDiagnosticPrompt(input: DiagnosticInput): string {
  const unresolvedSection =
    input.unresolvedMisconceptionIds.length > 0
      ? `\nCurrently unresolved misconception IDs from prior turns: ${JSON.stringify(input.unresolvedMisconceptionIds)}\nFor each one, judge whether this latest student message provides evidence that the misconception has been corrected. Only mark resolved if the student demonstrates genuine corrected understanding, not just copied wording from the tutor.`
      : "\nNo unresolved misconceptions from prior turns.";

  const checkpointSection =
    input.checkpoints.length > 0
      ? `\nCheckpoints for this session:\n${input.checkpoints
          .map(
            (cp) =>
              `- [${cp.id}]: ${cp.prompt}`
          )
          .join("\n")}`
      : "";

  return `You are a diagnostic analyzer for a Socratic reading tutor. Your job is to analyze a single exchange (student message and tutor response) and produce structured JSON output. You are NOT the tutor. You are a separate analytical system.

## Reading Content (excerpt)
${input.readingContent.slice(0, 6000)}

${checkpointSection}

## Conversation So Far
${input.conversationHistory
  .slice(-10)
  .map((message) => `${message.role === "user" ? "STUDENT" : "TUTOR"}: ${message.content}`)
  .join("\n\n")}

## Latest Exchange to Analyze
STUDENT: ${input.studentMessage}
TUTOR: ${input.assistantMessage}

## Current Topic Thread
${input.topicThread || "Not yet classified"}
${unresolvedSection}

## Your Task

Analyze the student's message and produce JSON with these fields:

1. "newMisconceptions": Array of misconceptions the student expressed in THIS message. Only log genuine misunderstandings of the reading content, not off-task remarks, confusion about the tutor's question, or disengagement. Each misconception needs:
   - description: What the student got wrong (1 sentence)
   - canonicalClaim: The student's claim normalized to a clear declarative statement
   - passageAnchor: Which part of the reading this relates to (null if unclear)
   - misconceptionType: One of: misread, missing_warrant, wrong_inference, overgeneralization, ignored_counterevidence
   - severity: low (minor imprecision), medium (substantive misunderstanding), high (fundamental inversion of the text's argument)
   - confidence: How confident YOU are that this is actually a misconception: high, medium, or low

2. "resolvedMisconceptions": Array of previously unresolved misconceptions that the student has now corrected. Each needs:
   - misconceptionId: The ID from the unresolved list above
   - confidence: How confident you are the student genuinely understands now
   - evidenceSummary: Brief explanation of what the student said that demonstrates corrected understanding

3. "engagementFlag": One of:
   - "on_task" - student is genuinely engaging with the reading and the tutor's questions
   - "shallow" - student is responding but with minimal effort
   - "disengaged" - student is not trying
   - "off_topic" - student is talking about something unrelated to the reading
   - "hostile" - student is being adversarial toward the tutor

4. "engagementNote": If engagementFlag is NOT "on_task", a brief note explaining why. Null if on_task.

Return ONLY valid JSON. No markdown fences. No explanation outside the JSON.

{
  "newMisconceptions": [],
  "resolvedMisconceptions": [],
  "engagementFlag": "on_task",
  "engagementNote": null
}`;
}

function parseDiagnosticResponse(raw: string): DiagnosticResult | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const newMisconceptions: DetectedMisconception[] = (
      Array.isArray(parsed.newMisconceptions) ? parsed.newMisconceptions : []
    )
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          typeof item.description === "string" &&
          typeof item.canonicalClaim === "string" &&
          item.description.length > 0
      )
      .map((item) => ({
        description: String(item.description).slice(0, 500),
        canonicalClaim: String(item.canonicalClaim).slice(0, 280),
        passageAnchor:
          typeof item.passageAnchor === "string" ? item.passageAnchor : null,
        misconceptionType: VALID_MISCONCEPTION_TYPES.includes(
          item.misconceptionType as (typeof VALID_MISCONCEPTION_TYPES)[number]
        )
          ? (item.misconceptionType as DetectedMisconception["misconceptionType"])
          : "wrong_inference",
        severity: VALID_SEVERITIES.includes(
          item.severity as (typeof VALID_SEVERITIES)[number]
        )
          ? (item.severity as DetectedMisconception["severity"])
          : "medium",
        confidence: VALID_CONFIDENCES.includes(
          item.confidence as (typeof VALID_CONFIDENCES)[number]
        )
          ? (item.confidence as DetectedMisconception["confidence"])
          : "medium",
      }));

    const resolvedMisconceptions: ResolvedMisconception[] = (
      Array.isArray(parsed.resolvedMisconceptions)
        ? parsed.resolvedMisconceptions
        : []
    )
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          typeof item.misconceptionId === "string" &&
          item.misconceptionId.length > 0
      )
      .map((item) => ({
        misconceptionId: String(item.misconceptionId),
        confidence: VALID_CONFIDENCES.includes(
          item.confidence as (typeof VALID_CONFIDENCES)[number]
        )
          ? (item.confidence as ResolvedMisconception["confidence"])
          : "medium",
        evidenceSummary:
          typeof item.evidenceSummary === "string"
            ? item.evidenceSummary.slice(0, 500)
            : "",
      }));

    const engagementFlag = VALID_ENGAGEMENT_FLAGS.includes(
      parsed.engagementFlag as (typeof VALID_ENGAGEMENT_FLAGS)[number]
    )
      ? (parsed.engagementFlag as DiagnosticResult["engagementFlag"])
      : "on_task";

    const engagementNote =
      typeof parsed.engagementNote === "string"
        ? parsed.engagementNote.slice(0, 300)
        : null;

    return {
      newMisconceptions,
      resolvedMisconceptions,
      engagementFlag,
      engagementNote,
      diagnosticTurnIndex: 0,
    };
  } catch (error) {
    console.error("Failed to parse diagnostic response:", error);
    return null;
  }
}

export async function runDiagnostic(input: DiagnosticInput): Promise<void> {
  try {
    const prompt = buildDiagnosticPrompt(input);

    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("Diagnostic model returned no text content");
      return;
    }

    const result = parseDiagnosticResponse(textBlock.text);
    if (!result) return;

    result.diagnosticTurnIndex = input.exchangeIndex;

    for (const misconception of result.newMisconceptions) {
      await prisma.misconception.create({
        data: {
          studentSessionId: input.studentSessionId,
          topicThread: input.topicThread || "general",
          description: misconception.description,
          canonicalClaim: misconception.canonicalClaim,
          passageAnchor: misconception.passageAnchor,
          misconceptionType: misconception.misconceptionType,
          severity: misconception.severity,
          confidence: misconception.confidence,
          studentMessage: input.studentMessage.slice(0, 1000),
          resolved: false,
          persistentlyUnresolved: false,
          detectedAtTurn: input.exchangeIndex,
        },
      });
    }

    for (const resolved of result.resolvedMisconceptions) {
      if (input.unresolvedMisconceptionIds.includes(resolved.misconceptionId)) {
        await prisma.misconception.update({
          where: { id: resolved.misconceptionId },
          data: {
            resolved: true,
            resolutionConfidence: resolved.confidence,
            resolutionEvidence: resolved.evidenceSummary,
            resolvedAtTurn: input.exchangeIndex,
          },
        });
      }
    }

    const latestUserMessage = await prisma.message.findFirst({
      where: {
        studentSessionId: input.studentSessionId,
        role: "user",
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestUserMessage) {
      await prisma.message.update({
        where: { id: latestUserMessage.id },
        data: {
          engagementFlag: result.engagementFlag,
          engagementNote: result.engagementNote,
        },
      });
    }

    await prisma.diagnosticLog.create({
      data: {
        studentSessionId: input.studentSessionId,
        turnIndex: input.exchangeIndex,
        rawResponse: textBlock.text.slice(0, 3000),
        misconceptionsDetected: result.newMisconceptions.length,
        misconceptionsResolved: result.resolvedMisconceptions.length,
        engagementFlag: result.engagementFlag,
      },
    });
  } catch (error) {
    console.error("Diagnostic pipeline error:", error);
  }
}
