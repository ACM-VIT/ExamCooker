import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, note, pastPaper } from "@/db";
import type { Metadata } from "next";
import { StudyApp } from "@/app/components/study-assistant/StudyApp";
import type { StudyScope } from "@/lib/study/scope";

export const metadata: Metadata = {
    title: "Study Assistant",
    description:
        "Your AI study partner for VIT coursework — ask questions, get explanations, quiz yourself, and find related papers.",
    alternates: { canonical: "/study" },
};

interface StudyPageProps {
    searchParams: Promise<{
        scope?: string;
        id?: string;
        code?: string;
        chatId?: string;
    }>;
}

async function resolveScopeAndContext(
    params: { scope?: string; id?: string; code?: string }
): Promise<{
    scope: StudyScope | null;
    label: string | null;
    subtitle: string | null;
}> {
    const { scope, id, code } = params;
    if (scope === "NOTE" && id) {
        const [noteRow] = await db
            .select({ id: note.id, title: note.title })
            .from(note)
            .where(eq(note.id, id))
            .limit(1);
        if (noteRow) {
            return {
                scope: { type: "NOTE", id: noteRow.id },
                label: noteRow.title.replace(/\.pdf$/i, ""),
                subtitle: "from your notes",
            };
        }
    }
    if (scope === "PAST_PAPER" && id) {
        const [paper] = await db
            .select({ id: pastPaper.id, title: pastPaper.title })
            .from(pastPaper)
            .where(eq(pastPaper.id, id))
            .limit(1);
        if (paper) {
            return {
                scope: { type: "PAST_PAPER", id: paper.id },
                label: paper.title,
                subtitle: "past paper",
            };
        }
    }
    if (scope === "COURSE" && code) {
        return {
            scope: { type: "COURSE", code },
            label: code,
            subtitle: "course",
        };
    }
    return { scope: null, label: null, subtitle: null };
}

export default async function StudyPage({ searchParams }: StudyPageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        const next = "/study";
        redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(next)}`);
    }

    const params = await searchParams;
    const { scope, label, subtitle } = await resolveScopeAndContext(params);

    return (
        <StudyApp
            initialScope={scope}
            initialLabel={label}
            initialSubtitle={subtitle}
            initialChatId={params.chatId ?? null}
        />
    );
}
