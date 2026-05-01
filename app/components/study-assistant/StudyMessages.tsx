"use client";

import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { ChatStatus, UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { Copy, Pause, PencilLine } from "lucide-react";
import { MessagePartRenderer } from "./message-parts";
import { ReasoningPart } from "./message-parts/reasoning-part";
import { StudyChatLoader } from "./StudyChatLoader";

type PartLike = { type?: string; text?: string };

function partitionPartsForRender(parts: PartLike[]) {
    type Row =
        | { kind: "reasoning"; start: number; end: number; text: string }
        | { kind: "other"; index: number };
    const rows: Row[] = [];
    let i = 0;
    while (i < parts.length) {
        const p = parts[i];
        if (p.type === "reasoning") {
            const start = i;
            const chunks: string[] = [(p.text ?? "")];
            while (i + 1 < parts.length && parts[i + 1].type === "reasoning") {
                i++;
                chunks.push(parts[i].text ?? "");
            }
            rows.push({
                kind: "reasoning",
                start,
                end: i,
                text: chunks.join("\n\n"),
            });
            i++;
        } else {
            rows.push({ kind: "other", index: i });
            i++;
        }
    }
    return rows;
}

interface MessagesProps {
    messages: UIMessage[];
    status: ChatStatus;
    isStreaming?: boolean;
    showStreamingIndicators?: boolean;
    onPause?: () => void;
    onEditLatestPrompt?: (messageId: string, text: string) => void;
}

function assistantHasVisibleContent(parts: unknown[]): boolean {
    for (const p of parts) {
        const part = p as { type?: string; text?: string };
        if (part.type === "reasoning") return true;
        if (part.type === "text" && part.text?.trim()) return true;
        if (isToolUIPart(p as never)) {
            return true;
        }
    }
    return false;
}

function isIncompleteAssistantPart(part: unknown) {
    return isToolUIPart(part as never)
        ? ["input-streaming", "input-available"].includes(
              ((part as { state?: string }).state ?? "input-available")
          )
        : false;
}

export const StudyMessages = memo(function StudyMessages({
    messages,
    status,
    isStreaming,
    showStreamingIndicators,
    onPause,
    onEditLatestPrompt,
}: MessagesProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const userScrolledUp = useRef(false);
    const lastLenRef = useRef(messages.length);
    const clampRafRef = useRef<number | null>(null);
    const didInitialPositionRef = useRef(false);
    const animatedUserSeedRef = useRef<string | null>(null);
    const [recentlySentUserId, setRecentlySentUserId] = useState<string | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [activeHatActionId, setActiveHatActionId] = useState<string | null>(null);

    const lastUserIndex = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === "user") return i;
        }
        return -1;
    }, [messages]);

    const firstUserIndex = useMemo(() => {
        for (let i = 0; i < messages.length; i++) {
            if (messages[i]?.role === "user") return i;
        }
        return -1;
    }, [messages]);

    const latestAssistantId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === "assistant") return messages[i].id;
        }
        return null;
    }, [messages]);

    const shouldShowBottomLoader = useMemo(() => {
        const last = messages[messages.length - 1];
        if (!last || !showStreamingIndicators) return false;
        if (last.role === "user") return true;
        if (status === "submitted") return true;
        if (status === "streaming" && last.role === "assistant") {
            const parts = Array.isArray(last.parts) ? last.parts : [];
            if (parts.length === 0) return true;
            return !assistantHasVisibleContent(parts);
        }
        return false;
    }, [messages, showStreamingIndicators, status]);

    const shouldReserveLoaderMinHeight = false;

    const alignLastUserToTop = useCallback((topOffset: number) => {
        const el = scrollRef.current;
        if (!el) return;

        const anchor = el.querySelector<HTMLElement>('[data-last-user="true"]');
        if (!anchor) return;

        const elRect = el.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const anchorTopInContent = anchorRect.top - elRect.top + el.scrollTop;
        const maxSafeGap = Math.max(
            10,
            el.clientHeight - anchorRect.height - 24
        );
        const measuredOffset = Math.min(
            Math.max(topOffset, Math.min(34, Math.round(anchorRect.height * 0.16))),
            maxSafeGap
        );
        const desiredScrollTop = Math.max(0, anchorTopInContent - measuredOffset);

        if (Math.abs(el.scrollTop - desiredScrollTop) > 1) {
            el.scrollTop = desiredScrollTop;
        }
    }, []);

    const alignLastAnchorToVisibleBottom = useCallback(
        (selector: string, marginBottom: number) => {
            const el = scrollRef.current;
            if (!el) return;

            const anchors = el.querySelectorAll<HTMLElement>(selector);
            const anchor = anchors[anchors.length - 1];
            if (!anchor) return;

            const elRect = el.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            const anchorBottomInContent =
                anchorRect.bottom - elRect.top + el.scrollTop;
            const desiredScrollTop = Math.max(
                0,
                anchorBottomInContent - (el.clientHeight - marginBottom)
            );

            if (Math.abs(el.scrollTop - desiredScrollTop) > 1) {
                el.scrollTop = desiredScrollTop;
            }
        },
        []
    );

    const clampScrollToFirstUser = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const first = el.querySelector<HTMLElement>("[data-first-user-anchor]");
        if (!first) return;
        const pad = 8;
        const elRect = el.getBoundingClientRect();
        const firstRect = first.getBoundingClientRect();
        const topInContent =
            firstRect.top - elRect.top + el.scrollTop;
        const minScroll = Math.max(0, topInContent - pad);
        if (el.scrollTop < minScroll) {
            el.scrollTop = minScroll;
        }
    }, []);

    const keepLoaderJustVisible = useCallback(() => {
        alignLastAnchorToVisibleBottom("[data-study-loader-anchor]", 12);
    }, [alignLastAnchorToVisibleBottom]);

    const keepStreamingTailVisible = useCallback(() => {
        alignLastAnchorToVisibleBottom("[data-study-assistant-tail-anchor]", 20);
    }, [alignLastAnchorToVisibleBottom]);

    const handleScroll = useCallback(
        (el: HTMLDivElement) => {
            const nearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 140;
            userScrolledUp.current = !nearBottom;
            if (clampRafRef.current != null) return;
            clampRafRef.current = requestAnimationFrame(() => {
                clampRafRef.current = null;
                clampScrollToFirstUser();
            });
        },
        [clampScrollToFirstUser]
    );

    useEffect(() => {
        if (messages.length === 0 && !shouldShowBottomLoader) {
            didInitialPositionRef.current = false;
            lastLenRef.current = 0;
            animatedUserSeedRef.current = null;
        }
    }, [messages.length, shouldShowBottomLoader]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || didInitialPositionRef.current) return;
        if (messages.length === 0 && !shouldShowBottomLoader) {
            return;
        }

        didInitialPositionRef.current = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const last = messages[messages.length - 1];
                if (last?.role === "user") {
                    alignLastUserToTop(24);
                } else if (shouldShowBottomLoader) {
                    keepLoaderJustVisible();
                } else {
                    keepStreamingTailVisible();
                }
                clampScrollToFirstUser();
            });
        });
    }, [
        alignLastUserToTop,
        messages,
        messages.length,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const grew = messages.length !== lastLenRef.current;
        lastLenRef.current = messages.length;
        const last = messages[messages.length - 1];
        const shouldFollowStreaming = Boolean(showStreamingIndicators && last?.role === "assistant");
        if (shouldShowBottomLoader || shouldFollowStreaming) {
            return;
        }
        if (
            userScrolledUp.current &&
            !grew &&
            !shouldFollowStreaming
        ) {
            return;
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (
                    userScrolledUp.current &&
                    !grew &&
                    !shouldFollowStreaming
                ) {
                    return;
                }
                if (last?.role === "user") {
                    alignLastUserToTop(24);
                } else if (shouldShowBottomLoader) {
                    keepLoaderJustVisible();
                } else if (shouldFollowStreaming) {
                    keepStreamingTailVisible();
                }
                clampScrollToFirstUser();
            });
        });
    }, [
        alignLastUserToTop,
        messages,
        showStreamingIndicators,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    useEffect(() => {
        const el = scrollRef.current;
        const last = messages[messages.length - 1];
        const shouldFollowStreaming =
            Boolean(showStreamingIndicators) && last?.role === "assistant";
        if (!el || (!shouldShowBottomLoader && !shouldFollowStreaming)) return;

        let frame = 0;
        let resizeObserver: ResizeObserver | null = null;
        const observeTarget =
            el.firstElementChild instanceof HTMLElement ? el.firstElementChild : el;

        const sync = () => {
            frame = 0;
            if (last?.role === "user") {
                alignLastUserToTop(24);
            } else if (shouldShowBottomLoader) {
                keepLoaderJustVisible();
            } else {
                keepStreamingTailVisible();
            }
            clampScrollToFirstUser();
        };

        const scheduleSync = () => {
            if (frame !== 0) return;
            frame = window.requestAnimationFrame(sync);
        };

        scheduleSync();

        const observer = new MutationObserver(scheduleSync);
        observer.observe(observeTarget, {
            subtree: true,
            childList: true,
            characterData: true,
        });

        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(scheduleSync);
            resizeObserver.observe(el);
            resizeObserver.observe(observeTarget);
        }

        window.addEventListener("resize", scheduleSync);

        return () => {
            observer.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener("resize", scheduleSync);
            if (frame !== 0) {
                window.cancelAnimationFrame(frame);
            }
        };
    }, [
        alignLastUserToTop,
        messages,
        showStreamingIndicators,
        shouldShowBottomLoader,
        clampScrollToFirstUser,
        keepLoaderJustVisible,
        keepStreamingTailVisible,
    ]);

    const activeAnimatedUserId = useMemo(() => {
        return recentlySentUserId;
    }, [recentlySentUserId]);

    useEffect(() => {
        const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : null;
        if (!lastUser || lastUser.role !== "user") return;
        if (!animatedUserSeedRef.current) {
            animatedUserSeedRef.current = lastUser.id;
            return;
        }
        if (animatedUserSeedRef.current === lastUser.id) return;
        animatedUserSeedRef.current = lastUser.id;
        setRecentlySentUserId(lastUser.id);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                alignLastUserToTop(24);
            });
        });
    }, [alignLastUserToTop, lastUserIndex, messages]);

    useEffect(() => {
        if (!recentlySentUserId) return;
        const timeout = window.setTimeout(() => {
            setRecentlySentUserId((current) =>
                current === recentlySentUserId ? null : current
            );
        }, 520);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [recentlySentUserId]);

    useEffect(() => {
        if (!copiedMessageId) return;
        const timeout = window.setTimeout(() => {
            setCopiedMessageId((current) =>
                current === copiedMessageId ? null : current
            );
        }, 1600);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [copiedMessageId]);

    useEffect(() => {
        if (!activeHatActionId) return;
        const timeout = window.setTimeout(() => {
            setActiveHatActionId((current) =>
                current === activeHatActionId ? null : current
            );
        }, 1300);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [activeHatActionId]);

    const triggerActionHat = useCallback((actionId: string) => {
        setActiveHatActionId(actionId);
    }, []);

    const handleCopyText = useCallback(async (id: string, text: string) => {
        if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(id);
        } catch {
            // no-op
        }
    }, []);

    return (
        <div
            ref={scrollRef}
            onScroll={(e) => handleScroll(e.currentTarget)}
            className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
            style={{ overflowAnchor: "none" }}
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col space-y-0 px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-32">
                {messages.map((message, idx) => {
                    const isUser = message.role === "user";
                    const parts = Array.isArray(message.parts) ? message.parts : [];
                    const isLastMsg = idx === messages.length - 1;
                    const nextIsAssistant =
                        idx < messages.length - 1 &&
                        messages[idx + 1]?.role === "assistant";

                    const turnClass = isUser
                        ? nextIsAssistant
                            ? "mb-0"
                            : "mb-4"
                        : isLastMsg
                          ? "mb-0"
                          : "mb-8 border-b border-black/10 pb-6 dark:border-white/10";

                    if (isUser) {
                        const text = parts
                            .filter((p) => (p as { type?: string }).type === "text")
                            .map((p) => (p as { text?: string }).text ?? "")
                            .join("\n");
                        const copyActionId = `${message.id}:prompt-copy`;
                        const editActionId = `${message.id}:prompt-edit`;
                        const isFirstUser = idx === firstUserIndex;
                        return (
                            <div
                                key={message.id}
                                data-last-user={
                                    idx === lastUserIndex ? "true" : undefined
                                }
                                data-first-user-anchor={isFirstUser ? "" : undefined}
                                className={`flex justify-end ${turnClass} study-user-turn ${
                                    message.id === activeAnimatedUserId
                                        ? "study-user-turn--entering"
                                        : ""
                                }`}
                            >
                                <div className="flex max-w-[84%] min-w-0 flex-col items-end gap-2 sm:max-w-[78%]">
                                    <UserBubble
                                        text={text}
                                        animateIn={message.id === activeAnimatedUserId}
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <TurnActionButton
                                            icon={Copy}
                                            label="Copy prompt"
                                            onClick={() => {
                                                triggerActionHat(copyActionId);
                                                void handleCopyText(message.id, text);
                                            }}
                                            hat="copy"
                                            fired={activeHatActionId === copyActionId}
                                        />
                                        {onEditLatestPrompt && text ? (
                                            <TurnActionButton
                                                icon={PencilLine}
                                                label="Edit prompt"
                                                onClick={() => {
                                                    triggerActionHat(editActionId);
                                                    onEditLatestPrompt(message.id, text);
                                                }}
                                                hat="edit"
                                                fired={activeHatActionId === editActionId}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    const showAssistantPlaceholder =
                        parts.length === 0 &&
                        isLastMsg &&
                        Boolean(showStreamingIndicators) &&
                        shouldShowBottomLoader;

                    const content = showAssistantPlaceholder ? null : (
                        partitionPartsForRender(parts).map((row) => {
                            if (row.kind === "reasoning") {
                                const isStreamingReasoning =
                                    isLastMsg &&
                                    isStreaming &&
                                    row.end === parts.length - 1;
                                return (
                                    <ReasoningPart
                                        key={`${message.id}-reasoning-${row.start}-${row.end}`}
                                        id={`${message.id}-reasoning-${row.start}`}
                                        text={row.text}
                                        isStreaming={isStreamingReasoning}
                                    />
                                );
                            }
                            const pIdx = row.index;
                            const part = parts[pIdx];
                            return (
                                <MessagePartRenderer
                                    key={`${message.id}-${pIdx}-${part.type}`}
                                    part={
                                        part as Parameters<
                                            typeof MessagePartRenderer
                                        >[0]["part"]
                                    }
                                    messageId={message.id}
                                    partIndex={pIdx}
                                    isResponseTail={
                                        isLastMsg &&
                                        pIdx === parts.length - 1
                                    }
                                    isStreaming={
                                        isLastMsg &&
                                        Boolean(showStreamingIndicators) &&
                                        pIdx === parts.length - 1
                                    }
                                    isGlobalStreaming={Boolean(showStreamingIndicators)}
                                />
                            );
                        })
                    );

                    const isLatestAssistant = message.id === latestAssistantId;
                    const hasIncompleteTool = parts.some(isIncompleteAssistantPart);
                    const assistantTextResult = extractAssistantTextResult(message);
                    const responseCopyActionId = `${message.id}:response-copy`;
                    const isCompletedAssistant =
                        !hasIncompleteTool && !(isLatestAssistant && isLastMsg && isStreaming);
                    return (
                        <div
                            key={message.id}
                            className={`flex w-full flex-col gap-3 text-black dark:text-[#D5D5D5] ${turnClass}`}
                        >
                            {content}
                            {!showAssistantPlaceholder ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    {isLastMsg && isStreaming ? (
                                        <TurnActionButton
                                            icon={Pause}
                                            label="Pause"
                                            onClick={onPause}
                                        />
                                    ) : null}
                                    {isCompletedAssistant && assistantTextResult ? (
                                        <TurnActionButton
                                            icon={Copy}
                                            label={copiedMessageId === message.id ? "Copied" : "Copy"}
                                            onClick={() => {
                                                triggerActionHat(responseCopyActionId);
                                                void handleCopyText(
                                                    message.id,
                                                    assistantTextResult
                                                );
                                            }}
                                            hat="copy"
                                            fired={activeHatActionId === responseCopyActionId}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                            {isLastMsg && (
                                <div
                                    aria-hidden="true"
                                    data-study-assistant-tail-anchor=""
                                    className="h-px w-px"
                                />
                            )}
                        </div>
                    );
                })}

                {shouldShowBottomLoader && (
                    <div
                        className={`mt-1 flex items-start ${shouldReserveLoaderMinHeight ? "min-h-[calc(100vh-22rem)] sm:min-h-[calc(100vh-20rem)]" : ""}`}
                    >
                        <StudyChatLoader />
                    </div>
                )}
            </div>
        </div>
    );
});

function TurnActionButton({
    icon: Icon,
    label,
    onClick,
    hat = "none",
    fired,
}: {
    icon: typeof PencilLine;
    label: string;
    onClick?: () => void;
    hat?: "copy" | "edit" | "none";
    fired?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="study-turn-action"
            data-hat={hat !== "none" ? hat : undefined}
            data-fired={fired ? "true" : undefined}
        >
            <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <Icon className="h-3.5 w-3.5" />
                {hat !== "none" ? (
                    <span
                        className={[
                            "study-turn-action__hat",
                            hat === "copy"
                                ? "study-turn-action__hat--copy"
                                : "study-turn-action__hat--edit",
                        ].join(" ")}
                        aria-hidden="true"
                    />
                ) : null}
                {fired && hat !== "none" ? (
                    <span className="study-copy-hat-burst" aria-hidden="true" />
                ) : null}
            </span>
        </button>
    );
}

function UserBubble({
    text,
    animateIn,
}: {
    text: string;
    animateIn?: boolean;
}) {
    return (
        <div
            className={[
                "study-user-bubble",
                animateIn ? "study-user-bubble--entering" : "",
            ].join(" ")}
        >
            <span className="study-user-bubble__body">
                <span className="study-user-bubble__text">{text}</span>
            </span>
        </div>
    );
}

function extractAssistantTextResult(message: UIMessage) {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    return parts
        .map((part) =>
            (part as { type?: string }).type === "text"
                ? ((part as { text?: string }).text ?? "").trim()
                : ""
        )
        .filter(Boolean)
        .join("\n\n")
        .trim();
}
