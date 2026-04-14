"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StepIndicator } from "@/components/ui/step-indicator";
import type {
  CheckpointLintResult,
  CheckpointProcessLevel,
  CheckpointRecord,
  FileInfo,
  SessionDetails,
} from "@/types";

function getRecommendedCheckpoints(maxExchanges: number): number {
  if (maxExchanges < 8) {
    return 1;
  }
  return Math.floor((maxExchanges - 4) / 4);
}

function formatSavedTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getProcessLevelTone(processLevel: CheckpointProcessLevel) {
  switch (processLevel) {
    case "retrieve":
      return "bg-[rgba(17,120,144,0.12)] text-[var(--teal)]";
    case "infer":
      return "bg-[rgba(114,133,3,0.12)] text-[var(--olive)]";
    case "integrate":
      return "bg-[rgba(17,120,144,0.08)] text-[var(--charcoal)]";
    case "evaluate":
      return "bg-[rgba(223,47,38,0.08)] text-[var(--signal)]";
  }
}

function formatProcessLevelLabel(processLevel: CheckpointProcessLevel) {
  switch (processLevel) {
    case "retrieve":
      return "Find in the text";
    case "infer":
      return "Read between the lines";
    case "integrate":
      return "Connect ideas";
    case "evaluate":
      return "Judge the argument";
  }
}

