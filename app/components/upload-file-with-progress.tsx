"use client";

import React, { useEffect, useReducer, useRef } from "react";
import UploadFile from "@/app/components/upload-file";
import type { CourseOption } from "@/app/components/mod/course-picker";

type UploadVariant = "Notes" | "Past Papers";

type UploadFileWithProgressProps = {
    variant: UploadVariant;
    courses?: CourseOption[];
};

type UploadStage =
    | "idle"
    | "preparing"
    | "processing"
    | "saving"
    | "complete"
    | "failed";

type UploadProgressState = {
    stage: UploadStage;
    processRequestsFinished: number;
    processRequestsStarted: number;
};

type UploadProgressAction =
    | { type: "submitted" }
    | { type: "process-started" }
    | { type: "process-finished" }
    | { type: "save-started" }
    | { type: "completed" }
    | { type: "failed" }
    | { type: "reset" };

const initialProgressState: UploadProgressState = {
    stage: "idle",
    processRequestsFinished: 0,
    processRequestsStarted: 0,
};

const stageOrder: UploadStage[] = [
    "preparing",
    "processing",
    "saving",
    "complete",
];

function uploadProgressReducer(
    state: UploadProgressState,
    action: UploadProgressAction,
): UploadProgressState {
    switch (action.type) {
        case "submitted":
            return {
                stage: "preparing",
                processRequestsFinished: 0,
                processRequestsStarted: 0,
            };
        case "process-started":
            return {
                ...state,
                stage: "processing",
                processRequestsStarted: state.processRequestsStarted + 1,
            };
        case "process-finished":
            return {
                ...state,
                processRequestsFinished: state.processRequestsFinished + 1,
            };
        case "save-started":
            return { ...state, stage: "saving" };
        case "completed":
            return { ...state, stage: "complete" };
        case "failed":
            return { ...state, stage: "failed" };
        case "reset":
            return initialProgressState;
    }
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
    const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const rawUrl =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

    try {
        return {
            method,
            pathname: new URL(rawUrl, window.location.origin).pathname,
        };
    } catch {
        return { method, pathname: rawUrl };
    }
}

function progressCopy(state: UploadProgressState, variant: UploadVariant) {
    const resourceName = variant === "Past Papers" ? "paper" : "notes";

    switch (state.stage) {
        case "preparing":
            return {
                eyebrow: "Step 1 of 4",
                title: "Preparing your files",
                description:
                    "Checking the selected files and assembling the upload request.",
            };
        case "processing": {
            const count = state.processRequestsStarted;
            const completed = Math.min(state.processRequestsFinished, count);
            const countText =
                count > 1
                    ? ` ${completed} of ${count} files processed.`
                    : completed > 0
                      ? " File processed."
                      : "";

            return {
                eyebrow: "Step 2 of 4",
                title: `Uploading and processing ${resourceName}`,
                description:
                    `Sending the file to ExamCooker, generating its stored copy and preview.${countText}`,
            };
        }
        case "saving":
            return {
                eyebrow: "Step 3 of 4",
                title: "Saving submission details",
                description:
                    "Writing the selected metadata and adding the submission to the automated review queue.",
            };
        case "complete":
            return {
                eyebrow: "Step 4 of 4",
                title: "Submitted for review",
                description:
                    "The upload is stored. ExamCooker is opening the library while automated review starts.",
            };
        case "failed":
            return {
                eyebrow: "Upload stopped",
                title: "This submission did not finish",
                description:
                    "The upload form contains the error details. Your selected files remain available so you can retry.",
            };
        case "idle":
            return null;
    }
}

function UploadProgressPanel({
    state,
    variant,
}: {
    state: UploadProgressState;
    variant: UploadVariant;
}) {
    const copy = progressCopy(state, variant);
    if (!copy) return null;

    const activeIndex =
        state.stage === "failed"
            ? -1
            : Math.max(stageOrder.indexOf(state.stage), 0);

    return (
        <aside
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[80] border border-black/15 bg-white/95 p-4 text-black shadow-2xl backdrop-blur-md dark:border-white/15 dark:bg-[#121B31]/95 dark:text-[#D5D5D5] sm:left-auto sm:right-5 sm:w-[22rem] lg:bottom-5"
        >
            <div className="flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className={`mt-1 size-3 shrink-0 rounded-full ${
                        state.stage === "failed"
                            ? "bg-red-500"
                            : state.stage === "complete"
                              ? "bg-emerald-500"
                              : "animate-pulse bg-[#008A90] dark:bg-[#3BF4C7]"
                    }`}
                />
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                        {copy.eyebrow}
                    </p>
                    <p className="mt-1 text-sm font-bold">{copy.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-black/60 dark:text-white/60">
                        {copy.description}
                    </p>
                </div>
            </div>

            {state.stage !== "failed" ? (
                <div
                    className="mt-4 grid grid-cols-4 gap-1"
                    aria-label={`${activeIndex + 1} of 4 upload steps reached`}
                >
                    {stageOrder.map((stage, index) => (
                        <span
                            key={stage}
                            aria-hidden="true"
                            className={`h-1.5 rounded-full transition-colors ${
                                index <= activeIndex
                                    ? "bg-[#008A90] dark:bg-[#3BF4C7]"
                                    : "bg-black/10 dark:bg-white/10"
                            }`}
                        />
                    ))}
                </div>
            ) : null}
        </aside>
    );
}

export default function UploadFileWithProgress(
    props: UploadFileWithProgressProps,
) {
    const [progress, dispatch] = useReducer(
        uploadProgressReducer,
        initialProgressState,
    );
    const validationFallbackRef = useRef<number | null>(null);
    const networkStartedRef = useRef(false);

    useEffect(() => {
        const originalFetch = window.fetch;

        const trackedFetch: typeof window.fetch = async (input, init) => {
            const { method, pathname } = requestDetails(input, init);
            const isProcessRequest =
                method === "POST" && pathname === "/api/uploads/process";
            const isSaveRequest =
                method === "POST" && pathname === "/api/uploads";

            if (!isProcessRequest && !isSaveRequest) {
                return originalFetch(input, init);
            }

            networkStartedRef.current = true;
            if (validationFallbackRef.current !== null) {
                window.clearTimeout(validationFallbackRef.current);
                validationFallbackRef.current = null;
            }

            dispatch({
                type: isProcessRequest ? "process-started" : "save-started",
            });

            try {
                const response = await originalFetch(input, init);
                if (!response.ok) {
                    dispatch({ type: "failed" });
                    return response;
                }

                dispatch({
                    type: isProcessRequest ? "process-finished" : "completed",
                });
                return response;
            } catch (error) {
                dispatch({ type: "failed" });
                throw error;
            }
        };

        window.fetch = trackedFetch;
        return () => {
            if (window.fetch === trackedFetch) {
                window.fetch = originalFetch;
            }
            if (validationFallbackRef.current !== null) {
                window.clearTimeout(validationFallbackRef.current);
            }
        };
    }, []);

    const handleSubmitCapture = () => {
        networkStartedRef.current = false;
        dispatch({ type: "submitted" });

        if (validationFallbackRef.current !== null) {
            window.clearTimeout(validationFallbackRef.current);
        }
        validationFallbackRef.current = window.setTimeout(() => {
            if (!networkStartedRef.current) {
                dispatch({ type: "reset" });
            }
            validationFallbackRef.current = null;
        }, 750);
    };

    return (
        <div onSubmitCapture={handleSubmitCapture}>
            <UploadFile {...props} />
            <UploadProgressPanel state={progress} variant={props.variant} />
        </div>
    );
}
