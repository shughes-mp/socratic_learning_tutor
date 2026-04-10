import React from "react";
import type { Message, Misconception } from "@prisma/client";

interface ReplayProps {
  messages: Message[];
  misconceptions: Misconception[];
}

export function ExchangeReplay({ messages, misconceptions }: ReplayProps) {
  if (messages.length === 0) {
    return <p className="text-slate-500 text-sm">No messages yet.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {messages.map((message) => {
        const isStudent = message.role === "user";
        const relatedMisconceptions = isStudent
          ? misconceptions.filter((item) => item.studentMessage === message.content)
          : [];

        return (
          <div
            key={message.id}
            className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
          >
            {!isStudent && (
              <div className="flex flex-wrap gap-2 mb-1.5 ml-1">
                {message.topicThread && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    Topic: {message.topicThread}
                  </span>
                )}
                {message.mode && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      message.mode === "socratic"
                        ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30"
                        : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30"
                    }`}
                  >
                    {message.mode}
                    {message.mode === "socratic" &&
                      message.attemptNumber !== null &&
                      ` (Attempt ${message.attemptNumber})`}
                  </span>
                )}
                {message.questionType && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                    QType: {message.questionType}
                  </span>
                )}
                {message.feedbackType && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                    {message.feedbackType}
                  </span>
                )}
                {message.expertModelType && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Expert: {message.expertModelType}
                  </span>
                )}
                {message.selfExplainPrompted && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Self-explain
                  </span>
                )}
                {message.cognitiveConflictStage && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    Conflict: {message.cognitiveConflictStage}
                  </span>
                )}
                {message.isRevisitProbe && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
                    Revisit
                  </span>
                )}
                {message.isGenuineAttempt && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border-amber-200 px-2 py-0.5 rounded">
                    Genuine Attempt
                  </span>
                )}
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                isStudent
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-tr-sm"
                  : "bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {message.content}
              </p>
            </div>

            {relatedMisconceptions.map((misconception) => (
              <div
                key={misconception.id}
                className="mt-2 mr-1 max-w-[80%] bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1"
              >
                <svg
                  className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <span className="font-bold">Misconception Logged:</span>{" "}
                  {misconception.description}
                  {misconception.resolved && (
                    <span className="ml-2 text-emerald-700">Resolved</span>
                  )}
                  {misconception.persistentlyUnresolved && (
                    <span className="ml-2 text-red-700">Persisted</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