export default function SessionManagementPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<"reading" | "assessment" | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [generatingMap, setGeneratingMap] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentUploadName, setRecentUploadName] = useState<string | null>(null);
  const [recentUploadCategory, setRecentUploadCategory] = useState<"reading" | "assessment" | null>(null);
  const [configSavedAt, setConfigSavedAt] = useState<Date | null>(null);
  const [showSavedState, setShowSavedState] = useState(false);
  const [dragActive, setDragActive] = useState<"reading" | "assessment" | null>(null);
  const [learnerCount, setLearnerCount] = useState(0);
  const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [showQuestionSavedState, setShowQuestionSavedState] = useState(false);
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editingCheckpointPrompt, setEditingCheckpointPrompt] = useState("");
  const [editingCheckpointProcessLevel, setEditingCheckpointProcessLevel] =
    useState<CheckpointProcessLevel>("infer");
  const [editingCheckpointPassageAnchors, setEditingCheckpointPassageAnchors] =
    useState("");
  const [newCheckpointPrompt, setNewCheckpointPrompt] = useState("");
  const [newCheckpointProcessLevel, setNewCheckpointProcessLevel] =
    useState<CheckpointProcessLevel>("infer");
  const [newCheckpointPassageAnchors, setNewCheckpointPassageAnchors] = useState("");
  const [lintingCheckpointId, setLintingCheckpointId] = useState<string | null>(null);
  const [checkpointLintResult, setCheckpointLintResult] = useState<{
    checkpointId: string;
    result: CheckpointLintResult;
  } | null>(null);
  const readingInputRef = useRef<HTMLInputElement>(null);
  const assessmentInputRef = useRef<HTMLInputElement>(null);

  const fetchCheckpoints = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load questions.");
      }

      setCheckpoints(Array.isArray(data?.checkpoints) ? data.checkpoints : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load questions.";
      setError(message);
    } finally {
      setLoadingCheckpoints(false);
    }
  }, [sessionId]);

  const fetchLearnerCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/students`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load learners.");
      }

      setLearnerCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error("Failed to load learners:", err);
      setLearnerCount(0);
    }
  }, [sessionId]);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files`);

      const filesContentType = res.headers.get("content-type") ?? "";
      if (!filesContentType.includes("application/json")) {
        throw new Error(
          "The server is not responding correctly. Please refresh the page or contact support if the issue persists."
        );
      }

      const filesData = await res.json();
      if (!res.ok) {
        throw new Error(filesData.error || "Failed to load session files.");
      }
      setFiles(filesData.files);

      const configRes = await fetch(`/api/sessions/${sessionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (configRes.ok) {
        const configData = await configRes.json().catch(() => null);
        if (configData) {
          setSession({
            id: configData.id,
            name: configData.name,
            description: configData.description,
            courseContext: configData.courseContext,
            learningGoal: configData.learningGoal,
            learningOutcomes: configData.learningOutcomes,
            prerequisiteMap: configData.prerequisiteMap,
            accessCode: configData.accessCode,
            createdAt: "",
            maxExchanges: configData.maxExchanges,
            stance: configData.stance ?? "directed",
            readingsCount: filesData.files.filter((f: FileInfo) => f.category === "reading").length,
            assessmentsCount: filesData.files.filter((f: FileInfo) => f.category === "assessment").length,
          });
        }
      }

      await Promise.all([fetchCheckpoints(), fetchLearnerCount()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session.";
      if (message.includes("<!DOCTYPE") || message.includes("Unexpected token")) {
        setError(
          "The server returned an unexpected response. Please refresh the page."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchCheckpoints, fetchLearnerCount, sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!recentUploadName) return;
    const timeout = window.setTimeout(() => {
      setRecentUploadName(null);
      setRecentUploadCategory(null);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [recentUploadName]);

  useEffect(() => {
    if (!showSavedState) return;
    const timeout = window.setTimeout(() => setShowSavedState(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [showSavedState]);

  useEffect(() => {
    if (!showQuestionSavedState) return;
    const timeout = window.setTimeout(() => setShowQuestionSavedState(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [showQuestionSavedState]);

  async function handleUpload(file: File, category: "reading" | "assessment") {
    setUploading(true);
    setUploadingCategory(category);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await fetch(`/api/sessions/${sessionId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const responseText = await res.text();
        let errorMessage = "Failed to upload file.";

        try {
          const data = JSON.parse(responseText) as { error?: string };
          errorMessage = data.error || errorMessage;
        } catch {
          if (res.status >= 500) {
            errorMessage =
              "The server could not process that file. Please try again or upload a text-based PDF, DOCX, TXT, or Markdown file.";
          }
        }

        throw new Error(errorMessage);
      }

      await fetchSession();
      setRecentUploadName(file.name);
      setRecentUploadCategory(category);
      setToast({
        tone: "success",
        message: `${category === "reading" ? "Reading" : "Assessment"} uploaded successfully.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setUploading(false);
      setUploadingCategory(null);
    }
  }

  async function handleRemoveFile(fileId: string, category: string) {
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/files?fileId=${fileId}&category=${category}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove file.");
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    }
  }

  function handleDrop(e: React.DragEvent, category: "reading" | "assessment") {
    e.preventDefault();
    setDragActive(null);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleUpload(droppedFiles[0], category);
    }
  }

  function handleDragOver(e: React.DragEvent, category: "reading" | "assessment") {
    e.preventDefault();
    setDragActive(category);
  }

  function handleDragLeave() {
    setDragActive(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, category: "reading" | "assessment") {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleUpload(selectedFiles[0], category);
    }
    e.target.value = "";
  }

  async function copyLink() {
    if (!session) return;
    const url = `${window.location.origin}/s/${session.accessCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveTeachingContext() {
    if (!session) return;

    setSavingConfig(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseContext: session.courseContext,
          learningGoal: session.learningGoal,
          learningOutcomes: session.learningOutcomes,
          prerequisiteMap: session.prerequisiteMap,
          stance: session.stance || "directed",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings.");
      }

      await fetchSession();
      const savedAt = new Date();
      setConfigSavedAt(savedAt);
      setShowSavedState(true);
      setToast({
        tone: "success",
        message: "Settings saved.",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setSavingConfig(false);
    }
  }

  async function generateSuggestedMap() {
    setGeneratingMap(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/suggest-prerequisite-map`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate prerequisite map.");
      }
      const data = await res.json();
      setSession((prev) =>
        prev
          ? {
              ...prev,
              prerequisiteMap: JSON.stringify(data.map, null, 2),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prerequisite map.");
    } finally {
      setGeneratingMap(false);
    }
  }

  async function createCheckpoint() {
    if (!newCheckpointPrompt.trim()) {
      setError("Write a question before saving.");
      setShowQuestionSavedState(false);
      return;
    }

    setSavingCheckpoint(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: newCheckpointPrompt,
          processLevel: newCheckpointProcessLevel,
          passageAnchors: newCheckpointPassageAnchors || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add question.");
      }

      setNewCheckpointPrompt("");
      setNewCheckpointProcessLevel("infer");
      setNewCheckpointPassageAnchors("");
      await fetchCheckpoints();
      setShowQuestionSavedState(true);
      setToast({ tone: "success", message: "Question added." });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add question.";
      setError(message);
      setShowQuestionSavedState(false);
      setToast({ tone: "error", message });
    } finally {
      setSavingCheckpoint(false);
    }
  }

  function startEditingCheckpoint(checkpoint: CheckpointRecord) {
    setEditingCheckpointId(checkpoint.id);
    setEditingCheckpointPrompt(checkpoint.prompt);
    setEditingCheckpointProcessLevel(checkpoint.processLevel);
    setEditingCheckpointPassageAnchors(checkpoint.passageAnchors ?? "");
    setCheckpointLintResult(null);
  }

  function cancelEditingCheckpoint() {
    setEditingCheckpointId(null);
    setEditingCheckpointPrompt("");
    setEditingCheckpointProcessLevel("infer");
    setEditingCheckpointPassageAnchors("");
  }

  async function saveCheckpointEdit(checkpointId: string) {
    if (!editingCheckpointPrompt.trim()) {
      setError("The question can't be empty.");
      return;
    }

    setSavingCheckpoint(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints/${checkpointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: editingCheckpointPrompt,
          processLevel: editingCheckpointProcessLevel,
          passageAnchors: editingCheckpointPassageAnchors || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update question.");
      }

      await fetchCheckpoints();
      cancelEditingCheckpoint();
      setToast({ tone: "success", message: "Question updated." });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update question.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setSavingCheckpoint(false);
    }
  }

  async function removeCheckpoint(checkpointId: string) {
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to remove question.");
      }

      setCheckpointLintResult((prev) =>
        prev?.checkpointId === checkpointId ? null : prev
      );
      await fetchCheckpoints();
      setToast({ tone: "success", message: "Question removed." });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove question.";
      setError(message);
      setToast({ tone: "error", message });
    }
  }

  async function moveCheckpoint(checkpointId: string, direction: -1 | 1) {
    const currentIndex = checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= checkpoints.length) {
      return;
    }

    const reordered = [...checkpoints];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setSavingCheckpoint(true);
    setError("");
    try {
      await Promise.all(
        reordered.map((checkpoint, index) =>
          fetch(`/api/sessions/${sessionId}/checkpoints/${checkpoint.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderIndex: index }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              throw new Error(data?.error || "Failed to reorder questions.");
            }
          })
        )
      );

      await fetchCheckpoints();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reorder questions.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setSavingCheckpoint(false);
    }
  }

  async function improveCheckpoint(checkpoint: CheckpointRecord) {
    setLintingCheckpointId(checkpoint.id);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints/lint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: checkpoint.prompt }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to get suggestions.");
      }

      setCheckpointLintResult({
        checkpointId: checkpoint.id,
        result: {
          isRecallOnly: Boolean(data?.isRecallOnly),
          suggestedRewrite:
            typeof data?.suggestedRewrite === "string"
              ? data.suggestedRewrite
              : checkpoint.prompt,
          suggestedExpectations: Array.isArray(data?.suggestedExpectations)
            ? data.suggestedExpectations
            : [],
          suggestedMisconceptions: Array.isArray(data?.suggestedMisconceptions)
            ? data.suggestedMisconceptions
            : [],
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get suggestions.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setLintingCheckpointId(null);
    }
  }

  async function applyCheckpointSuggestions(checkpointId: string) {
    if (checkpointLintResult?.checkpointId !== checkpointId) return;

    setSavingCheckpoint(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkpoints/${checkpointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: checkpointLintResult.result.suggestedRewrite,
          expectations: checkpointLintResult.result.suggestedExpectations,
          misconceptionSeeds: checkpointLintResult.result.suggestedMisconceptions,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to apply suggestions.");
      }

      await fetchCheckpoints();
      setCheckpointLintResult(null);
      setToast({ tone: "success", message: "Suggestions applied." });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply suggestions.";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setSavingCheckpoint(false);
    }
  }

  const readings = files.filter((f) => f.category === "reading");
  const assessments = files.filter((f) => f.category === "assessment");
  const isActive = readings.length > 0;
  const setupStep: 2 | 3 | null =
    readings.length === 0 ? 2 : learnerCount === 0 ? 3 : null;

  if (loading) {
    return (
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-16 text-[var(--dim-grey)] md:px-8 md:py-20">
              Loading session...
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-16 md:px-8 md:py-20">
              <p className="eyebrow eyebrow-rose">Instructor View</p>
              <h1 className="section-title mt-5">Session not found.</h1>
              <Link href="/instructor" className="mt-6 inline-flex text-[var(--signal)]">
                Create a new session
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="minerva-page">
      <div className="minerva-shell space-y-6 py-8">
        {toast && (
          <div className="fixed right-5 top-5 z-50 max-w-sm">
            <div
              className={`rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                toast.tone === "success"
                  ? "border-[rgba(17,120,144,0.22)] bg-[rgba(255,255,255,0.94)] text-[var(--charcoal)]"
                  : "border-[rgba(223,47,38,0.28)] bg-[rgba(255,255,255,0.96)] text-[var(--signal)]"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="hover:text-[var(--teal)] transition-colors">
                  Sessions
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">{session.name}</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                {session.name}
              </h1>
              {session.description && (
                <p className="mt-3 max-w-[36rem] text-[15px] leading-7 text-[var(--dim-grey)]">
                  {session.description}
                </p>
              )}
              {setupStep !== null && (
                <div className="mt-4">
                  <StepIndicator currentStep={setupStep} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={isActive ? `/instructor/${sessionId}/monitor` : "#"}
                aria-disabled={!isActive}
                title={!isActive ? "Upload a reading to activate this session first" : undefined}
                className={`minerva-button minerva-button-secondary ${
                  !isActive ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Learner progress
              </Link>
              <Link
                href={isActive ? `/instructor/${sessionId}/report` : "#"}
                aria-disabled={!isActive}
                title={!isActive ? "Upload a reading to activate this session first" : undefined}
                className={`minerva-button minerva-button-secondary ${
                  !isActive ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Session summaries
              </Link>
              <Link
                href={`/instructor/${sessionId}/misconceptions`}
                className="minerva-button minerva-button-secondary"
              >
                Common misunderstandings
              </Link>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className={`px-4 py-3 text-sm ${
          readings.length === 0
            ? "border border-[rgba(144,111,18,0.22)] bg-[rgba(144,111,18,0.08)] text-[#906f12]"
            : "border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.08)] text-[var(--teal)]"
        }`}>
          {readings.length === 0
            ? "Upload at least one reading to activate this session."
            : `Ready: ${readings.length} reading${readings.length !== 1 ? "s" : ""}, ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} uploaded.`}
        </div>

        {error && (
          <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
            {error}
          </div>
        )}

        {/* Share link card — shown after status bar */}
        {session && (
          <div className="minerva-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className={`eyebrow ${isActive ? "eyebrow-teal" : "eyebrow-rose"}`}>
                  {isActive ? "Access Code" : "Access Code — Not yet active"}
                </p>
                <p className={`mt-1 text-lg font-mono font-semibold ${
                  isActive ? "text-[var(--charcoal)]" : "text-[var(--dim-grey)] select-none blur-[3px]"
                }`}>
                  {session.accessCode}
                </p>
                {!isActive && (
                  <p className="mt-1 text-xs text-[var(--dim-grey)]">
                    Upload at least one reading below to activate this session.
                  </p>
                )}
              </div>
              {isActive && (
                <button
                  onClick={copyLink}
                  className="minerva-button"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy learner link
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="minerva-card space-y-4 p-6 md:p-8">
          <div>
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Tutor Configuration
            </h2>
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              What you write here shapes how the tutor opens the session, checks for
              understanding, and identifies gaps. Optional, but improves response quality.
            </p>
          </div>

          <fieldset className="space-y-3 rounded-xl border border-[var(--rule)] bg-[rgba(255,255,255,0.42)] p-4">
            <legend className="px-1 text-sm font-medium text-[var(--charcoal)]">
              Interaction style
            </legend>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start space-x-3">
                <input
                  type="radio"
                  name="stance"
                  value="directed"
                  checked={(session.stance ?? "directed") === "directed"}
                  onChange={(e) =>
                    setSession((prev) =>
                      prev ? { ...prev, stance: e.target.value as "directed" | "mentor" } : prev
                    )
                  }
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--charcoal)]">Directed Tutor</div>
                  <div className="text-xs text-[var(--dim-grey)]">
                    Guides the learner through probing questions. The tutor leads.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start space-x-3">
                <input
                  type="radio"
                  name="stance"
                  value="mentor"
                  checked={session.stance === "mentor"}
                  onChange={(e) =>
                    setSession((prev) =>
                      prev ? { ...prev, stance: e.target.value as "directed" | "mentor" } : prev
                    )
                  }
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--charcoal)]">Peer Mentor</div>
                  <div className="text-xs text-[var(--dim-grey)]">
                    Engages as a thinking partner, challenging interpretations
                    collaboratively. Good for experienced learners.
                  </div>
                </div>
              </label>
            </div>
          </fieldset>

          <div className="space-y-2">
            <label className="minerva-label">
              Where this fits in your course
            </label>
            <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
              Background the tutor needs — what course this is for, where learners are in the curriculum, what they've covered so far.
            </p>
            <textarea
              value={session.courseContext ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, courseContext: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="e.g. This is Week 4 of a 10-week unit on systems thinking. Learners have read Meadows chapters 1–3 and are familiar with stocks and flows, but have not yet covered feedback loops."
              className="minerva-textarea"
            />
          </div>

          <div className="space-y-2">
            <label className="minerva-label">
              Learning Outcomes
            </label>
            <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
              Optional. The specific skills or understandings learners should demonstrate. These are referenced in learner reports.
            </p>
            <textarea
              value={session.learningOutcomes ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, learningOutcomes: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="e.g. Learners will be able to reconstruct the author's central argument, identify unstated assumptions, and evaluate the strength of the evidence presented."
              className="minerva-textarea"
            />
          </div>

          <div className="space-y-2">
            <label className="minerva-label">
              What you want learners to be able to do
            </label>
            <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
              What you want learners to understand by the end of this session.
            </p>
            <textarea
              value={session.learningGoal ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, learningGoal: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="e.g. Explain the difference between reinforcing and balancing feedback loops, and identify at least one example of each in the reading."
              className="minerva-textarea"
            />
          </div>

          {session.maxExchanges && (
            <div className="minerva-panel p-4 text-sm text-[var(--charcoal)]">
              <p className="mb-1 font-semibold text-[var(--teal)]">
                Question Capacity
              </p>
              <p className="leading-6 text-[var(--dim-grey)]">
                With <strong>{session.maxExchanges} exchanges</strong>, this
                session can meaningfully cover approximately{" "}
                <strong>
                  {getRecommendedCheckpoints(session.maxExchanges)} key
                  question
                  {getRecommendedCheckpoints(session.maxExchanges) === 1 ? "" : "s"}
                </strong>
                . This assumes roughly four exchanges per question, plus
                exchanges for orientation and wrap-up.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--dim-grey)] hover:text-[var(--charcoal)] transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced settings
            </button>

            {showAdvanced && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <label className="minerva-label">
                      Concept dependencies
                    </label>
                    <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                      A map of which concepts build on others. You can generate this automatically from your reading.
                    </p>
                  </div>
                  <button
                    onClick={generateSuggestedMap}
                    disabled={generatingMap || readings.length === 0}
                    title={readings.length === 0 ? "Upload a reading first to generate a map" : undefined}
                    className="minerva-button minerva-button-secondary"
                  >
                    {generatingMap ? "Generating..." : "Generate from readings"}
                  </button>
                </div>
                <textarea
                  value={session.prerequisiteMap ?? ""}
                  onChange={(e) =>
                    setSession((prev) =>
                      prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                    )
                  }
                  rows={8}
                  placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
                  className="minerva-textarea resize-y font-mono text-xs"
                />
              </>
            )}
          </div>

          <div className="pt-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={saveTeachingContext}
                disabled={savingConfig}
                className="minerva-button"
              >
                {savingConfig
                  ? "Saving..."
                  : showSavedState
                    ? "Saved"
                    : "Save Configuration"}
              </button>
              {(configSavedAt || showSavedState) && (
                <p className="text-xs text-[var(--dim-grey)]">
                  {showSavedState
                    ? "Settings saved."
                    : configSavedAt
                      ? `Last saved at ${formatSavedTime(configSavedAt)}`
                      : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="minerva-card space-y-5 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Key Questions
              </h2>
              <p className="mt-2 max-w-[42rem] text-sm leading-6 text-[var(--dim-grey)]">
              Questions learners should be able to answer after working through the reading. With{" "}
                {session.maxExchanges} exchanges, aim for about{" "}
                {getRecommendedCheckpoints(session.maxExchanges)} question
                {getRecommendedCheckpoints(session.maxExchanges) === 1 ? "" : "s"}.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--dim-grey)]">
              {checkpoints.length} question{checkpoints.length === 1 ? "" : "s"}
            </p>
          </div>

          {session.maxExchanges > 0 &&
            checkpoints.length > Math.max(3, Math.floor(session.maxExchanges / 4)) && (
              <div className="rounded-xl border border-[rgba(144,111,18,0.22)] bg-[rgba(144,111,18,0.08)] px-4 py-3 text-sm text-[#906f12]">
                You have {checkpoints.length} questions with {session.maxExchanges} exchanges.
                Consider trimming this to roughly {getRecommendedCheckpoints(session.maxExchanges)}{" "}
                to {Math.max(3, Math.floor(session.maxExchanges / 4))} questions for this
                session length.
              </div>
            )}

          {loadingCheckpoints ? (
            <div className="rounded-xl border border-[var(--rule)] bg-[rgba(255,255,255,0.48)] px-4 py-5 text-sm text-[var(--dim-grey)]">
              Loading questions...
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--light-grey)] bg-[rgba(255,255,255,0.48)] px-4 py-5 text-sm text-[var(--dim-grey)]">
              No questions yet. Add 2-4 strong questions to guide the tutor through the reading.
            </div>
          ) : (
            <div className="space-y-3">
              {checkpoints.map((checkpoint, index) => {
                const isEditing = editingCheckpointId === checkpoint.id;
                const lintResult =
                  checkpointLintResult?.checkpointId === checkpoint.id
                    ? checkpointLintResult.result
                    : null;

                return (
                  <div
                    key={checkpoint.id}
                    className="space-y-4 rounded-2xl border border-[var(--rule)] bg-[rgba(255,255,255,0.62)] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                            Question {index + 1}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getProcessLevelTone(
                              checkpoint.processLevel
                            )}`}
                          >
                            {formatProcessLevelLabel(checkpoint.processLevel)}
                          </span>
                          {checkpoint.passageAnchors && (
                            <span className="rounded-full bg-[rgba(0,0,0,0.04)] px-2.5 py-1 text-[11px] font-medium text-[var(--dim-grey)]">
                              {checkpoint.passageAnchors}
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingCheckpointPrompt}
                              onChange={(e) => setEditingCheckpointPrompt(e.target.value)}
                              rows={4}
                              className="minerva-textarea"
                            />
                            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                              <select
                                value={editingCheckpointProcessLevel}
                                onChange={(e) =>
                                  setEditingCheckpointProcessLevel(
                                    e.target.value as CheckpointProcessLevel
                                  )
                                }
                                className="minerva-input"
                              >
                <option value="retrieve">Find in the text — Can the learner locate specific information?</option>
                <option value="infer">Read between the lines — Can the learner draw conclusions the author implies but doesn&apos;t state?</option>
                <option value="integrate">Connect ideas — Can the learner link ideas across different parts of the reading?</option>
                <option value="evaluate">Judge the argument — Can the learner assess the strength of the author&apos;s reasoning?</option>
                              </select>
                              <input
                                value={editingCheckpointPassageAnchors}
                                onChange={(e) =>
                                  setEditingCheckpointPassageAnchors(e.target.value)
                                }
                                placeholder="e.g., Section 2, paragraphs 3–5"
                                className="minerva-input"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="max-w-[48rem] text-[15px] leading-7 text-[var(--charcoal)]">
                            {checkpoint.prompt}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => moveCheckpoint(checkpoint.id, -1)}
                          disabled={index === 0 || savingCheckpoint}
                          className="minerva-button minerva-button-secondary"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveCheckpoint(checkpoint.id, 1)}
                          disabled={index === checkpoints.length - 1 || savingCheckpoint}
                          className="minerva-button minerva-button-secondary"
                        >
                          Down
                        </button>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveCheckpointEdit(checkpoint.id)}
                              disabled={savingCheckpoint}
                              className="minerva-button"
                            >
                              {savingCheckpoint ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditingCheckpoint}
                              disabled={savingCheckpoint}
                              className="minerva-button minerva-button-secondary"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditingCheckpoint(checkpoint)}
                              className="minerva-button minerva-button-secondary"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => improveCheckpoint(checkpoint)}
                              disabled={lintingCheckpointId === checkpoint.id}
                              className="minerva-button minerva-button-secondary"
                            >
                              {lintingCheckpointId === checkpoint.id
                                ? "Loading..."
                                : "Get feedback on this question"}
                            </button>
                            <button
                              onClick={() => removeCheckpoint(checkpoint.id)}
                              className="minerva-button minerva-button-secondary"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {lintResult && (
                      <div className="space-y-4 rounded-xl border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.06)] p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                              Question feedback
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--charcoal)]">
                              {lintResult.isRecallOnly
                                ? "This prompt looks too recall-heavy. Here is a stronger interpretive version."
                                : "This prompt is viable. Here are refinements to make evidence and misconception tracking stronger."}
                            </p>
                          </div>
                          <button
                            onClick={() => applyCheckpointSuggestions(checkpoint.id)}
                            disabled={savingCheckpoint}
                            className="minerva-button"
                          >
                            {savingCheckpoint ? "Applying..." : "Apply suggestions"}
                          </button>
                        </div>

                        <div className="space-y-3 text-sm text-[var(--charcoal)]">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                              Suggested rewrite
                            </p>
                            <p className="mt-2 leading-6">{lintResult.suggestedRewrite}</p>
                          </div>

                          {lintResult.suggestedExpectations.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                                Expected evidence
                              </p>
                              <ul className="mt-2 space-y-1.5 text-[var(--charcoal)]">
                                {lintResult.suggestedExpectations.map((item) => (
                                  <li key={item}>- {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {lintResult.suggestedMisconceptions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                                Likely misreadings
                              </p>
                              <ul className="mt-2 space-y-1.5 text-[var(--charcoal)]">
                                {lintResult.suggestedMisconceptions.map((item) => (
                                  <li key={item}>- {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-[var(--rule)] bg-[rgba(255,255,255,0.5)] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                Add question
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--dim-grey)]">
              Write a question worth discussing, not something learners can answer by copying one line from the reading.
              </p>
            </div>

            <textarea
              value={newCheckpointPrompt}
              onChange={(e) => setNewCheckpointPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Why does the author's argument about system behavior depend on the claim that structure drives outcomes?"
              className="minerva-textarea"
            />

            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                <label className="minerva-label">Process level</label>
                <select
                  value={newCheckpointProcessLevel}
                  onChange={(e) =>
                    setNewCheckpointProcessLevel(
                      e.target.value as CheckpointProcessLevel
                    )
                  }
                  className="minerva-input"
                >
                <option value="retrieve">Find in the text — Can the learner locate specific information?</option>
                <option value="infer">Read between the lines — Can the learner draw conclusions the author implies but doesn&apos;t state?</option>
                <option value="integrate">Connect ideas — Can the learner link ideas across different parts of the reading?</option>
                <option value="evaluate">Judge the argument — Can the learner assess the strength of the author&apos;s reasoning?</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="minerva-label">Which part of the reading?</label>
                <input
                  value={newCheckpointPassageAnchors}
                  onChange={(e) => setNewCheckpointPassageAnchors(e.target.value)}
                  placeholder="e.g., Section 2, paragraphs 3–5"
                  className="minerva-input"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={createCheckpoint}
                disabled={savingCheckpoint}
                className="minerva-button"
              >
                {savingCheckpoint ? "Saving..." : "Add question"}
              </button>
              {showQuestionSavedState ? (
                <p className="text-xs font-medium text-[var(--teal)]">
                  Question added and ready to use.
                </p>
              ) : (
                <p className="text-xs text-[var(--dim-grey)]">
                  Aim for 2-4 strong questions for most sessions.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Readings section */}
        <div className="minerva-card space-y-4 p-6 md:p-8">
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Readings
          </h2>

          {/* Drop zone */}
          <div
            onDrop={(e) => handleDrop(e, "reading")}
            onDragOver={(e) => handleDragOver(e, "reading")}
            onDragLeave={handleDragLeave}
            onClick={() => readingInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive === "reading"
                ? "border-[var(--teal)] bg-[rgba(17,120,144,0.08)]"
                : "border-[var(--light-grey)] hover:border-[var(--teal)] hover:bg-[rgba(255,255,255,0.55)]"
            }`}
          >
            <input
              ref={readingInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFileChange(e, "reading")}
              className="hidden"
            />
            <svg className="mx-auto mb-2 w-8 h-8 text-[var(--dim-grey)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-[var(--charcoal)]">
              {uploadingCategory === "reading"
                ? "Uploading reading..."
                : "Drag and drop files here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              PDF, DOCX, TXT, or Markdown up to 10MB
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              Scanned PDFs will not work. Use a text-based PDF or upload DOCX, TXT, or Markdown instead.
            </p>
            {recentUploadCategory === "reading" && recentUploadName && (
              <p className="mt-3 text-xs font-medium text-[var(--teal)]">
                Uploaded: {recentUploadName}
              </p>
            )}
          </div>

          {/* File list */}
          {readings.length > 0 && (
            <div className="space-y-2">
              {readings.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between border p-3 transition-colors ${
                    recentUploadCategory === "reading" && recentUploadName === file.filename
                      ? "border-[rgba(17,120,144,0.28)] bg-[rgba(17,120,144,0.08)]"
                      : "border-[var(--rule)] bg-[rgba(255,255,255,0.58)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-md bg-[rgba(17,120,144,0.12)] px-2 py-0.5 text-xs font-medium uppercase text-[var(--teal)]">
                      {file.filename.split(".").pop()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--charcoal)]">
                        {file.filename}
                      </p>
                      <p className="truncate text-xs text-[var(--dim-grey)]">
                        {file.preview}...
                      </p>
                      {recentUploadCategory === "reading" && recentUploadName === file.filename && (
                        <p className="mt-1 text-[11px] font-medium text-[var(--teal)]">
                          Ready
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id, file.category)}
                    className="flex-shrink-0 p-1.5 text-[var(--dim-grey)] transition-colors hover:bg-[rgba(223,47,38,0.08)] hover:text-[var(--signal)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessments section */}
        <div className="minerva-card space-y-4 p-6 md:p-8">
          <div>
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Assessments
            </h2>
            <p className="mt-1 text-sm text-[var(--dim-grey)] max-w-[38rem]">
              Upload your assignments or exam questions. The tutor reads them to understand
                    what learners are working toward — but will never reveal or directly answer them.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={(e) => handleDrop(e, "assessment")}
            onDragOver={(e) => handleDragOver(e, "assessment")}
            onDragLeave={handleDragLeave}
            onClick={() => assessmentInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive === "assessment"
                ? "border-[var(--rose)] bg-[rgba(165,65,125,0.08)]"
                : "border-[var(--light-grey)] hover:border-[var(--rose)] hover:bg-[rgba(255,255,255,0.55)]"
            }`}
          >
            <input
              ref={assessmentInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFileChange(e, "assessment")}
              className="hidden"
            />
            <svg className="mx-auto mb-2 w-8 h-8 text-[var(--dim-grey)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-[var(--charcoal)]">
              {uploadingCategory === "assessment"
                ? "Uploading assessment..."
                : "Drag and drop files here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              PDF, DOCX, TXT, or Markdown up to 10MB
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              Scanned PDFs will not work. Use a text-based PDF or upload DOCX, TXT, or Markdown instead.
            </p>
            {recentUploadCategory === "assessment" && recentUploadName && (
              <p className="mt-3 text-xs font-medium text-[var(--rose)]">
                Uploaded: {recentUploadName}
              </p>
            )}
          </div>

          {/* File list */}
          {assessments.length > 0 && (
            <div className="space-y-2">
              {assessments.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between border p-3 transition-colors ${
                    recentUploadCategory === "assessment" && recentUploadName === file.filename
                      ? "border-[rgba(165,65,125,0.24)] bg-[rgba(165,65,125,0.08)]"
                      : "border-[var(--rule)] bg-[rgba(255,255,255,0.58)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-md bg-[rgba(165,65,125,0.12)] px-2 py-0.5 text-xs font-medium uppercase text-[var(--rose)]">
                      {file.filename.split(".").pop()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--charcoal)]">
                        {file.filename}
                      </p>
                      <p className="truncate text-xs text-[var(--dim-grey)]">
                        {file.preview}...
                      </p>
                      {recentUploadCategory === "assessment" && recentUploadName === file.filename && (
                        <p className="mt-1 text-[11px] font-medium text-[var(--rose)]">
                          Ready
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id, file.category)}
                    className="flex-shrink-0 p-1.5 text-[var(--dim-grey)] transition-colors hover:bg-[rgba(223,47,38,0.08)] hover:text-[var(--signal)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
