CREATE TABLE IF NOT EXISTS "ExamInstance" (
  "id" STRING PRIMARY KEY,
  "courseId" STRING NOT NULL,
  "courseCode" STRING NOT NULL,
  "examType" "ExamType",
  "semester" "Semester" DEFAULT 'UNKNOWN' NOT NULL,
  "campus" "Campus" DEFAULT 'VELLORE' NOT NULL,
  "slot" STRING,
  "scheduledAt" timestamp(3),
  "status" STRING DEFAULT 'upcoming' NOT NULL,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "ExamInstance_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamInstance_courseId_idx"
  ON "ExamInstance" ("courseId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamInstance_course_exam_slot_idx"
  ON "ExamInstance" ("courseCode", "examType", "semester", "campus", "slot");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamInstance_scheduledAt_idx"
  ON "ExamInstance" ("scheduledAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SyllabusTopicExtraction" (
  "id" STRING PRIMARY KEY,
  "syllabusId" STRING NOT NULL,
  "sourceHash" STRING NOT NULL,
  "model" STRING NOT NULL,
  "promptVersion" STRING NOT NULL,
  "status" STRING DEFAULT 'queued' NOT NULL,
  "topics" jsonb,
  "error" STRING,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "SyllabusTopicExtraction_syllabusId_fkey"
    FOREIGN KEY ("syllabusId")
    REFERENCES "syllabi"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "SyllabusTopicExtraction_source_key"
    UNIQUE ("syllabusId", "sourceHash", "model", "promptVersion")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "SyllabusTopicExtraction_syllabusId_idx"
  ON "SyllabusTopicExtraction" ("syllabusId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CanonicalTopic" (
  "id" STRING PRIMARY KEY,
  "courseId" STRING NOT NULL,
  "syllabusId" STRING,
  "moduleLabel" STRING,
  "title" STRING NOT NULL,
  "aliases" STRING[] DEFAULT ARRAY[]:::STRING[],
  "embedding" jsonb,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "CanonicalTopic_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "CanonicalTopic_syllabusId_fkey"
    FOREIGN KEY ("syllabusId")
    REFERENCES "syllabi"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CanonicalTopic_courseId_idx"
  ON "CanonicalTopic" ("courseId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CanonicalTopic_title_trgm_idx"
  ON "CanonicalTopic" USING gin ("title");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ExamSignal" (
  "id" STRING PRIMARY KEY,
  "examInstanceId" STRING,
  "userId" STRING,
  "topicId" STRING,
  "signalType" STRING NOT NULL,
  "source" STRING NOT NULL,
  "rawText" STRING,
  "confidence" INT4 DEFAULT 1 NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "ExamSignal_examInstanceId_fkey"
    FOREIGN KEY ("examInstanceId")
    REFERENCES "ExamInstance"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ExamSignal_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "ExamSignal_topicId_fkey"
    FOREIGN KEY ("topicId")
    REFERENCES "CanonicalTopic"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamSignal_examInstanceId_idx"
  ON "ExamSignal" ("examInstanceId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamSignal_topicId_idx"
  ON "ExamSignal" ("topicId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamSignal_userId_idx"
  ON "ExamSignal" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ExamSignal_type_createdAt_idx"
  ON "ExamSignal" ("signalType", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "StudyPlanRun" (
  "id" STRING PRIMARY KEY,
  "userId" STRING NOT NULL,
  "courseId" STRING,
  "examInstanceId" STRING,
  "courseCode" STRING NOT NULL,
  "examType" "ExamType",
  "syllabusId" STRING,
  "selectedTopics" jsonb NOT NULL,
  "studyPreferences" jsonb NOT NULL,
  "status" STRING DEFAULT 'queued' NOT NULL,
  "plan" jsonb,
  "error" STRING,
  "cost" jsonb,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "StudyPlanRun_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "StudyPlanRun_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "StudyPlanRun_examInstanceId_fkey"
    FOREIGN KEY ("examInstanceId")
    REFERENCES "ExamInstance"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "StudyPlanRun_syllabusId_fkey"
    FOREIGN KEY ("syllabusId")
    REFERENCES "syllabi"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "StudyPlanRun_userId_updatedAt_idx"
  ON "StudyPlanRun" ("userId", "updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "StudyPlanRun_course_exam_idx"
  ON "StudyPlanRun" ("courseCode", "examType");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "StudyPlanRun_status_idx"
  ON "StudyPlanRun" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SlotIntelligenceSummary" (
  "id" STRING PRIMARY KEY,
  "courseId" STRING NOT NULL,
  "examType" "ExamType",
  "semester" "Semester" DEFAULT 'UNKNOWN' NOT NULL,
  "campus" "Campus" DEFAULT 'VELLORE' NOT NULL,
  "slot" STRING,
  "summary" jsonb NOT NULL,
  "confidence" INT4 DEFAULT 1 NOT NULL,
  "generatedAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "SlotIntelligenceSummary_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "SlotIntelligenceSummary_scope_key"
    UNIQUE ("courseId", "examType", "semester", "campus", "slot")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ContributionLedger" (
  "id" STRING PRIMARY KEY,
  "userId" STRING NOT NULL,
  "signalId" STRING,
  "creditDelta" INT4 DEFAULT 0 NOT NULL,
  "reputationDelta" INT4 DEFAULT 0 NOT NULL,
  "reason" STRING NOT NULL,
  "status" STRING DEFAULT 'pending' NOT NULL,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "ContributionLedger_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ContributionLedger_signalId_fkey"
    FOREIGN KEY ("signalId")
    REFERENCES "ExamSignal"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ContributionLedger_userId_createdAt_idx"
  ON "ContributionLedger" ("userId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ContributionLedger_signalId_idx"
  ON "ContributionLedger" ("signalId");
