-- CreateTable
CREATE TABLE "Session" (
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

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "processLevel" TEXT NOT NULL,
    "passageAnchors" TEXT,
    "expectations" TEXT,
    "misconceptionSeeds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Checkpoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unseen',
    "turnsSpent" INTEGER NOT NULL DEFAULT 0,
    "evidenceNotes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentCheckpoint_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentCheckpoint_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "softRevisitQueue" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "sessionSummary" TEXT,
    CONSTRAINT "StudentSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LOAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "learningOutcome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidenceSummary" TEXT,
    "processMetrics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LOAssessment_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
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
    "engagementFlag" TEXT,
    "engagementNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "topicThread" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "studentMessage" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "persistentlyUnresolved" BOOLEAN NOT NULL DEFAULT false,
    "canonicalClaim" TEXT,
    "passageAnchor" TEXT,
    "misconceptionType" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "detectedAtTurn" INTEGER,
    "resolvedAtTurn" INTEGER,
    "resolutionConfidence" TEXT,
    "resolutionEvidence" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Misconception_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiagnosticLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "misconceptionsDetected" INTEGER NOT NULL,
    "misconceptionsResolved" INTEGER NOT NULL,
    "engagementFlag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosticLog_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MisconceptionOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "clusterLabel" TEXT NOT NULL,
    "overrideType" TEXT NOT NULL,
    "instructorNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MisconceptionOverride_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeachingRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "whatToAddress" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "moveFiveMin" TEXT NOT NULL,
    "moveFifteenMin" TEXT NOT NULL,
    "moveThirtyMin" TEXT NOT NULL,
    "sourceClusters" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "instructorAction" TEXT,
    "instructorNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeachingRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfidenceCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "topicThread" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "probeAsked" BOOLEAN NOT NULL DEFAULT false,
    "probeResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfidenceCheck_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stats" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuggestedQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestedQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicMastery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentSessionId" TEXT NOT NULL,
    "topicThread" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "criteriamet" TEXT NOT NULL DEFAULT '[]',
    "hintLadderRung" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicMastery_studentSessionId_fkey" FOREIGN KEY ("studentSessionId") REFERENCES "StudentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessCode_key" ON "Session"("accessCode");

-- CreateIndex
CREATE INDEX "Checkpoint_sessionId_idx" ON "Checkpoint"("sessionId");

-- CreateIndex
CREATE INDEX "StudentCheckpoint_studentSessionId_idx" ON "StudentCheckpoint"("studentSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCheckpoint_studentSessionId_checkpointId_key" ON "StudentCheckpoint"("studentSessionId", "checkpointId");

-- CreateIndex
CREATE INDEX "LOAssessment_studentSessionId_idx" ON "LOAssessment"("studentSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LOAssessment_studentSessionId_learningOutcome_key" ON "LOAssessment"("studentSessionId", "learningOutcome");

-- CreateIndex
CREATE INDEX "DiagnosticLog_studentSessionId_idx" ON "DiagnosticLog"("studentSessionId");

-- CreateIndex
CREATE INDEX "MisconceptionOverride_sessionId_idx" ON "MisconceptionOverride"("sessionId");

-- CreateIndex
CREATE INDEX "TeachingRecommendation_sessionId_idx" ON "TeachingRecommendation"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMastery_studentSessionId_topicThread_key" ON "TopicMastery"("studentSessionId", "topicThread");
