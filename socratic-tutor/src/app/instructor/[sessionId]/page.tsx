"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { FileInfo, SessionDetails } from "@/types";

export default function SessionManagementPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [generatingMap, setGeneratingMap] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState<"reading" | "assessment" | null>(null);
  const readingInputRef = useRef<HTMLInputElement>(null);
  const assessmentInputRef = useRef<HTMLInputElement>(null);

  const fetchSession = useCallback(async () => {
    try {
      // Fetch session details from the files endpoint (which includes session info)
      const res = await fetch(`/api/sessions/${sessionId}/files`);
      if (!res.ok) throw new Error("Session not found.");
      const data = await res.json();
      setFiles(data.files);

      // Fetch session config separately
      const configRes = await fetch(`/api/sessions/${sessionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty patch to get current data
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        setSession({
          id: configData.id,
          name: configData.name,
          description: configData.description,
          courseContext: configData.courseContext,
          learningGoal: configData.learningGoal,
          prerequisiteMap: configData.prerequisiteMap,
          accessCode: configData.accessCode,
          createdAt: "",
          maxExchanges: configData.maxExchanges,
          readingsCount: data.files.filter((f: FileInfo) => f.category === "reading").length,
          assessmentsCount: data.files.filter((f: FileInfo) => f.category === "assessment").length,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  async function handleUpload(file: File, category: "reading" | "assessment") {
    setUploading(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
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
          prerequisiteMap: session.prerequisiteMap,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save teaching context.");
      }

      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save teaching context.");
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

  const readings = files.filter((f) => f.category === "reading");
  const assessments = files.filter((f) => f.category === "assessment");

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
        {/* Header */}
        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="eyebrow eyebrow-teal">Instructor Workspace</p>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                {session.name}
              </h1>
              {session.description && (
                <p className="mt-3 max-w-[36rem] text-[15px] leading-7 text-[var(--dim-grey)]">
                  {session.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/instructor/${sessionId}/monitor`}
                className="minerva-button minerva-button-secondary"
              >
                Student Activity
              </Link>
              <Link
                href={`/instructor/${sessionId}/report`}
                className="minerva-button minerva-button-secondary"
              >
                Report
              </Link>
            </div>
          </div>

          {/* Share link card */}
          <div className="minerva-panel mt-6 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="eyebrow eyebrow-teal">
                  Access Code
                </p>
                <p className="mt-1 text-lg font-mono font-semibold text-[var(--charcoal)]">
                  {session.accessCode}
                </p>
              </div>
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
                    Copy Student Link
                  </>
                )}
              </button>
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

        <div className="minerva-card space-y-4 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="eyebrow eyebrow-teal">Teaching Context</p>
              <h2 className="mt-3 font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching Context
              </h2>
              <p className="mt-2 text-sm text-[var(--dim-grey)]">
                Guide the tutor&apos;s opening, transfer checks, and prerequisite prompts.
              </p>
            </div>
            <button
              onClick={saveTeachingContext}
              disabled={savingConfig}
              className="minerva-button"
            >
              {savingConfig ? "Saving..." : "Save Context"}
            </button>
          </div>

          <div className="space-y-2">
            <label className="minerva-label">
              Course Context
            </label>
            <textarea
              value={session.courseContext ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, courseContext: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="How this reading fits the broader course arc..."
              className="minerva-textarea"
            />
          </div>

          <div className="space-y-2">
            <label className="minerva-label">
              Session Learning Goal
            </label>
            <textarea
              value={session.learningGoal ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, learningGoal: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="What students should be able to explain or apply by the end of the session..."
              className="minerva-textarea"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <label className="minerva-label">
                  Prerequisite Map JSON
                </label>
                <p className="mt-1 text-xs text-[var(--dim-grey)]">
                  Optional advanced map for prerequisite-aware scaffolding.
                </p>
              </div>
              <button
                onClick={generateSuggestedMap}
                disabled={generatingMap || readings.length === 0}
                className="minerva-button minerva-button-secondary"
              >
                {generatingMap ? "Generating..." : "Generate Suggested Map"}
              </button>
            </div>
            <textarea
              value={session.prerequisiteMap ?? ""}
              onChange={(e) =>
                setSession((prev) =>
                  prev ? { ...prev, prerequisiteMap: e.target.value } : prev
                )
              }
              rows={10}
              placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
              className="minerva-textarea resize-y font-mono text-xs"
            />
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
              {uploading ? "Uploading..." : "Drag and drop files here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              .pdf, .docx, .txt, .md (max 10MB)
            </p>
          </div>

          {/* File list */}
          {readings.length > 0 && (
            <div className="space-y-2">
              {readings.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between border border-[var(--rule)] bg-[rgba(255,255,255,0.58)] p-3"
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
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              The tutor will never answer these directly.
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
              {uploading ? "Uploading..." : "Drag and drop files here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              .pdf, .docx, .txt, .md (max 10MB)
            </p>
          </div>

          {/* File list */}
          {assessments.length > 0 && (
            <div className="space-y-2">
              {assessments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between border border-[var(--rule)] bg-[rgba(255,255,255,0.58)] p-3"
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
