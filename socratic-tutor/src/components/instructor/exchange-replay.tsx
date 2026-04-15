import React from "react";
import ReactMarkdown from "react-markdown";
import type { ConfidenceCheck, Message, Misconception } from "@prisma/client";
import { stripTags } from "@/lib/strip-tags";

type ReplayMessage = Message & { hidden?: boolean };

interface ReplayProps {
  messages: ReplayMessage[];
  misconceptions: Misconception[];
  confidenceChecks?: ConfidenceCheck[];
}

export function ExchangeReplay({
  messages,
  misconceptions,
  confidenceChecks = [],
}: ReplayProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-[var(--dim-grey)]">No messages yet.</p>;
  }

  const visibleMessages = messages.filter(
    (message) =>
      !message.hidden &&
      !(
        message.role === "user" &&
        message.content.includes("OPENING SEQUENCE INSTRUCTION")
      )
  );

  if (visibleMessages.length === 0) {
    return <p className="text-sm text-[var(--dim-grey)]">No messages yet.</p>;
  }

  return (
    <div className="mt-4 space-y-6">
      {confidenceChecks.length > 0 && (
        <div className="mb-4 rounded-lg border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.04)] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--teal)]">
            Confidence checks
          </p>
          <div className="mt-2 space-y-1.5">
            {confidenceChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-center gap-2 text-xs text-[var(--dim-grey)]"
              >
                <span className="font-medium text-[var(--charcoal)]">
                  {check.topicThread}
                </span>
                <span>→</span>
                <span
                  className={
                    check.rating === "very_confident"
                      ? "text-[var(--teal)]"
                      : check.rating === "uncertain"
                        ? "text-[var(--signal)]"
                        : "text-[#906f12]"
                  }
                >
                  {check.rating.replace(/_/g, " ")}
                </span>
                {check.probeAsked && (
                  <span className="rounded bg-[rgba(34,34,34,0.06)] px-1.5 py-0.5 text-[10px]">
                    Probe: {check.probeResult || "pending"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleMessages.map((message) => {
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
                  ? "rounded-tr-sm bg-[var(--teal)] text-white"
                  : "rounded-tl-sm border border-[var(--rule)] bg-white text-[var(--charcoal)] shadow-sm"
              }`}
            >
              {isStudent ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {message.content}
                </p>
              ) : (
                <div className="prose prose-sm max-w-none text-[15px] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
                  <ReactMarkdown>{stripTags(message.content)}</ReactMarkdown>
                </div>
              )}
            </div>

            {relatedMisconceptions.map((misconception) => (
              <div
                key={misconception.id}
                className="mt-2 mr-1 flex max-w-[80%] items-start gap-2 rounded-lg border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-3 py-2 text-xs text-[var(--signal)]"
              >
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--signal)]"
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
                  <span className="font-bold">Common misunderstanding logged:</span>{" "}
                  {misconception.description}
                  {misconception.resolved && (
                    <span className="ml-2 text-[var(--teal)]">Resolved</span>
                  )}
                  {misconception.persistentlyUnresolved && (
                    <span className="ml-2 text-[var(--signal)]">Persisted</span>
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
