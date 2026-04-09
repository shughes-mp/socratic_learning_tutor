import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";
import { buildSystemPrompt, buildContextInstruction } from "@/lib/system-prompt";
import { parseTags, computeNextAttemptState, extractConfidenceRating } from "@/lib/attempt-tracker";

// Helper to make the route robust for long streams
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { studentSessionId, messages } = await req.json();

    if (!studentSessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request payload", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1];

    const studentSession = await prisma.studentSession.findUnique({
      where: { id: studentSessionId },
      include: {
        session: { include: { readings: true, assessments: true } },
      },
    });

    if (!studentSession) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (studentSession.session.closesAt && new Date(studentSession.session.closesAt) < new Date()) {
      return NextResponse.json({ error: "Session closed", code: "SESSION_CLOSED" }, { status: 403 });
    }

    const dbMessages = await prisma.message.findMany({
      where: { studentSessionId },
      orderBy: { createdAt: "asc" },
    });

    let currentTopicThread: string | null = null;
    let attemptCount = 0;
    const exchangeCount = Math.floor(dbMessages.length / 2);

    if (exchangeCount >= studentSession.session.maxExchanges) {
      return NextResponse.json({ error: "Exchange limit reached", code: "EXCHANGE_LIMIT" }, { status: 403 });
    }

    for (const msg of dbMessages) {
      if (msg.role === "assistant") {
        if (msg.topicThread && msg.topicThread !== currentTopicThread) {
          currentTopicThread = msg.topicThread;
          attemptCount = 0;
        }
        if (msg.isGenuineAttempt) {
          attemptCount++;
        }
      }
    }

    const systemPrompt = buildSystemPrompt(studentSession.session.readings, studentSession.session.assessments);
    const instruction = buildContextInstruction(currentTopicThread, attemptCount, exchangeCount, studentSession.session.maxExchanges);

    const anthropicMessages = messages.map((m: any, index: number) => {
      if (index === messages.length - 1 && m.role === "user") {
        return { role: m.role, content: `${instruction}\n\nUser Message: ${m.content}` };
      }
      return { role: m.role, content: m.content };
    });

    if (exchangeCount > 0 && exchangeCount % 4 === 0) {
      const rating = extractConfidenceRating(lastUserMessage.content);
      if (rating) {
        prisma.confidenceCheck.create({
          data: { studentSessionId, topicThread: currentTopicThread || "general", rating },
        }).catch(console.error);
      }
    }

    await prisma.message.create({
      data: { studentSessionId, role: "user", content: lastUserMessage.content },
    });

    // Create ReadableStream to send to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            system: systemPrompt,
            messages: anthropicMessages,
            max_tokens: 1024,
            stream: true,
          });

          let fullResponse = "";

          for await (const event of anthropicStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text;
              fullResponse += text;
              // Only stream the raw chunk right down to client. Client UI strips tags.
              controller.enqueue(encoder.encode(text));
            }
          }

          // Once finished, parse tags and save the completed message
          const { cleanedText, tags } = parseTags(fullResponse);
          const nextState = computeNextAttemptState(currentTopicThread, attemptCount, tags);

          await prisma.message.create({
            data: {
              studentSessionId,
              role: "assistant",
              content: cleanedText,
              topicThread: tags.topicThread || currentTopicThread,
              attemptNumber: nextState.newAttemptCount,
              isGenuineAttempt: tags.isGenuineAttempt,
              mode: tags.mode,
            },
          });

          if (tags.misconception) {
            await prisma.misconception.create({
              data: {
                studentSessionId,
                topicThread: tags.topicThread || currentTopicThread || "general",
                description: tags.misconception,
                studentMessage: lastUserMessage.content,
              },
            });
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to process chat request", code: "CHAT_FAILED" }, { status: 500 });
  }
}
