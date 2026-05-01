"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StudySidebar } from "./StudySidebar";
import { StudyChat } from "./StudyChat";
import { useNavbarOffset } from "./useNavbarOffset";
import type { StudyScope } from "@/lib/study/scope";
import {
    deleteStudyChatAction,
    getStudyChatMessagesAction,
    listStudyChatsAction,
    renameStudyChatAction,
    type StudyChatMessageDTO,
} from "@/app/actions/studyChats";

interface StudyAppProps {
    initialScope: StudyScope | null;
    initialLabel: string | null;
    initialSubtitle: string | null;
    initialChatId: string | null;
}

export interface StudyChatSummary {
    id: string;
    title: string;
    scope: "NOTE" | "PAST_PAPER" | "COURSE";
    createdAt: string;
    updatedAt: string;
    context: {
        type: "NOTE" | "PAST_PAPER" | "COURSE";
        id?: string | null;
        code?: string | null;
        title?: string | null;
    };
}

type CachedStudyMessage = Pick<StudyChatMessageDTO, "id" | "role" | "parts">;

function cryptoRandomId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return (crypto as Crypto).randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function scopeKey(scope: StudyScope | null): string | null {
    if (!scope) return null;
    if (scope.type === "COURSE") return `COURSE:${scope.code}`;
    return `${scope.type}:${scope.id}`;
}

