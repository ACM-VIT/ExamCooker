import { cockroachEnum, cockroachTable, string, varchar, timestamp, jsonb, bool, int4, int8, uniqueIndex, index, foreignKey, primaryKey } from "drizzle-orm/cockroach-core"
import { sql } from "drizzle-orm"

export const crdbInternalRegion = cockroachEnum("crdb_internal_region", [`aws-ap-south-1`])
export const role = cockroachEnum("Role", [`USER`, `MODERATOR`])
export const voteType = cockroachEnum("VoteType", [`UPVOTE`, `DOWNVOTE`])
export const studyScope = cockroachEnum("StudyScope", [`NOTE`, `PAST_PAPER`, `COURSE`])
export const examType = cockroachEnum("ExamType", [`CAT_1`, `CAT_2`, `FAT`, `MODEL_CAT_1`, `MODEL_CAT_2`, `MODEL_FAT`, `MID`, `QUIZ`, `CIA`, `OTHER`])
export const semester = cockroachEnum("Semester", [`FALL`, `WINTER`, `SUMMER`, `WEEKEND`, `UNKNOWN`])
export const campus = cockroachEnum("Campus", [`VELLORE`, `CHENNAI`, `AP`, `BHOPAL`, `BANGALORE`, `MAURITIUS`])


