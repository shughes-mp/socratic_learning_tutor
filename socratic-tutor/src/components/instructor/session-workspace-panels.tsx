"use client";

import Link from "next/link";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { StepIndicator } from "@/components/ui/step-indicator";
import type { CheckpointRecord, FileInfo, SessionDetails } from "@/types";

export interface QuestionSuggestion {
  prompt: string;
  processLevel: string;
  focusArea: string | null;
  rationale: string;
  qualityLabels: string[];
  expectations: string[];
  misconceptions: string[];
}

type UploadCategory = "reading" | "assessment";
type UploadHandlers = {
  onDrop: (event: React.DragEvent, category: UploadCategory) => void;
  onDragOver: (event: React.DragEvent, category: UploadCategory) => void;
  onDragLeave: () => void;
  onFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    category: UploadCategory
  ) => void;
  onRemoveFile: (fileId: string, category: string) => void | Promise<void>;
};

type UploadUiState = {
  dragActive: UploadCategory | null;
  uploadingCategory: UploadCategory | null;
  recentUploadCategory: UploadCategory | null;
  recentUploadName: string | null;
};

type QuestionActions = {
  onGenerateSuggestions: () => void | Promise<void>;
  onAcceptSuggestion: (index: number) => void | Promise<void>;
  onDismissSuggestion: (index: number) => void;
  onCreateCheckpoint: () => void | Promise<void>;
  onDragStartCheckpoint: (checkpointId: string) => void;
  onDragOverCheckpoint: (event: React.DragEvent, checkpointId: string) => void;
  onDropCheckpoint: (checkpointId: string) => void | Promise<void>;
  onEndDragCheckpoint: () => void;
  onStartEditingCheckpoint: (checkpoint: CheckpointRecord) => void;
  onCancelEditingCheckpoint: () => void;
  onSaveCheckpointEdit: (checkpointId: string) => void | Promise<void>;
  onRemoveCheckpoint: (checkpointId: string) => void | Promise<void>;
};

type QuestionUiState = {
  loadingCheckpoints: boolean;
  savingCheckpoint: boolean;
  generatingSuggestions: boolean;
  suggestions: QuestionSuggestion[];
  acceptingSuggestionIndex: number | null;
  editingCheckpointId: string | null;
  editingCheckpointPrompt: string;
  draggedCheckpointId: string | null;
  dragTargetCheckpointId: string | null;
  showQuestionSavedState: boolean;
  newCheckpointPrompt: string;
};

type TeachingContextActions = {
  onGenerateSuggestedMap: () => void | Promise<void>;
  onSaveTeachingContext: () => void | Promise<void>;
};

type TeachingContextUiState = {
  showAdvanced: boolean;
  generatingMap: boolean;
  savingConfig: boolean;
  showSavedState: boolean;
  configSavedAt: Date | null;
};

function CollapsibleSection(props: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const { title, description, open, onToggle, summary, children } = props;

  return (
    <div className="minerva-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left md:p-8"
      >
        <div>
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-[42rem] text-sm leading-6 text-[var(--dim-grey)]">
              {description}
            </p>
          ) : null}
          {!open && summary ? <div className="mt-2">{summary}</div> : null}
        </div>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-[var(--dim-grey)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? <div className="space-y-5 px-6 pb-6 md:px-8 md:pb-8">{children}</div> : null}
    </div>
  );
}

