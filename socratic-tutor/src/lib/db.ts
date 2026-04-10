import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  tursoSchemaReady: Promise<void> | undefined;
};

const TURSO_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "courseContext" TEXT,
  "learningGoal" TEXT,
  "prerequisiteMap" TEXT,
  "accessCode" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opensAt" DATETIME,
  "closesAt" DATETIME,
  "maxExchanges" INTEGER NOT NULL DEFAULT 20
);
CREATE TABLE IF NOT EXISTS "Reading" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Assessment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assessment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StudentSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "softRevisitQueue" TEXT NOT NULL DEFAULT '[]',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  "sessionSummary" TEXT,
  CONSTRAINT "StudentSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "topicThread" TEXT,
  "attemptNumber" INTEGER,
  "isGenuineAttempt" BOOLEAN,
  "mode" TEXT,
  "questionType" TEXT,
  "feedbackType" TEXT,
  "expertModelType" TEXT,
  "selfExplainPrompted" BOOLEAN NOT NULL DEFAULT false,
  "cognitiveConflictStage" TEXT,
  "misconceptionResolved" BOOLEAN NOT NULL DEFAULT false,
  "isRevisitProbe" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Misconception" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "topicThread" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "studentMessage" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "persistentlyUnresolved" BOOLEAN NOT NULL DEFAULT false,
  "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Misconception_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ConfidenceCheck" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "topicThread" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "probeAsked" BOOLEAN NOT NULL DEFAULT false,
  "probeResult" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfidenceCheck_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "stats" TEXT NOT NULL,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "SuggestedQuestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuggestedQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "TopicMastery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "topicThread" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "criteriamet" TEXT NOT NULL DEFAULT '[]',
  "hintLadderRung" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TopicMastery_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_accessCode_key" ON "Session"("accessCode");
CREATE UNIQUE INDEX IF NOT EXISTS "TopicMastery_studentSessionId_topicThread_key" ON "TopicMastery"("studentSessionId", "topicThread");
`;

function createPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    // Production: Turso Cloud via libsql
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter } as never);
  }

  // Local dev: better-sqlite3 (not loaded on Vercel)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function ensureDatabaseReady() {
  if (!process.env.TURSO_DATABASE_URL) return;

  if (!globalForPrisma.tursoSchemaReady) {
    globalForPrisma.tursoSchemaReady = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require("@libsql/client");
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });

      await client.executeMultiple(TURSO_BOOTSTRAP_SQL);
    })();
  }

  await globalForPrisma.tursoSchemaReady;
}
