"use client";

import React, { useEffect, useRef, useState } from "react";
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
    const router = useRouter();

    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false);
    const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null);
    const [showError, setShowError] = useState(false);
    const quizMetaRef = useRef<{ courseCode: string; totalQuestions: number }>({ courseCode: "", totalQuestions: 0 });

    useEffect(() => {
        const params = new URLSearchParams(decodeURIComponent(quizConfig));
        const weeks = params.get("weeks")?.split("-") || [];
        const numQuestions = Number.parseInt(params.get("numQ") || "0", 10);
        const time = params.get("time") || "000000";
        const courseCode = params.get("course") || "102104073";
        quizMetaRef.current.courseCode = courseCode;

        const hours = Number.parseInt(time.slice(0, 2), 10);
        const minutes = Number.parseInt(time.slice(2, 4), 10);
        const seconds = Number.parseInt(time.slice(4, 6), 10);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        setTimeRemaining(totalSeconds);

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
        setQuestions(selectedQuestions);
    }, [quizConfig]);

    useEffect(() => {
        if (timeRemaining > 0 && !quizSubmitted) {
            const timer = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 1) {
                        submitQuiz();
                        clearInterval(timer);
                        return 0;
                    }

                    if (prev === 30) {
                        setShowWarning(true);
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [timeRemaining, quizSubmitted]);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const handleAnswerSelect = (answer: string) => {
        setShowError(false);
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex].selectedAnswer = answer;
        setQuestions(updatedQuestions);
    };

    const isAnswerCorrect = (selected: string, correctAnswers: string | string[]) => {
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
    };

    const submitQuiz = () => {
        const correctAnswersCount = questions.filter((q) => {
            const selectedAnswer = (q.selectedAnswer || "").trim();
            return isAnswerCorrect(selectedAnswer, q.answer);
        }).length;
        setScore(correctAnswersCount);
        setQuizSubmitted(true);
        captureQuizSubmitted({
            courseCode: quizMetaRef.current.courseCode,
            score: correctAnswersCount,
            totalQuestions: quizMetaRef.current.totalQuestions,
        });
    };

    const goToNextQuestion = () => {
        const currentQuestion = questions[currentQuestionIndex];

        if (!currentQuestion.selectedAnswer) {
            setShowError(true);
            return;
        }

        setShowError(false);
        if (currentQuestionIndex === questions.length - 1) {
            submitQuiz();
        } else {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const toggleQuestionExpansion = (index: number) => {
        if (quizSubmitted) {
            setExpandedQuestionIndex(expandedQuestionIndex === index ? null : index);
        }
    };

    const getScoreColor = (percentage: number) => {
        if (percentage >= 80) return "text-green-400 dark:bg-green-800/20";
        if (percentage >= 60) return "text-yellow-400 dark:bg-yellow-800/20";
        return "dark:bg-red-800/20 text-red-400";
    };

    if (questions.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-16 w-16 animate-spin border-b-2 border-t-2 border-gray-900" />
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
                            <Trophy className="h-16 w-16 dark:text-[#D5D5D5]" />
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
                                onChange={(e) => setShowOnlyIncorrect(e.target.checked)}
                                className="form-checkbox h-5 w-5"
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
                        <div
                            key={index}
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
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex flex-col items-center justify-between gap-4 font-semibold dark:text-[#D5D5D5] sm:flex-row">
                    <div className="flex w-full justify-between gap-4 sm:w-fit sm:justify-start">
                        <button
                            onClick={() => router.push("/quiz")}
                            className="flex items-center bg-[#5FC4E7] px-6 py-3 hover:opacity-90 transition-opacity dark:bg-[#008A90]"
                        >
                            <ArrowLeft size={20} className="mr-2" />
                            Try Another Quiz
                        </button>
                        <button
                            className="flex items-center bg-[#5FC4E7] px-6 py-3 hover:opacity-90 transition-opacity dark:bg-[#008A90]"
                            onClick={() => window.location.reload()}
                        >
                            <RotateCcw size={20} className="mr-2" />
                            Retry Quiz
                        </button>
                    </div>
                    <button
                        onClick={() => router.push("/")}
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

    return (
        <div className="mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
                <div className="flex items-center space-x-2">
                    <Clock
                        className={
                            timeRemaining <= 30
                                ? "animate-pulse text-red-500"
                                : "text-black dark:text-white"
                        }
                    />
                    <span
                        className={`font-mono text-lg sm:text-xl ${
                            timeRemaining <= 30 ? "text-red-500" : "text-black dark:text-white"
                        }`}
                    >
                        {formatTime(timeRemaining)}
                    </span>
                </div>
                <div className="text-lg text-black dark:text-white sm:text-md">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </div>
            </div>

            {showWarning && (
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
                            key={index}
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
