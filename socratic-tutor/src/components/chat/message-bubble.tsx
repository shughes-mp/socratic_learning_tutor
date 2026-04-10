interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  // Strip structural tags just visually for the client
  const displayContent = content
    .replace(/\[MODE:\s*.*?\]/ig, "")
    .replace(/\[TOPIC_THREAD:\s*.*?\]/ig, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*.*?\]/ig, "")
    .replace(/\[MISCONCEPTION:\s*.*?\]/ig, "")
    .replace(/\[DIRECT_ANSWER:\s*.*?\]/ig, "")
    .replace(/\[QTYPE:\s*.*?\]/ig, "")
    .replace(/\[FEEDBACK_TYPE:\s*.*?\]/ig, "")
    .replace(/\[EXPERT_MODEL:\s*.*?\]/ig, "")
    .replace(/\[SELF_EXPLAIN_PROMPTED:\s*.*?\]/ig, "")
    .replace(/\[COGNITIVE_CONFLICT:\s*.*?\]/ig, "")
    .replace(/\[MISCONCEPTION_RESOLVED:\s*.*?\]/ig, "")
    .replace(/\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*.*?\]/ig, "")
    .trim();

  // Do not render empty messages unless it's just loading
  if (!displayContent && !isUser) return null;

  return (
    <div className={`mb-8 flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 ${
          isUser
            ? "border border-[rgba(223,47,38,0.25)] bg-[rgba(223,47,38,0.92)] text-white shadow-[0_20px_35px_rgba(223,47,38,0.12)] rounded-tr-sm"
            : isSystem
              ? "border border-[rgba(17,120,144,0.24)] bg-[rgba(17,120,144,0.08)] text-[var(--charcoal)] shadow-sm rounded-xl"
              : "border border-[var(--rule)] bg-[rgba(255,255,255,0.7)] text-[var(--charcoal)] shadow-sm rounded-tl-sm"
        }`}
      >
        <div className="chat-prose max-w-none">
          {displayContent || (
            <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--light-grey)]" />
          )}
        </div>
      </div>
    </div>
  );
}
