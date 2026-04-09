import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  // Strip structural tags just visually for the client
  const displayContent = content
    .replace(/\[MODE:\s*.*?\]/ig, "")
    .replace(/\[TOPIC_THREAD:\s*.*?\]/ig, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*.*?\]/ig, "")
    .replace(/\[MISCONCEPTION:\s*.*?\]/ig, "")
    .replace(/\[DIRECT_ANSWER:\s*.*?\]/ig, "")
    .trim();

  // Do not render empty messages unless it's just loading
  if (!displayContent && !isUser) return null;

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 ${
          isUser
            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-sm"
            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200 rounded-tl-sm"
        }`}
      >
        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white max-w-none">
          {displayContent || (
            <span className="inline-block w-2 h-4 bg-slate-300 dark:bg-slate-600 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
