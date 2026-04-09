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
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file.");
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

  const readings = files.filter((f) => f.category === "reading");
  const assessments = files.filter((f) => f.category === "assessment");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-slate-500">Session not found.</p>
          <Link href="/instructor" className="text-indigo-600 hover:underline text-sm">
            Create a new session
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {session.name}
              </h1>
              {session.description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {session.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/instructor/${sessionId}/monitor`}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Student Activity
              </Link>
              <Link
                href={`/instructor/${sessionId}/report`}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Report
              </Link>
            </div>
          </div>

          {/* Share link card */}
          <div className="mt-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Access Code
                </p>
                <p className="text-lg font-mono font-semibold text-indigo-900 dark:text-indigo-200 mt-0.5">
                  {session.accessCode}
                </p>
              </div>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
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
        <div className={`p-3 rounded-xl text-sm ${
          readings.length === 0
            ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400"
            : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
        }`}>
          {readings.length === 0
            ? "Upload at least one reading to activate this session."
            : `Ready: ${readings.length} reading${readings.length !== 1 ? "s" : ""}, ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} uploaded.`}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Readings section */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
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
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700/30"
            }`}
          >
            <input
              ref={readingInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFileChange(e, "reading")}
              className="hidden"
            />
            <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {uploading ? "Uploading..." : "Drag and drop files here, or click to browse"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              .pdf, .docx, .txt, .md (max 10MB)
            </p>
          </div>

          {/* File list */}
          {readings.length > 0 && (
            <div className="space-y-2">
              {readings.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase">
                      {file.filename.split(".").pop()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {file.preview}...
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id, file.category)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
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
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Assessments
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700/30"
            }`}
          >
            <input
              ref={assessmentInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFileChange(e, "assessment")}
              className="hidden"
            />
            <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {uploading ? "Uploading..." : "Drag and drop files here, or click to browse"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              .pdf, .docx, .txt, .md (max 10MB)
            </p>
          </div>

          {/* File list */}
          {assessments.length > 0 && (
            <div className="space-y-2">
              {assessments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase">
                      {file.filename.split(".").pop()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {file.preview}...
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id, file.category)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
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
    </div>
  );
}
