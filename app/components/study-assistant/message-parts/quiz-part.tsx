"use client";

import { memo, useMemo, useState } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";

export interface QuizQuestion {
    id: string;
    question: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    explanation?: string;
}

export interface QuizOutput {
    title?: string;
    questions: QuizQuestion[];
}

interface QuizPartProps {
    state: ToolState;
    output?: QuizOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const QuizPart = memo(function QuizPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: QuizPartProps) {
    const quiz = (output as QuizOutput | null) ?? null;
    const questions = useMemo(
        () => (quiz?.questions && Array.isArray(quiz.questions) ? quiz.questions : []),
        [quiz]
    );

    const [picks, setPicks] = useState<Record<string, string>>({});
    const [graded, setGraded] = useState(false);
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});

    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Drafting questions" active={Boolean(isGlobalStreaming)} />;
    }

    const score = questions.filter((q) => picks[q.id] === q.correctOptionId).length;
    const allAnswered = questions.length > 0 && Object.keys(picks).length === questions.length;

    const pickOption = (qid: string, oid: string) => {
        if (graded) return;
        setPicks((prev) => ({ ...prev, [qid]: oid }));
    };

    return (
        <ToolShell
            toolName="quiz_me"
            label={quiz?.title ?? "Quiz"}
            state={state}
            errorText={errorText}
            headerExtra={
                questions.length
                    ? graded
                        ? `Score ${score}/${questions.length}`
                        : `${questions.length} questions`
                    : undefined
            }
        >
            {questions.length ? (
                <div className="space-y-5">
                    {questions.map((q, qi) => {
                        const picked = picks[q.id];
                        const isCorrect = picked === q.correctOptionId;
                        return (
                            <div key={q.id} className="space-y-2">
                                <p className="text-[13.5px] font-medium text-black dark:text-[#D5D5D5]">
                                    <span className="mr-1.5 font-mono text-[11px] text-black/45 dark:text-[#D5D5D5]/45">
                                        Q{qi + 1}
                                    </span>
                                    {q.question}
                                </p>
                                <div className="space-y-1">
                                    {q.options.map((o) => {
                                        const isPicked = picked === o.id;
                                        const isRight = graded && o.id === q.correctOptionId;
                                        const isWrong = graded && isPicked && !isCorrect;
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => pickOption(q.id, o.id)}
                                                disabled={graded}
                                                className={[
                                                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition",
                                                    isRight
                                                        ? "border-black/30 bg-black/[0.03] dark:border-white/30 dark:bg-white/[0.05]"
                                                        : isWrong
                                                            ? "border-red-500/40 bg-red-500/5"
                                                            : isPicked
                                                                ? "border-black/25 bg-black/[0.02] dark:border-white/25 dark:bg-white/[0.03]"
                                                                : "border-black/10 dark:border-white/10",
                                                    !graded
                                                        ? "cursor-pointer hover:border-black/20 hover:bg-black/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.03]"
                                                        : "cursor-default",
                                                ].join(" ")}
                                            >
                                                <span
                                                    className={[
                                                        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase",
                                                        isRight
                                                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-[#0C1222]"
                                                            : isWrong
                                                                ? "border-red-500 bg-red-500 text-white"
                                                                : isPicked
                                                                    ? "border-black bg-black/80 text-white dark:border-white dark:bg-white/80 dark:text-[#0C1222]"
                                                                    : "border-black/25 text-black/55 dark:border-white/25 dark:text-[#D5D5D5]/55",
                                                    ].join(" ")}
                                                >
                                                    {o.id}
                                                </span>
                                                <span className="flex-1 text-black dark:text-[#D5D5D5]">{o.text}</span>
                                                {isRight && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/70 dark:text-[#D5D5D5]/70" strokeWidth={2.5} />}
                                                {isWrong && <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" strokeWidth={2.5} />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {graded && q.explanation && (
                                    <div className="mt-1 rounded-md bg-black/[0.03] px-3 py-2 text-[12.5px] leading-relaxed text-black/75 dark:bg-white/[0.04] dark:text-[#D5D5D5]/80">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setRevealed((prev) => ({
                                                    ...prev,
                                                    [q.id]: !prev[q.id],
                                                }))
                                            }
                                            className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/50 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:text-[#D5D5D5]"
                                        >
                                            {revealed[q.id] ? "Hide" : "Show"} explanation
                                        </button>
                                        {revealed[q.id] && (
                                            <p className="mt-1.5 whitespace-pre-wrap">{q.explanation}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/5">
                        {!graded ? (
                            <button
                                type="button"
                                onClick={() => setGraded(true)}
                                disabled={!allAnswered}
                                className="inline-flex items-center rounded-md bg-[#0C1222] px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/40 dark:bg-[#D5D5D5] dark:text-[#0C1222] dark:disabled:bg-white/10 dark:disabled:text-white/40"
                            >
                                Grade answers
                            </button>
                        ) : (
                            <>
                                <span className="text-[13px] font-semibold tabular-nums text-black dark:text-[#D5D5D5]">
                                    {score}/{questions.length}
                                    {score === questions.length ? " · perfect" : ""}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPicks({});
                                        setGraded(false);
                                        setRevealed({});
                                    }}
                                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-black/50 hover:text-black dark:text-[#D5D5D5]/50 dark:hover:text-[#D5D5D5]"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Retry
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}
        </ToolShell>
    );
});