export function StudyApp({
    initialScope,
    initialLabel,
    initialSubtitle,
    initialChatId,
}: StudyAppProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [chats, setChats] = useState<StudyChatSummary[]>([]);
    const [activeChatId, setActiveChatId] = useState<string>(
        () => initialChatId ?? cryptoRandomId()
    );
    const syncUrlRef = useRef<boolean>(Boolean(initialChatId));
    const [scope, setScope] = useState<StudyScope | null>(initialScope);
    const [scopeLabel, setScopeLabel] = useState<string | null>(initialLabel);
    const [scopeSubtitle, setScopeSubtitle] = useState<string | null>(
        initialSubtitle
    );
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth < 768 : false
    );
    const [renameTarget, setRenameTarget] = useState<StudyChatSummary | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<StudyChatSummary | null>(null);
    const [chatMessageCache, setChatMessageCache] = useState<
        Record<string, CachedStudyMessage[]>
    >({});
    const navOffset = useNavbarOffset();
    const incomingScopeKey = useMemo(() => scopeKey(initialScope), [initialScope]);
    const lastAppliedIncomingScopeKeyRef = useRef<string | null>(null);
    const chatMessageCacheRef = useRef<Record<string, CachedStudyMessage[]>>({});
    const inFlightChatLoadsRef = useRef<
        Partial<Record<string, Promise<CachedStudyMessage[]>>>
    >({});

    const cacheChatMessages = useCallback(
        (chatId: string, messages: CachedStudyMessage[]) => {
            chatMessageCacheRef.current = {
                ...chatMessageCacheRef.current,
                [chatId]: messages,
            };
            setChatMessageCache((prev) => ({
                ...prev,
                [chatId]: messages,
            }));
        },
        []
    );

    const refetchChats = useCallback(async () => {
        try {
            const data = await listStudyChatsAction(80);
            setChats(data as StudyChatSummary[]);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        void refetchChats();
    }, [refetchChats]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(max-width: 767px)");
        const sync = () => {
            setIsMobileViewport(media.matches);
            if (!media.matches) {
                setMobileSidebarOpen(false);
            }
        };
        sync();
        media.addEventListener("change", sync);
        return () => {
            media.removeEventListener("change", sync);
        };
    }, []);

    const prefetchChatMessages = useCallback(
        async (chatId: string) => {
            if (!chatId) return [];
            const cached = chatMessageCacheRef.current[chatId];
            if (cached) return cached;
            if (inFlightChatLoadsRef.current[chatId]) {
                return inFlightChatLoadsRef.current[chatId];
            }

            const promise = getStudyChatMessagesAction(chatId)
                .then((list) =>
                    list.map((message) => ({
                        id: message.id,
                        role: message.role,
                        parts: Array.isArray(message.parts) ? message.parts : [],
                    }))
                )
                .then((messages) => {
                    cacheChatMessages(chatId, messages);
                    return messages;
                })
                .catch(() => [])
                .finally(() => {
                    delete inFlightChatLoadsRef.current[chatId];
                });

            inFlightChatLoadsRef.current[chatId] = promise;
            return promise;
        },
        [cacheChatMessages]
    );

    useEffect(() => {
        chats.slice(0, 4).forEach((chat) => {
            void prefetchChatMessages(chat.id);
        });
    }, [chats, prefetchChatMessages]);

    useEffect(() => {
        if (!syncUrlRef.current || !activeChatId) return;
        const current = searchParams.get("chatId");
        if (current === activeChatId) return;
        const next = new URLSearchParams(searchParams.toString());
        next.set("chatId", activeChatId);
        router.replace(`/study?${next.toString()}`, { scroll: false });
    }, [activeChatId, router, searchParams]);

    useEffect(() => {
        if (!incomingScopeKey) return;
        if (lastAppliedIncomingScopeKeyRef.current === incomingScopeKey) return;
        lastAppliedIncomingScopeKeyRef.current = incomingScopeKey;

        // Ask Tutor deep-links should always begin a fresh chat for that context.
        syncUrlRef.current = false;
        setScope(initialScope);
        setScopeLabel(initialLabel);
        setScopeSubtitle(initialSubtitle);
        setActiveChatId(cryptoRandomId());
        setMobileSidebarOpen(false);

        const next = new URLSearchParams(searchParams.toString());
        if (next.has("chatId")) {
            next.delete("chatId");
            router.replace(`/study${next.size ? `?${next.toString()}` : ""}`, {
                scroll: false,
            });
        }
    }, [
        incomingScopeKey,
        initialScope,
        initialLabel,
        initialSubtitle,
        router,
        searchParams,
    ]);

    const handleSelectChat = useCallback((summary: StudyChatSummary) => {
        void prefetchChatMessages(summary.id);
        syncUrlRef.current = true;
        setActiveChatId(summary.id);
        const nextScope: StudyScope | null =
            summary.context.type === "COURSE" && summary.context.code
                ? { type: "COURSE", code: summary.context.code }
                : summary.context.id
                    ? {
                        type: summary.context.type as "NOTE" | "PAST_PAPER",
                        id: summary.context.id,
                    }
                    : null;
        setScope(nextScope);
        setScopeLabel(summary.context.title ?? summary.title);
        setScopeSubtitle(
            summary.context.type === "NOTE"
                ? "note"
                : summary.context.type === "PAST_PAPER"
                    ? "past paper"
                    : "course"
        );
        setMobileSidebarOpen(false);
    }, [prefetchChatMessages]);

    const handleNewChat = useCallback(() => {
        syncUrlRef.current = false;
        setActiveChatId(cryptoRandomId());
        setMobileSidebarOpen(false);
        const next = new URLSearchParams(searchParams.toString());
        if (next.has("chatId")) {
            next.delete("chatId");
            router.replace(`/study${next.size ? `?${next.toString()}` : ""}`, {
                scroll: false,
            });
        }
    }, [router, searchParams]);

    const handleRenameChat = useCallback(
        async (chat: StudyChatSummary) => {
            setRenameTarget(chat);
            setRenameValue(chat.title);
        },
        []
    );

    const handleDeleteChat = useCallback(
        async (chat: StudyChatSummary) => {
            setDeleteTarget(chat);
        },
        []
    );

    const handleRenameSubmit = useCallback(async () => {
        if (!renameTarget) return;
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === renameTarget.title) {
            setRenameTarget(null);
            return;
        }

        setChats((prev) =>
            prev.map((c) =>
                c.id === renameTarget.id
                    ? { ...c, title: trimmed, updatedAt: new Date().toISOString() }
                    : c
            )
        );
        setRenameTarget(null);

        try {
            const res = await renameStudyChatAction(renameTarget.id, trimmed);
            if (!res.ok) throw new Error("rename failed");
        } catch {
            void refetchChats();
        }
    }, [renameTarget, renameValue, refetchChats]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        const wasActive = target.id === activeChatId;
        setDeleteTarget(null);
        setChats((prev) => prev.filter((c) => c.id !== target.id));

        if (wasActive) {
            const fallback = chats.find((c) => c.id !== target.id);
            if (fallback) {
                handleSelectChat(fallback);
            } else {
                handleNewChat();
            }
        }

        try {
            await deleteStudyChatAction(target.id);
        } catch {
            void refetchChats();
        }
    }, [activeChatId, chats, deleteTarget, handleNewChat, handleSelectChat, refetchChats]);

    const handleClearScope = useCallback(() => {
        setScope(null);
        setScopeLabel(null);
        setScopeSubtitle(null);
        const next = new URLSearchParams(searchParams.toString());
        next.delete("scope");
        next.delete("id");
        next.delete("code");
        router.replace(`/study${next.size ? `?${next.toString()}` : ""}`, {
            scroll: false,
        });
    }, [router, searchParams]);

    const onChatUpdated = useCallback(
        (info: { chatId: string; title?: string | null }) => {
            syncUrlRef.current = true;
            setChats((prev) => {
                const existing = prev.find((c) => c.id === info.chatId);
                if (existing) {
                    return prev.map((c) =>
                        c.id === info.chatId
                            ? {
                                ...c,
                                title: info.title || c.title,
                                updatedAt: new Date().toISOString(),
                            }
                            : c
                    );
                }
                return [
                    {
                        id: info.chatId,
                        title: info.title || "New chat",
                        scope: scope?.type ?? ("COURSE" as const),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        context: scope
                            ? scope.type === "COURSE"
                                ? { type: "COURSE", code: scope.code, title: scope.code }
                                : {
                                    type: scope.type,
                                    id: scope.id,
                                    title: scopeLabel ?? null,
                                }
                            : { type: "COURSE", title: null },
                    },
                    ...prev,
                ];
            });
            setTimeout(() => {
                void refetchChats();
            }, 1200);
        },
        [scope, scopeLabel, refetchChats]
    );

    const sidebar = useMemo(
        () => (
            <StudySidebar
                chats={chats}
                activeChatId={activeChatId}
                onSelect={handleSelectChat}
                onNewChat={handleNewChat}
                onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
                collapsed={sidebarCollapsed}
                isMobile={false}
                onRenameChat={handleRenameChat}
                onDeleteChat={handleDeleteChat}
            />
        ),
        [
            chats,
            activeChatId,
            handleSelectChat,
            handleNewChat,
            sidebarCollapsed,
            handleRenameChat,
            handleDeleteChat,
        ]
    );

    const chatPane = (
        <main className="flex h-full flex-1 flex-col overflow-hidden">
            <StudyChat
                chatId={activeChatId}
                scope={scope}
                scopeLabel={scopeLabel}
                scopeSubtitle={scopeSubtitle}
                onToggleSidebar={() => setMobileSidebarOpen((p) => !p)}
                onClearScope={handleClearScope}
                onChatUpdated={onChatUpdated}
                cachedMessages={chatMessageCache[activeChatId]}
                onMessagesSnapshot={cacheChatMessages}
            />
        </main>
    );

    return (
        <div
            data-study-chat
            style={{ paddingLeft: navOffset }}
            className="flex h-[calc(100svh-56px)] w-full overflow-hidden bg-[#C2E6EC] text-black transition-[padding] duration-200 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
        >
            {isMobileViewport ? (
                <div className="relative h-full w-full overflow-hidden md:hidden">
                    <div
                        className="flex h-full w-[200%] transition-transform duration-300 ease-out"
                        style={{
                            transform: mobileSidebarOpen
                                ? "translate3d(0, 0, 0)"
                                : "translate3d(-50%, 0, 0)",
                        }}
                    >
                        <aside className="h-full w-1/2 shrink-0 border-r border-black/10 dark:border-white/10">
                            <StudySidebar
                                chats={chats}
                                activeChatId={activeChatId}
                                onSelect={handleSelectChat}
                                onNewChat={handleNewChat}
                                onToggleCollapse={() => setMobileSidebarOpen(false)}
                                collapsed={false}
                                isMobile
                                onRenameChat={handleRenameChat}
                                onDeleteChat={handleDeleteChat}
                            />
                        </aside>
                        <div className="h-full w-1/2 shrink-0">{chatPane}</div>
                    </div>
                </div>
            ) : (
                <>
                    <aside
                        className={[
                            "hidden shrink-0 border-r border-black/10 transition-[width] duration-200 dark:border-white/10 md:block",
                            sidebarCollapsed ? "w-14" : "w-64",
                        ].join(" ")}
                    >
                        {sidebar}
                    </aside>
                    {chatPane}
                </>
            )}

            {renameTarget && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#11192b]">
                        <h3 className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                            Rename chat
                        </h3>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleRenameSubmit();
                                if (e.key === "Escape") setRenameTarget(null);
                            }}
                            className="mt-3 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[#4db3d6] dark:border-white/10 dark:bg-[#0E1528] dark:text-[#D5D5D5]"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRenameTarget(null)}
                                className="rounded-md px-3 py-1.5 text-xs text-black/70 hover:bg-black/5 dark:text-[#D5D5D5]/70 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleRenameSubmit()}
                                className="rounded-md bg-black px-3 py-1.5 text-xs text-white hover:bg-black/85 dark:bg-[#3BF4C7] dark:text-[#0C1222] dark:hover:bg-[#3BF4C7]/90"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#11192b]">
                        <h3 className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                            Delete chat?
                        </h3>
                        <p className="mt-2 text-xs text-black/65 dark:text-[#D5D5D5]/65">
                            This cannot be undone.
                        </p>
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="rounded-md px-3 py-1.5 text-xs text-black/70 hover:bg-black/5 dark:text-[#D5D5D5]/70 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDeleteConfirm()}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
