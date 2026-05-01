"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";
import { streamdownPlugins } from "@/lib/streamdown-config";

export interface ExplainOutput {
    concept?: string;
    level?: string;
    selectionText?: string | null;
    explanation: string;
}

interface ExplainPartProps {
    state: ToolState;
    input?: { concept?: string; selectionText?: string; level?: string };
    output?: ExplainOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const ExplainPart = memo(function ExplainPart({
    state,
    input,
    output,
    errorText,
    isGlobalStreaming,
}: ExplainPartProps) {
    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Thinking it through" active={Boolean(isGlobalStreaming)} />;
    }

    const data = (output as ExplainOutput | null) ?? null;
    const concept = data?.concept ?? input?.concept;
    const selection = (data?.selectionText ?? input?.selectionText)?.trim();
    const level = data?.level ?? input?.level;

    return (
        <ToolShell
            toolName="explain_concept"
            label={concept ? `Explanation: ${concept}` : "Explanation"}
            state={state}
            errorText={errorText}
            headerExtra={level ? `Level: ${level}` : undefined}
        >
            <div className="space-y-3">
                {selection && (
                    <blockquote className="border-l-2 border-black/20 bg-black/[0.02] px-3 py-2 text-[12.5px] italic leading-relaxed text-black/65 dark:border-white/20 dark:bg-white/[0.03] dark:text-[#D5D5D5]/70">
                        {selection.length > 320 ? selection.slice(0, 320) + "..." : selection}
                    </blockquote>
                )}
                {data?.explanation ? (
                    <div className="prose prose-neutral dark:prose-invert max-w-none font-sans text-[14px] leading-relaxed text-black dark:text-[#D5D5D5]">
                        <Streamdown plugins={streamdownPlugins}>{data.explanation}</Streamdown>
                    </div>
                ) : null}
            </div>
        </ToolShell>
    );
});
