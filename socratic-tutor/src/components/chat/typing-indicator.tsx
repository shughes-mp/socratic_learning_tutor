export function TypingIndicator() {
  return (
    <div className="mb-8 flex w-full justify-start">
      <div className="flex h-[52px] items-center gap-1.5 rounded-2xl rounded-tl-sm border border-[var(--rule)] bg-[rgba(255,255,255,0.7)] px-5 py-4 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--teal)] animate-[bounce_1.4s_infinite_ease-in-out_both] [animation-delay:-0.32s]" />
        <span className="h-2 w-2 rounded-full bg-[var(--olive)] animate-[bounce_1.4s_infinite_ease-in-out_both] [animation-delay:-0.16s]" />
        <span className="h-2 w-2 rounded-full bg-[var(--rose)] animate-[bounce_1.4s_infinite_ease-in-out_both]" />
      </div>
    </div>
  );
}
