"use client";

import React from "react";
import Link from "next/link";
import { LoadingState } from "@/components/ui/loading-state";
import {
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

function getPurposeLinks(sessionId: string, purpose: string) {
  const monitor = { href: `/instructor/${sessionId}/monitor`, label: "Learner progress" };
  const misconceptions = { href: `/instructor/${sessionId}/misconceptions`, label: "Misconceptions" };
  const report = { href: `/instructor/${sessionId}/report`, label: "Instructor Recommendations" };

  switch (purpose) {
    case "during_class_prep":
      return [monitor, misconceptions, report];
    case "during_class_reflection":
      return [misconceptions, monitor, report];
    case "after_class":
      return [report, misconceptions, monitor];
    case "pre_class":
    default:
      return [report, misconceptions, monitor];
  }
}

export function WorkspaceHeader({ sessionId, session, isActive, setupStep }: WorkspaceHeaderProps) {
  const purposeOption = getSessionPurposeOption(session.sessionPurpose);
  const links = getPurposeLinks(sessionId, session.sessionPurpose);

  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
            <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
              Sessions
            </Link>
            <span>/</span>
            <span className="text-[var(--charcoal)]">Setup</span>
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
                {setupStep === 2 ? "Add source materials" : setupStep === 3 ? "Define outcomes" : "Share with learners"}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="minerva-button minerva-button-secondary text-sm"
              >
                {link.label}
              </Link>
            ))}
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

 export function StatusBar({ learnerCount, readingsCount, assessmentsCount, checkpointsCount, purposeLabel }: StatusBarProps & { checkpointsCount: number, purposeLabel: string }) {
  return (
    <div className="border border-[var(--rule)] bg-[rgba(17,120,144,0.04)] px-6 py-3 text-sm text-[var(--dim-grey)]">
      Status: {readingsCount} reading{readingsCount !== 1 ? "s" : ""}, {checkpointsCount} key question{checkpointsCount !== 1 ? "s" : ""}, {assessmentsCount} assignment{assessmentsCount !== 1 ? "s" : ""}. AI tutor set to {purposeLabel}.
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
  const learnerUrl = typeof window !== "undefined"
    ? `${window.location.origin}/s/${session.accessCode}`
    : `/s/${session.accessCode}`;

  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow eyebrow-teal">Learner link</p>
          <p className="mt-2 font-mono text-base text-[var(--charcoal)]">{learnerUrl}</p>
          {!isActive && (
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              Upload source materials to activate the AI Tutor before sharing.
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

// ─── SessionInsightsCard (purpose-aware) ──────────────────────────────────────

interface LiveLearnerStatus {
  id: string;
  studentName: string;
  hasRecentEngagementConcern: boolean;
  latestEngagementFlag: string | null;
  isWaitingForStudentReply: boolean;
  secondsSinceLastMessage: number | null;
  endedAt: string | Date | null;
}

interface SessionInsightsCardProps {
  sessionId: string;
  sessionPurpose: string;
  learnerCount: number;
  liveStatus: LiveLearnerStatus[];
}

function isLiveMode(purpose: string) {
  return purpose === "during_class_prep" || purpose === "during_class_reflection";
}

export function SessionInsightsCard({
  sessionId,
  sessionPurpose,
  learnerCount,
  liveStatus,
}: SessionInsightsCardProps) {
  const live = isLiveMode(sessionPurpose);
  const links = getPurposeLinks(sessionId, sessionPurpose);
  const primary = links[0];

  if (live) {
    const activeLearners = liveStatus.filter((l) => !l.endedAt);
    const completedLearners = liveStatus.filter((l) => l.endedAt);
    const concernCount = activeLearners.filter((l) => l.hasRecentEngagementConcern).length;
    const waitingLong = activeLearners.filter(
      (l) => l.isWaitingForStudentReply && (l.secondsSinceLastMessage ?? 0) > 180
    ).length;
    const hasConcerns = concernCount > 0 || waitingLong > 0;

    return (
      <div className="minerva-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--rule)] px-6 py-4 md:px-8">
          <span
            className={`h-2.5 w-2.5 rounded-full ${hasConcerns ? "bg-[#906f12]" : "bg-[var(--teal)]"}`}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
            Real-time monitoring
          </p>
        </div>

        <div className="px-6 py-5 md:px-8">
          {/* Stats row */}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
                {activeLearners.length}
              </p>
              <p className="mt-1 text-xs text-[var(--dim-grey)]">
                active now
              </p>
            </div>
            {completedLearners.length > 0 && (
              <div>
                <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
                  {completedLearners.length}
                </p>
                <p className="mt-1 text-xs text-[var(--dim-grey)]">
                  completed
                </p>
              </div>
            )}
            {concernCount > 0 && (
              <div>
                <p className="text-[28px] font-bold leading-none text-[#906f12]">
                  {concernCount}
                </p>
                <p className="mt-1 text-xs text-[var(--dim-grey)]">
                  engagement concern{concernCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            {waitingLong > 0 && (
              <div>
                <p className="text-[28px] font-bold leading-none text-[var(--dim-grey)]">
                  {waitingLong}
                </p>
                <p className="mt-1 text-xs text-[var(--dim-grey)]">
                  waiting 3+ min
                </p>
              </div>
            )}
          </div>

          {/* Alert banner */}
          {hasConcerns && (
            <div className="mt-4 rounded-lg border border-[rgba(144,111,18,0.2)] bg-[rgba(144,111,18,0.06)] px-4 py-3">
              <p className="text-sm text-[var(--charcoal)]">
                {concernCount > 0 && (
                  <span className="font-medium text-[#906f12]">
                    {concernCount} learner{concernCount !== 1 ? "s" : ""} showing
                    engagement concerns.{" "}
                  </span>
                )}
                {waitingLong > 0 && (
                  <span className="text-[var(--dim-grey)]">
                    {waitingLong} waiting 3+ minutes for a reply.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Purpose-ordered CTAs */}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={primary.href} className="minerva-button">
              {primary.label}
            </Link>
            {links.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="minerva-button minerva-button-secondary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Review mode (pre-class / after-class) ──

  const completed = liveStatus.filter((l) => l.endedAt).length;
  const total = liveStatus.length;
  const participationLabel =
    sessionPurpose === "pre_class"
      ? "Learner readiness"
      : "Learning outcome summary";
  const contextLine =
    sessionPurpose === "pre_class"
      ? "Identify readiness and misconceptions before class began."
      : "Review how learners translated understanding into application.";

  return (
    <div className="minerva-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--rule)] px-6 py-4 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
          {participationLabel}
        </p>
      </div>

      <div className="px-6 py-5 md:px-8">
        {/* Participation health check */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
              {total}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              learner{total !== 1 ? "s" : ""} participated
            </p>
          </div>
          <div>
            <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
              {completed}
            </p>
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              completed
            </p>
          </div>
          {total - completed > 0 && (
            <div>
              <p className="text-[28px] font-bold leading-none text-[var(--dim-grey)]">
                {total - completed}
              </p>
              <p className="mt-1 text-xs text-[var(--dim-grey)]">
                still in progress
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-[var(--dim-grey)]">{contextLine}</p>

        {/* Purpose-ordered CTAs */}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={primary.href} className="minerva-button">
            {primary.label}
          </Link>
          {links.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="minerva-button minerva-button-secondary"
            >
              {link.label}
            </Link>
          ))}
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
            Source Materials
          </h2>
          {!open && readings.length > 0 && (
            <p className="mt-2 text-sm text-[var(--dim-grey)]">
              {readings.length} source file{readings.length !== 1 ? "s" : ""} uploaded
            </p>
          )}
          {!open && readings.length === 0 && (
            <p className="mt-2 text-sm text-[#906f12]">No source materials yet — upload to activate the AI Tutor</p>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-4 px-6 pb-6 md:px-8 md:pb-8">
          <p className="text-sm text-[var(--dim-grey)]">
            Ground the AI conversation in your primary materials. PDF, DOCX, TXT, or Markdown. Up to 50MB.
          </p>
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
              <LoadingState message="Uploading…" />
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
            Key Questions
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
            <button
              onClick={actions.onGenerateSuggestions}
              disabled={generatingSuggestions || readingsCount === 0}
              title={readingsCount === 0 ? "Upload source materials first" : undefined}
              className="minerva-button minerva-button-secondary flex-shrink-0 text-sm"
            >
                {generatingSuggestions ? (
                  <LoadingState variant="button" message="Generating" />
                ) : (
                  "Suggest from material"
                )}
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <label className="minerva-label">Choose 1-3 questions that will guide what the AI tutor focuses on. Aim for questions that require interpretation, inference, or synthesis - not merely recall.</label>
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
                Suggested questions - review then accept or dismiss
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
                        {acceptingSuggestionIndex === index ? (
                          <LoadingState variant="button" message="Adding" />
                        ) : (
                          "Accept"
                        )}
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
            <LoadingState message="Loading questions…" />
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
                          {savingCheckpoint ? (
                            <LoadingState variant="button" message="Saving" />
                          ) : (
                            "Save"
                          )}
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
            <label className="minerva-label">Design your own question below</label>
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
                {savingCheckpoint ? (
                  <LoadingState variant="button" message="Adding" />
                ) : (
                  "Add question"
                )}
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
          {/* Course context */}
          <div className="space-y-2">
            <label className="minerva-label" htmlFor="courseContext">
              Where this session fits in your course
            </label>
            <p className="text-xs text-[var(--dim-grey)]">
              Optional. Helps the tutor connect to larger course themes and prior sessions.
            </p>
            <textarea
              id="courseContext"
              value={session.courseContext ?? ""}
              onChange={(e) => updateSession({ courseContext: e.target.value || null })}
              placeholder="e.g. Week 4 of Systems Thinking. Learners have covered feedback loops and delays."
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
              placeholder={"#system-analysis: Observe and deconstruct systems into constituent parts to explain the characteristics, and relationships among, those parts at multiple levels of analysis"}
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
                    Directed: guides learners through questions with clear authority. Mentor: more collaborative inquiry, suited for experienced or professional learners.
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
                    <label className="minerva-label">Foundational concept map</label>
                    <p className="text-xs text-[var(--dim-grey)]">
                      Identify the concepts learners must understand to master this reading. Helps the AI identify the &quot;illusion of competence.&quot;
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={actions.onGenerateSuggestedMap}
                        disabled={generatingMap}
                        className="minerva-button minerva-button-secondary text-sm"
                      >
                        {generatingMap ? (
                          <LoadingState variant="button" message="Generating" />
                        ) : (
                          "Generate from material"
                        )}
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
              {savingConfig ? (
                <LoadingState variant="button" message="Saving" />
              ) : (
                "Save settings"
              )}
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
  assessmentInputRef: React.RefObject<HTMLInputElement | null>;
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
            Upload your assessment or exam questions. The tutor will coach learners without revealing the answers.
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
              <LoadingState message="Uploading…" />
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
