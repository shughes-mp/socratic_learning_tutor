import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";
import {
  buildContextInstruction,
  buildSystemPrompt,
  parsePrerequisiteMap,
  type SoftRevisitItem,
} from "@/lib/system-prompt";
import {
  containsConfidencePrompt,
  computeNextAttemptState,
  extractConfidenceRating,
  parseTags,
} from "@/lib/attempt-tracker";
import {
  determineNextHintLadderRung,
  evaluateMastery,
} from "@/lib/mastery";
import { runDiagnostic } from "@/lib/diagnostic";

export const maxDuration = 60;
const VALID_CHECKPOINT_STATUSES = [
  "probing",
  "evidence_sufficient",
  "evidence_insufficient",
  "deferred",
] as const;

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

export async function POST(req: Request) {
  try {
    await ensureDatabaseReady();

    const payload = (await req.json()) as {
      studentSessionId?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!payload.studentSessionId || !payload.messages || !Array.isArray(payload.messages)) {
      return NextResponse.json(
        { error: "Invalid request payload", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const studentSessionId = payload.studentSessionId;
    const incomingMessages = payload.messages;
    const lastUserMessage = incomingMessages[incomingMessages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Missing user message", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const studentSession = await prisma.studentSession.findUnique({
      where: { id: studentSessionId },
      include: {
        session: {
          include: {
            readings: true,
            assessments: true,
          },
        },
      },
    });

    if (!studentSession) {
      return NextResponse.json(
        { error: "Session not found", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (studentSession.session.closesAt && new Date(studentSession.session.closesAt) < new Date()) {
      return NextResponse.json(
        { error: "Session closed", code: "SESSION_CLOSED" },
        { status: 403 }
      );
    }

    const checkpoints = await prisma.checkpoint.findMany({
      where: { sessionId: studentSession.session.id },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });

    const studentCheckpoints = await prisma.studentCheckpoint.findMany({
      where: { studentSessionId },
    });

    const dbMessages = await prisma.message.findMany({
      where: { studentSessionId },
      orderBy: { createdAt: "asc" },
    });

    const exchangeCount = Math.floor(dbMessages.length / 2);
    if (exchangeCount >= studentSession.session.maxExchanges) {
      return NextResponse.json(
        { error: "Exchange limit reached", code: "EXCHANGE_LIMIT" },
        { status: 403 }
      );
    }

    let currentTopicThread: string | null = null;
    let attemptCount = 0;
    for (const message of dbMessages) {
      if (message.role !== "assistant") continue;
      if (message.topicThread && message.topicThread !== currentTopicThread) {
        currentTopicThread = message.topicThread;
        attemptCount = 0;
      }
      if (message.isGenuineAttempt) {
        attemptCount += 1;
      }
    }

    const lastAssistantMessage = [...dbMessages].reverse().find((message) => message.role === "assistant");
    const previousQuestionType = lastAssistantMessage?.questionType ?? null;
    const confidencePromptWasAsked = containsConfidencePrompt(lastAssistantMessage?.content);
    const confidenceRating = confidencePromptWasAsked
      ? extractConfidenceRating(lastUserMessage.content)
      : null;

    const unresolvedConfidenceProbe = await prisma.confidenceCheck.findFirst({
      where: {
        studentSessionId,
        probeAsked: true,
        probeResult: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const unresolvedMisconceptions = currentTopicThread
      ? await prisma.misconception.findMany({
          where: {
            studentSessionId: payload.studentSessionId,
            topicThread: currentTopicThread,
            resolved: false,
          },
          orderBy: { detectedAt: "asc" },
        })
      : [];

    const prerequisiteMap = parsePrerequisiteMap(studentSession.session.prerequisiteMap);
    if (prerequisiteMap && hasCycle(prerequisiteMap)) {
      console.warn("Ignoring prerequisite map with cycle for session", studentSession.session.id);
    }

    const activePrerequisiteMap =
      prerequisiteMap && !hasCycle(prerequisiteMap) ? prerequisiteMap : null;

    const topicMastery = currentTopicThread
      ? await prisma.topicMastery.findUnique({
          where: {
            studentSessionId_topicThread: {
              studentSessionId: payload.studentSessionId,
              topicThread: currentTopicThread,
            },
          },
        })
      : null;

    const softRevisitQueue = JSON.parse(studentSession.softRevisitQueue || "[]") as SoftRevisitItem[];
    const revisitTriggerAt = Math.floor(studentSession.session.maxExchanges * 0.6);
    const activeSoftRevisit =
      exchangeCount >= revisitTriggerAt && softRevisitQueue.length > 0 ? softRevisitQueue[0] : null;

    const systemPrompt = buildSystemPrompt(
      studentSession.session.readings,
      studentSession.session.assessments,
      {
        courseContext: studentSession.session.courseContext,
        learningGoal: studentSession.session.learningGoal,
        learningOutcomes: studentSession.session.learningOutcomes,
        stance: studentSession.session.stance,
      },
      checkpoints
    );

    const instruction = buildContextInstruction({
      lastTopicThread: currentTopicThread,
      currentAttemptCount: attemptCount,
      exchangeCount,
      maxExchanges: studentSession.session.maxExchanges,
      checkpoints,
      studentCheckpoints,
      previousQuestionType,
      unresolvedMisconceptions,
      confidenceRating,
      activeSoftRevisit,
      hintLadderRung: topicMastery?.hintLadderRung ?? 0,
      prerequisiteMap: activePrerequisiteMap,
    });

    let currentConfidenceCheckId: string | null = null;
    if (confidenceRating) {
      const confidenceCheck = await prisma.confidenceCheck.create({
        data: {
          studentSessionId: payload.studentSessionId,
          topicThread: currentTopicThread || "general",
          rating: confidenceRating,
          probeAsked: confidenceRating !== "somewhat_confident",
        },
      });
      currentConfidenceCheckId = confidenceCheck.id;
    }

    await prisma.message.create({
      data: {
        studentSessionId,
        role: "user",
        content: lastUserMessage.content,
        topicThread: currentTopicThread,
      },
    });

    const anthropicMessages = incomingMessages.map((message, index) => {
      if (index === incomingMessages.length - 1 && message.role === "user") {
        return {
          role: message.role,
          content: `${instruction}\n\nUser Message: ${message.content}`,
        };
      }

      return { role: message.role, content: message.content };
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            system: systemPrompt,
            messages: anthropicMessages,
            max_tokens: 1400,
            stream: true,
          });

          let fullResponse = "";

          for await (const event of anthropicStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const { cleanedText, tags } = parseTags(fullResponse);
          const normalizedTopicThread =
            confidenceRating === "uncertain" && currentTopicThread
              ? currentTopicThread
              : tags.topicThread || currentTopicThread;
          const nextState = computeNextAttemptState(currentTopicThread, attemptCount, {
            ...tags,
            topicThread: normalizedTopicThread,
          });

          const currentHintRung = topicMastery?.hintLadderRung ?? 0;
          const nextHintRung = determineNextHintLadderRung(currentHintRung, tags);
          const checkpointStatusMatches = Array.from(
            fullResponse.matchAll(
              /\[CHECKPOINT_STATUS:\s*([\s\S]*?)\|([\s\S]+?)\]/gi
            )
          );

          await prisma.message.create({
            data: {
              studentSessionId,
              role: "assistant",
              content: cleanedText,
              topicThread: normalizedTopicThread,
              attemptNumber: nextState.newAttemptCount,
              isGenuineAttempt: tags.isGenuineAttempt,
              mode: tags.mode,
              questionType: tags.questionType,
              feedbackType: tags.feedbackType,
              expertModelType: tags.expertModelType,
              selfExplainPrompted: tags.selfExplainPrompted,
              cognitiveConflictStage: tags.cognitiveConflictStage,
              misconceptionResolved: tags.misconceptionResolved,
              isRevisitProbe: tags.isRevisitProbe,
            },
          });

          const diagnosticInput = {
            studentSessionId,
            sessionId: studentSession.session.id,
            studentMessage: lastUserMessage.content,
            assistantMessage: cleanedText,
            topicThread: normalizedTopicThread,
            exchangeIndex: exchangeCount + 1,
            readingContent: studentSession.session.readings
              .map((reading) => reading.content)
              .join("\n\n"),
            checkpoints: checkpoints.map((checkpoint) => ({
              id: checkpoint.id,
              prompt: checkpoint.prompt,
              processLevel: checkpoint.processLevel,
              passageAnchors: checkpoint.passageAnchors,
            })),
            unresolvedMisconceptionIds: unresolvedMisconceptions.map(
              (misconception) => misconception.id
            ),
            conversationHistory: incomingMessages.map((message) => ({
              role: message.role as "user" | "assistant",
              content: message.content,
            })),
          };

          const diagnosticPromise = runDiagnostic(diagnosticInput).catch(
            (err) => {
              console.error("Background diagnostic failed:", err);
            }
          );

          if (checkpointStatusMatches.length > 0) {
            const studentCheckpointMap = new Map(
              studentCheckpoints.map((item) => [item.checkpointId, item])
            );

            for (const match of checkpointStatusMatches) {
              const checkpointId = match[1]?.trim();
              const rawStatus = match[2]?.trim().toLowerCase();

              if (!checkpointId) continue;
              if (
                !VALID_CHECKPOINT_STATUSES.includes(
                  rawStatus as (typeof VALID_CHECKPOINT_STATUSES)[number]
                )
              ) {
                continue;
              }

              const checkpoint = checkpoints.find((item) => item.id === checkpointId);
              if (!checkpoint) continue;

              const existing = studentCheckpointMap.get(checkpointId);
              if (existing) {
                const updated = await prisma.studentCheckpoint.update({
                  where: { id: existing.id },
                  data: {
                    status: rawStatus,
                    turnsSpent: existing.turnsSpent + 1,
                  },
                });
                studentCheckpointMap.set(checkpointId, updated);
              } else {
                const created = await prisma.studentCheckpoint.create({
                  data: {
                    studentSessionId,
                    checkpointId,
                    status: rawStatus,
                    turnsSpent: 1,
                  },
                });
                studentCheckpointMap.set(checkpointId, created);
              }
            }
          }

          if (
            unresolvedConfidenceProbe &&
            !confidenceRating &&
            unresolvedConfidenceProbe.topicThread === (currentTopicThread || unresolvedConfidenceProbe.topicThread)
          ) {
            await prisma.confidenceCheck.update({
              where: { id: unresolvedConfidenceProbe.id },
              data: {
                probeResult: tags.isGenuineAttempt ? "passed" : "failed",
              },
            });
          }

          if (currentConfidenceCheckId && confidenceRating === "somewhat_confident") {
            await prisma.confidenceCheck.update({
              where: { id: currentConfidenceCheckId },
              data: { probeAsked: false, probeResult: null },
            });
          }

          if (
            unresolvedMisconceptions.length > 0 &&
            currentTopicThread &&
            normalizedTopicThread &&
            normalizedTopicThread !== currentTopicThread &&
            !tags.cognitiveConflictStage
          ) {
            await prisma.misconception.updateMany({
              where: {
                studentSessionId,
                topicThread: currentTopicThread,
                resolved: false,
              },
              data: { persistentlyUnresolved: true },
            });
          }

          const nextSoftRevisitQueue = [...softRevisitQueue];
          const queueTopic = normalizedTopicThread || currentTopicThread;
          const addQueueItem = (reason: SoftRevisitItem["reason"]) => {
            if (!queueTopic) return;
            if (
              nextSoftRevisitQueue.some(
                (item) => item.topicThread === queueTopic && item.reason === reason
              )
            ) {
              return;
            }

            nextSoftRevisitQueue.push({
              topicThread: queueTopic,
              reason,
              addedAtExchange: exchangeCount,
            });
          };

          if (tags.directAnswer) {
            addQueueItem("DIRECT_ANSWER");
          }

          if (confidenceRating === "uncertain") {
            addQueueItem("LOW_CONFIDENCE");
          }

          if (
            unresolvedMisconceptions.some((item) => item.persistentlyUnresolved) ||
            (unresolvedMisconceptions.length > 0 &&
              normalizedTopicThread !== currentTopicThread &&
              !tags.cognitiveConflictStage)
          ) {
            addQueueItem("UNRESOLVED_MISCONCEPTION");
          }

          if (activeSoftRevisit && tags.isRevisitProbe) {
            if (tags.isGenuineAttempt) {
              nextSoftRevisitQueue.shift();
            }
          }

          if (
            JSON.stringify(nextSoftRevisitQueue) !==
            JSON.stringify(softRevisitQueue)
          ) {
            await prisma.studentSession.update({
              where: { id: studentSessionId },
              data: { softRevisitQueue: JSON.stringify(nextSoftRevisitQueue) },
            });
          }

          await evaluateMastery(
            studentSessionId,
            normalizedTopicThread,
            nextHintRung
          );
          if (
            currentTopicThread &&
            normalizedTopicThread &&
            currentTopicThread !== normalizedTopicThread
          ) {
            await evaluateMastery(
              studentSessionId,
              currentTopicThread,
              topicMastery?.hintLadderRung ?? 0
            );
          }

          await diagnosticPromise;
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request", code: "CHAT_FAILED" },
      { status: 500 }
    );
  }
}
