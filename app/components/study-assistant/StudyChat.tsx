"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { StudyScope } from "@/lib/study/scope";
import { StudyHeader } from "./StudyHeader";
import { StudyLanding } from "./StudyLanding";
import { StudyMessages } from "./StudyMessages";
import { StudyComposer } from "./StudyComposer";
import {
    getStudyChatMessagesAction,
    type StudyChatMessageDTO,
} from "@/app/actions/studyChats";
import { StudyChatLoader } from "./StudyChatLoader";

interface StudyChatProps {
    chatId: string;
    scope: StudyScope | null;
    scopeLabel: string | null;
    scopeSubtitle: string | null;
    onToggleSidebar: () => void;
    onClearScope: () => void;
    onChatUpdated: (info: { chatId: string; title?: string | null }) => void;
    cachedMessages?: Pick<StudyChatMessageDTO, "id" | "role" | "parts">[];
    onMessagesSnapshot?: (
        chatId: string,
        messages: Pick<StudyChatMessageDTO, "id" | "role" | "parts">[]
    ) => void;
}

export function StudyChat({
    chatId,
    scope,
    scopeLabel,
    scopeSubtitle,
    onToggleSidebar,
    onClearScope,
    onChatUpdated,
    cachedMessages,
    onMessagesSnapshot,
}: StudyChatProps) {
    const [input, setInput] = useState("");
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [stopRequested, setStopRequested] = useState(false);
    const [isHydratingChat, setIsHydratingChat] = useState(true);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/study/chat",
                prepareSendMessagesRequest: ({ messages, id, trigger, messageId }) => ({
                    body: {
                        id: id ?? chatId,
                        scope: scope ?? { type: "COURSE", code: "GENERAL" },
                        message: messages.at(-1),
                        trigger,
                        messageId,
                    },
                }),
            }),
        [chatId, scope]
    );

    const {
        messages,
        sendMessage,
        stop,
        status,
        setMessages,
        error,
        clearError,
    } = useChat({
        id: chatId,
        transport,
        onFinish: ({ message }) => {
            const text = extractUserText(message);
            if (text) {
                onChatUpdated({ chatId, title: text.slice(0, 60) });
            }
        },
    });

    const isStreaming = status === "streaming" || status === "submitted";
    const showStreamingIndicators = isStreaming && !stopRequested;
    const isEmpty = messages.length === 0 && status === "ready";
    const showLanding = !isHydratingChat && isEmpty;

    const hydratedChatIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (hydratedChatIdRef.current === chatId) return;
        hydratedChatIdRef.current = chatId;
        const normalizedCachedMessages = Array.isArray(cachedMessages)
            ? cachedMessages.map((message) => ({
                  id: message.id,
                  role: message.role,
                  parts: Array.isArray(message.parts) ? message.parts : [],
              }))
            : null;
        setIsHydratingChat(!normalizedCachedMessages);
        setMessages([]);
        setInput("");
        setEditingMessageId(null);
        setStopRequested(false);

        if (normalizedCachedMessages) {
            setMessages(normalizedCachedMessages);
            return;
        }

        let cancelled = false;
        void getStudyChatMessagesAction(chatId)
            .then((list) => {
                if (cancelled) return;
                if (Array.isArray(list) && list.length) {
                    setMessages(
                        list.map((m) => ({
                            id: m.id,
                            role: m.role,
                            parts: Array.isArray(m.parts) ? m.parts : [],
                        }))
                    );
                }
            })
            .catch(() => { })
            .finally(() => {
                if (!cancelled) {
                    setIsHydratingChat(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [cachedMessages, chatId, setMessages]);

    useEffect(() => {
        if (status === "ready") {
            setStopRequested(false);
        }
    }, [status]);

    useEffect(() => {
        onMessagesSnapshot?.(
            chatId,
            messages.map((message) => ({
                id: message.id,
                role: message.role as "user" | "assistant",
                parts: Array.isArray(message.parts) ? message.parts : [],
            }))
        );
    }, [chatId, messages, onMessagesSnapshot]);

    const handleSend = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            setEditingMessageId(null);
            setStopRequested(false);
            clearError?.();
            setMessages((current) => pruneStoppedAssistantDrafts(current));
            void sendMessage({ text: trimmed });
            onChatUpdated({ chatId, title: trimmed.slice(0, 60) });
            setInput("");
        },
        [chatId, clearError, onChatUpdated, sendMessage, setMessages]
    );

    const handleBeginEdit = useCallback((messageId: string, text: string) => {
        setEditingMessageId(messageId);
        setInput(text);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingMessageId(null);
        setInput("");
    }, []);

    const handleSubmit = useCallback(() => {
        if (editingMessageId) {
            setEditingMessageId(null);
            handleSend(input);
            return;
        }
        handleSend(input);
    }, [editingMessageId, handleSend, input]);

    const handleStop = useCallback(() => {
        setStopRequested(true);
        setMessages((current) => pruneStoppedAssistantDrafts(current));
        void stop();
    }, [setMessages, stop]);

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <StudyHeader
                scope={scope}
                scopeLabel={scopeLabel}
                scopeSubtitle={scopeSubtitle}
                onToggleSidebar={onToggleSidebar}
                onClearScope={onClearScope}
                compact={showLanding}
            />

            {isHydratingChat ? (
                <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
                    <StudyChatLoader centered />
                </div>
            ) : showLanding ? (
                <div className="no-scrollbar relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
                    <div className="mx-auto w-full max-w-2xl">
                        <StudyLanding
                            scope={scope}
                            scopeLabel={scopeLabel}
                            onSend={handleSend}
                            composer={
                                <StudyComposer
                                    value={input}
                                    onChange={setInput}
                                    onSend={handleSubmit}
                                    onStop={handleStop}
                                    isStreaming={showStreamingIndicators}
                                    isEditing={Boolean(editingMessageId)}
                                    onCancelEdit={handleCancelEdit}
                                    disabled={stopRequested && isStreaming}
                                    placeholder={placeholderFor(scope)}
                                    variant="inline"
                                />
                            }
                        />

                        {error && (
                            <div className="mx-auto mt-4 max-w-lg rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                                {error.message || "Something went wrong. Please try again."}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <StudyMessages
                        messages={messages}
                        status={status}
                        isStreaming={isStreaming}
                        showStreamingIndicators={showStreamingIndicators}
                        onPause={handleStop}
                        onEditLatestPrompt={handleBeginEdit}
                    />

                    {error && (
                        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                            <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                                {error.message || "Something went wrong. Please try again."}
                            </div>
                        </div>
                    )}

                    <StudyComposer
                        value={input}
                        onChange={setInput}
                        onSend={handleSubmit}
                        onStop={handleStop}
                        isStreaming={showStreamingIndicators}
                        isEditing={Boolean(editingMessageId)}
                        onCancelEdit={handleCancelEdit}
                        disabled={stopRequested && isStreaming}
                        placeholder={placeholderFor(scope)}
                        variant="sticky"
                    />
                </>
            )}
        </div>
    );
}

function placeholderFor(scope: StudyScope | null): string {
    if (!scope) return "Ask anything about your coursework…";
    if (scope.type === "NOTE") return "Ask about this note…";
    if (scope.type === "PAST_PAPER") return "Ask about this paper…";
    return "Ask about this course…";
}

function extractUserText(message: {
    parts?: Array<{ type?: string; text?: string }>;
}): string | null {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const p of parts) {
        if (p?.type === "text" && p.text) return p.text;
    }
    return null;
}

function pruneStoppedAssistantDrafts(messages: UIMessage[]): UIMessage[] {
    return messages.flatMap((message) => {
        if (message.role !== "assistant") {
            return [message];
        }

        const parts = Array.isArray(message.parts) ? message.parts : [];
        const sanitizedParts = parts.filter((part) => !isIncompleteToolPart(part));

        if (sanitizedParts.length === 0) {
            return [];
        }

        if (sanitizedParts.length === parts.length) {
            return [message];
        }

        return [{ ...message, parts: sanitizedParts }];
    });
}

function isIncompleteToolPart(part: unknown) {
    if (!part || typeof part !== "object") return false;
    const typedPart = part as { type?: string; state?: string };
    if (!typedPart.type?.startsWith("tool-")) return false;
    return ["input-streaming", "input-available"].includes(
        typedPart.state ?? "input-available"
    );
}
