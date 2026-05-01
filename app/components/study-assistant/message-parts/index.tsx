"use client";

import type { UIMessagePart, UIDataTypes, UITools } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { TextPart } from "./text-part";
import { ReasoningPart } from "./reasoning-part";
import { ToolShell, type ToolState } from "./tool-shell";
import { SummaryPart } from "./summary-part";
import { QuizPart } from "./quiz-part";
import { ExplainPart } from "./explain-part";
import { SearchResultsPart } from "./search-results-part";
import { ForumResultsPart } from "./forum-results-part";
import { CourseOverviewPart } from "./course-overview-part";
import { SyllabusPart } from "./syllabus-part";
import { ImageGenerationPart } from "./image-generation-part";

export type StudyMessagePart = UIMessagePart<UIDataTypes, UITools>;

interface MessagePartRendererProps {
    part: StudyMessagePart;
    messageId: string;
    partIndex: number;
    isResponseTail?: boolean;
    isStreaming?: boolean;
    isGlobalStreaming?: boolean;
}

export function MessagePartRenderer({
    part,
    messageId,
    partIndex,
    isResponseTail,
    isStreaming,
    isGlobalStreaming,
}: MessagePartRendererProps) {
    const partId = `${messageId}-${partIndex}`;

    if (part.type === "text") {
        return (
            <TextPart
                id={partId}
                text={(part as { text?: string }).text ?? ""}
                isResponseTail={isResponseTail}
                isStreaming={isStreaming}
            />
        );
    }

    if (part.type === "reasoning") {
        return (
            <ReasoningPart
                id={partId}
                text={(part as { text?: string }).text ?? ""}
                isStreaming={isStreaming}
            />
        );
    }

    if (isToolUIPart(part)) {
        const toolName = getToolName(part as Parameters<typeof getToolName>[0]);
        const state = ((part as { state?: string }).state ?? "input-available") as ToolState;
        const input = (part as { input?: unknown }).input;
        const output = (part as { output?: unknown }).output;
        const errorText = (part as { errorText?: string }).errorText;

        switch (toolName) {
            case "image_generation":
                return (
                    <ImageGenerationPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "summarize_document":
                return (
                    <SummaryPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "quiz_me":
                return (
                    <QuizPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "explain_concept":
                return (
                    <ExplainPart
                        state={state}
                        input={input as { selectionText?: string; level?: string }}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "search_past_papers":
            case "search_notes":
                return (
                    <SearchResultsPart
                        toolName={toolName}
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "search_forum":
                return (
                    <ForumResultsPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "get_course_overview":
                return (
                    <CourseOverviewPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            case "get_syllabus":
                return (
                    <SyllabusPart
                        state={state}
                        output={output}
                        errorText={errorText}
                        isGlobalStreaming={isGlobalStreaming}
                    />
                );
            default:
                return (
                    <ToolShell
                        toolName={toolName}
                        state={state}
                        errorText={errorText}
                    >
                        <pre className="max-h-64 overflow-auto rounded-md bg-black/[0.04] px-2 py-1.5 text-[11px] leading-relaxed dark:bg-white/[0.05]">
                            {safeStringify(output ?? input)}
                        </pre>
                    </ToolShell>
                );
        }
    }

    return null;
}

function safeStringify(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
