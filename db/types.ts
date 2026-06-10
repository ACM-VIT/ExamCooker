import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  Campus,
  ExamType,
  Role,
  Semester,
  StudyScope,
  VoteType,
} from "@/db/enums";
import {
  accounts,
  comment,
  course,
  forum,
  forumPost,
  module,
  note,
  pastPaper,
  sessions,
  studyChat,
  studyMessage,
  subject,
  syllabi,
  tag,
  upcomingExam,
  user,
  viewHistory,
  vote,
} from "@/db/schema";

export type Account = InferSelectModel<typeof accounts>;
export type Comment = InferSelectModel<typeof comment>;
export type Course = InferSelectModel<typeof course>;
export type Forum = InferSelectModel<typeof forum>;
export type ForumPost = InferSelectModel<typeof forumPost>;
export type Module = InferSelectModel<typeof module>;
export type Note = InferSelectModel<typeof note>;
export type PastPaper = InferSelectModel<typeof pastPaper>;
export type Session = InferSelectModel<typeof sessions>;
export type StudyChat = InferSelectModel<typeof studyChat>;
export type StudyMessage = InferSelectModel<typeof studyMessage>;
export type Subject = InferSelectModel<typeof subject>;
export type Syllabus = InferSelectModel<typeof syllabi>;
export type Tag = InferSelectModel<typeof tag>;
export type UpcomingExam = InferSelectModel<typeof upcomingExam>;
export type User = InferSelectModel<typeof user>;
export type ViewHistory = InferSelectModel<typeof viewHistory>;
export type Vote = InferSelectModel<typeof vote>;

export type NewAccount = InferInsertModel<typeof accounts>;
export type NewComment = InferInsertModel<typeof comment>;
export type NewCourse = InferInsertModel<typeof course>;
export type NewForum = InferInsertModel<typeof forum>;
export type NewForumPost = InferInsertModel<typeof forumPost>;
export type NewModule = InferInsertModel<typeof module>;
export type NewNote = InferInsertModel<typeof note>;
export type NewPastPaper = InferInsertModel<typeof pastPaper>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewStudyChat = InferInsertModel<typeof studyChat>;
export type NewStudyMessage = InferInsertModel<typeof studyMessage>;
export type NewSubject = InferInsertModel<typeof subject>;
export type NewSyllabus = InferInsertModel<typeof syllabi>;
export type NewTag = InferInsertModel<typeof tag>;
export type NewUpcomingExam = InferInsertModel<typeof upcomingExam>;
export type NewUser = InferInsertModel<typeof user>;
export type NewViewHistory = InferInsertModel<typeof viewHistory>;
export type NewVote = InferInsertModel<typeof vote>;

export type { Campus, ExamType, Role, Semester, StudyScope, VoteType };
