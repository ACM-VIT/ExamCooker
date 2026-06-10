import { and, desc, eq } from "drizzle-orm";
import { db, studyChat, studyMessage } from "@/db";
import type { StudyScope } from "./scope";
import type { UIMessage } from "ai";

interface EnsureChatInput {
    chatId?: string;
    userId: string;
    scope: StudyScope;
    firstUserText?: string;
}

export async function ensureStudyChat({
    chatId,
    userId,
    scope,
    firstUserText,
}: EnsureChatInput) {
    if (chatId) {
        const [existing] = await db
            .select()
            .from(studyChat)
            .where(and(eq(studyChat.id, chatId), eq(studyChat.userId, userId)))
            .limit(1);
        if (existing) return existing;
    }

    const title = firstUserText
        ? firstUserText.slice(0, 80).replace(/\s+/g, " ").trim()
        : scope.type === "COURSE"
            ? `${scope.code} study`
            : "study chat";

    const [created] = await db
        .insert(studyChat)
        .values({
            ...(chatId ? { id: chatId } : {}),
            userId,
            scope: scope.type,
            noteId: scope.type === "NOTE" ? scope.id : null,
            pastPaperId: scope.type === "PAST_PAPER" ? scope.id : null,
            courseCode: scope.type === "COURSE" ? scope.code : null,
            title,
        })
        .returning();

    return created;
}

export async function loadStudyChatMessages({
    chatId,
    userId,
    take = 24,
}: {
    chatId: string;
    userId: string;
    take?: number;
}): Promise<UIMessage[]> {
    const rows = await db
        .select({
            id: studyMessage.id,
            role: studyMessage.role,
            parts: studyMessage.parts,
        })
        .from(studyMessage)
        .innerJoin(studyChat, eq(studyMessage.chatId, studyChat.id))
        .where(and(eq(studyChat.id, chatId), eq(studyChat.userId, userId)))
        .orderBy(desc(studyMessage.createdAt))
        .limit(take);

    return rows
        .reverse()
        .map((message) => ({
            id: message.id,
            role: message.role as UIMessage["role"],
            parts: (Array.isArray(message.parts) ? message.parts : []) as UIMessage["parts"],
        }));
}

export async function persistStudyTurn({
    chatId,
    userMessage,
    assistantMessage,
}: {
    chatId: string;
    userMessage?: { id: string; parts: unknown };
    assistantMessage?: { id: string; parts: unknown };
}) {
    if (userMessage) {
        await db
            .insert(studyMessage)
            .values({
                id: userMessage.id,
                chatId,
                role: "user",
                parts: userMessage.parts,
            })
            .onConflictDoNothing({ target: studyMessage.id });
    }
    if (assistantMessage) {
        await db
            .insert(studyMessage)
            .values({
                id: assistantMessage.id,
                chatId,
                role: "assistant",
                parts: assistantMessage.parts,
            })
            .onConflictDoUpdate({
                target: studyMessage.id,
                set: { parts: assistantMessage.parts },
            });
    }
    await db
        .update(studyChat)
        .set({ updatedAt: new Date() })
        .where(eq(studyChat.id, chatId));
}
