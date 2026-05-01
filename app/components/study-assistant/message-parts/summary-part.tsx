"use client";

import { memo } from "react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

export interface SummaryOutput {
    title?: string;
    tldr?: string;
    sections?: { heading: string; bullets: string[] }[];
    keyTerms?: string[];
    truncated?: boolean;
    pageCount?: number;
}

interface SummaryPartProps {
    state: ToolState;
    output?: SummaryOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const SummaryPart = memo(function SummaryPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: SummaryPartProps) {
    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Reading the document" active={Boolean(isGlobalStreaming)} />;
    }

    const data = (output as SummaryOutput | null) ?? null;

    return (
        <ToolShell
            toolName="summarize_document"
            label={data?.title ? `Summary · ${data.title}` : "Summary"}
            state={state}
            errorText={errorText}
            headerExtra={
                data?.pageCount
                    ? `${data.pageCount} page${data.pageCount === 1 ? "" : "s"}${data.truncated ? " · partial" : ""}`
                    : undefined
            }
        >
            {data ? (
                <div className="space-y-4">
                    {data.tldr && (
                        <div className="rounded-lg border border-black/5 bg-black/[0.02] p-3 dark:border-white/5 dark:bg-white/[0.03]">
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-black/50 dark:text-[#D5D5D5]/50">
                                tl;dr
                            </p>
                            <p className="text-[13.5px] leading-relaxed text-black dark:text-[#D5D5D5]">
                                {data.tldr}
                            </p>
                        </div>
                    )}

                    {data.sections?.length ? (
                        <div className="space-y-3">
                            {data.sections.map((section, si) => (
                                <section key={si}>
                                    <h4 className="mb-1.5 text-[13px] font-semibold text-black dark:text-[#D5D5D5]">
                                        <span className="mr-1.5 font-mono text-[11px] text-black/45 dark:text-[#D5D5D5]/45">
                                            {String(si + 1).padStart(2, "0")}
                                        </span>
                                        {section.heading}
                                    </h4>
                                    <ul className="ml-4 list-disc space-y-1 text-[13px] leading-relaxed text-black/80 marker:text-black/30 dark:text-[#D5D5D5]/85 dark:marker:text-[#D5D5D5]/30">
                                        {section.bullets.map((b, bi) => (
                                            <li key={bi}>{b}</li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    ) : null}

                    {data.keyTerms?.length ? (
                        <div>
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/50 dark:text-[#D5D5D5]/50">
                                key terms
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {data.keyTerms.map((term) => (
                                    <span
                                        key={term}
                                        className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[11px] font-medium text-black/75 dark:border-white/10 dark:bg-white/10 dark:text-[#D5D5D5]/80"
                                    >
                                        {term}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {data.truncated && (
                        <p className="text-[11px] italic text-black/45 dark:text-[#D5D5D5]/45">
                            Long document. This summary covers the earlier portion.
                        </p>
                    )}
                </div>
            ) : null}
        </ToolShell>
    );
});
