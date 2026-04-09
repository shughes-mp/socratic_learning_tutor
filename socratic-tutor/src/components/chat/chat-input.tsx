import { useRef, useEffect } from "react";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ input, handleInputChange, handleSubmit, isLoading, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && !disabled) {
        // Find closest form and submit it
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 transition-shadow"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Session has ended." : "Type your message... (Shift+Enter for new line)"}
        disabled={isLoading || disabled}
        className="w-full max-h-[200px] min-h-[44px] bg-transparent resize-none outline-none px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-50"
        rows={1}
      />
      
      <button
        type="submit"
        disabled={!input.trim() || isLoading || disabled}
        className="flex-shrink-0 h-[44px] w-[44px] flex items-center justify-center rounded-xl bg-indigo-600 text-white disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 hover:bg-indigo-700 transition-colors ml-2"
      >
        <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
}
