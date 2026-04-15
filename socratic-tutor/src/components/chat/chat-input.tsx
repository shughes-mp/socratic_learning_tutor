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
      className="relative mx-auto flex w-full max-w-5xl items-end border border-[var(--rule)] bg-[rgba(255,255,255,0.78)] p-2 shadow-sm transition-shadow focus-within:shadow-[0_0_0_4px_rgba(17,120,144,0.08)]"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Session has ended." : "Type your message... (Shift+Enter for new line)"}
        disabled={isLoading || disabled}
        className="min-h-[52px] max-h-[200px] w-full resize-none bg-transparent px-3 py-3 text-[15px] text-[var(--charcoal)] outline-none placeholder:text-[#908a84] disabled:opacity-50"
        rows={1}
      />
      
      <button
        type="submit"
        disabled={!input.trim() || isLoading || disabled}
        className="ml-2 flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center border border-[var(--signal)] bg-[var(--signal)] text-white transition-colors hover:bg-[#c92c24] disabled:border-[var(--light-grey)] disabled:bg-[rgba(255,255,255,0.6)] disabled:text-[var(--light-grey-2,#b4afaa)]"
      >
        <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
}
