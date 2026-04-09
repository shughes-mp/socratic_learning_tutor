import React from "react";
import type { Message, Misconception } from "@prisma/client";

interface ReplayProps {
  messages: Message[];
  misconceptions: Misconception[];
}

export function ExchangeReplay({ messages, misconceptions }: ReplayProps) {
  if (messages.length === 0) return <p className="text-slate-500 text-sm">No messages yet.</p>;

  return (
    <div className="space-y-6 mt-4">
      {messages.map((msg, idx) => {
        const isStudent = msg.role === "user";
        
        // Find any misconceptions logged around this time for this specific message
        const relatedMisconceptions = isStudent 
          ? misconceptions.filter(m => m.studentMessage === msg.content) 
          : [];

        return (
          <div key={msg.id} className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}>
            
            {/* Tag Badges for AI messages */}
            {!isStudent && (
              <div className="flex gap-2 mb-1.5 ml-1">
                {msg.topicThread && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    Topic: {msg.topicThread}
                  </span>
                )}
                {msg.mode && (
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${msg.mode === 'socratic' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30'}`}>
                    {msg.mode} 
                    {msg.mode === 'socratic' && msg.attemptNumber !== null && ` (Attempt ${msg.attemptNumber})`}
                  </span>
                )}
                {msg.isGenuineAttempt && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border-amber-200 px-2 py-0.5 rounded">
                    Genuine Attempt
                  </span>
                )}
              </div>
            )}

            <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${isStudent ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'}`}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
            </div>

            {/* Misconception Flags for Student messages */}
            {relatedMisconceptions.map(m => (
              <div key={m.id} className="mt-2 mr-1 max-w-[80%] bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <span className="font-bold">Misconception Logged:</span> {m.description}
                </div>
              </div>
            ))}

          </div>
        );
      })}
    </div>
  );
}
