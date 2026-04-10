"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatArea } from "@/components/chat/chat-area";
import { ChatInput } from "@/components/chat/chat-input";

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

interface ClientChatProps {
  accessCode: string;
  sessionName: string;
  sessionDescription: string | null;
  courseContext: string | null;
  learningGoal: string | null;
  maxExchanges: number;
}

export function ClientChat({
  accessCode,
  sessionName,
  sessionDescription,
  courseContext,
  learningGoal,
  maxExchanges,
}: ClientChatProps) {
  const router = useRouter();
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [isEnded, setIsEnded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const initialized = useRef(false);

  const exchangeCount = Math.ceil(messages.filter((message) => message.role === "user").length);

  useEffect(() => {
    const sid = sessionStorage.getItem("studentSessionId");
    const sname = sessionStorage.getItem("studentName");

    if (!sid) {
      router.push(`/s/${accessCode}`);
      return;
    }

    setStudentSessionId(sid);
    setStudentName(sname);

    if (!initialized.current && messages.length === 0) {
      initialized.current = true;
      sendMessage(
        `Hi. My name is ${sname || "a student"}. I'm ready to begin the session.
OPENING SEQUENCE INSTRUCTION: This is the opening exchange.
1. Greet me by name.
2. Ask ONE question about what I already know or believe about the main topic before doing the reading.
3. Do NOT ask about the reading content yet.
4. Wait for my response before bridging to the reading and asking the first Socratic question.
If course context is available, use it naturally in the first three exchanges.`,
        sid
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerEndSession = async (sid: string) => {
    if (isEnded || isEnding) return;
    setIsEnding(true);
    try {
      const res = await fetch("/api/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentSessionId: sid }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      setIsEnded(true);
      setIsEnding(false);
      sessionStorage.removeItem("studentSessionId");
      sessionStorage.removeItem("studentName");
    }
  };

  const sendMessage = async (
    contentToSend: string,
    sid: string | null = studentSessionId
  ) => {
    if (!sid || !contentToSend.trim() || isLoading) return;

    setIsLoading(true);
    setError(false);

    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: contentToSend,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentSessionId: sid, messages: newMessages }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.code === "EXCHANGE_LIMIT") {
          triggerEndSession(sid);
        } else {
          setError(true);
        }
        setIsLoading(false);
        return;
      }

      if (!res.body) throw new Error("No body in response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      const assistantMessageId = Math.random().toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((prev) => {
            const mapped = [...prev];
            const lastIdx = mapped.length - 1;
            if (mapped[lastIdx].id === assistantMessageId) {
              mapped[lastIdx] = {
                ...mapped[lastIdx],
                content: mapped[lastIdx].content + chunk,
              };
            }
            return mapped;
          });
        }
      }
    } catch (err) {
      console.error("Stream Error:", err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && studentSessionId && exchangeCount < maxExchanges) {
      const content = input;
      setInput("");
      sendMessage(content);
    }
  };

  const handleEndClick = () => {
    if (
      studentSessionId &&
      confirm("Are you sure you want to end this tutoring session?")
    ) {
      triggerEndSession(studentSessionId);
    }
  };

  if (!studentSessionId) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      <header className="flex-shrink-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex flex-col">
          <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {sessionName}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Socratic Tutor • Access: {accessCode}
          </p>
        </div>
        {!isEnded && (
          <button
            onClick={handleEndClick}
            disabled={isEnding || isLoading}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/30 rounded-lg transition-colors border-transparent"
          >
            {isEnding ? "Ending..." : "End Session"}
          </button>
        )}
      </header>

      {isEnded && summary ? (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 flex justify-center">
          <div className="max-w-3xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm my-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Session Complete
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {summary.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 pt-6">
            <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-white dark:bg-slate-900 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Session Orientation
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {sessionName}
              </h2>
              {sessionDescription && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {sessionDescription}
                </p>
              )}
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                I&apos;ll help you work through the reading by asking questions
                that push you to build your own understanding. After a few
                genuine attempts, I&apos;ll give a direct answer if you&apos;re
                still stuck.
              </p>
              {courseContext && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    Why this matters:
                  </span>{" "}
                  {courseContext}
                </p>
              )}
              {learningGoal && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    Goal for this session:
                  </span>{" "}
                  {learningGoal}
                </p>
              )}
              {studentName && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  You&apos;re joining as {studentName}.
                </p>
              )}
            </div>
          </div>
          <ChatArea messages={messages} isLoading={isLoading} />
        </div>
      )}

      {!isEnded && (
        <div className="flex-shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-4 pt-4 pb-6">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            {error && (
              <div className="w-full mb-3 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center shadow-sm">
                I&apos;m having trouble connecting right now. Please try again
                in a moment.
              </div>
            )}

            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={isEnded || isEnding || (exchangeCount >= maxExchanges && !isLoading)}
            />

            <div className="w-full flex justify-between items-center mt-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>This tutor draws only from the uploaded readings.</span>
              <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-md">
                {exchangeCount} of {maxExchanges} exchanges
              </span>
            </div>

            {exchangeCount >= maxExchanges && !isLoading && !isEnded && (
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-amber-600 mb-2">
                  You have reached the exchange limit for this session.
                </p>
                <button
                  onClick={() => triggerEndSession(studentSessionId)}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm transition-colors"
                >
                  View Summary
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
