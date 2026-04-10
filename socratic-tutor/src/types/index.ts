// Shared TypeScript types for the Socratic Tutor application

export type FileCategory = "reading" | "assessment";

export interface CreateSessionRequest {
  name: string;
  description?: string;
  courseContext?: string;
  learningGoal?: string;
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
  prerequisiteMap: string | null;
  accessCode: string;
  createdAt: string;
  maxExchanges: number;
  readingsCount: number;
  assessmentsCount: number;
}

export interface StudentEntryData {
  sessionId: string;
  sessionName: string;
  description: string | null;
  courseContext?: string | null;
  learningGoal?: string | null;
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
