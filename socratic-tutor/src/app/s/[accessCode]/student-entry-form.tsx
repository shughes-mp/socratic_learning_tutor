"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/loading-state";

interface StudentEntryFormProps {
  sessionId: string;
  accessCode: string;
}

export default function StudentEntryForm({ sessionId, accessCode }: StudentEntryFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/student-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, studentName: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start session.");
      }

      const data = await res.json();
      // Store student session ID in sessionStorage for the chat page
      sessionStorage.setItem("studentSessionId", data.id);
      sessionStorage.setItem("studentName", name.trim());
      router.push(`/s/${accessCode}/chat`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="student-name" className="minerva-label">
          What&apos;s your name?
        </label>
        <input
          id="student-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your first and last name"
          className="minerva-input"
          required
          autoFocus
        />
      </div>

      {error && (
        <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-[13px] text-[var(--signal)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="minerva-button w-full"
      >
        {loading ? (
          <LoadingState variant="button" message="Starting…" />
        ) : (
          "Begin"
        )}
      </button>
      <p className="text-center text-[11px] text-[var(--dim-grey)]">
        No account needed. Your responses are only visible to your instructor.
      </p>
    </form>
  );
}
