-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "Role" AS ENUM('USER', 'MODERATOR');--> statement-breakpoint
CREATE TYPE "VoteType" AS ENUM('UPVOTE', 'DOWNVOTE');--> statement-breakpoint
CREATE TYPE "ExamType" AS ENUM('CAT_1', 'CAT_2', 'FAT', 'MODEL_CAT_1', 'MODEL_CAT_2', 'MODEL_FAT', 'MID', 'QUIZ', 'CIA', 'OTHER');--> statement-breakpoint
CREATE TYPE "Semester" AS ENUM('FALL', 'WINTER', 'SUMMER', 'WEEKEND', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "Campus" AS ENUM('VELLORE', 'CHENNAI', 'AP', 'BHOPAL', 'BANGALORE', 'MAURITIUS');--> statement-breakpoint
CREATE TABLE "_ForumPostToTag" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_ForumPostToTag_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_ForumToTag" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_ForumToTag_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_NoteToTag" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_NoteToTag_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_PastPaperToTag" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_PastPaperToTag_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamptz,
	"migration_name" varchar(255) NOT NULL,
	"logs" string,
	"rolled_back_at" timestamptz,
	"started_at" timestamptz DEFAULT now() NOT NULL,
	"applied_steps_count" int8 DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_UserBookmarkedForumPosts" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_UserBookmarkedForumPosts_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_UserBookmarkedNotes" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_UserBookmarkedNotes_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_UserBookmarkedPastPapers" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_UserBookmarkedPastPapers_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_UserBookmarkedResources" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_UserBookmarkedResources_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "_UserBookmarkedSyllabus" (
	"A" string NOT NULL,
	"B" string NOT NULL,
	CONSTRAINT "_UserBookmarkedSyllabus_AB_unique" UNIQUE("A","B")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" string PRIMARY KEY,
	"user_id" string NOT NULL,
	"type" string NOT NULL,
	"provider" string NOT NULL,
	"provider_account_id" string NOT NULL,
	"refresh_token" string,
	"access_token" string,
	"expires_at" int4,
	"token_type" string,
	"scope" string,
	"id_token" string,
	"session_state" string,
	"passwordHash" string,
	"passwordSalt" string,
	CONSTRAINT "accounts_provider_provider_account_id_key" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "Comment" (
	"id" string PRIMARY KEY,
	"content" string NOT NULL,
	"authorId" string NOT NULL,
	"forumPostId" string NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Course" (
	"id" string PRIMARY KEY,
	"code" string NOT NULL,
	"title" string NOT NULL,
	"aliases" string[],
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "Course_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "Forum" (
	"id" string PRIMARY KEY,
	"courseName" string NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ForumPost" (
	"id" string PRIMARY KEY,
	"title" string NOT NULL,
	"authorId" string NOT NULL,
	"forumId" string NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"description" string DEFAULT '' NOT NULL,
	"downvoteCount" int4 DEFAULT 0 NOT NULL,
	"upvoteCount" int4 DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Module" (
	"id" string PRIMARY KEY,
	"title" string NOT NULL,
	"subjectId" string NOT NULL,
	"webReferences" string[],
	"youtubeLinks" string[]
);
--> statement-breakpoint
CREATE TABLE "Note" (
	"id" string PRIMARY KEY,
	"title" string NOT NULL,
	"authorId" string NOT NULL,
	"fileUrl" string NOT NULL,
	"isClear" bool DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"thumbNailUrl" string,
	"courseId" string
);
--> statement-breakpoint
CREATE TABLE "PastPaper" (
	"id" string PRIMARY KEY,
	"title" string NOT NULL,
	"fileUrl" string NOT NULL,
	"authorId" string NOT NULL,
	"isClear" bool DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"thumbNailUrl" string,
	"courseId" string,
	"examType" "ExamType",
	"slot" string,
	"year" int4,
	"semester" "Semester" DEFAULT 'UNKNOWN'::public."Semester"::"Semester" NOT NULL,
	"campus" "Campus" DEFAULT 'VELLORE'::public."Campus"::"Campus" NOT NULL,
	"hasAnswerKey" bool DEFAULT false NOT NULL,
	"questionPaperId" string,
	CONSTRAINT "PastPaper_questionPaperId_key" UNIQUE("questionPaperId")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" string PRIMARY KEY,
	"session_token" string NOT NULL,
	"user_id" string NOT NULL,
	"expires" timestamp(3) NOT NULL,
	CONSTRAINT "sessions_session_token_key" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "Subject" (
	"id" string PRIMARY KEY,
	"name" string NOT NULL,
	CONSTRAINT "Subject_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "syllabi" (
	"id" string PRIMARY KEY,
	"name" string NOT NULL,
	"fileUrl" string NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" string PRIMARY KEY,
	"name" string NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"aliases" string[],
	CONSTRAINT "Tag_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "UpcomingExam" (
	"id" string PRIMARY KEY,
	"courseId" string NOT NULL,
	"slots" string[],
	"examType" "ExamType",
	"scheduledAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" string PRIMARY KEY,
	"email" string NOT NULL,
	"role" "Role" DEFAULT 'USER'::public."Role"::"Role" NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"email_verified" timestamp(3),
	"name" string,
	"image" string,
	CONSTRAINT "User_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ViewHistory" (
	"id" string PRIMARY KEY,
	"userId" string NOT NULL,
	"pastPaperId" string,
	"noteId" string,
	"subjectId" string,
	"viewedAt" timestamp(3) NOT NULL,
	"forumPostId" string,
	"count" int4 DEFAULT 1 NOT NULL,
	"syllabusId" string,
	CONSTRAINT "ViewHistory_userId_forumPostId_key" UNIQUE("userId","forumPostId"),
	CONSTRAINT "ViewHistory_userId_noteId_key" UNIQUE("userId","noteId"),
	CONSTRAINT "ViewHistory_userId_pastPaperId_key" UNIQUE("userId","pastPaperId"),
	CONSTRAINT "ViewHistory_userId_subjectId_key" UNIQUE("userId","subjectId"),
	CONSTRAINT "ViewHistory_userId_syllabusId_key" UNIQUE("userId","syllabusId")
);
--> statement-breakpoint
CREATE TABLE "Vote" (
	"id" string PRIMARY KEY,
	"userId" string NOT NULL,
	"forumPostId" string NOT NULL,
	"type" "VoteType" NOT NULL,
	"createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "Vote_userId_forumPostId_key" UNIQUE("userId","forumPostId")
);
--> statement-breakpoint
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Note" ADD CONSTRAINT "Note_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_forumPostId_fkey" FOREIGN KEY ("forumPostId") REFERENCES "ForumPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "PastPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Module" ADD CONSTRAINT "Module_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_NoteToTag" ADD CONSTRAINT "_NoteToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_NoteToTag" ADD CONSTRAINT "_NoteToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedNotes" ADD CONSTRAINT "_UserBookmarkedNotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedNotes" ADD CONSTRAINT "_UserBookmarkedNotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_ForumToTag" ADD CONSTRAINT "_ForumToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_ForumToTag" ADD CONSTRAINT "_ForumToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_ForumPostToTag" ADD CONSTRAINT "_ForumPostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_ForumPostToTag" ADD CONSTRAINT "_ForumPostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_PastPaperToTag" ADD CONSTRAINT "_PastPaperToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "PastPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_PastPaperToTag" ADD CONSTRAINT "_PastPaperToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedPastPapers" ADD CONSTRAINT "_UserBookmarkedPastPapers_A_fkey" FOREIGN KEY ("A") REFERENCES "PastPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedPastPapers" ADD CONSTRAINT "_UserBookmarkedPastPapers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedForumPosts" ADD CONSTRAINT "_UserBookmarkedForumPosts_A_fkey" FOREIGN KEY ("A") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedForumPosts" ADD CONSTRAINT "_UserBookmarkedForumPosts_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedResources" ADD CONSTRAINT "_UserBookmarkedResources_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedResources" ADD CONSTRAINT "_UserBookmarkedResources_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_forumPostId_fkey" FOREIGN KEY ("forumPostId") REFERENCES "ForumPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_pastPaperId_fkey" FOREIGN KEY ("pastPaperId") REFERENCES "PastPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_forumPostId_fkey" FOREIGN KEY ("forumPostId") REFERENCES "ForumPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "_UserBookmarkedSyllabus" ADD CONSTRAINT "_UserBookmarkedSyllabus_B_fkey" FOREIGN KEY ("B") REFERENCES "syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UpcomingExam" ADD CONSTRAINT "UpcomingExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX "_ForumPostToTag_B_index" ON "_ForumPostToTag" ("B");--> statement-breakpoint
CREATE INDEX "_ForumToTag_B_index" ON "_ForumToTag" ("B");--> statement-breakpoint
CREATE INDEX "_NoteToTag_B_index" ON "_NoteToTag" ("B");--> statement-breakpoint
CREATE INDEX "_PastPaperToTag_B_index" ON "_PastPaperToTag" ("B");--> statement-breakpoint
CREATE INDEX "_UserBookmarkedForumPosts_B_index" ON "_UserBookmarkedForumPosts" ("B");--> statement-breakpoint
CREATE INDEX "_UserBookmarkedNotes_B_index" ON "_UserBookmarkedNotes" ("B");--> statement-breakpoint
CREATE INDEX "_UserBookmarkedPastPapers_B_index" ON "_UserBookmarkedPastPapers" ("B");--> statement-breakpoint
CREATE INDEX "_UserBookmarkedResources_B_index" ON "_UserBookmarkedResources" ("B");--> statement-breakpoint
CREATE INDEX "_UserBookmarkedSyllabus_B_index" ON "_UserBookmarkedSyllabus" ("B");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "Comment_authorId_idx" ON "Comment" ("authorId");--> statement-breakpoint
CREATE INDEX "Comment_forumPostId_createdAt_idx" ON "Comment" ("forumPostId","createdAt");--> statement-breakpoint
CREATE INDEX "Course_aliases_inverted_idx" ON "Course" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX "Course_title_idx" ON "Course" ("title");--> statement-breakpoint
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost" ("authorId");--> statement-breakpoint
CREATE INDEX "ForumPost_createdAt_idx" ON "ForumPost" ("createdAt");--> statement-breakpoint
CREATE INDEX "ForumPost_description_trgm_idx" ON "ForumPost" USING gin ("description");--> statement-breakpoint
CREATE INDEX "ForumPost_forumId_createdAt_idx" ON "ForumPost" ("forumId","createdAt");--> statement-breakpoint
CREATE INDEX "ForumPost_title_trgm_idx" ON "ForumPost" USING gin ("title");--> statement-breakpoint
CREATE INDEX "Module_subjectId_idx" ON "Module" ("subjectId");--> statement-breakpoint
CREATE INDEX "Note_authorId_idx" ON "Note" ("authorId");--> statement-breakpoint
CREATE INDEX "Note_courseId_idx" ON "Note" ("courseId");--> statement-breakpoint
CREATE INDEX "Note_courseId_isClear_createdAt_idx" ON "Note" ("courseId","isClear","createdAt");--> statement-breakpoint
CREATE INDEX "Note_courseId_isClear_updatedAt_idx" ON "Note" ("courseId","isClear","updatedAt");--> statement-breakpoint
CREATE INDEX "Note_createdAt_idx" ON "Note" ("createdAt");--> statement-breakpoint
CREATE INDEX "Note_isClear_createdAt_idx" ON "Note" ("isClear","createdAt");--> statement-breakpoint
CREATE INDEX "Note_title_trgm_idx" ON "Note" USING gin ("title");--> statement-breakpoint
CREATE INDEX "PastPaper_authorId_idx" ON "PastPaper" ("authorId");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_examType_idx" ON "PastPaper" ("courseId","examType");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_isClear_createdAt_idx" ON "PastPaper" ("courseId","isClear","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_isClear_examType_year_createdAt_idx" ON "PastPaper" ("courseId","isClear","examType","year","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_isClear_year_createdAt_idx" ON "PastPaper" ("courseId","isClear","year","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_slot_idx" ON "PastPaper" ("courseId","slot");--> statement-breakpoint
CREATE INDEX "PastPaper_courseId_year_idx" ON "PastPaper" ("courseId","year");--> statement-breakpoint
CREATE INDEX "PastPaper_createdAt_idx" ON "PastPaper" ("createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_isClear_createdAt_idx" ON "PastPaper" ("isClear","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_isClear_examType_courseId_year_createdAt_idx" ON "PastPaper" ("isClear","examType","courseId","year","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_metadata_sibling_idx" ON "PastPaper" ("courseId","isClear","examType","slot","year","semester","campus","hasAnswerKey","createdAt");--> statement-breakpoint
CREATE INDEX "PastPaper_title_trgm_idx" ON "PastPaper" USING gin ("title");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" ("expires");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "Subject_name_trgm_idx" ON "Subject" USING gin ("name");--> statement-breakpoint
CREATE INDEX "syllabi_name_idx" ON "syllabi" ("name");--> statement-breakpoint
CREATE INDEX "syllabi_name_trgm_idx" ON "syllabi" USING gin ("name");--> statement-breakpoint
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING gin ("name");--> statement-breakpoint
CREATE INDEX "UpcomingExam_courseId_idx" ON "UpcomingExam" ("courseId");--> statement-breakpoint
CREATE INDEX "UpcomingExam_courseId_scheduledAt_idx" ON "UpcomingExam" ("courseId","scheduledAt");--> statement-breakpoint
CREATE INDEX "UpcomingExam_scheduledAt_createdAt_idx" ON "UpcomingExam" ("scheduledAt","createdAt");--> statement-breakpoint
CREATE INDEX "UpcomingExam_scheduledAt_idx" ON "UpcomingExam" ("scheduledAt");--> statement-breakpoint
CREATE INDEX "User_name_trgm_idx" ON "User" USING gin ("name");--> statement-breakpoint
CREATE INDEX "ViewHistory_forumPostId_idx" ON "ViewHistory" ("forumPostId");--> statement-breakpoint
CREATE INDEX "ViewHistory_noteId_idx" ON "ViewHistory" ("noteId");--> statement-breakpoint
CREATE INDEX "ViewHistory_pastPaperId_idx" ON "ViewHistory" ("pastPaperId");--> statement-breakpoint
CREATE INDEX "ViewHistory_subjectId_idx" ON "ViewHistory" ("subjectId");--> statement-breakpoint
CREATE INDEX "ViewHistory_syllabusId_idx" ON "ViewHistory" ("syllabusId");--> statement-breakpoint
CREATE INDEX "ViewHistory_userId_viewedAt_idx" ON "ViewHistory" ("userId","viewedAt");--> statement-breakpoint
CREATE INDEX "Vote_forumPostId_idx" ON "Vote" ("forumPostId");
*/