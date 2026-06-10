"use server";

import { auth } from "@/app/auth";
import { and, asc, desc, eq } from "drizzle-orm";
import { course, db, note, pastPaper, studyChat, studyMessage } from "@/db";

export interface StudyChatSummaryDTO {
    id: string;
    title: string;
    scope: "NOTE" | "PAST_PAPER" | "COURSE";
    createdAt: string;
    updatedAt: string;
    context:
        | { type: "NOTE"; id?: string | null; title?: string | null }
        | { type: "PAST_PAPER"; id?: string | null; title?: string | null }
        | { type: "COURSE"; code?: string | null; title?: string | null };
}

export interface StudyChatMessageDTO {
    id: string;
    role: "user" | "assistant";
    parts: unknown;
    createdAt: string;
}

export async function listStudyChatsAction(limit = 80): Promise<StudyChatSummaryDTO[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const chats = await db
        .select({
            id: studyChat.id,
            title: studyChat.title,
            scope: studyChat.scope,
            noteId: studyChat.noteId,
            pastPaperId: studyChat.pastPaperId,
            courseCode: studyChat.courseCode,
            createdAt: studyChat.createdAt,
            updatedAt: studyChat.updatedAt,
            noteTitle: note.title,
            pastPaperTitle: pastPaper.title,
            courseTitle: course.title,
        })
        .from(studyChat)
        .leftJoin(note, eq(studyChat.noteId, note.id))
        .leftJoin(pastPaper, eq(studyChat.pastPaperId, pastPaper.id))
        .leftJoin(course, eq(studyChat.courseCode, course.code))
        .where(eq(studyChat.userId, session.user.id))
        .orderBy(desc(studyChat.updatedAt))
        .limit(safeLimit);

    return chats.map((c) => ({
        id: c.id,
        title: c.title ?? "Untitled chat",
        scope: c.scope,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        context:
            c.scope === "NOTE"
                ? { type: "NOTE", id: c.noteId, title: c.noteTitle }
                : c.scope === "PAST_PAPER"
                    ? { type: "PAST_PAPER", id: c.pastPaperId, title: c.pastPaperTitle }
                    : { type: "COURSE", code: c.courseCode, title: c.courseTitle ?? c.courseCode },
    }));
}

export async function getStudyChatMessagesAction(chatId: string): Promise<StudyChatMessageDTO[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    const messages = await db
        .select({
            id: studyMessage.id,
            role: studyMessage.role,
            parts: studyMessage.parts,
            createdAt: studyMessage.createdAt,
        })
        .from(studyMessage)
        .innerJoin(studyChat, eq(studyMessage.chatId, studyChat.id))
        .where(and(eq(studyChat.id, chatId), eq(studyChat.userId, session.user.id)))
        .orderBy(asc(studyMessage.createdAt));

    return messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.parts,
        createdAt: m.createdAt.toISOString(),
    }));
}

export async function renameStudyChatAction(chatId: string, title: string): Promise<{ ok: boolean }> {
    const session = await auth();
    if (!session?.user?.id) return { ok: false };

    const nextTitle = title.trim();
    if (!nextTitle || nextTitle.length > 100) return { ok: false };

    const updated = await db
        .update(studyChat)
        .set({ title: nextTitle, updatedAt: new Date() })
        .where(and(eq(studyChat.id, chatId), eq(studyChat.userId, session.user.id)))
        .returning({ id: studyChat.id });

    return { ok: updated.length > 0 };
}

export async function deleteStudyChatAction(chatId: string): Promise<{ ok: boolean }> {
    const session = await auth();
    if (!session?.user?.id) return { ok: false };

    const deleted = await db
        .delete(studyChat)
        .where(and(eq(studyChat.id, chatId), eq(studyChat.userId, session.user.id)))
        .returning({ id: studyChat.id });

    return { ok: deleted.length > 0 };
}
