"use client";

import React, { type RefObject, useEffect, useState } from "react";
import { useGuestPrompt } from "@/app/components/auth-gate";
import {
    applyPaperMetadata,
    prepareClassifierPdf,
    type ClassifierResponse,
    type PaperMetadataClassification,
} from "@/app/components/uploads/paper-metadata-autofill";

function formatExamType(value: string) {
    return value.replaceAll("_", "-");
}

function formatSemester(value: string) {
    return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
}

function detectedFields(result: PaperMetadataClassification) {
    return [
        result.courseCode,
        result.examType ? formatExamType(result.examType) : null,
        result.semester ? formatSemester(result.semester) : null,
        result.year?.toString() ?? null,
        result.slot ? `Slot ${result.slot}` : null,
    ].filter((value): value is string => Boolean(value));
}

export default function PaperMetadataAutofillPanel({
    rootRef,
    sourceFile,
}: {
    rootRef: RefObject<HTMLDivElement | null>;
    sourceFile: File | null;
}) {
    const { requireAuth } = useGuestPrompt();
    const [result, setResult] = useState<PaperMetadataClassification | null>(null);
    const [isClassifying, setIsClassifying] = useState(false);
    const [error, setError] = useState("");
    const [appliedMessage, setAppliedMessage] = useState("");

    useEffect(() => {
        setResult(null);
        setError("");
        setAppliedMessage("");
    }, [sourceFile]);

    const handleClassify = async () => {
        const root = rootRef.current;
        if (!sourceFile || !root) return;
        if (!requireAuth("auto-fill paper details")) return;

        setIsClassifying(true);
        setError("");
        setAppliedMessage("");
        setResult(null);

        try {
            const classifierPdf = await prepareClassifierPdf(sourceFile);
            const formData = new FormData();
            formData.append("file", classifierPdf);

            const response = await fetch("/api/uploads/classify", {
                method: "POST",
                body: formData,
            });
            const payload = (await response
                .json()
                .catch(() => null)) as ClassifierResponse | null;

            if (!response.ok || !payload?.success || !payload.result) {
                throw new Error(payload?.error ?? "Paper classification failed.");
            }

            const classification = payload.result;
            const appliedFields = await applyPaperMetadata(root, classification);
            setResult(classification);
            setAppliedMessage(
                appliedFields.length > 0
                    ? `Filled ${appliedFields.join(", ")}.`
                    : "Details were detected, but no matching form options could be applied.",
            );
        } catch (classificationError) {
            setError(
                classificationError instanceof Error
                    ? classificationError.message
                    : "Paper classification failed.",
            );
        } finally {
            setIsClassifying(false);
        }
    };

    const fields = result ? detectedFields(result) : [];

    return (
        <aside className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[48] border border-black/15 bg-white/95 p-4 text-black shadow-2xl backdrop-blur-md dark:border-white/15 dark:bg-[#121B31]/95 dark:text-[#D5D5D5] sm:left-auto sm:right-5 sm:w-[22rem] lg:bottom-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                Paper metadata
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-bold">Auto-fill with AI</p>
                    <p className="mt-1 truncate text-xs text-black/55 dark:text-white/55">
                        {sourceFile
                            ? sourceFile.name
                            : "Select a PDF or take a photo first"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void handleClassify()}
                    disabled={!sourceFile || isClassifying}
                    className="shrink-0 border-2 border-black bg-[#3BF4C7] px-3 py-2 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-45"
                >
                    {isClassifying ? "Reading..." : "Auto-fill"}
                </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-black/55 dark:text-white/55">
                For photos, only the upper half of the first image is sent for classification. Review every filled field before uploading.
            </p>

            <div aria-live="polite" aria-atomic="true">
                {error ? (
                    <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">
                        {error}
                    </p>
                ) : null}

                {result ? (
                    <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                        <div className="flex flex-wrap gap-1.5">
                            {fields.map((field, index) => (
                                <span
                                    key={`${field}-${index}`}
                                    className="border border-black/15 bg-black/5 px-2 py-1 text-[11px] font-semibold dark:border-white/15 dark:bg-white/5"
                                >
                                    {field}
                                </span>
                            ))}
                        </div>
                        <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">
                            {Math.round(result.confidence * 100)}% confidence · {result.evidence}
                        </p>
                        {appliedMessage ? (
                            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                {appliedMessage}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </aside>
    );
}
