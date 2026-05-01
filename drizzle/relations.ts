import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	forumPost: {
		tags: r.many.tag({
			from: r.forumPost.id.through(r.forumPostToTag.a),
			to: r.tag.id.through(r.forumPostToTag.b)
		}),
		usersViaUserBookmarkedForumPosts: r.many.user({
			from: r.forumPost.id.through(r.userBookmarkedForumPosts.a),
			to: r.user.id.through(r.userBookmarkedForumPosts.b),
			alias: "forumPost_id_user_id_via_userBookmarkedForumPosts"
		}),
		usersViaComment: r.many.user({
			alias: "user_id_forumPost_id_via_comment"
		}),
		viewHistories: r.many.viewHistory(),
		usersViaVote: r.many.user({
			from: r.forumPost.id.through(r.vote.forumPostId),
			to: r.user.id.through(r.vote.userId),
			alias: "forumPost_id_user_id_via_vote"
		}),
	},
	tag: {
		forumPosts: r.many.forumPost(),
		forums: r.many.forum(),
		notes: r.many.note(),
		pastPapers: r.many.pastPaper(),
	},
	forum: {
		tags: r.many.tag({
			from: r.forum.id.through(r.forumToTag.a),
			to: r.tag.id.through(r.forumToTag.b)
		}),
		users: r.many.user(),
	},
	note: {
		tags: r.many.tag({
			from: r.note.id.through(r.noteToTag.a),
			to: r.tag.id.through(r.noteToTag.b)
		}),
		users: r.many.user({
			from: r.note.id.through(r.userBookmarkedNotes.a),
			to: r.user.id.through(r.userBookmarkedNotes.b)
		}),
		studyChats: r.many.studyChat(),
		viewHistories: r.many.viewHistory(),
	},
	pastPaper: {
		tags: r.many.tag({
			from: r.pastPaper.id.through(r.pastPaperToTag.a),
			to: r.tag.id.through(r.pastPaperToTag.b)
		}),
		users: r.many.user({
			from: r.pastPaper.id.through(r.userBookmarkedPastPapers.a),
			to: r.user.id.through(r.userBookmarkedPastPapers.b),
			alias: "pastPaper_id_user_id_via_userBookmarkedPastPapers"
		}),
		user: r.one.user({
			from: r.pastPaper.authorId,
			to: r.user.id,
			alias: "pastPaper_authorId_user_id"
		}),
		course: r.one.course({
			from: r.pastPaper.courseId,
			to: r.course.id
		}),
		pastPaper: r.one.pastPaper({
			from: r.pastPaper.questionPaperId,
			to: r.pastPaper.id,
			alias: "pastPaper_questionPaperId_pastPaper_id"
		}),
		pastPapers: r.one.pastPaper({
			alias: "pastPaper_questionPaperId_pastPaper_id"
		}),
		studyChats: r.many.studyChat(),
		viewHistories: r.many.viewHistory(),
	},
	user: {
		forumPostsViaUserBookmarkedForumPosts: r.many.forumPost({
			alias: "forumPost_id_user_id_via_userBookmarkedForumPosts"
		}),
		notes: r.many.note(),
		pastPapersViaUserBookmarkedPastPapers: r.many.pastPaper({
			alias: "pastPaper_id_user_id_via_userBookmarkedPastPapers"
		}),
		subjects: r.many.subject(),
		syllabi: r.many.syllabi({
			from: r.user.id.through(r.userBookmarkedSyllabus.a),
			to: r.syllabi.id.through(r.userBookmarkedSyllabus.b)
		}),
		accounts: r.many.accounts(),
		forumPostsViaComment: r.many.forumPost({
			from: r.user.id.through(r.comment.authorId),
			to: r.forumPost.id.through(r.comment.forumPostId),
			alias: "user_id_forumPost_id_via_comment"
		}),
		forums: r.many.forum({
			from: r.user.id.through(r.forumPost.authorId),
			to: r.forum.id.through(r.forumPost.forumId)
		}),
		courses: r.many.course({
			from: r.user.id.through(r.note.authorId),
			to: r.course.id.through(r.note.courseId)
		}),
		pastPapersAuthorId: r.many.pastPaper({
			alias: "pastPaper_authorId_user_id"
		}),
		sessions: r.many.sessions(),
		studyChats: r.many.studyChat(),
		viewHistories: r.many.viewHistory(),
		forumPostsViaVote: r.many.forumPost({
			alias: "forumPost_id_user_id_via_vote"
		}),
	},
	subject: {
		users: r.many.user({
			from: r.subject.id.through(r.userBookmarkedResources.a),
			to: r.user.id.through(r.userBookmarkedResources.b)
		}),
		modules: r.many.module(),
		viewHistories: r.many.viewHistory(),
	},
	syllabi: {
		users: r.many.user(),
		viewHistories: r.many.viewHistory(),
	},
	accounts: {
		user: r.one.user({
			from: r.accounts.userId,
			to: r.user.id
		}),
	},
	module: {
		subject: r.one.subject({
			from: r.module.subjectId,
			to: r.subject.id
		}),
	},
	course: {
		users: r.many.user(),
		pastPapers: r.many.pastPaper(),
		upcomingExams: r.many.upcomingExam(),
	},
	sessions: {
		user: r.one.user({
			from: r.sessions.userId,
			to: r.user.id
		}),
	},
	studyChat: {
		note: r.one.note({
			from: r.studyChat.noteId,
			to: r.note.id
		}),
		pastPaper: r.one.pastPaper({
			from: r.studyChat.pastPaperId,
			to: r.pastPaper.id
		}),
		user: r.one.user({
			from: r.studyChat.userId,
			to: r.user.id
		}),
		studyMessages: r.many.studyMessage(),
	},
	studyMessage: {
		studyChat: r.one.studyChat({
			from: r.studyMessage.chatId,
			to: r.studyChat.id
		}),
	},
	upcomingExam: {
		course: r.one.course({
			from: r.upcomingExam.courseId,
			to: r.course.id
		}),
	},
	viewHistory: {
		forumPost: r.one.forumPost({
			from: r.viewHistory.forumPostId,
			to: r.forumPost.id
		}),
		note: r.one.note({
			from: r.viewHistory.noteId,
			to: r.note.id
		}),
		pastPaper: r.one.pastPaper({
			from: r.viewHistory.pastPaperId,
			to: r.pastPaper.id
		}),
		subject: r.one.subject({
			from: r.viewHistory.subjectId,
			to: r.subject.id
		}),
		syllabus: r.one.syllabi({
			from: r.viewHistory.syllabusId,
			to: r.syllabi.id
		}),
		user: r.one.user({
			from: r.viewHistory.userId,
			to: r.user.id
		}),
	},
}))