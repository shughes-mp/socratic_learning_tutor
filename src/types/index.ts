// Shared TypeScript types for the Socratic Tutor application

export type FileCategory = "reading" | "assessment";

export interface CreateSessionRequest {
  name: string;
  description?: string;
  courseContext?: string;
  learningGoal?: string;
  learningOutcomes?: string;
  stance?: "directed" | "mentor";
}

export interface CreateSessionResponse {
  id: string;
  name: string;
  accessCode: string;
}

export interface UploadFileRequest {
  category: FileCategory;
}

export interface FileInfo {
  id: string;
  filename: string;
  category: FileCategory;
  preview: string; // first 100 chars
  uploadedAt: string;
}

export interface SessionDetails {
  id: string;
  name: string;
  description: string | null;
  courseContext: string | null;
  learningGoal: string | null;
  learningOutcomes: string | null;
  prerequisiteMap: string | null;
  accessCode: string;
  createdAt: string;
  maxExchanges: number;
  stance: "directed" | "mentor";
  readingsCount: number;
  assessmentsCount: number;
}

export type CheckpointProcessLevel =
  | "retrieve"
  | "infer"
  | "integrate"
  | "evaluate";

export type StudentCheckpointStatus =
  | "unseen"
  | "probing"
  | "evidence_sufficient"
  | "evidence_insufficient"
  | "deferred";

export interface CheckpointRecord {
  id: string;
  sessionId: string;
  orderIndex: number;
  prompt: string;
  processLevel: CheckpointProcessLevel;
  passageAnchors: string | null;
  expectations: string | null;
  misconceptionSeeds: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentCheckpointRecord {
  id: string;
  studentSessionId: string;
  checkpointId: string;
  status: StudentCheckpointStatus;
  turnsSpent: number;
  evidenceNotes: string | null;
  updatedAt: string;
}

export interface CheckpointLintResult {
  isRecallOnly: boolean;
  suggestedRewrite: string;
  suggestedExpectations: string[];
  suggestedMisconceptions: string[];
}

export interface StudentEntryData {
  sessionId: string;
  sessionName: string;
  description: string | null;
  courseContext?: string | null;
  learningGoal?: string | null;
  learningOutcomes?: string | null;
  stance?: "directed" | "mentor";
}

export interface ApiError {
  error: string;
  code: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface StudentSessionInfo {
  id: string;
  studentName: string;
  startedAt: string;
  endedAt: string | null;
  exchangeCount: number;
  misconceptionCount: number;
  lastActive: string;
}
