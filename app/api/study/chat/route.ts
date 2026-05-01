import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    streamText,
    convertToModelMessages,
    stepCountIs,
    generateId,
    smoothStream,
    type UIMessage,
    type ModelMessage,
} from "ai";
import { z } from "zod";
import { auth } from "@/app/auth";
import { study, STUDY_PROVIDER_OPTIONS } from "@/lib/ai/provider";
import { loadScopeContext, buildStudySystemPrompt, type StudyScope } from "@/lib/study/scope";
import { loadStudyTools } from "@/lib/study/tools";
import { ensureStudyChat, loadStudyChatMessages, persistStudyTurn } from "@/lib/study/persist";
import { getStudyChatRatelimit } from "@/lib/study/rate-limit";
import { fetchPdfAsBuffer } from "@/lib/study/tools/pdf-fetch";

export const maxDuration = 60;
const STUDY_STREAM_DELAY_MS = 60;
const STUDY_STREAM_MIN_WORD_GROUP_CHARS = 12;

function detectStudyStreamChunk(buffer: string) {
    const lineMatch = buffer.match(/^[\s\S]*?\n+/);
    if (lineMatch) {
        return lineMatch[0];
    }

    const sentenceMatch = buffer.match(/^[\s\S]*?[.!?](?=\s|$)/);
    if (sentenceMatch) {
        return sentenceMatch[0];
    }

    const wordGroupMatch = buffer.match(/^(?:\S+\s+){1,4}/);
    if (
        wordGroupMatch &&
        wordGroupMatch[0].length >= STUDY_STREAM_MIN_WORD_GROUP_CHARS
    ) {
        return wordGroupMatch[0];
    }

    return null;
}

const scopeSchema = z.union([
    z.object({ type: z.literal("NOTE"), id: z.string().min(1) }),
    z.object({ type: z.literal("PAST_PAPER"), id: z.string().min(1) }),
    z.object({ type: z.literal("COURSE"), code: z.string().min(1) }),
]);

