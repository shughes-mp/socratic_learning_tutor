import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

interface ChatAreaMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
}

interface ChatAreaProps {
  messages: ChatAreaMessage[];
  isLoading: boolean;
}

export function ChatArea({ messages, isLoading }: ChatAreaProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 scroll-smooth">
      <div className="max-w-4xl mx-auto flex flex-col pt-4 pb-20">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role as "user" | "assistant" | "system" | "data"} content={m.content} />
        ))}
        {isLoading && (
          <div className="mt-2">
            <TypingIndicator />
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
}
