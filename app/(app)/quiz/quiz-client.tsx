"use client";

import React, { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronRight,
    Clock,
    Trophy,
    Target,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    RotateCcw,
} from "lucide-react";
import { WildlifeJSON } from "@/public/assets/quiz-json";
import { ForestJSON } from "@/public/assets/quiz-json";
import { spokenenglishJSON } from "@/public/assets/quiz-json";
import { conservationEconomicsJSON } from "@/public/assets/quiz-json";
import { captureQuizSubmitted } from "@/lib/posthog/client";

interface Question {
    question: string;
    options: string[];
    answer: string;
}

interface QuizQuestion extends Question {
    selectedAnswer?: string;
    isMarked?: boolean;
    weekNumber: string;
    isExpanded?: boolean;
    originalIndex?: number;
}

interface Week {
    name: string;
    questions?: Question[];
    content?: Question[];
}

interface CourseData {
    title: string;
    code: string;
    weeks: Week[];
}

// loading → empty (no questions matched) | in_progress → submitted.
// Answers, navigation and the timer only act while the quiz is in progress,
// and a quiz is submitted exactly once, by the last answer or the timer.
type QuizPhase = "loading" | "empty" | "in_progress" | "submitted";

type QuizState = {
    phase: QuizPhase;
    currentQuestionIndex: number;
    expandedQuestionIndex: number | null;
    questions: QuizQuestion[];
    score: number;
    showError: boolean;
    showOnlyIncorrect: boolean;
    /** Seconds left, or null for a quiz without a time limit. */
    timeRemaining: number | null;
};

type QuizAction =
    | { type: "initialize"; questions: QuizQuestion[]; timeLimitSeconds: number | null }
    | { type: "answer"; answer: string; index: number }
    | { type: "next-question" }
    | { type: "missing-answer" }
    | { type: "submit" }
    | { type: "tick" }
    | { type: "show-only-incorrect"; value: boolean }
    | { type: "toggle-expanded"; index: number };

const initialQuizState: QuizState = {
    phase: "loading",
    currentQuestionIndex: 0,
    expandedQuestionIndex: null,
    questions: [],
    score: 0,
    showError: false,
    showOnlyIncorrect: false,
    timeRemaining: null,
};

function isAnswerCorrect(selected: string, correctAnswers: string | string[]) {
    const normalizedSelected = selected.trim().toLowerCase();
    if (typeof correctAnswers === "string") {
        return normalizedSelected === correctAnswers.trim().toLowerCase();
    }
    if (Array.isArray(correctAnswers)) {
        return correctAnswers.some(
            (answer) => normalizedSelected === answer.trim().toLowerCase(),
        );
    }
    return false;
}

function scoreQuestions(questions: QuizQuestion[]) {
    return questions.filter((q) =>
        isAnswerCorrect((q.selectedAnswer || "").trim(), q.answer),
    ).length;
}

function submitQuizState(state: QuizState): QuizState {
    return {
        ...state,
        phase: "submitted",
        score: scoreQuestions(state.questions),
        showError: false,
    };
}

function quizReducer(state: QuizState, action: QuizAction): QuizState {
    switch (action.type) {
        case "initialize":
            return {
                ...initialQuizState,
                phase: action.questions.length > 0 ? "in_progress" : "empty",
                questions: action.questions,
                timeRemaining: action.timeLimitSeconds,
            };
        case "answer":
            if (state.phase !== "in_progress") return state;
            return {
                ...state,
                questions: state.questions.map((question, index) =>
                    index === action.index
                        ? { ...question, selectedAnswer: action.answer }
                        : question,
                ),
                showError: false,
            };
        case "next-question": {
            if (state.phase !== "in_progress") return state;
            if (!state.questions[state.currentQuestionIndex]?.selectedAnswer) {
                return { ...state, showError: true };
            }
            if (state.currentQuestionIndex >= state.questions.length - 1) {
                return submitQuizState(state);
            }
            return {
                ...state,
                currentQuestionIndex: state.currentQuestionIndex + 1,
                showError: false,
            };
        }
        case "missing-answer":
            return state.phase === "in_progress" ? { ...state, showError: true } : state;
        case "submit":
            return state.phase === "in_progress" ? submitQuizState(state) : state;
        case "tick": {
            if (state.phase !== "in_progress" || state.timeRemaining === null) return state;
            const timeRemaining = Math.max(0, state.timeRemaining - 1);
            return timeRemaining === 0
                ? submitQuizState({ ...state, timeRemaining })
                : { ...state, timeRemaining };
        }
        case "show-only-incorrect":
            return { ...state, showOnlyIncorrect: action.value };
        case "toggle-expanded":
            return state.phase === "submitted"
                ? {
                      ...state,
                      expandedQuestionIndex:
                          state.expandedQuestionIndex === action.index
                              ? null
                              : action.index,
                  }
                : state;
    }
}

