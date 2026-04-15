"use client";

import React from "react";
import Link from "next/link";
import {
  SESSION_PURPOSE_OPTIONS,
  getSessionPurposeBadgeClasses,
  getSessionPurposeOption,
} from "@/lib/session-purpose";
import type { CheckpointRecord, FileInfo, SessionDetails } from "@/types";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 flex-shrink-0 text-[var(--dim-grey)] transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 text-[var(--dim-grey)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

// ─── WorkspaceHeader ───────────────────────────────────────────────────────────

interface WorkspaceHeaderProps {
  sessionId: string;
  session: SessionDetails;
  isActive: boolean;
  setupStep: 2 | 3 | 4 | null;
}

export function WorkspaceHeader({ sessionId, session, isActive, setupStep }: WorkspaceHeaderProps) {
  const purposeOption = getSessionPurposeOption(session.sessionPurpose);

  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
            <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
              Sessions
            </Link>
            <span>/</span>
            <span className="text-[var(--charcoal)]">Workspace</span>
          </nav>
          <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
            {session.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(session.sessionPurpose)}`}
            >
              {purposeOption.shortLabel}
            </span>
            {setupStep !== null && (
              <span className="text-xs text-[var(--dim-grey)]">
                Step {setupStep} of 4 —{" "}
                {setupStep === 2 ? "Add a reading" : setupStep === 3 ? "Add questions" : "Share with learners"}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/instructor/${sessionId}/monitor`} className="minerva-button minerva-button-secondary text-sm">
              Learner progress
            </Link>
            <Link href={`/instructor/${sessionId}/misconceptions`} className="minerva-button minerva-button-secondary text-sm">
              Misunderstandings
            </Link>
            <Link href={`/instructor/${sessionId}/report`} className="minerva-button minerva-button-secondary text-sm">
              Teaching brief
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatusBar ─────────────────────────────────────────────────────────────────

interface StatusBarProps {
  learnerCount: number;
  readingsCount: number;
  assessmentsCount: number;
}

export function StatusBar({ learnerCount, readingsCount, assessmentsCount }: StatusBarProps) {
  return (
    <div className="border border-[var(--rule)] bg-[rgba(17,120,144,0.04)] px-6 py-3 text-sm text-[var(--dim-grey)]">
      {readingsCount === 0
        ? "Upload at least one reading to activate this session."
        : learnerCount === 0
          ? `Ready: ${readingsCount} reading${readingsCount !== 1 ? "s" : ""}, ${assessmentsCount} assessment${assessmentsCount !== 1 ? "s" : ""} uploaded. No learners yet.`
          : `Active: ${learnerCount} learner${learnerCount !== 1 ? "s" : ""} connected. ${readingsCount} reading${readingsCount !== 1 ? "s" : ""}, ${assessmentsCount} assessment${assessmentsCount !== 1 ? "s" : ""}.`}
    </div>
  );
}

// ─── AccessCodeCard ────────────────────────────────────────────────────────────

interface AccessCodeCardProps {
  session: SessionDetails;
  isActive: boolean;
  copied: boolean;
  onCopyLink: () => void;
}

export function AccessCodeCard({ session, isActive, copied, onCopyLink }: AccessCodeCardProps) {
  const studentUrl = typeof window !== "undefined"
    ? `${window.location.origin}/s/${session.accessCode}`
    : `/s/${session.accessCode}`;

  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow eyebrow-teal">Student link</p>
          <p className="mt-2 font-mono text-base text-[var(--charcoal)]">{studentUrl}</p>
          {!isActive && (
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              Upload a reading to activate this session before sharing.
            </p>
          )}
        </div>
        <button
          onClick={onCopyLink}
          disabled={!isActive}
          className={`minerva-button ${!isActive ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

// ─── ActiveMonitoringCard ──────────────────────────────────────────────────────

interface ActiveMonitoringCardProps {
  sessionId: string;
  learnerCount: number;
}

export function ActiveMonitoringCard({ sessionId, learnerCount }: ActiveMonitoringCardProps) {
  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow eyebrow-teal">Session active</p>
          <p className="mt-2 text-sm text-[var(--dim-grey)]">
            {learnerCount} learner{learnerCount !== 1 ? "s" : ""} connected
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/instructor/${sessionId}/monitor`} className="minerva-button">
            Learner progress
          </Link>
          <Link href={`/instructor/${sessionId}/report`} className="minerva-button minerva-button-secondary">
            Teaching brief
          </Link>
          <Link href={`/instructor/${sessionId}/misconceptions`} className="minerva-button minerva-button-secondary">
            Common misunderstandings
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── ReadingsSection ───────────────────────────────────────────────────────────

interface ReadingsSectionProps {
  open: boolean;
  onToggle: () => void;
  readings: FileInfo[];
  uiState: {
    dragActive: "reading" | "assessment" | null;
    uploadingCategory: "reading" | "assessment" | null;
    recentUploadCategory: "reading" | "assessment" | null;
    recentUploadName: string | null;
  };
  readingInputRef: React.RefObject<HTMLInputElement | null>;
  handlers: {
    onDrop: (e: React.DragEvent, category: "reading" | "assessment") => void;
    onDragOver: (e: React.DragEvent, category: "reading" | "assessment") => void;
    onDragLeave: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>, category: "reading" | "assessment") => void;
    onRemoveFile: (fileId: string, category: string) => void;
  };
}

export function ReadingsSection({
  open,
  onToggle,
  readings,
  uiState,
  readingInputRef,
  handlers,
}: ReadingsSectionProps) {
  const { dragActive, uploadingCategory, recentUploadCategory, recentUploadName } = uiState;

  return (
    <div className="minerva-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left md:p-8"
      >
        <div>
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Readings
          </h2>
          {!open && readings.length > 0 && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              {readings.length} reading{readings.length !== 1 ? "s" : ""} uploaded
            </p>
          )}
          {!open && readings.length === 0 && (
            <p className="mt-2 text-sm text-[#906f12]">No readings yet — upload to activate this session</p>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-4 px-6 pb-6 md:px-8 md:pb-8">
          <p className="text-sm text-[var(--dim-grey)]">
            Upload the reading students will be tutored on. PDF, DOCX, TXT, or Markdown. Up to 50MB.
          </p>

          {/* Drop zone */}
          <div
            onDrop={(e) => handlers.onDrop(e, "reading")}
            onDragOver={(e) => handlers.onDragOver(e, "reading")}
            onDragLeave={handlers.onDragLeave}
            className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragActive === "reading"
                ? "border-[var(--teal)] bg-[rgba(17,120,144,0.06)]"
                : "border-[var(--rule)] hover:border-[rgba(17,120,144,0.4)] hover:bg-[rgba(17,120,144,0.02)]"
            }`}
            onClick={() => readingInputRef.current?.click()}
          >
            {uploadingCategory === "reading" ? (
              <p className="text-sm text-[var(--dim-grey)]">Uploading…</p>
            ) : (
              <>
                <svg className="h-7 w-7 text-[var(--dim-grey)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-[var(--dim-grey)]">
                  <span className="font-medium text-[var(--teal)]">Click to upload</span> or drag and drop
                </p>
              </>
            )}
            <input
              ref={readingInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="sr-only"
              onChange={(e) => handlers.onFileChange(e, "reading")}
            />
          </div>

          {/* Recent upload banner */}
          {recentUploadCategory === "reading" && recentUploadName && (
            <p className="text-xs text-[var(--teal)]">✓ {recentUploadName} uploaded</p>
          )}

          {/* File list */}
          {readings.length > 0 && (
            <ul className="space-y-2">
              {readings.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--rule)] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon />
                    <span className="truncate text-sm text-[var(--charcoal)]">{file.filename}</span>
                  </div>
                  <button
                    onClick={() => handlers.onRemoveFile(file.id, "reading")}
                    className="flex-shrink-0 text-xs text-[var(--dim-grey)] hover:text-[var(--signal)]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QuestionsSection ──────────────────────────────────────────────────────────

interface Suggestion {
  prompt: string;
  processLevel: string;
  focusArea: string | null;
  rationale: string;
  qualityLabels: string[];
  expectations: string[];
  misconceptions: string[];
}

interface QuestionsSectionProps {
  open: boolean;
  onToggle: () => void;
  session: SessionDetails;
  readingsCount: number;
  checkpoints: CheckpointRecord[];
  uiState: {
    loadingCheckpoints: boolean;
    savingCheckpoint: boolean;
    generatingSuggestions: boolean;
    suggestions: Suggestion[];
    acceptingSuggestionIndex: number | null;
    editingCheckpointId: string | null;
    editingCheckpointPrompt: string;
    draggedCheckpointId: string | null;
    dragTargetCheckpointId: string | null;
    showQuestionSavedState: boolean;
    newCheckpointPrompt: string;
  };
  setEditingCheckpointPrompt: (value: string) => void;
  setNewCheckpointPrompt: (value: string) => void;
  actions: {
    onGenerateSuggestions: () => void;
    onAcceptSuggestion: (index: number) => void;
    onDismissSuggestion: (index: number) => void;
    onCreateCheckpoint: () => void;
    onDragStartCheckpoint: (id: string) => void;
    onDragOverCheckpoint: (e: React.DragEvent, id: string) => void;
    onDropCheckpoint: (id: string) => void;
    onEndDragCheckpoint: () => void;
    onStartEditingCheckpoint: (checkpoint: CheckpointRecord) => void;
    onCancelEditingCheckpoint: () => void;
    onSaveCheckpointEdit: (id: string) => void;
    onRemoveCheckpoint: (id: string) => void;
  };
}

export function QuestionsSection({
  open,
  onToggle,
  session,
  readingsCount,
  checkpoints,
  uiState,
  setEditingCheckpointPrompt,
  setNewCheckpointPrompt,
  actions,
}: QuestionsSectionProps) {
  const {
    loadingCheckpoints,
    savingCheckpoint,
    generatingSuggestions,
    suggestions,
    acceptingSuggestionIndex,
    editingCheckpointId,
    editingCheckpointPrompt,
    draggedCheckpointId,
    dragTargetCheckpointId,
    showQuestionSavedState,
    newCheckpointPrompt,
  } = uiState;

  const recommendedCount = Math.max(2, Math.floor((session.maxExchanges - 4) / 4));
  const tooMany = checkpoints.length > recommendedCount + 2;

  return (
    <div className="minerva-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left md:p-8"
      >
        <div>
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Key questions
          </h2>
          {!open && checkpoints.length > 0 && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              {checkpoints.length} question{checkpoints.length !== 1 ? "s" : ""}
            </p>
          )}
          {!open && checkpoints.length === 0 && (
            <p className="mt-2 text-sm text-[#906f12]">No questions yet — add 2–4 to guide the tutor</p>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-6 px-6 pb-6 md:px-8 md:pb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="max-w-[44rem] text-sm text-[var(--dim-grey)]">
              These guide what the tutor focuses on. Aim for {recommendedCount}–{recommendedCount + 1} questions that
              require interpretation, inference, or synthesis — not recall.
            </p>
            <button
              onClick={actions.onGenerateSuggestions}
              disabled={generatingSuggestions || readingsCount === 0}
              title={readingsCount === 0 ? "Upload a reading first" : undefined}
              className="minerva-button minerva-button-secondary flex-shrink-0 text-sm"
            >
              {generatingSuggestions ? "Generating…" : "Suggest from reading"}
            </button>
          </div>

          {tooMany && (
            <p className="text-xs text-[#906f12]">
              {checkpoints.length} questions for {session.maxExchanges} exchanges may be too many. Consider removing
              lower-priority questions or increasing the exchange limit.
            </p>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                Suggested questions — review and accept or dismiss
              </p>
              {suggestions.map((suggestion, index) => (
                <div
                  key={`suggestion-${index}`}
                  className="space-y-3 rounded-2xl border-2 border-dashed border-[rgba(17,120,144,0.28)] bg-[rgba(17,120,144,0.04)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
                          Suggestion {index + 1}
                        </span>
                        {suggestion.focusArea && (
                          <span className="rounded-full bg-[rgba(0,0,0,0.04)] px-2.5 py-1 text-[11px] font-medium text-[var(--dim-grey)]">
                            {suggestion.focusArea}
                          </span>
                        )}
                      </div>
                      <p className="max-w-[48rem] text-[15px] leading-7 text-[var(--charcoal)]">
                        {suggestion.prompt}
                      </p>
                      {suggestion.rationale && (
                        <p className="text-xs text-[var(--dim-grey)]">{suggestion.rationale}</p>
                      )}
                      {suggestion.expectations.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                            Expected evidence
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                            {suggestion.expectations.map((e, i) => (
                              <li key={i}>— {e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {suggestion.misconceptions.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                            Likely misreadings
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                            {suggestion.misconceptions.map((m, i) => (
                              <li key={i}>— {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        onClick={() => actions.onAcceptSuggestion(index)}
                        disabled={acceptingSuggestionIndex === index}
                        className="minerva-button text-sm"
                      >
                        {acceptingSuggestionIndex === index ? "Adding…" : "Accept"}
                      </button>
                      <button
                        onClick={() => actions.onDismissSuggestion(index)}
                        className="minerva-button minerva-button-secondary text-sm"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Existing checkpoints */}
          {loadingCheckpoints ? (
            <p className="text-sm text-[var(--dim-grey)]">Loading questions…</p>
          ) : checkpoints.length > 0 ? (
            <ul className="space-y-2">
              {checkpoints.map((checkpoint, index) => (
                <li
                  key={checkpoint.id}
                  draggable
                  onDragStart={() => actions.onDragStartCheckpoint(checkpoint.id)}
                  onDragOver={(e) => actions.onDragOverCheckpoint(e, checkpoint.id)}
                  onDrop={() => actions.onDropCheckpoint(checkpoint.id)}
                  onDragEnd={actions.onEndDragCheckpoint}
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    draggedCheckpointId === checkpoint.id
                      ? "opacity-40"
                      : dragTargetCheckpointId === checkpoint.id && draggedCheckpointId !== checkpoint.id
                        ? "border-[var(--teal)] bg-[rgba(17,120,144,0.04)]"
                        : "border-[var(--rule)] bg-white"
                  }`}
                >
                  {editingCheckpointId === checkpoint.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingCheckpointPrompt}
                        onChange={(e) => setEditingCheckpointPrompt(e.target.value)}
                        rows={3}
                        className="minerva-input w-full resize-none text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => actions.onSaveCheckpointEdit(checkpoint.id)}
                          disabled={savingCheckpoint}
                          className="minerva-button text-sm"
                        >
                          {savingCheckpoint ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={actions.onCancelEditingCheckpoint}
                          className="minerva-button minerva-button-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex-shrink-0 text-xs font-semibold text-[var(--dim-grey)]">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-6 text-[var(--charcoal)]">{checkpoint.prompt}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          onClick={() => actions.onStartEditingCheckpoint(checkpoint)}
                          className="text-xs text-[var(--dim-grey)] hover:text-[var(--teal)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => actions.onRemoveCheckpoint(checkpoint.id)}
                          className="text-xs text-[var(--dim-grey)] hover:text-[var(--signal)]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Add new checkpoint */}
          <div className="space-y-3 border-t border-[var(--rule)] pt-5">
            <label className="minerva-label">Add a question</label>
            <textarea
              value={newCheckpointPrompt}
              onChange={(e) => setNewCheckpointPrompt(e.target.value)}
              placeholder="e.g. What does Meadows mean by 'system behavior is intrinsic'?"
              rows={3}
              className="minerva-input w-full resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  actions.onCreateCheckpoint();
                }
              }}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={actions.onCreateCheckpoint}
                disabled={savingCheckpoint || !newCheckpointPrompt.trim()}
                className="minerva-button text-sm"
              >
                {savingCheckpoint ? "Adding…" : "Add question"}
              </button>
              {showQuestionSavedState && (
                <p className="text-xs text-[var(--teal)]">Question added.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TeachingContextSection ────────────────────────────────────────────────────

interface TeachingContextSectionProps {
  open: boolean;
  onToggle: () => void;
  session: SessionDetails;
  setSession: React.Dispatch<React.SetStateAction<SessionDetails | null>>;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  readingsCount: number;
  uiState: {
    showAdvanced: boolean;
    generatingMap: boolean;
    savingConfig: boolean;
    showSavedState: boolean;
    configSavedAt: Date | null;
  };
  actions: {
    onGenerateSuggestedMap: () => void;
    onSaveTeachingContext: () => void;
  };
  recommendedCheckpoints: number;
  formatSavedTime: (date: Date) => string;
}

export function TeachingContextSection({
  open,
  onToggle,
  session,
  setSession,
  setShowAdvanced,
  readingsCount,
  uiState,
  actions,
  formatSavedTime,
}: TeachingContextSectionProps) {
  const { showAdvanced, generatingMap, savingConfig, showSavedState, configSavedAt } = uiState;
  const isConfigured = !!(session.courseContext || session.learningGoal || session.learningOutcomes);

  function updateSession(updates: Partial<SessionDetails>) {
    setSession((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  return (
    <div className="minerva-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left md:p-8"
      >
        <div>
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Teaching context
          </h2>
          {!open && isConfigured && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">Configured</p>
          )}
          {!open && !isConfigured && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">Not yet configured</p>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-8 px-6 pb-8 md:px-8">
          {/* Session Purpose Selector */}
          <div className="space-y-3">
            <div>
              <label className="minerva-label">Session purpose</label>
              <p className="mt-0.5 mb-3 text-xs text-[var(--dim-grey)]">
                When will students use this session? The tutor adapts its questioning strategy and cognitive target
                based on this.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SESSION_PURPOSE_OPTIONS.map((option) => {
                const isSelected = session.sessionPurpose === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSession({ sessionPurpose: option.value })}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-[var(--teal)] bg-[rgba(17,120,144,0.06)]"
                        : "border-[var(--rule)] hover:border-[rgba(17,120,144,0.3)] hover:bg-[rgba(17,120,144,0.02)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(option.value)}`}
                      >
                        {option.shortLabel}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dim-grey)]">
                        {option.cognitiveLevel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-[var(--charcoal)]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Course context */}
          <div className="space-y-2">
            <label className="minerva-label" htmlFor="courseContext">
              Where this fits in your course
            </label>
            <p className="text-xs text-[var(--dim-grey)]">
              Optional. Helps the tutor connect this reading to larger course themes and prior sessions.
            </p>
            <textarea
              id="courseContext"
              value={session.courseContext ?? ""}
              onChange={(e) => updateSession({ courseContext: e.target.value || null })}
              placeholder="e.g. Week 4 of Systems Thinking. Students have covered feedback loops and delays."
              rows={3}
              className="minerva-input w-full resize-none text-sm"
            />
          </div>

          {/* Session goal */}
          <div className="space-y-2">
            <label className="minerva-label" htmlFor="learningGoal">
              Session goal
            </label>
            <p className="text-xs text-[var(--dim-grey)]">
              The overarching understanding you&apos;re building toward. Shapes how the tutor opens and closes the
              session.
            </p>
            <textarea
              id="learningGoal"
              value={session.learningGoal ?? ""}
              onChange={(e) => updateSession({ learningGoal: e.target.value || null })}
              placeholder="e.g. Understand how system structure drives behavior — not external events."
              rows={3}
              className="minerva-input w-full resize-none text-sm"
            />
          </div>

          {/* Learning outcomes */}
          <div className="space-y-2">
            <label className="minerva-label" htmlFor="learningOutcomes">
              Learning outcomes to assess
            </label>
            <p className="text-xs text-[var(--dim-grey)]">
              The specific skills or understandings you want to track. The tutor will assess each learner against
              these and include formative ratings in the teaching brief.
            </p>
            <textarea
              id="learningOutcomes"
              value={session.learningOutcomes ?? ""}
              onChange={(e) => updateSession({ learningOutcomes: e.target.value || null })}
              placeholder={"1. Explain how feedback loops sustain system behavior.\n2. Distinguish between event-level and structural explanations."}
              rows={4}
              className="minerva-input w-full resize-none text-sm"
            />
          </div>

          {/* Advanced settings */}
          <div className="border-t border-[var(--rule)] pt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)] hover:text-[var(--charcoal)]"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="mt-6 space-y-6">
                {/* Tutor stance */}
                <div className="space-y-2">
                  <label className="minerva-label">Tutor stance</label>
                  <p className="text-xs text-[var(--dim-grey)]">
                    Directed: formal authority guiding comprehension. Mentor: collaborative inquiry, suited for
                    professional learners.
                  </p>
                  <div className="flex gap-3">
                    {(["directed", "mentor"] as const).map((stance) => (
                      <button
                        key={stance}
                        type="button"
                        onClick={() => updateSession({ stance })}
                        className={`rounded-xl border px-4 py-2 text-sm capitalize transition-colors ${
                          session.stance === stance
                            ? "border-[var(--teal)] bg-[rgba(17,120,144,0.06)] text-[var(--teal)]"
                            : "border-[var(--rule)] text-[var(--charcoal)] hover:border-[rgba(17,120,144,0.3)]"
                        }`}
                      >
                        {stance}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max exchanges */}
                <div className="space-y-2">
                  <label className="minerva-label" htmlFor="maxExchanges">
                    Max exchanges
                  </label>
                  <p className="text-xs text-[var(--dim-grey)]">
                    The session ends after this many back-and-forth turns. Default 20 (~15 min).
                  </p>
                  <input
                    id="maxExchanges"
                    type="number"
                    min={4}
                    max={100}
                    value={session.maxExchanges}
                    onChange={(e) => updateSession({ maxExchanges: Number(e.target.value) })}
                    className="minerva-input w-32 text-sm"
                  />
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="minerva-label" htmlFor="opensAt">
                      Opens at
                    </label>
                    <input
                      id="opensAt"
                      type="datetime-local"
                      value={session.opensAt ? session.opensAt.slice(0, 16) : ""}
                      onChange={(e) => updateSession({ opensAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="minerva-input w-full text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="minerva-label" htmlFor="closesAt">
                      Closes at
                    </label>
                    <input
                      id="closesAt"
                      type="datetime-local"
                      value={session.closesAt ? session.closesAt.slice(0, 16) : ""}
                      onChange={(e) => updateSession({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="minerva-input w-full text-sm"
                    />
                  </div>
                </div>

                {/* Prerequisite map */}
                {readingsCount > 0 && (
                  <div className="space-y-2">
                    <label className="minerva-label">Prerequisite concept map</label>
                    <p className="text-xs text-[var(--dim-grey)]">
                      JSON map of concept dependencies. The tutor checks prerequisites before advancing topics.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={actions.onGenerateSuggestedMap}
                        disabled={generatingMap}
                        className="minerva-button minerva-button-secondary text-sm"
                      >
                        {generatingMap ? "Generating…" : "Generate from reading"}
                      </button>
                    </div>
                    {session.prerequisiteMap && (
                      <textarea
                        value={session.prerequisiteMap}
                        onChange={(e) => updateSession({ prerequisiteMap: e.target.value || null })}
                        rows={6}
                        className="minerva-input w-full resize-y font-mono text-xs"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4 border-t border-[var(--rule)] pt-6">
            <button
              onClick={actions.onSaveTeachingContext}
              disabled={savingConfig}
              className="minerva-button"
            >
              {savingConfig ? "Saving…" : "Save settings"}
            </button>
            {showSavedState && configSavedAt && (
              <p className="text-xs text-[var(--teal)]">Saved at {formatSavedTime(configSavedAt)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AssessmentsSection ────────────────────────────────────────────────────────

interface AssessmentsSectionProps {
  open: boolean;
  onToggle: () => void;
  assessments: FileInfo[];
  uiState: {
    dragActive: "reading" | "assessment" | null;
    uploadingCategory: "reading" | "assessment" | null;
    recentUploadCategory: "reading" | "assessment" | null;
    recentUploadName: string | null;
  };
  assessmentInputRef: React.RefObject<HTMLInputElement>;
  handlers: {
    onDrop: (e: React.DragEvent, category: "reading" | "assessment") => void;
    onDragOver: (e: React.DragEvent, category: "reading" | "assessment") => void;
    onDragLeave: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>, category: "reading" | "assessment") => void;
    onRemoveFile: (fileId: string, category: string) => void;
  };
}

export function AssessmentsSection({
  open,
  onToggle,
  assessments,
  uiState,
  assessmentInputRef,
  handlers,
}: AssessmentsSectionProps) {
  const { dragActive, uploadingCategory, recentUploadCategory, recentUploadName } = uiState;

  return (
    <div className="minerva-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left md:p-8"
      >
        <div>
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Assessments
          </h2>
          {!open && assessments.length > 0 && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              {assessments.length} assessment{assessments.length !== 1 ? "s" : ""} uploaded
            </p>
          )}
          {!open && assessments.length === 0 && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">Optional — protects your assessment answers</p>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-4 px-6 pb-6 md:px-8 md:pb-8">
          <p className="text-sm text-[var(--dim-grey)]">
            Upload your assessment or exam questions. The tutor will coach students without revealing the answers.
            Optional.
          </p>

          {/* Drop zone */}
          <div
            onDrop={(e) => handlers.onDrop(e, "assessment")}
            onDragOver={(e) => handlers.onDragOver(e, "assessment")}
            onDragLeave={handlers.onDragLeave}
            className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragActive === "assessment"
                ? "border-[var(--teal)] bg-[rgba(17,120,144,0.06)]"
                : "border-[var(--rule)] hover:border-[rgba(17,120,144,0.4)] hover:bg-[rgba(17,120,144,0.02)]"
            }`}
            onClick={() => assessmentInputRef.current?.click()}
          >
            {uploadingCategory === "assessment" ? (
              <p className="text-sm text-[var(--dim-grey)]">Uploading…</p>
            ) : (
              <>
                <svg className="h-7 w-7 text-[var(--dim-grey)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-[var(--dim-grey)]">
                  <span className="font-medium text-[var(--teal)]">Click to upload</span> or drag and drop
                </p>
              </>
            )}
            <input
              ref={assessmentInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="sr-only"
              onChange={(e) => handlers.onFileChange(e, "assessment")}
            />
          </div>

          {recentUploadCategory === "assessment" && recentUploadName && (
            <p className="text-xs text-[var(--teal)]">✓ {recentUploadName} uploaded</p>
          )}

          {assessments.length > 0 && (
            <ul className="space-y-2">
              {assessments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--rule)] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon />
                    <span className="truncate text-sm text-[var(--charcoal)]">{file.filename}</span>
                  </div>
                  <button
                    onClick={() => handlers.onRemoveFile(file.id, "assessment")}
                    className="flex-shrink-0 text-xs text-[var(--dim-grey)] hover:text-[var(--signal)]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
