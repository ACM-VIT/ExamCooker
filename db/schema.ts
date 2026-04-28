import { randomUUID } from "node:crypto";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  campusValues,
  examTypeValues,
  roleValues,
  studyScopeValues,
  semesterValues,
  voteTypeValues,
} from "@/db/enums";

const cockroachEnum = pgEnum;
const cockroachTable = pgTable;
const string = text;
const bool = boolean;
const int4 = integer;

const createId = () => randomUUID();
const now = () => new Date();

const createdAtColumn = () =>
  timestamp({ mode: "date", precision: 3 }).defaultNow().notNull();

const updatedAtColumn = () =>
  timestamp({ mode: "date", precision: 3 }).$onUpdate(now).notNull();

const touchedAtColumn = () =>
  timestamp({ mode: "date", precision: 3 })
    .$defaultFn(now)
    .$onUpdate(now)
    .notNull();

export const role = cockroachEnum("Role", roleValues);
export const voteType = cockroachEnum("VoteType", voteTypeValues);
export const studyScope = cockroachEnum("StudyScope", studyScopeValues);
export const examType = cockroachEnum("ExamType", examTypeValues);
export const semester = cockroachEnum("Semester", semesterValues);
export const campus = cockroachEnum("Campus", campusValues);

export const prismaMigrations = cockroachTable("_prisma_migrations", {
  id: varchar({ length: 36 }).primaryKey(),
  checksum: varchar({ length: 64 }).notNull(),
  finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
  migrationName: varchar("migration_name", { length: 255 }).notNull(),
  logs: string(),
  rolledBackAt: timestamp("rolled_back_at", { mode: "date", withTimezone: true }),
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  appliedStepsCount: bigint("applied_steps_count", { mode: "number" })
    .default(0)
    .notNull(),
});

export const user = cockroachTable(
  "User",
  {
    id: string().$defaultFn(createId).primaryKey(),
    email: string().notNull(),
    role: role().default("USER").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    emailVerified: timestamp("email_verified", { mode: "date", precision: 3 }),
    name: string(),
    image: string(),
  },
  (table) => [
    uniqueIndex("User_email_key").using("btree", table.email.asc()),
    index("User_name_trgm_idx").using("gin", table.name.asc()),
  ],
);

