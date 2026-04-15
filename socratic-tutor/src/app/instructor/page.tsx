"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/ui/step-indicator";
import { LoadingState } from "@/components/ui/loading-state";
import { SESSION_PURPOSE_OPTIONS, getSessionPurposeBadgeClasses } from "@/lib/session-purpose";

export default function InstructorCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionPurpose, setSessionPurpose] = useState("pre_class");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sessionPurpose,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session.");
      }

      const session = await res.json();
      router.push(`/instructor/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_360px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-12 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">Setup</p>
            <h1 className="section-title mt-5 max-w-[10ch]">
              Create a session.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Three steps: name your session, upload a reading, then share the
              link with your learners.
            </p>
            <div className="mt-8">
              <StepIndicator currentStep={1} />
            </div>
          </div>

          <div className="px-4 py-12 md:px-8 md:py-16">
            <form onSubmit={handleSubmit} className="minerva-card p-6 md:p-8">
              <div className="space-y-5">
                <div>
                  <label htmlFor="session-name" className="minerva-label">
                    Session Name
                  </label>
                  <input
                    id="session-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Week 3: Systems Thinking"
                    className="minerva-input"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    Instructions for learners
                  </label>
                  <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                    Optional. Shown on the entry page before learners begin.
                    Use this to set expectations — e.g. which sections to focus on,
                    what context to keep in mind.
                  </p>
                  <textarea
                    id="session-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Read the first two sections before starting. Pay attention to how the author defines core terms — the tutor will ask you about them."
                    rows={3}
                    className="minerva-textarea"
                  />
                </div>

                <div>
                  <label className="minerva-label">Session Purpose</label>
                  <p className="mt-0.5 mb-3 text-xs text-[var(--dim-grey)]">
                    When in the learning cycle will learners use this session? This shapes how the tutor questions and what the teaching brief measures.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SESSION_PURPOSE_OPTIONS.map((option) => {
                      const isSelected = sessionPurpose === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSessionPurpose(option.value)}
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-[var(--teal)] bg-[rgba(17,120,144,0.06)]"
                              : "border-[var(--rule)] hover:border-[rgba(17,120,144,0.3)]"
                          }`}
                        >
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(option.value)}`}
                          >
                            {option.shortLabel}
                          </span>
                          <p className="mt-1.5 text-xs font-medium text-[var(--charcoal)]">
                            {option.cognitiveLevel}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-4 text-[var(--dim-grey)]">
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-[13px] text-[var(--signal)]">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--rule)] pt-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    Next: upload a reading, then share the link.
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="minerva-button"
                  >
                    {loading ? <LoadingState variant="button" message="Creating…" /> : "Continue"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
