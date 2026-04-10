"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InstructorCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [courseContext, setCourseContext] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
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
          courseContext: courseContext.trim() || undefined,
          learningGoal: learningGoal.trim() || undefined,
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
            <p className="eyebrow eyebrow-teal">Session Design</p>
            <h1 className="section-title mt-5 max-w-[10ch]">
              Build a guided learning environment.
            </h1>
            <p className="body-copy muted-copy mt-6 max-w-[25rem]">
              Define the reading context, the learning goal, and the boundaries
              for the tutoring conversation. You can upload files immediately
              after the session is created.
            </p>
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
                    placeholder="Week 3: Systems Thinking"
                    className="minerva-input"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="session-description"
                    className="minerva-label"
                  >
                    Description
                  </label>
                  <textarea
                    id="session-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What should students understand about this session before they begin?"
                    rows={3}
                    className="minerva-textarea"
                  />
                </div>

                <div>
                  <label htmlFor="course-context" className="minerva-label">
                    Course Context
                  </label>
                  <textarea
                    id="course-context"
                    value={courseContext}
                    onChange={(e) => setCourseContext(e.target.value)}
                    placeholder="How does this reading fit the broader arc of the course or unit?"
                    rows={4}
                    className="minerva-textarea"
                  />
                </div>

                <div>
                  <label htmlFor="learning-goal" className="minerva-label">
                    Learning Goal
                  </label>
                  <textarea
                    id="learning-goal"
                    value={learningGoal}
                    onChange={(e) => setLearningGoal(e.target.value)}
                    placeholder="What should students be able to explain, analyze, or apply after the session?"
                    rows={4}
                    className="minerva-textarea"
                  />
                </div>

                {error && (
                  <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-[13px] text-[var(--signal)]">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--rule)] pt-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-[12px] text-[var(--dim-grey)]">
                    After creation, you can upload readings, add protected
                    assessments, and share the student link.
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="minerva-button"
                  >
                    {loading ? "Creating..." : "Create Session"}
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
