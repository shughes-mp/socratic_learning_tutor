import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  tursoSchemaReady: Promise<void> | undefined;
};

function getRemoteDatabaseUrl(): string | undefined {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }

  if (process.env.DATABASE_URL?.startsWith("libsql://")) {
    return process.env.DATABASE_URL;
  }

  return undefined;
}

function isHostedProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

type LibsqlClient = {
  execute: (args: string | { sql: string; args?: unknown[] }) => Promise<unknown>;
  executeMultiple: (sql: string) => Promise<unknown>;
};

const TURSO_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "courseContext" TEXT,
  "learningGoal" TEXT,
  "learningOutcomes" TEXT,
  "prerequisiteMap" TEXT,
  "accessCode" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opensAt" DATETIME,
  "closesAt" DATETIME,
  "maxExchanges" INTEGER NOT NULL DEFAULT 20,
  "stance" TEXT NOT NULL DEFAULT 'directed'
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
CREATE TABLE IF NOT EXISTS "Checkpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "processLevel" TEXT NOT NULL,
  "passageAnchors" TEXT,
  "expectations" TEXT,
  "misconceptionSeeds" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkpoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
  "canonicalClaim" TEXT,
  "passageAnchor" TEXT,
  "misconceptionType" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "confidence" TEXT NOT NULL DEFAULT 'medium',
  "updatedAt" DATETIME,
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
CREATE TABLE IF NOT EXISTS "StudentCheckpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "checkpointId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unseen',
  "turnsSpent" INTEGER NOT NULL DEFAULT 0,
  "evidenceNotes" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentCheckpoint_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentCheckpoint_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "LOAssessment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentSessionId" TEXT NOT NULL,
  "learningOutcome" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "evidenceSummary" TEXT,
  "processMetrics" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LOAssessment_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE IF NOT EXISTS "MisconceptionOverride" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "clusterLabel" TEXT NOT NULL,
  "overrideType" TEXT NOT NULL,
  "instructorNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MisconceptionOverride_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_accessCode_key" ON "Session"("accessCode");
CREATE INDEX IF NOT EXISTS "Checkpoint_sessionId_idx" ON "Checkpoint"("sessionId");
CREATE INDEX IF NOT EXISTS "StudentCheckpoint_studentSessionId_idx" ON "StudentCheckpoint"("studentSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentCheckpoint_studentSessionId_checkpointId_key" ON "StudentCheckpoint"("studentSessionId", "checkpointId");
CREATE INDEX IF NOT EXISTS "LOAssessment_studentSessionId_idx" ON "LOAssessment"("studentSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LOAssessment_studentSessionId_learningOutcome_key" ON "LOAssessment"("studentSessionId", "learningOutcome");
CREATE UNIQUE INDEX IF NOT EXISTS "TopicMastery_studentSessionId_topicThread_key" ON "TopicMastery"("studentSessionId", "topicThread");
CREATE INDEX IF NOT EXISTS "MisconceptionOverride_sessionId_idx" ON "MisconceptionOverride"("sessionId");
`;

async function getExistingColumns(
  client: LibsqlClient,
  tableName: string
): Promise<Set<string>> {
  const result = (await client.execute(`PRAGMA table_info("${tableName}")`)) as {
    rows?: Array<Record<string, unknown>>;
  };

  const columns = new Set<string>();
  for (const row of result.rows ?? []) {
    const columnName = row.name;
    if (typeof columnName === "string") {
      columns.add(columnName);
    }
  }

  return columns;
}

async function addColumnIfMissing(
  client: LibsqlClient,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = await getExistingColumns(client, tableName);
  if (columns.has(columnName)) return;
  await client.execute(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
}

async function ensureTursoSchemaUpgrades(client: LibsqlClient) {
  await addColumnIfMissing(client, "Session", "learningOutcomes", "TEXT");
  await addColumnIfMissing(
    client,
    "Session",
    "stance",
    "TEXT NOT NULL DEFAULT 'directed'"
  );

  await addColumnIfMissing(client, "Misconception", "canonicalClaim", "TEXT");
  await addColumnIfMissing(client, "Misconception", "passageAnchor", "TEXT");
  await addColumnIfMissing(client, "Misconception", "misconceptionType", "TEXT");
  await addColumnIfMissing(
    client,
    "Misconception",
    "severity",
    "TEXT NOT NULL DEFAULT 'medium'"
  );
  await addColumnIfMissing(
    client,
    "Misconception",
    "confidence",
    "TEXT NOT NULL DEFAULT 'medium'"
  );
  await addColumnIfMissing(client, "Misconception", "updatedAt", "DATETIME");

  await client.execute(
    `UPDATE "Misconception" SET "updatedAt" = COALESCE("updatedAt", "detectedAt", CURRENT_TIMESTAMP)`
  );
}

function createPrismaClient(): PrismaClient {
  const remoteDatabaseUrl = getRemoteDatabaseUrl();

  if (remoteDatabaseUrl) {
    // Production: Turso Cloud via libsql
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({
      url: remoteDatabaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter } as never);
  }

  if (isHostedProductionEnvironment()) {
    const message =
      "Production database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel.";
    console.error(message);
    throw new Error(message);
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
  const remoteDatabaseUrl = getRemoteDatabaseUrl();
  if (!remoteDatabaseUrl) return;

  if (!globalForPrisma.tursoSchemaReady) {
    globalForPrisma.tursoSchemaReady = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require("@libsql/client");
      const client = createClient({
        url: remoteDatabaseUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });

      await client.executeMultiple(TURSO_BOOTSTRAP_SQL);
      await ensureTursoSchemaUpgrades(client as LibsqlClient);
    })();
  }

  await globalForPrisma.tursoSchemaReady;
}
