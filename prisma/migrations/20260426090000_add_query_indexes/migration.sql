-- Auth/session lookups.
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions"("expires");

-- Relation, moderation, list, and aggregate query paths.
CREATE INDEX IF NOT EXISTS "UpcomingExam_courseId_scheduledAt_idx" ON "UpcomingExam"("courseId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "UpcomingExam_scheduledAt_createdAt_idx" ON "UpcomingExam"("scheduledAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Note_authorId_idx" ON "Note"("authorId");
CREATE INDEX IF NOT EXISTS "Note_courseId_isClear_createdAt_idx" ON "Note"("courseId", "isClear", "createdAt");
CREATE INDEX IF NOT EXISTS "Note_courseId_isClear_updatedAt_idx" ON "Note"("courseId", "isClear", "updatedAt");

CREATE INDEX IF NOT EXISTS "ViewHistory_userId_viewedAt_idx" ON "ViewHistory"("userId", "viewedAt");
CREATE INDEX IF NOT EXISTS "ViewHistory_pastPaperId_idx" ON "ViewHistory"("pastPaperId");
CREATE INDEX IF NOT EXISTS "ViewHistory_noteId_idx" ON "ViewHistory"("noteId");
CREATE INDEX IF NOT EXISTS "ViewHistory_forumPostId_idx" ON "ViewHistory"("forumPostId");
CREATE INDEX IF NOT EXISTS "ViewHistory_subjectId_idx" ON "ViewHistory"("subjectId");
CREATE INDEX IF NOT EXISTS "ViewHistory_syllabusId_idx" ON "ViewHistory"("syllabusId");

CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost"("authorId");
CREATE INDEX IF NOT EXISTS "ForumPost_forumId_createdAt_idx" ON "ForumPost"("forumId", "createdAt");
CREATE INDEX IF NOT EXISTS "Vote_forumPostId_idx" ON "Vote"("forumPostId");
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX IF NOT EXISTS "Comment_forumPostId_createdAt_idx" ON "Comment"("forumPostId", "createdAt");

CREATE INDEX IF NOT EXISTS "PastPaper_authorId_idx" ON "PastPaper"("authorId");
CREATE INDEX IF NOT EXISTS "PastPaper_courseId_isClear_createdAt_idx" ON "PastPaper"("courseId", "isClear", "createdAt");
CREATE INDEX IF NOT EXISTS "PastPaper_courseId_isClear_year_createdAt_idx" ON "PastPaper"("courseId", "isClear", "year", "createdAt");
CREATE INDEX IF NOT EXISTS "PastPaper_courseId_isClear_examType_year_createdAt_idx" ON "PastPaper"("courseId", "isClear", "examType", "year", "createdAt");
CREATE INDEX IF NOT EXISTS "PastPaper_metadata_sibling_idx" ON "PastPaper"("courseId", "isClear", "examType", "slot", "year", "semester", "campus", "hasAnswerKey", "createdAt");
CREATE INDEX IF NOT EXISTS "PastPaper_isClear_examType_courseId_year_createdAt_idx" ON "PastPaper"("isClear", "examType", "courseId", "year", "createdAt");

CREATE INDEX IF NOT EXISTS "Module_subjectId_idx" ON "Module"("subjectId");
CREATE INDEX IF NOT EXISTS "syllabi_name_idx" ON "syllabi"("name");

-- Specialized search indexes Prisma cannot represent in the schema.
CREATE INVERTED INDEX IF NOT EXISTS "Course_aliases_inverted_idx" ON "Course"("aliases");

-- Trigram indexes for ILIKE/contains search paths.
DROP INDEX IF EXISTS "Tag_name_trgm_idx";
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Note_title_trgm_idx" ON "Note" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PastPaper_title_trgm_idx" ON "PastPaper" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ForumPost_title_trgm_idx" ON "ForumPost" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ForumPost_description_trgm_idx" ON "ForumPost" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Subject_name_trgm_idx" ON "Subject" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "syllabi_name_trgm_idx" ON "syllabi" USING GIN ("name" gin_trgm_ops);