export const accounts = cockroachTable(
  "accounts",
  {
    id: string().$defaultFn(createId).primaryKey(),
    userId: string("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
  },
  (table) => [
    uniqueIndex("accounts_provider_provider_account_id_key").using(
      "btree",
      table.provider.asc(),
      table.providerAccountId.asc(),
    ),
    index("accounts_user_id_idx").using("btree", table.userId.asc()),
  ],
);

export const sessions = cockroachTable(
  "sessions",
  {
    id: string().$defaultFn(createId).primaryKey(),
    sessionToken: string("session_token").notNull(),
    userId: string("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    expires: timestamp({ mode: "date", precision: 3 }).notNull(),
  },
  (table) => [
    index("sessions_expires_idx").using("btree", table.expires.asc()),
    uniqueIndex("sessions_session_token_key").using(
      "btree",
      table.sessionToken.asc(),
    ),
    index("sessions_user_id_idx").using("btree", table.userId.asc()),
  ],
);

export const course = cockroachTable(
  "Course",
  {
    id: string().$defaultFn(createId).primaryKey(),
    code: string().notNull(),
    title: string().notNull(),
    aliases: string().array().$defaultFn(() => []),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("Course_aliases_inverted_idx").using("gin", table.aliases.asc()),
    uniqueIndex("Course_code_key").using("btree", table.code.asc()),
    index("Course_title_idx").using("btree", table.title.asc()),
  ],
);

export const forum = cockroachTable("Forum", {
  id: string().$defaultFn(createId).primaryKey(),
  courseName: string().notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const subject = cockroachTable(
  "Subject",
  {
    id: string().$defaultFn(createId).primaryKey(),
    name: string().notNull(),
  },
  (table) => [
    uniqueIndex("Subject_name_key").using("btree", table.name.asc()),
    index("Subject_name_trgm_idx").using("gin", table.name.asc()),
  ],
);

export const syllabi = cockroachTable(
  "syllabi",
  {
    id: string().$defaultFn(createId).primaryKey(),
    name: string().notNull(),
    fileUrl: string().notNull(),
  },
  (table) => [
    index("syllabi_name_idx").using("btree", table.name.asc()),
    index("syllabi_name_trgm_idx").using("gin", table.name.asc()),
  ],
);

export const tag = cockroachTable(
  "Tag",
  {
    id: string().$defaultFn(createId).primaryKey(),
    name: string().notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    aliases: string().array().$defaultFn(() => []),
  },
  (table) => [
    uniqueIndex("Tag_name_key").using("btree", table.name.asc()),
    index("Tag_name_trgm_idx").using("gin", table.name.asc()),
  ],
);

export const module = cockroachTable(
  "Module",
  {
    id: string().$defaultFn(createId).primaryKey(),
    title: string().notNull(),
    subjectId: string()
      .notNull()
      .references(() => subject.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    webReferences: string().array().$defaultFn(() => []),
    youtubeLinks: string().array().$defaultFn(() => []),
  },
  (table) => [index("Module_subjectId_idx").using("btree", table.subjectId.asc())],
);

export const forumPost = cockroachTable(
  "ForumPost",
  {
    id: string().$defaultFn(createId).primaryKey(),
    title: string().notNull(),
    authorId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    forumId: string()
      .notNull()
      .references(() => forum.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    description: string().default("").notNull(),
    downvoteCount: int4().default(0).notNull(),
    upvoteCount: int4().default(0).notNull(),
  },
  (table) => [
    index("ForumPost_authorId_idx").using("btree", table.authorId.asc()),
    index("ForumPost_createdAt_idx").using("btree", table.createdAt.asc()),
    index("ForumPost_description_trgm_idx").using(
      "gin",
      table.description.asc(),
    ),
    index("ForumPost_forumId_createdAt_idx").using(
      "btree",
      table.forumId.asc(),
      table.createdAt.asc(),
    ),
    index("ForumPost_title_trgm_idx").using("gin", table.title.asc()),
  ],
);

export const note = cockroachTable(
  "Note",
  {
    id: string().$defaultFn(createId).primaryKey(),
    title: string().notNull(),
    authorId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fileUrl: string().notNull(),
    isClear: bool().default(false).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    thumbNailUrl: string(),
    courseId: string().references(() => course.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("Note_authorId_idx").using("btree", table.authorId.asc()),
    index("Note_courseId_idx").using("btree", table.courseId.asc()),
    index("Note_courseId_isClear_createdAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.createdAt.asc(),
    ),
    index("Note_courseId_isClear_updatedAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.updatedAt.asc(),
    ),
    index("Note_createdAt_idx").using("btree", table.createdAt.asc()),
    index("Note_isClear_createdAt_idx").using(
      "btree",
      table.isClear.asc(),
      table.createdAt.asc(),
    ),
    index("Note_title_trgm_idx").using("gin", table.title.asc()),
  ],
);

export const pastPaper = cockroachTable(
  "PastPaper",
  {
    id: string().$defaultFn(createId).primaryKey(),
    title: string().notNull(),
    fileUrl: string().notNull(),
    authorId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isClear: bool().default(false).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    thumbNailUrl: string(),
    courseId: string().references(() => course.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    examType: examType(),
    slot: string(),
    year: int4(),
    semester: semester().default("UNKNOWN").notNull(),
    campus: campus().default("VELLORE").notNull(),
    hasAnswerKey: bool().default(false).notNull(),
    questionPaperId: string(),
  },
  (table) => [
    foreignKey({
      columns: [table.questionPaperId],
      foreignColumns: [table.id],
      name: "PastPaper_questionPaperId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("PastPaper_authorId_idx").using("btree", table.authorId.asc()),
    index("PastPaper_courseId_examType_idx").using(
      "btree",
      table.courseId.asc(),
      table.examType.asc(),
    ),
    index("PastPaper_courseId_isClear_createdAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.createdAt.asc(),
    ),
    index("PastPaper_courseId_isClear_examType_year_createdAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.examType.asc(),
      table.year.asc(),
      table.createdAt.asc(),
    ),
    index("PastPaper_courseId_isClear_year_createdAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.year.asc(),
      table.createdAt.asc(),
    ),
    index("PastPaper_courseId_slot_idx").using(
      "btree",
      table.courseId.asc(),
      table.slot.asc(),
    ),
    index("PastPaper_courseId_year_idx").using(
      "btree",
      table.courseId.asc(),
      table.year.asc(),
    ),
    index("PastPaper_createdAt_idx").using("btree", table.createdAt.asc()),
    index("PastPaper_isClear_createdAt_idx").using(
      "btree",
      table.isClear.asc(),
      table.createdAt.asc(),
    ),
    index("PastPaper_isClear_examType_courseId_year_createdAt_idx").using(
      "btree",
      table.isClear.asc(),
      table.examType.asc(),
      table.courseId.asc(),
      table.year.asc(),
      table.createdAt.asc(),
    ),
    index("PastPaper_metadata_sibling_idx").using(
      "btree",
      table.courseId.asc(),
      table.isClear.asc(),
      table.examType.asc(),
      table.slot.asc(),
      table.year.asc(),
      table.semester.asc(),
      table.campus.asc(),
      table.hasAnswerKey.asc(),
      table.createdAt.asc(),
    ),
    uniqueIndex("PastPaper_questionPaperId_key").using(
      "btree",
      table.questionPaperId.asc(),
    ),
    index("PastPaper_title_trgm_idx").using("gin", table.title.asc()),
  ],
);

export const studyChat = cockroachTable(
  "StudyChat",
  {
    id: string().$defaultFn(createId).primaryKey(),
    userId: string()
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    scope: studyScope().notNull(),
    noteId: string().references(() => note.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    pastPaperId: string().references(() => pastPaper.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    courseCode: string(),
    title: string(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("StudyChat_userId_courseCode_idx").using(
      "btree",
      table.userId.asc(),
      table.courseCode.asc(),
    ),
    index("StudyChat_userId_noteId_idx").using(
      "btree",
      table.userId.asc(),
      table.noteId.asc(),
    ),
    index("StudyChat_userId_pastPaperId_idx").using(
      "btree",
      table.userId.asc(),
      table.pastPaperId.asc(),
    ),
    index("StudyChat_userId_updatedAt_idx").using(
      "btree",
      table.userId.asc(),
      table.updatedAt.asc(),
    ),
  ],
);

export const studyMessage = cockroachTable(
  "StudyMessage",
  {
    id: string().$defaultFn(createId).primaryKey(),
    chatId: string()
      .notNull()
      .references(() => studyChat.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: string().notNull(),
    parts: jsonb().notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("StudyMessage_chatId_createdAt_idx").using(
      "btree",
      table.chatId.asc(),
      table.createdAt.asc(),
    ),
  ],
);

export const comment = cockroachTable(
  "Comment",
  {
    id: string().$defaultFn(createId).primaryKey(),
    content: string().notNull(),
    authorId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    forumPostId: string()
      .notNull()
      .references(() => forumPost.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("Comment_authorId_idx").using("btree", table.authorId.asc()),
    index("Comment_forumPostId_createdAt_idx").using(
      "btree",
      table.forumPostId.asc(),
      table.createdAt.asc(),
    ),
  ],
);

export const upcomingExam = cockroachTable(
  "UpcomingExam",
  {
    id: string().$defaultFn(createId).primaryKey(),
    courseId: string()
      .notNull()
      .references(() => course.id, { onDelete: "cascade", onUpdate: "cascade" }),
    slots: string().array().$defaultFn(() => []),
    examType: examType(),
    scheduledAt: timestamp({ mode: "date", precision: 3 }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("UpcomingExam_courseId_idx").using("btree", table.courseId.asc()),
    index("UpcomingExam_courseId_scheduledAt_idx").using(
      "btree",
      table.courseId.asc(),
      table.scheduledAt.asc(),
    ),
    index("UpcomingExam_scheduledAt_createdAt_idx").using(
      "btree",
      table.scheduledAt.asc(),
      table.createdAt.asc(),
    ),
    index("UpcomingExam_scheduledAt_idx").using(
      "btree",
      table.scheduledAt.asc(),
    ),
  ],
);

export const viewHistory = cockroachTable(
  "ViewHistory",
  {
    id: string().$defaultFn(createId).primaryKey(),
    userId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    pastPaperId: string().references(() => pastPaper.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    noteId: string().references(() => note.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    subjectId: string().references(() => subject.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    viewedAt: touchedAtColumn(),
    forumPostId: string().references(() => forumPost.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    count: int4().default(1).notNull(),
    syllabusId: string().references(() => syllabi.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("ViewHistory_forumPostId_idx").using("btree", table.forumPostId.asc()),
    index("ViewHistory_noteId_idx").using("btree", table.noteId.asc()),
    index("ViewHistory_pastPaperId_idx").using("btree", table.pastPaperId.asc()),
    index("ViewHistory_subjectId_idx").using("btree", table.subjectId.asc()),
    index("ViewHistory_syllabusId_idx").using("btree", table.syllabusId.asc()),
    uniqueIndex("ViewHistory_userId_forumPostId_key").using(
      "btree",
      table.userId.asc(),
      table.forumPostId.asc(),
    ),
    uniqueIndex("ViewHistory_userId_noteId_key").using(
      "btree",
      table.userId.asc(),
      table.noteId.asc(),
    ),
    uniqueIndex("ViewHistory_userId_pastPaperId_key").using(
      "btree",
      table.userId.asc(),
      table.pastPaperId.asc(),
    ),
    uniqueIndex("ViewHistory_userId_subjectId_key").using(
      "btree",
      table.userId.asc(),
      table.subjectId.asc(),
    ),
    uniqueIndex("ViewHistory_userId_syllabusId_key").using(
      "btree",
      table.userId.asc(),
      table.syllabusId.asc(),
    ),
    index("ViewHistory_userId_viewedAt_idx").using(
      "btree",
      table.userId.asc(),
      table.viewedAt.asc(),
    ),
  ],
);

export const vote = cockroachTable(
  "Vote",
  {
    id: string().$defaultFn(createId).primaryKey(),
    userId: string()
      .notNull()
      .references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    forumPostId: string()
      .notNull()
      .references(() => forumPost.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    type: voteType().notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("Vote_forumPostId_idx").using("btree", table.forumPostId.asc()),
    uniqueIndex("Vote_userId_forumPostId_key").using(
      "btree",
      table.userId.asc(),
      table.forumPostId.asc(),
    ),
  ],
);

export const noteToTag = cockroachTable(
  "_NoteToTag",
  {
    a: string("A")
      .notNull()
      .references(() => note.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: string("B")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_NoteToTag_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_NoteToTag_B_index").using("btree", table.b.asc()),
  ],
);

export const forumToTag = cockroachTable(
  "_ForumToTag",
  {
    a: string("A")
      .notNull()
      .references(() => forum.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: string("B")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_ForumToTag_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_ForumToTag_B_index").using("btree", table.b.asc()),
  ],
);

export const forumPostToTag = cockroachTable(
  "_ForumPostToTag",
  {
    a: string("A")
      .notNull()
      .references(() => forumPost.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    b: string("B")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_ForumPostToTag_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_ForumPostToTag_B_index").using("btree", table.b.asc()),
  ],
);

export const pastPaperToTag = cockroachTable(
  "_PastPaperToTag",
  {
    a: string("A")
      .notNull()
      .references(() => pastPaper.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    b: string("B")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_PastPaperToTag_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_PastPaperToTag_B_index").using("btree", table.b.asc()),
  ],
);

export const userBookmarkedNotes = cockroachTable(
  "_UserBookmarkedNotes",
  {
    a: string("A")
      .notNull()
      .references(() => note.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: string("B")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_UserBookmarkedNotes_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_UserBookmarkedNotes_B_index").using("btree", table.b.asc()),
  ],
);

export const userBookmarkedPastPapers = cockroachTable(
  "_UserBookmarkedPastPapers",
  {
    a: string("A")
      .notNull()
      .references(() => pastPaper.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    b: string("B")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_UserBookmarkedPastPapers_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_UserBookmarkedPastPapers_B_index").using("btree", table.b.asc()),
  ],
);

export const userBookmarkedForumPosts = cockroachTable(
  "_UserBookmarkedForumPosts",
  {
    a: string("A")
      .notNull()
      .references(() => forumPost.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    b: string("B")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_UserBookmarkedForumPosts_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_UserBookmarkedForumPosts_B_index").using("btree", table.b.asc()),
  ],
);

export const userBookmarkedResources = cockroachTable(
  "_UserBookmarkedResources",
  {
    a: string("A")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: string("B")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_UserBookmarkedResources_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_UserBookmarkedResources_B_index").using("btree", table.b.asc()),
  ],
);

export const userBookmarkedSyllabus = cockroachTable(
  "_UserBookmarkedSyllabus",
  {
    a: string("A")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: string("B")
      .notNull()
      .references(() => syllabi.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    uniqueIndex("_UserBookmarkedSyllabus_AB_unique").using(
      "btree",
      table.a.asc(),
      table.b.asc(),
    ),
    index("_UserBookmarkedSyllabus_B_index").using("btree", table.b.asc()),
  ],
);
