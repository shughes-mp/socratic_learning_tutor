"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/ui/step-indicator";
import { LoadingState } from "@/components/ui/loading-state";

export default function InstructorCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
          sessionPurpose: "pre_class",
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
              Set up your AI Tutor.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Name your session and we&apos;ll take you to the workspace where
              you can upload readings, set learning goals, and choose when in
              the learning cycle students will use the tutor.
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
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-[13px] text-[var(--signal)]">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end border-t border-[var(--rule)] pt-5">
                  <button
                    type="submit"
                    disabled={loading}
                    className="minerva-button"
                  >
                    {loading ? <LoadingState variant="button" message="Creating…" /> : "Create session"}
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
