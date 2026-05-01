"use client";

import { useEffect, useMemo, useState } from "react";
import {
    PanelLeftClose,
    PanelLeft,
    Plus,
    Search,
    X,
    MoreHorizontal,
} from "lucide-react";
import { createPortal } from "react-dom";
import { SidebarWordmark } from "./SidebarWordmark";
import type { StudyChatSummary } from "./StudyApp";

interface StudySidebarProps {
    chats: StudyChatSummary[];
    activeChatId: string;
    onSelect: (chat: StudyChatSummary) => void;
    onNewChat: () => void;
    onToggleCollapse: () => void;
    collapsed: boolean;
    isMobile: boolean;
    onRenameChat: (chat: StudyChatSummary) => void;
    onDeleteChat: (chat: StudyChatSummary) => void;
}

type Bucket = "today" | "week" | "older";

function bucketFor(iso: string): Bucket {
    const d = new Date(iso);
    const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1.5) return "today";
    if (diffDays < 7) return "week";
    return "older";
}

export function StudySidebar({
    chats,
    activeChatId,
    onSelect,
    onNewChat,
    onToggleCollapse,
    collapsed,
    isMobile,
    onRenameChat,
    onDeleteChat,
}: StudySidebarProps) {
    const [query, setQuery] = useState("");
    const [menuState, setMenuState] = useState<{ chatId: string; x: number; y: number } | null>(
        null
    );

    const filtered = useMemo(() => {
        if (!query.trim()) return chats;
        const q = query.toLowerCase();
        return chats.filter(
            (c) =>
                c.title.toLowerCase().includes(q) ||
                c.context.title?.toLowerCase().includes(q)
        );
    }, [chats, query]);

    const grouped = useMemo(() => {
        const map: Record<Bucket, StudyChatSummary[]> = {
            today: [],
            week: [],
            older: [],
        };
        for (const c of filtered) map[bucketFor(c.updatedAt)].push(c);
        return map;
    }, [filtered]);

    useEffect(() => {
        if (!menuState) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-study-chat-menu]")) return;
            if (target?.closest("[data-study-chat-menu-trigger]")) return;
            setMenuState(null);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuState(null);
        };
        const onViewportChange = () => setMenuState(null);

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onEscape);
        window.addEventListener("resize", onViewportChange);
        window.addEventListener("scroll", onViewportChange, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onEscape);
            window.removeEventListener("resize", onViewportChange);
            window.removeEventListener("scroll", onViewportChange, true);
        };
    }, [menuState]);

    if (collapsed && !isMobile) {
        // Collapsed rail — flush against the main NavBar, same bg so they read as one column.
        return (
            <div className="flex h-full flex-col items-center bg-[#C2E6EC] dark:bg-[#0C1222] py-3">
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label="expand sidebar"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-black/70 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                >
                    <PanelLeft className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onNewChat}
                    aria-label="new chat"
                    title="new chat"
                    className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/60 text-black/80 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-[#D5D5D5] dark:hover:bg-white/10"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-[#C2E6EC] dark:bg-[#0C1222]">
            {/* Brand + collapse. Sized so the wordmark sits flush with the
                rest of the ExamCooker chrome and never collides with the main
                NavBar. */}
            {isMobile ? (
                <div className="relative flex h-12 items-center px-3">
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label="close"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-black/60 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="ml-auto min-w-0 flex-1 pl-3">
                        <SidebarWordmark align="end" />
                    </div>
                </div>
            ) : (
                <div className="flex h-12 items-center justify-between gap-2 px-3">
                    <SidebarWordmark />
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label="collapse sidebar"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-black/60 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* New chat + search */}
            <div className="space-y-2 px-3 pb-3">
                <button
                    type="button"
                    onClick={onNewChat}
                    className="group flex w-full items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-[13.5px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:text-[#D5D5D5] dark:hover:bg-white/10"
                >
                    <Plus className="h-4 w-4 text-[#4db3d6] transition-transform group-hover:rotate-90 dark:text-[#3BF4C7]" />
                    New chat
                </button>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/50 dark:text-[#D5D5D5]/50" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search chats"
                        className="w-full rounded-md border border-black/10 bg-white/60 py-1.5 pl-8 pr-2 text-[12.5px] text-black placeholder:text-black/40 focus:border-[#4db3d6] focus:outline-none focus:ring-2 focus:ring-[#4db3d6]/20 dark:border-white/10 dark:bg-white/5 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/40 dark:focus:border-[#3BF4C7] dark:focus:ring-[#3BF4C7]/20"
                    />
                </div>
            </div>

            {/* Chats list */}
            <nav aria-label="chat history" className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="mx-2 mt-6 text-[13px] leading-relaxed text-black/55 dark:text-[#D5D5D5]/55">
                        {chats.length === 0
                            ? "No chats yet."
                            : `No chats match "${query}".`}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(["today", "week", "older"] as Bucket[]).map((bucket) => {
                            const items = grouped[bucket];
                            if (!items.length) return null;
                            return (
                                <section key={bucket}>
                                    <h3 className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/50 dark:text-[#D5D5D5]/50">
                                        {bucket === "today"
                                            ? "Today"
                                            : bucket === "week"
                                                ? "Last 7 days"
                                                : "Older"}
                                    </h3>
                                    <ul className="space-y-px">
                                        {items.map((chat) => {
                                            const isActive = chat.id === activeChatId;
                                            const isMenuOpen = menuState?.chatId === chat.id;
                                            return (
                                                <li key={chat.id}>
                                                    <div
                                                        className={[
                                                            "group relative flex w-full items-center gap-1 rounded-md text-left text-[13px] transition",
                                                            isActive || isMenuOpen
                                                                ? "bg-white text-black shadow-sm dark:bg-white/10 dark:text-[#D5D5D5]"
                                                                : "text-black/80 hover:bg-white/60 hover:text-black dark:text-[#D5D5D5]/80 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]",
                                                        ].join(" ")}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelect(chat)}
                                                            className="flex min-w-0 flex-1 items-center justify-start px-2 py-1.5 text-left"
                                                        >
                                                            <span className="line-clamp-1 w-full break-words text-left">
                                                                {chat.title}
                                                            </span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            data-study-chat-menu-trigger
                                                            aria-label={`chat actions for ${chat.title}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const rect = (
                                                                    e.currentTarget as HTMLButtonElement
                                                                ).getBoundingClientRect();
                                                                setMenuState((curr) =>
                                                                    curr?.chatId === chat.id
                                                                        ? null
                                                                        : {
                                                                              chatId: chat.id,
                                                                              x: rect.right - 150,
                                                                              y: rect.bottom + 6,
                                                                          }
                                                                );
                                                            }}
                                                            className={[
                                                                "mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-black/55 transition hover:bg-black/10 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5]",
                                                                isMenuOpen
                                                                    ? "opacity-100"
                                                                    : "opacity-0 group-hover:opacity-100",
                                                            ].join(" ")}
                                                        >
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            );
                        })}
                    </div>
                )}
            </nav>
            {menuState &&
                createPortal(
                    (() => {
                        const target = chats.find((c) => c.id === menuState.chatId);
                        if (!target) return null;
                        return (
                            <div
                                data-study-chat-menu
                                style={{
                                    position: "fixed",
                                    left: Math.max(8, Math.min(menuState.x, window.innerWidth - 160)),
                                    top: Math.max(8, Math.min(menuState.y, window.innerHeight - 96)),
                                }}
                                className="z-[80] min-w-[9rem] rounded-md border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#11192b]"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuState(null);
                                        onRenameChat(target);
                                    }}
                                    className="flex w-full items-center rounded px-2 py-1.5 text-left text-[12.5px] text-black/85 hover:bg-black/5 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                                >
                                    Rename
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuState(null);
                                        onDeleteChat(target);
                                    }}
                                    className="flex w-full items-center rounded px-2 py-1.5 text-left text-[12.5px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                >
                                    Delete
                                </button>
                            </div>
                        );
                    })(),
                    document.body
                )}
        </div>
    );
}
