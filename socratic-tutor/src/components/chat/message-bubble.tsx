import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { stripTags } from "@/lib/strip-tags";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  const displayContent = useMemo(() => stripTags(content), [content]);

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
});