/** Parses the HHMMSS `time` parameter; anything not positive means no limit. */
function parseTimeLimitSeconds(time: string) {
    if (!/^\d{6}$/.test(time)) return null;
    const hours = Number.parseInt(time.slice(0, 2), 10);
    const minutes = Number.parseInt(time.slice(2, 4), 10);
    const seconds = Number.parseInt(time.slice(4, 6), 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds : null;
}

const getCourseData = (courseCode: string): CourseData => {
    switch (courseCode) {
        case "102104073":
            return { ...WildlifeJSON, code: courseCode } as CourseData;
        case "102104082":
            return { ...ForestJSON, code: courseCode } as CourseData;
        case "109106067":
            return { ...spokenenglishJSON, code: courseCode } as CourseData;
        case "102104086":
            return { ...conservationEconomicsJSON, code: courseCode } as CourseData;
        default:
            return { ...WildlifeJSON, code: "102104073" } as CourseData;
    }
};

export default function QuizClient({ quizConfig }: { quizConfig: string }) {
    const { push } = useRouter();
    const [
        {
            phase,
            currentQuestionIndex,
            expandedQuestionIndex,
            questions,
            score,
            showError,
            showOnlyIncorrect,
            timeRemaining,
        },
        dispatch,
    ] = useReducer(quizReducer, initialQuizState);
    const quizSubmitted = phase === "submitted";
    const quizMetaRef = useRef<{ courseCode: string; totalQuestions: number }>({ courseCode: "", totalQuestions: 0 });

    useEffect(() => {
        const params = new URLSearchParams(decodeURIComponent(quizConfig));
        const weeks = params.get("weeks")?.split("-") || [];
        const numQuestions = Number.parseInt(params.get("numQ") || "0", 10);
        const timeLimitSeconds = parseTimeLimitSeconds(params.get("time") || "");
        const courseCode = params.get("course") || "102104073";
        quizMetaRef.current.courseCode = courseCode;

        const courseData = getCourseData(courseCode);

        const allQuestions: QuizQuestion[] = weeks.flatMap((week) => {
            const weekData = courseData.weeks.find((w) => w.name === week);

            if (!weekData) {
                console.warn(`Week ${week} not found in course data`);
                return [];
            }

            const questionsArray = weekData.questions || weekData.content || [];

            return questionsArray.map((q: Question, index) => ({
                ...q,
                weekNumber: week,
                isExpanded: false,
                originalIndex: index,
            }));
        });

        const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffledQuestions.slice(0, numQuestions).map((q, index) => ({
            ...q,
            originalIndex: index,
        }));
        quizMetaRef.current.totalQuestions = selectedQuestions.length;
        dispatch({
            type: "initialize",
            questions: selectedQuestions,
            timeLimitSeconds,
        });
    }, [quizConfig]);

    const timed = timeRemaining !== null;
    useEffect(() => {
        if (phase !== "in_progress" || !timed) return;
        // The reducer submits when the countdown reaches zero.
        const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
        return () => clearInterval(timer);
    }, [phase, timed]);

    // Report each submission once, whichever path (last answer or timer) made it.
    useEffect(() => {
        if (phase !== "submitted") return;
        captureQuizSubmitted({
            courseCode: quizMetaRef.current.courseCode,
            score,
            totalQuestions: quizMetaRef.current.totalQuestions,
        });
    }, [phase, score]);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const handleAnswerSelect = (answer: string) => {
        dispatch({ type: "answer", answer, index: currentQuestionIndex });
    };

    const goToNextQuestion = () => {
        // The reducer asks for an answer, advances, or submits on the last question.
        dispatch({ type: "next-question" });
    };

    const toggleQuestionExpansion = (index: number) => {
        dispatch({ type: "toggle-expanded", index });
    };

    const getScoreColor = (percentage: number) => {
        if (percentage >= 80) return "text-green-400 dark:bg-green-800/20";
        if (percentage >= 60) return "text-yellow-400 dark:bg-yellow-800/20";
        return "dark:bg-red-800/20 text-red-400";
    };

    if (phase === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="size-16 animate-spin border-b-2 border-t-2 border-gray-900" />
            </div>
        );
    }

    if (phase === "empty") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center text-black dark:text-[#D5D5D5]">
                <p className="text-lg font-semibold">No questions match this quiz.</p>
                <button
                    type="button"
                    onClick={() => push("/quiz")}
                    className="border-2 border-black px-4 py-2 font-semibold dark:border-[#D5D5D5]"
                >
                    Choose other weeks
                </button>
            </div>
        );
    }

    if (quizSubmitted) {
        const displayedQuestions = showOnlyIncorrect
            ? questions.filter((q) => !isAnswerCorrect(q.selectedAnswer || "", q.answer))
            : questions;

        const percentage = ((score / questions.length) * 100).toFixed(1);

        return (
            <div className="mx-auto px-4 py-8 lg:w-[75vw] md:w-[90vw]">
                <div className="mb-8 overflow-hidden bg-[#5FC4E7] shadow-lg dark:border-2 dark:bg-[#ffffff]/20">
                    <div className="p-6 text-center">
                        <div className="mb-4 flex justify-center">
                            <Trophy className="size-16 dark:text-[#D5D5D5]" />
                        </div>
                        <h1 className="text-2xl font-bold dark:text-[#D5D5D5]">Quiz Complete!</h1>
                        <p className="mt-2 text-lg font-semibold text-black dark:text-[#D5D5D5]">
                            Here&apos;s how you performed
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 gap-4 p-2 text-center md:grid-cols-3">
                            <div className={`flex flex-col items-center justify-center p-4 text-4xl font-bold ${getScoreColor(Number(percentage))}`}>
                                <p className="mb-1 text-md font-medium uppercase">Score</p>
                                <p className="text-3xl">{score}/{questions.length}</p>
                            </div>
                            <div className={`flex flex-col items-center justify-center p-4 text-4xl font-bold ${getScoreColor(Number(percentage))}`}>
                                <p className="mb-1 text-md font-medium uppercase">Percentage</p>
                                <p className="text-3xl font-bold">{percentage}%</p>
                            </div>
                            <div className={`flex flex-col items-center justify-center p-4 text-4xl font-bold ${getScoreColor(Number(percentage))}`}>
                                <p className="mb-1 text-md font-medium uppercase">Questions</p>
                                <p className="text-3xl">
                                    {questions.filter((q) => isAnswerCorrect(q.selectedAnswer || "", q.answer)).length} correct
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center space-x-2 bg-[#5FC4E7] p-3 dark:bg-[#ffffff]/20">
                        <Target size={20} />
                        <label className="flex cursor-pointer items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={showOnlyIncorrect}
                                onChange={(e) =>
                                    dispatch({
                                        type: "show-only-incorrect",
                                        value: e.target.checked,
                                    })
                                }
                                className="form-checkbox size-5"
                            />
                            <span className="text-base font-medium dark:text-[#D5D5D5]">
                                Show Incorrect Only
                            </span>
                        </label>
                    </div>
                    <span className="justify-end p-4 text-md font-medium text-dark dark:text-[#D5D5D5]">
                        Showing {displayedQuestions.length} of {questions.length} questions
                    </span>
                </div>

                <div className="mb-6 grid w-full grid-cols-3 gap-4 sm:grid-cols-4">
                    {displayedQuestions.map((q, index) => (
                        <button
                            type="button"
                            key={`${q.weekNumber}-${q.originalIndex ?? q.question}`}
                            className={`cursor-pointer p-2 py-4 transition-all duration-300 ${
                                expandedQuestionIndex === index ? "col-span-4" : ""
                            } ${
                                isAnswerCorrect(q.selectedAnswer || "", q.answer)
                                    ? "bg-green-200 text-[#037d00] dark:bg-[#1a271a]"
                                    : "bg-red-200 font-semibold text-[#cb0909] dark:bg-[#341a1a]"
                            }`}
                            onClick={() => toggleQuestionExpansion(index)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <p className="text-md text-black dark:text-[#D5D5D5]">
                                        Question {(q.originalIndex || 0) + 1}
                                    </p>
                                    <p className="text-sm text-black opacity-75 dark:text-[#D5D5D5]">
                                        Week {q.weekNumber}
                                    </p>
                                </div>
                                {expandedQuestionIndex === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                            {expandedQuestionIndex === index && (
                                <div className="mt-2">
                                    <p className="text-black dark:text-[#D5D5D5]">{q.question}</p>
                                    <p className="mt-2">
                                        Your answer:{" "}
                                        <span
                                            className={
                                                isAnswerCorrect(q.selectedAnswer || "", q.answer)
                                                    ? "font-semibold text-green-800"
                                                    : "font-semibold text-red-800"
                                            }
                                        >
                                            {q.selectedAnswer || "Not answered"}
                                        </span>
                                    </p>
                                    <p className="mt-1 font-semibold text-green-800">
                                        Correct answer: {q.answer}
                                    </p>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="mt-8 flex flex-col items-center justify-between gap-4 font-semibold dark:text-[#D5D5D5] sm:flex-row">
                    <div className="flex w-full justify-between gap-4 sm:w-fit sm:justify-start">
                        <button
                            type="button"
                            onClick={() => push("/quiz")}
                            className="flex items-center bg-[#5FC4E7] px-6 py-3 hover:opacity-90 transition-opacity dark:bg-[#008A90]"
                        >
                            <ArrowLeft size={20} className="mr-2" />
                            Try Another Quiz
                        </button>
                        <button
                            type="button"
                            className="flex items-center bg-[#5FC4E7] px-6 py-3 hover:opacity-90 transition-opacity dark:bg-[#008A90]"
                            onClick={() => window.location.reload()}
                        >
                            <RotateCcw size={20} className="mr-2" />
                            Retry Quiz
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => push("/")}
                        className="flex w-full items-center justify-center bg-[#5FC4E7] px-6 py-3 hover:opacity-90 transition-opacity dark:bg-[#008A90] sm:w-fit"
                    >
                        Return Home
                        <ChevronRight size={20} className="ml-2" />
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const timeRunningOut = timeRemaining !== null && timeRemaining <= 30;

    return (
        <div className="mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
                {timeRemaining !== null ? (
                    <div className="flex items-center space-x-2">
                        <Clock
                            className={
                                timeRunningOut
                                    ? "animate-pulse text-red-500"
                                    : "text-black dark:text-white"
                            }
                        />
                        <span
                            className={`font-mono text-lg sm:text-xl ${
                                timeRunningOut ? "text-red-500" : "text-black dark:text-white"
                            }`}
                        >
                            {formatTime(timeRemaining)}
                        </span>
                    </div>
                ) : (
                    <span aria-hidden />
                )}
                <div className="text-lg text-black dark:text-white sm:text-md">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </div>
            </div>

            {timeRunningOut && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:px-4 sm:py-3 sm:text-base">
                    30 seconds remaining! Please finish your quiz.
                </div>
            )}

            <div className="flex flex-col items-center justify-center">
                <div className="mb-4 flex min-h-[10vh] w-[70vw] bg-[#5FC4E7] text-black shadow-md dark:bg-[#008A90] dark:text-[#D5D5D5]">
                    <h2 className="flex items-center justify-center p-3 text-center text-base font-medium shadow-sm sm:p-4 sm:text-xl">
                        {currentQuestionIndex + 1}. {currentQuestion.question}
                    </h2>
                </div>

                <div className="w-[60vw] space-y-3">
                    {currentQuestion.options.map((option, index) => (
                        <button
                            type="button"
                            key={option}
                            onClick={() => handleAnswerSelect(option)}
                            className={`w-full p-3 text-left text-sm text-black transition-colors sm:p-4 sm:text-base dark:border dark:border-[#D5D5D5] dark:text-[#D5D5D5] ${
                                currentQuestion.selectedAnswer === option
                                    ? "bg-[#82BEE9] text-white shadow-lg dark:bg-white/20"
                                    : "bg-[#5FC4E7] dark:bg-[#0C1222]"
                            }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>

                {showError && (
                    <div className="mt-4 w-[60vw] rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">
                        Please select an answer before proceeding
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end space-x-4 sm:mt-6">
                <button
                    type="button"
                    onClick={goToNextQuestion}
                    className="bg-[#5FC4E7] px-4 py-2 text-lg font-semibold hover:opacity-90 transition-opacity dark:bg-[#008A90] dark:text-[#D5D5D5] sm:px-6"
                >
                    {currentQuestionIndex === questions.length - 1 ? "Submit" : "Next"}
                    <ChevronRight size={20} className="ml-2 inline" />
                </button>
            </div>
        </div>
    );
}
