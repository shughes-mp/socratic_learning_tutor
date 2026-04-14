import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  // Strip structural tags just visually for the client
  const displayContent = content
    .replace(/\[MODE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[TOPIC_THREAD:\s*[\s\S]*?\]/gi, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_CANONICAL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_PASSAGE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_SEVERITY:\s*[\s\S]*?\]/gi, "")
    .replace(/\[DIRECT_ANSWER:\s*[\s\S]*?\]/gi, "")
    .replace(/\[QTYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[FEEDBACK_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[EXPERT_MODEL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[SELF_EXPLAIN_PROMPTED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[COGNITIVE_CONFLICT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_RESOLVED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_ID:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_STATUS:\s*[\s\S]*?\]/gi, "")
    .replace(/\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*[\s\S]*?\]/gi, "")
    .trim();

  // Do not render empty messages unless it's just loading
  if (!displayContent && !isUser) return null;

  return (
    <div className={`mb-8 flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 ${
          isUser
            ? "border border-[rgba(17,120,144,0.25)] bg-[rgba(17,120,144,0.92)] text-white shadow-[0_20px_35px_rgba(17,120,144,0.12)] rounded-tr-sm"
            : isSystem
              ? "border border-[rgba(17,120,144,0.24)] bg-[rgba(17,120,144,0.08)] text-[var(--charcoal)] shadow-sm rounded-xl"
              : "border border-[var(--rule)] bg-[rgba(255,255,255,0.7)] text-[var(--charcoal)] shadow-sm rounded-tl-sm"
        }`}
      >
        <div className="chat-prose max-w-none">
          {displayContent ? (
            isUser || isSystem ? (
              displayContent
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="tutor-paragraph">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="tutor-question">{children}</strong>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )
          ) : (
            <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--light-grey)]" />
          )}
        </div>
      </div>
    </div>
  );
}
