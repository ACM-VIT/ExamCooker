CREATE TABLE IF NOT EXISTS "ContentCorrectionReport" (
  "id" TEXT PRIMARY KEY,
  "resourceType" TEXT NOT NULL,
  "noteId" TEXT NULL,
  "pastPaperId" TEXT NULL,
  "reporterId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "suggestedValue" TEXT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "aiDecision" JSONB NULL,
  "resolvedById" TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3) NULL,
  CONSTRAINT "ContentCorrectionReport_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentCorrectionReport_pastPaperId_fkey" FOREIGN KEY ("pastPaperId") REFERENCES "PastPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentCorrectionReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentCorrectionReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContentCorrectionReport_one_resource_check" CHECK (
    ("noteId" IS NOT NULL AND "pastPaperId" IS NULL AND "resourceType" = 'note') OR
    ("noteId" IS NULL AND "pastPaperId" IS NOT NULL AND "resourceType" = 'pastPaper')
  )
);

CREATE INDEX IF NOT EXISTS "ContentCorrectionReport_status_createdAt_idx" ON "ContentCorrectionReport" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentCorrectionReport_noteId_idx" ON "ContentCorrectionReport" ("noteId");
CREATE INDEX IF NOT EXISTS "ContentCorrectionReport_pastPaperId_idx" ON "ContentCorrectionReport" ("pastPaperId");
CREATE INDEX IF NOT EXISTS "ContentCorrectionReport_reporterId_idx" ON "ContentCorrectionReport" ("reporterId");
