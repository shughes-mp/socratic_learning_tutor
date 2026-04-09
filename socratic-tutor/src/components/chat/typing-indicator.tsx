export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start mb-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5 h-[52px]">
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1.4s_infinite_ease-in-out_both] [animation-delay:-0.32s]" />
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1.4s_infinite_ease-in-out_both] [animation-delay:-0.16s]" />
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1.4s_infinite_ease-in-out_both]" />
      </div>
    </div>
  );
}