export const forumPostToTag = cockroachTable("_ForumPostToTag", {
	a: string("A").notNull().references(() => forumPost.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_ForumPostToTag_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_ForumPostToTag_B_index").using("btree", table.b.asc()),
]);

export const forumToTag = cockroachTable("_ForumToTag", {
	a: string("A").notNull().references(() => forum.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_ForumToTag_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_ForumToTag_B_index").using("btree", table.b.asc()),
]);

export const noteToTag = cockroachTable("_NoteToTag", {
	a: string("A").notNull().references(() => note.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_NoteToTag_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_NoteToTag_B_index").using("btree", table.b.asc()),
]);

export const pastPaperToTag = cockroachTable("_PastPaperToTag", {
	a: string("A").notNull().references(() => pastPaper.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_PastPaperToTag_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_PastPaperToTag_B_index").using("btree", table.b.asc()),
]);

export const prismaMigrations = cockroachTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { mode: 'string', withTimezone: true }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: string(),
	rolledBackAt: timestamp("rolled_back_at", { mode: 'string', withTimezone: true }),
	startedAt: timestamp("started_at", { mode: 'string', withTimezone: true }).defaultNow().notNull(),
	appliedStepsCount: int8("applied_steps_count", { mode: 'number' }).default(0).notNull(),
});

export const userBookmarkedForumPosts = cockroachTable("_UserBookmarkedForumPosts", {
	a: string("A").notNull().references(() => forumPost.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_UserBookmarkedForumPosts_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_UserBookmarkedForumPosts_B_index").using("btree", table.b.asc()),
]);

export const userBookmarkedNotes = cockroachTable("_UserBookmarkedNotes", {
	a: string("A").notNull().references(() => note.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_UserBookmarkedNotes_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_UserBookmarkedNotes_B_index").using("btree", table.b.asc()),
]);

export const userBookmarkedPastPapers = cockroachTable("_UserBookmarkedPastPapers", {
	a: string("A").notNull().references(() => pastPaper.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_UserBookmarkedPastPapers_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_UserBookmarkedPastPapers_B_index").using("btree", table.b.asc()),
]);

export const userBookmarkedResources = cockroachTable("_UserBookmarkedResources", {
	a: string("A").notNull().references(() => subject.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_UserBookmarkedResources_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_UserBookmarkedResources_B_index").using("btree", table.b.asc()),
]);

export const userBookmarkedSyllabus = cockroachTable("_UserBookmarkedSyllabus", {
	a: string("A").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	b: string("B").notNull().references(() => syllabi.id, { onDelete: "cascade", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("_UserBookmarkedSyllabus_AB_unique").using("btree", table.a.asc(), table.b.asc()),
	index("_UserBookmarkedSyllabus_B_index").using("btree", table.b.asc()),
]);

export const accounts = cockroachTable("accounts", {
	id: string().primaryKey(),
	userId: string("user_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	type: string().notNull(),
	provider: string().notNull(),
	providerAccountId: string("provider_account_id").notNull(),
	refreshToken: string("refresh_token"),
	accessToken: string("access_token"),
	expiresAt: int4("expires_at"),
	tokenType: string("token_type"),
	scope: string(),
	idToken: string("id_token"),
	sessionState: string("session_state"),
	passwordHash: string(),
	passwordSalt: string(),
}, (table) => [
	uniqueIndex("accounts_provider_provider_account_id_key").using("btree", table.provider.asc(), table.providerAccountId.asc()),
]);

export const comment = cockroachTable("Comment", {
	id: string().primaryKey(),
	content: string().notNull(),
	authorId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	forumPostId: string().notNull().references(() => forumPost.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
});

export const course = cockroachTable("Course", {
	id: string().primaryKey(),
	code: string().notNull(),
	title: string().notNull(),
	aliases: string().array(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	uniqueIndex("Course_code_key").using("btree", table.code.asc()),
	index("Course_title_idx").using("btree", table.title.asc()),
]);

export const forum = cockroachTable("Forum", {
	id: string().primaryKey(),
	courseName: string().notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
});

export const forumPost = cockroachTable("ForumPost", {
	id: string().primaryKey(),
	title: string().notNull(),
	authorId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	forumId: string().notNull().references(() => forum.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	description: string().default("").notNull(),
	upvoteCount: int4().default(0).notNull(),
	downvoteCount: int4().default(0).notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	index("ForumPost_createdAt_idx").using("btree", table.createdAt.asc()),
]);

export const module = cockroachTable("Module", {
	id: string().primaryKey(),
	title: string().notNull(),
	subjectId: string().notNull().references(() => subject.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	webReferences: string().array(),
	youtubeLinks: string().array(),
});

export const note = cockroachTable("Note", {
	id: string().primaryKey(),
	title: string().notNull(),
	authorId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	fileUrl: string().notNull(),
	thumbNailUrl: string(),
	isClear: bool().default(false).notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
	courseId: string().references(() => course.id, { onDelete: "set null", onUpdate: "cascade" } ),
}, (table) => [
	index("Note_courseId_idx").using("btree", table.courseId.asc()),
	index("Note_createdAt_idx").using("btree", table.createdAt.asc()),
	index("Note_isClear_createdAt_idx").using("btree", table.isClear.asc(), table.createdAt.asc()),
]);

export const pastPaper = cockroachTable("PastPaper", {
	id: string().primaryKey(),
	title: string().notNull(),
	fileUrl: string().notNull(),
	thumbNailUrl: string(),
	authorId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	isClear: bool().default(false).notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
	courseId: string().references(() => course.id, { onDelete: "set null", onUpdate: "cascade" } ),
	examType: examType(),
	slot: string(),
	year: int4(),
	semester: semester().default("'UNKNOWN'::public.\"Semester\"").notNull(),
	campus: campus().default("'VELLORE'::public.\"Campus\"").notNull(),
	hasAnswerKey: bool().default(false).notNull(),
	questionPaperId: string(),
}, (table) => [
	foreignKey({
		columns: [table.questionPaperId],
		foreignColumns: [table.id],
		name: "PastPaper_questionPaperId_fkey"
	}).onUpdate("cascade").onDelete("set null"),
	index("PastPaper_courseId_examType_idx").using("btree", table.courseId.asc(), table.examType.asc()),
	index("PastPaper_courseId_slot_idx").using("btree", table.courseId.asc(), table.slot.asc()),
	index("PastPaper_courseId_year_idx").using("btree", table.courseId.asc(), table.year.asc()),
	index("PastPaper_createdAt_idx").using("btree", table.createdAt.asc()),
	index("PastPaper_isClear_createdAt_idx").using("btree", table.isClear.asc(), table.createdAt.asc()),
	uniqueIndex("PastPaper_questionPaperId_key").using("btree", table.questionPaperId.asc()),
]);

export const sessions = cockroachTable("sessions", {
	id: string().primaryKey(),
	sessionToken: string("session_token").notNull(),
	userId: string("user_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	expires: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	uniqueIndex("sessions_session_token_key").using("btree", table.sessionToken.asc()),
]);

export const studyChat = cockroachTable("StudyChat", {
	id: string().primaryKey(),
	userId: string().notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	scope: studyScope().notNull(),
	noteId: string().references(() => note.id, { onDelete: "set null", onUpdate: "cascade" } ),
	pastPaperId: string().references(() => pastPaper.id, { onDelete: "set null", onUpdate: "cascade" } ),
	courseCode: string(),
	title: string(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	index("StudyChat_userId_courseCode_idx").using("btree", table.userId.asc(), table.courseCode.asc()),
	index("StudyChat_userId_noteId_idx").using("btree", table.userId.asc(), table.noteId.asc()),
	index("StudyChat_userId_pastPaperId_idx").using("btree", table.userId.asc(), table.pastPaperId.asc()),
	index("StudyChat_userId_updatedAt_idx").using("btree", table.userId.asc(), table.updatedAt.asc()),
]);

export const studyMessage = cockroachTable("StudyMessage", {
	id: string().primaryKey(),
	chatId: string().notNull().references(() => studyChat.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	role: string().notNull(),
	parts: jsonb().notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
}, (table) => [
	index("StudyMessage_chatId_createdAt_idx").using("btree", table.chatId.asc(), table.createdAt.asc()),
]);

export const subject = cockroachTable("Subject", {
	id: string().primaryKey(),
	name: string().notNull(),
}, (table) => [
	uniqueIndex("Subject_name_key").using("btree", table.name.asc()),
]);

export const syllabi = cockroachTable("syllabi", {
	id: string().primaryKey(),
	name: string().notNull(),
	fileUrl: string().notNull(),
});

export const tag = cockroachTable("Tag", {
	id: string().primaryKey(),
	name: string().notNull(),
	aliases: string().array(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	uniqueIndex("Tag_name_key").using("btree", table.name.asc()),
	index("Tag_name_trgm_idx").using("btree", table.name.asc()),
]);

export const upcomingExam = cockroachTable("UpcomingExam", {
	id: string().primaryKey(),
	courseId: string().notNull().references(() => course.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	slots: string().array(),
	examType: examType(),
	scheduledAt: timestamp({ mode: 'string', precision: 3 }),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	index("UpcomingExam_courseId_idx").using("btree", table.courseId.asc()),
	index("UpcomingExam_scheduledAt_idx").using("btree", table.scheduledAt.asc()),
]);

export const user = cockroachTable("User", {
	id: string().primaryKey(),
	name: string(),
	email: string().notNull(),
	emailVerified: timestamp("email_verified", { mode: 'string', precision: 3 }),
	image: string(),
	role: role().default("'USER'::public.\"Role\"").notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	uniqueIndex("User_email_key").using("btree", table.email.asc()),
]);

export const viewHistory = cockroachTable("ViewHistory", {
	id: string().primaryKey(),
	userId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	pastPaperId: string().references(() => pastPaper.id, { onDelete: "set null", onUpdate: "cascade" } ),
	noteId: string().references(() => note.id, { onDelete: "set null", onUpdate: "cascade" } ),
	forumPostId: string().references(() => forumPost.id, { onDelete: "set null", onUpdate: "cascade" } ),
	subjectId: string().references(() => subject.id, { onDelete: "set null", onUpdate: "cascade" } ),
	viewedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
	count: int4().default(1).notNull(),
	syllabusId: string().references(() => syllabi.id, { onDelete: "set null", onUpdate: "cascade" } ),
}, (table) => [
	uniqueIndex("ViewHistory_userId_forumPostId_key").using("btree", table.userId.asc(), table.forumPostId.asc()),
	uniqueIndex("ViewHistory_userId_noteId_key").using("btree", table.userId.asc(), table.noteId.asc()),
	uniqueIndex("ViewHistory_userId_pastPaperId_key").using("btree", table.userId.asc(), table.pastPaperId.asc()),
	uniqueIndex("ViewHistory_userId_subjectId_key").using("btree", table.userId.asc(), table.subjectId.asc()),
	uniqueIndex("ViewHistory_userId_syllabusId_key").using("btree", table.userId.asc(), table.syllabusId.asc()),
]);

export const vote = cockroachTable("Vote", {
	id: string().primaryKey(),
	userId: string().notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	forumPostId: string().notNull().references(() => forumPost.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	type: voteType().notNull(),
	createdAt: timestamp({ mode: 'string', precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string', precision: 3 }).notNull(),
}, (table) => [
	uniqueIndex("Vote_userId_forumPostId_key").using("btree", table.userId.asc(), table.forumPostId.asc()),
]);