export function WorkspaceHeader(props: {
  sessionId: string;
  session: SessionDetails;
  isActive: boolean;
  setupStep: 2 | 3 | 4 | null;
}) {
  const { sessionId, session, isActive, setupStep } = props;

  return (
    <div className="minerva-card p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
            <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
              Sessions
            </Link>
            <span>/</span>
            <span className="text-[var(--charcoal)]">{session.name}</span>
          </nav>
          <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
            {session.name}
          </h1>
          {session.description ? (
            <p className="mt-3 max-w-[36rem] text-[15px] leading-7 text-[var(--dim-grey)]">
              {session.description}
            </p>
          ) : null}
          {setupStep !== null ? (
            <div className="mt-4">
              <StepIndicator currentStep={setupStep} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
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
            Teaching brief
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
  );
}

export function StatusBar(props: {
  learnerCount: number;
  readingsCount: number;
  assessmentsCount: number;
}) {
  const { learnerCount, readingsCount, assessmentsCount } = props;
  const inactive = readingsCount === 0;

  return (
    <div
      className={`px-4 py-3 text-sm ${
        inactive
          ? "border border-[rgba(144,111,18,0.22)] bg-[rgba(144,111,18,0.08)] text-[#906f12]"
          : "border border-[rgba(17,120,144,0.18)] bg-[rgba(17,120,144,0.08)] text-[var(--teal)]"
      }`}
    >
      {inactive
        ? "Upload at least one reading to activate this session."
        : learnerCount === 0
          ? `Ready: ${readingsCount} reading${readingsCount !== 1 ? "s" : ""}, ${assessmentsCount} assessment${assessmentsCount !== 1 ? "s" : ""} uploaded. No learners yet.`
          : `Active: ${learnerCount} learner${learnerCount !== 1 ? "s" : ""} connected. ${readingsCount} reading${readingsCount !== 1 ? "s" : ""}, ${assessmentsCount} assessment${assessmentsCount !== 1 ? "s" : ""}.`}
    </div>
  );
}

export function AccessCodeCard(props: {
  session: SessionDetails;
  isActive: boolean;
  copied: boolean;
  onCopyLink: () => void | Promise<void>;
}) {
  const { session, isActive, copied, onCopyLink } = props;

  return (
    <div className="minerva-card p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className={`eyebrow ${isActive ? "eyebrow-teal" : "eyebrow-rose"}`}>
            {isActive ? "Access Code" : "Access Code - Not yet active"}
          </p>
          <p
            className={`mt-1 text-lg font-mono font-semibold ${
              isActive
                ? "text-[var(--charcoal)]"
                : "select-none text-[var(--dim-grey)] blur-[3px]"
            }`}
          >
            {session.accessCode}
          </p>
          {!isActive ? (
            <p className="mt-1 text-xs text-[var(--dim-grey)]">
              Upload at least one reading below to activate this session.
            </p>
          ) : null}
        </div>
        {isActive ? (
          <button onClick={onCopyLink} className="minerva-button">
            {copied ? "Copied" : "Copy learner link"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ActiveMonitoringCard(props: {
  sessionId: string;
  learnerCount: number;
}) {
  const { sessionId, learnerCount } = props;

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
          <Link
            href={`/instructor/${sessionId}/report`}
            className="minerva-button minerva-button-secondary"
          >
            Teaching brief
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
  );
}

export function ReadingsSection(props: {
  open: boolean;
  onToggle: () => void;
  readings: FileInfo[];
  uiState: UploadUiState;
  readingInputRef: RefObject<HTMLInputElement | null>;
  handlers: UploadHandlers;
}) {
  const {
    open,
    onToggle,
    readings,
    uiState,
    readingInputRef,
    handlers,
  } = props;
  const { dragActive, uploadingCategory, recentUploadCategory, recentUploadName } = uiState;
  const { onDrop, onDragOver, onDragLeave, onFileChange, onRemoveFile } = handlers;

  return (
    <CollapsibleSection
      title="Readings"
      open={open}
      onToggle={onToggle}
      summary={
        readings.length > 0 ? (
          <p className="text-sm text-[var(--dim-grey)]">
            {readings.length} reading{readings.length !== 1 ? "s" : ""} uploaded
          </p>
        ) : (
          <p className="text-sm text-[#906f12]">
            No reading yet - upload one to activate the tutor
          </p>
        )
      }
    >
      <div
        onDrop={(event) => onDrop(event, "reading")}
        onDragOver={(event) => onDragOver(event, "reading")}
        onDragLeave={onDragLeave}
        onClick={() => readingInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive === "reading"
            ? "border-[var(--teal)] bg-[rgba(17,120,144,0.08)]"
            : "border-[var(--light-grey)] hover:border-[var(--teal)] hover:bg-[rgba(255,255,255,0.55)]"
        }`}
      >
        <input
          ref={readingInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(event) => onFileChange(event, "reading")}
          className="hidden"
        />
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
        {recentUploadCategory === "reading" && recentUploadName ? (
          <p className="mt-3 text-xs font-medium text-[var(--teal)]">
            Uploaded: {recentUploadName}
          </p>
        ) : null}
      </div>

      {readings.length > 0 ? (
        <div className="space-y-2">
          {readings.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between border p-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--charcoal)]">
                  {file.filename}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--dim-grey)]">{file.preview}</p>
              </div>
              <button
                onClick={() => onRemoveFile(file.id, "reading")}
                className="minerva-button minerva-button-secondary ml-4"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function QuestionSuggestionCard(props: {
  suggestion: QuestionSuggestion;
  index: number;
  acceptingSuggestionIndex: number | null;
  onAcceptSuggestion: (index: number) => void | Promise<void>;
  onDismissSuggestion: (index: number) => void;
}) {
  const { suggestion, index, acceptingSuggestionIndex, onAcceptSuggestion, onDismissSuggestion } = props;

  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-[rgba(17,120,144,0.28)] bg-[rgba(17,120,144,0.04)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
            Suggestion {index + 1}
          </span>
          <p className="max-w-[48rem] text-[15px] leading-7 text-[var(--charcoal)]">
            {suggestion.prompt}
          </p>
          <p className="max-w-[42rem] text-sm leading-6 text-[var(--dim-grey)]">
            {suggestion.rationale}
          </p>
          {suggestion.expectations.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                Expected evidence
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                {suggestion.expectations.map((expectation) => (
                  <li key={expectation}>- {expectation}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {suggestion.misconceptions.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                Likely misreadings
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--dim-grey)]">
                {suggestion.misconceptions.map((misconception) => (
                  <li key={misconception}>- {misconception}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={() => onAcceptSuggestion(index)}
            disabled={acceptingSuggestionIndex === index}
            className="minerva-button"
          >
            {acceptingSuggestionIndex === index ? "Adding..." : "Accept"}
          </button>
          <button
            onClick={() => onDismissSuggestion(index)}
            className="minerva-button minerva-button-secondary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckpointCard(props: {
  checkpoint: CheckpointRecord;
  index: number;
  isEditing: boolean;
  editingCheckpointPrompt: string;
  setEditingCheckpointPrompt: Dispatch<SetStateAction<string>>;
  savingCheckpoint: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStartCheckpoint: (checkpointId: string) => void;
  onDragOverCheckpoint: (event: React.DragEvent, checkpointId: string) => void;
  onDropCheckpoint: (checkpointId: string) => void | Promise<void>;
  onEndDragCheckpoint: () => void;
  onStartEditingCheckpoint: (checkpoint: CheckpointRecord) => void;
  onCancelEditingCheckpoint: () => void;
  onSaveCheckpointEdit: (checkpointId: string) => void | Promise<void>;
  onRemoveCheckpoint: (checkpointId: string) => void | Promise<void>;
}) {
  const {
    checkpoint,
    index,
    isEditing,
    editingCheckpointPrompt,
    setEditingCheckpointPrompt,
    savingCheckpoint,
    isDragging,
    isDropTarget,
    onDragStartCheckpoint,
    onDragOverCheckpoint,
    onDropCheckpoint,
    onEndDragCheckpoint,
    onStartEditingCheckpoint,
    onCancelEditingCheckpoint,
    onSaveCheckpointEdit,
    onRemoveCheckpoint,
  } = props;

  return (
    <div
      draggable={!isEditing && !savingCheckpoint}
      onDragStart={() => onDragStartCheckpoint(checkpoint.id)}
      onDragOver={(event) => onDragOverCheckpoint(event, checkpoint.id)}
      onDrop={() => onDropCheckpoint(checkpoint.id)}
      onDragEnd={onEndDragCheckpoint}
      className={`space-y-4 rounded-2xl border bg-[rgba(255,255,255,0.62)] p-4 transition-all ${
        isDropTarget
          ? "border-[var(--teal)] shadow-[0_0_0_2px_rgba(17,120,144,0.12)]"
          : "border-[var(--rule)]"
      } ${isDragging ? "cursor-grabbing opacity-60" : "cursor-grab"}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
              Question {index + 1}
            </span>
            {!isEditing ? (
              <span className="text-xs text-[var(--dim-grey)]">Drag to reorder</span>
            ) : null}
          </div>

          {isEditing ? (
            <textarea
              value={editingCheckpointPrompt}
              onChange={(event) => setEditingCheckpointPrompt(event.target.value)}
              rows={4}
              className="minerva-textarea"
            />
          ) : (
            <p className="max-w-[48rem] text-[15px] leading-7 text-[var(--charcoal)]">
              {checkpoint.prompt}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => onSaveCheckpointEdit(checkpoint.id)}
                disabled={savingCheckpoint}
                className="minerva-button"
              >
                {savingCheckpoint ? "Saving..." : "Save"}
              </button>
              <button
                onClick={onCancelEditingCheckpoint}
                disabled={savingCheckpoint}
                className="minerva-button minerva-button-secondary"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onStartEditingCheckpoint(checkpoint)}
                className="minerva-button minerva-button-secondary"
              >
                Edit
              </button>
              <button
                onClick={() => onRemoveCheckpoint(checkpoint.id)}
                aria-label={`Delete question ${index + 1}`}
                title="Delete question"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(223,47,38,0.24)] text-[20px] leading-none text-[var(--signal)] transition-colors hover:bg-[rgba(223,47,38,0.08)]"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuestionsSection(props: {
  open: boolean;
  onToggle: () => void;
  session: SessionDetails;
  readingsCount: number;
  checkpoints: CheckpointRecord[];
  uiState: QuestionUiState;
  setEditingCheckpointPrompt: Dispatch<SetStateAction<string>>;
  setNewCheckpointPrompt: Dispatch<SetStateAction<string>>;
  actions: QuestionActions;
}) {
  const {
    open,
    onToggle,
    session,
    readingsCount,
    checkpoints,
    uiState,
    setEditingCheckpointPrompt,
    setNewCheckpointPrompt,
    actions,
  } = props;
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
  const {
    onGenerateSuggestions,
    onAcceptSuggestion,
    onDismissSuggestion,
    onCreateCheckpoint,
    onDragStartCheckpoint,
    onDragOverCheckpoint,
    onDropCheckpoint,
    onEndDragCheckpoint,
    onStartEditingCheckpoint,
    onCancelEditingCheckpoint,
    onSaveCheckpointEdit,
    onRemoveCheckpoint,
  } = actions;

  const recommendedCount = Math.floor((session.maxExchanges - 4) / 4);
  const upperBound = Math.max(3, Math.floor(session.maxExchanges / 4));

  return (
    <CollapsibleSection
      title="Key Questions"
      description={`Questions learners should be able to answer after working through the reading. With ${session.maxExchanges} exchanges, aim for about ${recommendedCount} question${recommendedCount === 1 ? "" : "s"}.`}
      open={open}
      onToggle={onToggle}
      summary={
        checkpoints.length > 0 ? (
          <p className="text-sm text-[var(--dim-grey)]">
            {checkpoints.length} question{checkpoints.length !== 1 ? "s" : ""}
          </p>
        ) : (
          <p className="text-sm text-[#906f12]">
            No questions yet - add 2-4 to guide the tutor
          </p>
        )
      }
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onGenerateSuggestions}
            disabled={generatingSuggestions || readingsCount === 0}
            title={readingsCount === 0 ? "Upload a reading first" : undefined}
            className="minerva-button minerva-button-secondary"
          >
            {generatingSuggestions ? "Generating..." : "Suggest questions from reading"}
          </button>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--dim-grey)]">
            {checkpoints.length} question{checkpoints.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {session.maxExchanges > 0 && checkpoints.length > upperBound ? (
        <div className="rounded-xl border border-[rgba(144,111,18,0.22)] bg-[rgba(144,111,18,0.08)] px-4 py-3 text-sm text-[#906f12]">
          You have {checkpoints.length} questions with {session.maxExchanges} exchanges.
          Consider trimming this to roughly {recommendedCount} to {upperBound} questions for this
          session length.
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">
            Suggested questions - review and accept or dismiss
          </p>
          {suggestions.map((suggestion, index) => (
            <QuestionSuggestionCard
              key={`suggestion-${index}`}
              suggestion={suggestion}
              index={index}
              acceptingSuggestionIndex={acceptingSuggestionIndex}
              onAcceptSuggestion={onAcceptSuggestion}
              onDismissSuggestion={onDismissSuggestion}
            />
          ))}
        </div>
      ) : null}

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
          {checkpoints.map((checkpoint, index) => (
            <CheckpointCard
              key={checkpoint.id}
              checkpoint={checkpoint}
              index={index}
              isEditing={editingCheckpointId === checkpoint.id}
              editingCheckpointPrompt={editingCheckpointPrompt}
              setEditingCheckpointPrompt={setEditingCheckpointPrompt}
              savingCheckpoint={savingCheckpoint}
              isDragging={draggedCheckpointId === checkpoint.id}
              isDropTarget={dragTargetCheckpointId === checkpoint.id}
              onDragStartCheckpoint={onDragStartCheckpoint}
              onDragOverCheckpoint={onDragOverCheckpoint}
              onDropCheckpoint={onDropCheckpoint}
              onEndDragCheckpoint={onEndDragCheckpoint}
              onStartEditingCheckpoint={onStartEditingCheckpoint}
              onCancelEditingCheckpoint={onCancelEditingCheckpoint}
              onSaveCheckpointEdit={onSaveCheckpointEdit}
              onRemoveCheckpoint={onRemoveCheckpoint}
            />
          ))}
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
          onChange={(event) => setNewCheckpointPrompt(event.target.value)}
          rows={4}
          placeholder="e.g. Why does the author's argument about system behavior depend on the claim that structure drives outcomes?"
          className="minerva-textarea"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={onCreateCheckpoint}
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
    </CollapsibleSection>
  );
}

export function TeachingContextSection(props: {
  open: boolean;
  onToggle: () => void;
  session: SessionDetails;
  setSession: Dispatch<SetStateAction<SessionDetails | null>>;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  readingsCount: number;
  uiState: TeachingContextUiState;
  actions: TeachingContextActions;
  recommendedCheckpoints: number;
  formatSavedTime: (date: Date) => string;
}) {
  const {
    open,
    onToggle,
    session,
    setSession,
    setShowAdvanced,
    readingsCount,
    uiState,
    actions,
    recommendedCheckpoints,
    formatSavedTime,
  } = props;
  const { showAdvanced, generatingMap, savingConfig, showSavedState, configSavedAt } = uiState;
  const { onGenerateSuggestedMap, onSaveTeachingContext } = actions;

  const hasConfig = Boolean(
    session.courseContext || session.learningGoal || session.learningOutcomes
  );

  return (
    <CollapsibleSection
      title="Teaching context"
      description="Help the tutor understand your course, your goals, and what good performance looks like. Optional, but meaningfully improves the quality of questions and feedback."
      open={open}
      onToggle={onToggle}
      summary={
        <p className="text-sm text-[var(--dim-grey)]">
          {hasConfig ? "Configured" : "Not yet configured"}
        </p>
      }
    >
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
              onChange={(event) =>
                setSession((prev) =>
                  prev ? { ...prev, stance: event.target.value as "directed" | "mentor" } : prev
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
              onChange={(event) =>
                setSession((prev) =>
                  prev ? { ...prev, stance: event.target.value as "directed" | "mentor" } : prev
                )
              }
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-[var(--charcoal)]">Peer Mentor</div>
              <div className="text-xs text-[var(--dim-grey)]">
                Engages as a thinking partner, challenging interpretations collaboratively. Good for experienced learners.
              </div>
            </div>
          </label>
        </div>
      </fieldset>

      <div className="space-y-2">
        <label className="minerva-label">Where this fits in your course</label>
        <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
          Background the tutor needs - what course this is for, where learners are in the curriculum, and what they have covered so far.
        </p>
        <textarea
          value={session.courseContext ?? ""}
          onChange={(event) =>
            setSession((prev) => (prev ? { ...prev, courseContext: event.target.value } : prev))
          }
          rows={3}
          placeholder="e.g. This is Week 4 of a 10-week unit on systems thinking. Learners have read Meadows chapters 1-3 and are familiar with stocks and flows, but have not yet covered feedback loops."
          className="minerva-textarea"
        />
      </div>

      <div className="space-y-2">
        <label className="minerva-label">Learning outcomes to assess</label>
        <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
          The specific skills or understandings you want to track. The tutor will assess each learner against these and include formative ratings in the teaching brief.
        </p>
        <textarea
          value={session.learningOutcomes ?? ""}
          onChange={(event) =>
            setSession((prev) =>
              prev ? { ...prev, learningOutcomes: event.target.value } : prev
            )
          }
          rows={3}
          placeholder="e.g. Learners will be able to reconstruct the author's central argument, identify unstated assumptions, and evaluate the strength of the evidence presented."
          className="minerva-textarea"
        />
      </div>

      <div className="space-y-2">
        <label className="minerva-label">Session goal</label>
        <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
          The overarching understanding you are building toward. This shapes how the tutor opens the session, selects questions, and frames the closing synthesis.
        </p>
        <textarea
          value={session.learningGoal ?? ""}
          onChange={(event) =>
            setSession((prev) => (prev ? { ...prev, learningGoal: event.target.value } : prev))
          }
          rows={3}
          placeholder="e.g. Explain the difference between reinforcing and balancing feedback loops, and identify at least one example of each in the reading."
          className="minerva-textarea"
        />
      </div>

      {session.maxExchanges ? (
        <div className="minerva-panel p-4 text-sm text-[var(--charcoal)]">
          <p className="mb-1 font-semibold text-[var(--teal)]">Question capacity</p>
          <p className="leading-6 text-[var(--dim-grey)]">
            With <strong>{session.maxExchanges} exchanges</strong>, this session can meaningfully cover approximately{" "}
            <strong>
              {recommendedCheckpoints} key question{recommendedCheckpoints === 1 ? "" : "s"}
            </strong>
            . This assumes roughly four exchanges per question, plus exchanges for orientation and wrap-up.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--dim-grey)] transition-colors hover:text-[var(--charcoal)]"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced settings
        </button>

        {showAdvanced ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="minerva-label">Concept dependencies</label>
                <p className="mt-0.5 mb-2 text-xs text-[var(--dim-grey)]">
                  A map of which concepts build on others. You can generate this automatically from your reading.
                </p>
              </div>
              <button
                onClick={onGenerateSuggestedMap}
                disabled={generatingMap || readingsCount === 0}
                title={readingsCount === 0 ? "Upload a reading first to generate a map" : undefined}
                className="minerva-button minerva-button-secondary"
              >
                {generatingMap ? "Generating..." : "Generate from readings"}
              </button>
            </div>
            <textarea
              value={session.prerequisiteMap ?? ""}
              onChange={(event) =>
                setSession((prev) =>
                  prev ? { ...prev, prerequisiteMap: event.target.value } : prev
                )
              }
              rows={8}
              placeholder='{"concepts":[{"id":"foundations","label":"Foundations","level":"foundational","prerequisites":[]}]}'
              className="minerva-textarea resize-y font-mono text-xs"
            />
          </>
        ) : null}
      </div>

      <div className="pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={onSaveTeachingContext}
            disabled={savingConfig}
            className="minerva-button"
          >
            {savingConfig ? "Saving..." : showSavedState ? "Saved" : "Save configuration"}
          </button>
          {configSavedAt || showSavedState ? (
            <p className="text-xs text-[var(--dim-grey)]">
              {showSavedState
                ? "Settings saved."
                : configSavedAt
                  ? `Last saved at ${formatSavedTime(configSavedAt)}`
                  : ""}
            </p>
          ) : null}
        </div>
      </div>
    </CollapsibleSection>
  );
}

export function AssessmentsSection(props: {
  open: boolean;
  onToggle: () => void;
  assessments: FileInfo[];
  uiState: UploadUiState;
  assessmentInputRef: RefObject<HTMLInputElement | null>;
  handlers: UploadHandlers;
}) {
  const {
    open,
    onToggle,
    assessments,
    uiState,
    assessmentInputRef,
    handlers,
  } = props;
  const { dragActive, uploadingCategory, recentUploadCategory, recentUploadName } = uiState;
  const { onDrop, onDragOver, onDragLeave, onFileChange, onRemoveFile } = handlers;

  return (
    <CollapsibleSection
      title="Assessments"
      description="Upload your assignments or exam questions. The tutor reads them to understand what learners are working toward, but will never reveal or directly answer them."
      open={open}
      onToggle={onToggle}
      summary={
        <p className="text-sm text-[var(--dim-grey)]">
          {assessments.length > 0
            ? `${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} uploaded`
            : "No assessments uploaded"}
        </p>
      }
    >
      <div
        onDrop={(event) => onDrop(event, "assessment")}
        onDragOver={(event) => onDragOver(event, "assessment")}
        onDragLeave={onDragLeave}
        onClick={() => assessmentInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive === "assessment"
            ? "border-[var(--rose)] bg-[rgba(165,65,125,0.08)]"
            : "border-[var(--light-grey)] hover:border-[var(--rose)] hover:bg-[rgba(255,255,255,0.55)]"
        }`}
      >
        <input
          ref={assessmentInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(event) => onFileChange(event, "assessment")}
          className="hidden"
        />
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
        {recentUploadCategory === "assessment" && recentUploadName ? (
          <p className="mt-3 text-xs font-medium text-[var(--rose)]">
            Uploaded: {recentUploadName}
          </p>
        ) : null}
      </div>

      {assessments.length > 0 ? (
        <div className="space-y-2">
          {assessments.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between border p-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--charcoal)]">
                  {file.filename}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--dim-grey)]">{file.preview}</p>
              </div>
              <button
                onClick={() => onRemoveFile(file.id, "assessment")}
                className="minerva-button minerva-button-secondary ml-4"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}