const bodySchema = z.object({
    id: z.string().optional(),
    scope: scopeSchema,
    messages: z.array(z.any()).optional(),
    message: z.any().optional(),
    trigger: z.string().optional(),
    messageId: z.string().optional(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const ratelimit = getStudyChatRatelimit();
    if (ratelimit) {
        const { success } = await ratelimit.limit(`u:${session.user.id}`);
        if (!success) {
            return new Response(
                JSON.stringify({ error: "slow down — rate limit reached. try again in a minute." }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    let parsedBody: z.infer<typeof bodySchema>;
    try {
        parsedBody = bodySchema.parse(await req.json());
    } catch (error) {
        console.error("[study/chat] invalid body", error);
        return new Response("Bad Request", { status: 400 });
    }
    const { id: requestedChatId, scope, trigger, messageId } = parsedBody;
    const scopeTyped = scope as StudyScope;
    const chatId = requestedChatId ?? generateId();
    const incoming = getIncomingMessages(parsedBody);
    if (incoming.length === 0) {
        return new Response("Bad Request", { status: 400 });
    }
    const lastUser = [...incoming].reverse().find((m) => m.role === "user");
    const firstUserText = lastUser ? extractUserText(lastUser) : undefined;

    let chatReady: Promise<unknown> = Promise.resolve();
    let userPersisted: Promise<void> = Promise.resolve();

    const stream = createUIMessageStream({
        originalMessages: incoming,
        generateId,
        onError: (error) => {
            console.error("[study/chat] stream error", error);
            return "something went wrong while replying. try again.";
        },
        execute: async ({ writer }) => {
            const contextPromise = loadScopeContext(scopeTyped);
            const persistedMessagesPromise = shouldLoadPersistedHistory(parsedBody)
                ? loadStudyChatMessages({
                    chatId,
                    userId: session.user.id,
                })
                : Promise.resolve([]);

            chatReady = ensureStudyChat({
                chatId,
                userId: session.user.id,
                scope: scopeTyped,
                firstUserText,
            });

            if (lastUser) {
                userPersisted = chatReady
                    .then(() =>
                        persistStudyTurn({
                            chatId,
                            userMessage: {
                                id: lastUser.id,
                                parts: lastUser.parts ?? [],
                            },
                        })
                    )
                    .catch((err) => {
                        console.warn("[study/chat] failed to persist user message", err);
                    });
            }

            const [context, persistedMessages] = await Promise.all([
                contextPromise,
                persistedMessagesPromise,
            ]);
            const tools = loadStudyTools({ context, userId: session.user.id });
            const system = buildStudySystemPrompt(scopeTyped, context);
            const promptMessages = mergePromptMessages({
                persistedMessages,
                incomingMessages: incoming,
                trigger,
                messageId,
            });
            const modelMessages = await convertToModelMessages(stripLargeToolOutputs(promptMessages), {
                tools,
                ignoreIncompleteToolCalls: true,
            });
            const messagesWithPdf = attachScopePdf(modelMessages, context, firstUserText);
            const result = streamText({
                model: study.languageModel("default"),
                system,
                messages: messagesWithPdf,
                tools,
                stopWhen: stepCountIs(5),
                providerOptions: STUDY_PROVIDER_OPTIONS,
                experimental_transform: smoothStream({
                    chunking: detectStudyStreamChunk,
                    delayInMs: STUDY_STREAM_DELAY_MS,
                }),
                experimental_download: async (requests) =>
                    Promise.all(
                        requests.map(async ({ url, isUrlSupportedByModel }) => {
                            if (isUrlSupportedByModel) return null;
                            try {
                                const fetched = await fetchPdfAsBuffer(url.toString());
                                return {
                                    data: fetched.data,
                                    mediaType: fetched.mediaType,
                                };
                            } catch (err) {
                                console.warn("[study/chat] download failed", url.toString(), err);
                                return null;
                            }
                        })
                    ),
            });
            writer.merge(
                result.toUIMessageStream({
                    sendReasoning: true,
                    messageMetadata: ({ part }) => {
                        if (part.type === "finish") {
                            return {
                                chatId,
                                scope: scopeTyped,
                            };
                        }
                    },
                })
            );
            result.consumeStream();
        },
        onFinish: async ({ messages }) => {
            const last = messages.at(-1);
            if (!last || last.role !== "assistant") return;
            try {
                await chatReady;
                await userPersisted;
                await persistStudyTurn({
                    chatId,
                    assistantMessage: {
                        id: last.id,
                        parts: last.parts ?? [],
                    },
                });
            } catch (err) {
                console.warn("[study/chat] failed to persist assistant message", err);
            }
        },
    });

    return createUIMessageStreamResponse({
        stream,
        headers: {
            "X-Study-Chat-Id": chatId,
        },
    });
}

function getIncomingMessages(body: z.infer<typeof bodySchema>): UIMessage[] {
    if (body.message) return [body.message as UIMessage];
    return (body.messages ?? []) as UIMessage[];
}

function shouldLoadPersistedHistory(body: z.infer<typeof bodySchema>): boolean {
    return Boolean(body.message || !body.messages || body.messages.length <= 1);
}

function mergePromptMessages({
    persistedMessages,
    incomingMessages,
    trigger,
    messageId,
}: {
    persistedMessages: UIMessage[];
    incomingMessages: UIMessage[];
    trigger?: string;
    messageId?: string;
}): UIMessage[] {
    let history = persistedMessages;
    if (trigger === "regenerate-message" && messageId) {
        const index = history.findIndex((message) => message.id === messageId);
        if (index >= 0) {
            history = history.slice(
                0,
                history[index]?.role === "assistant" ? index : index + 1
            );
        }
    }

    const incomingIds = new Set(incomingMessages.map((message) => message.id));
    return [
        ...history.filter((message) => !incomingIds.has(message.id)),
        ...incomingMessages,
    ];
}

function stripLargeToolOutputs(messages: UIMessage[]): UIMessage[] {
    return messages.map((message) => ({
        ...message,
        parts: message.parts.map((part) => {
            if (
                part.type !== "tool-image_generation" ||
                !("output" in part) ||
                !part.output ||
                typeof part.output !== "object" ||
                !("result" in part.output)
            ) {
                return part;
            }

            return {
                ...part,
                output: {
                    ...part.output,
                    result: "[generated image omitted from prompt history]",
                },
            };
        }),
    }));
}

function extractUserText(message: UIMessage): string {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
        if ((part as { type?: string }).type === "text") {
            return String((part as { text?: string }).text ?? "").trim();
        }
    }
    return "";
}

/**
 * Append a `file` part to the trailing user message so providers (Gemini,
 * GPT-4 vision, etc.) can ingest the PDF directly — no server-side text
 * extraction needed. We attach once per turn on the last user message to
 * avoid blowing up token usage with repeated uploads.
 */
function attachScopePdf(
    messages: ModelMessage[],
    context: { fileUrl?: string; title?: string } | null,
    userText?: string
): ModelMessage[] {
    if (!context?.fileUrl) return messages;
    if (messages.length === 0) return messages;
    if (!shouldAttachScopePdf(userText)) return messages;

    // Walk backwards to find the last user message.
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "user") continue;

        const existingContent = m.content;
        const parts = Array.isArray(existingContent)
            ? existingContent.slice()
            : [{ type: "text" as const, text: String(existingContent ?? "") }];

        parts.push({
            type: "file" as const,
            mediaType: "application/pdf",
            data: new URL(context.fileUrl),
            filename: context.title ? `${context.title}.pdf` : "document.pdf",
        });

        const next = messages.slice();
        next[i] = { ...m, content: parts } as ModelMessage;
        return next;
    }
    return messages;
}

function shouldAttachScopePdf(userText?: string): boolean {
    if (!userText) return false;
    return /\b(this|document|pdf|note|paper|question|answer|solve|summari[sz]e|overview|explain|derive|section|page|topic|quiz|test)\b/i.test(userText);
}
