"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    ChevronRight,
    Clock,
    ArrowLeft,
    Trophy,
    Target,
    ChevronDown,
    ChevronUp,
    ArrowLeftCircle,
} from "lucide-react";

interface QuizContent {
    title: string;
    weeks: Week[];
}

interface Week {
    name: string;
    questions: Question[];
}

interface Question {
    id: number;
    question: string;
    options: string[];
    answer: string[];
}

interface QuizQuestion extends Omit<Question, 'answer'> {
    answer: string;
    selectedAnswer?: string;
    isMarked?: boolean;
    weekNumber: string;
    isExpanded?: boolean;
}

const predefinedReasons = [
    "Incorrect Answer Options",
    "Offensive Content",
    "Duplicate Question",
    "Other",
];

const ReportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedReason: string;
    setSelectedReason: (reason: string) => void;
    handleReportSubmit: () => void;
    reportErrorMessage: string | null;
    reportSuccessMessage: string | null;
    reporting: boolean;
    questionToReport: QuizQuestion | null;
}> = ({
    isOpen,
    onClose,
    selectedReason,
    setSelectedReason,
    handleReportSubmit,
    reportErrorMessage,
    reportSuccessMessage,
    reporting,
    questionToReport,
}) => {
    if (!isOpen || !questionToReport) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white dark:bg-[#0C1222] rounded-lg shadow-lg p-6 w-11/12 sm:w-2/3 md:w-1/2 lg:w-1/3">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <ArrowLeftCircle size={24} />
                    </button>
                    <h2 className="text-xl font-bold dark:text-[#D5D5D5] text-center flex-1">Report Question</h2>
                    <div className="w-6"></div>
                </div>
                <p className="mb-4 dark:text-[#D5D5D5]">
                    Please select a reason for reporting this question.
                </p>
                <p className="mb-4 dark:text-[#D5D5D5]">
                    <strong>Question:</strong> {questionToReport.question}
                </p>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 dark:text-[#D5D5D5]" htmlFor="reason">
                        Reason
                    </label>
                    <select
                        id="reason"
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300 dark:bg-[#3D414E] dark:text-[#D5D5D5] dark:border-gray-600"
                    >
                        <option value="">-- Select a Reason --</option>
                        {predefinedReasons.map((reason, index) => (
                            <option key={index} value={reason}>
                                {reason}
                            </option>
                        ))}
                    </select>
                </div>
                {reportErrorMessage && (
                    <p className="text-red-500 text-sm mb-4">{reportErrorMessage}</p>
                )}
                {reportSuccessMessage && (
                    <p className="text-green-500 text-sm mb-4">{reportSuccessMessage}</p>
                )}
                <div className="flex justify-center space-x-2 mt-4">
                    <button
                        onClick={handleReportSubmit}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                        disabled={reporting}
                    >
                        {reporting ? "Reporting..." : "Submit Report"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const QuizPage: React.FC = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
    const [score, setScore] = useState<number>(0);
    const [showWarning, setShowWarning] = useState<boolean>(false);
    const [showOnlyIncorrect, setShowOnlyIncorrect] = useState<boolean>(false);
    const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null);
    const [showError, setShowError] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [questionToReport, setQuestionToReport] = useState<QuizQuestion | null>(null);
    const [reporting, setReporting] = useState<boolean>(false);
    const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
    const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);

    const cleanQuestion = (question: string): string => {
        return question.replace(/^\d+[\.\)]\s*/, '').trim();
    };

    const isValidQuestion = (question: string): boolean => {
        const cleanedQuestion = cleanQuestion(question);
        
        if (cleanedQuestion === '') return false;
        
        const optionOnlyPattern = /^([a-zA-Z]\. ?)+$/;
        if (optionOnlyPattern.test(cleanedQuestion)) return false;
        
        return true;
    };

    const getCourseCodeFromPath = (): string => {
        const pathParts = pathname.split("/quiz/");
        if (pathParts.length < 2) {
            return "";
        }
        const courseCodeWithParams = pathParts[1];
        const [courseCode] = courseCodeWithParams.split("?");
        return courseCode;
    };

    useEffect(() => {
        const fetchQuizContent = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const url = new URL(window.location.href);
                const courseCode = getCourseCodeFromPath();

                if (!courseCode) {
                    throw new Error("Course code not found in URL.");
                }

                const params = new URLSearchParams(url.search);
                const weeksParam = params.get("weeks");
                const numQuestionsParam = params.get("numQ");
                const timeParam = params.get("time");

                const weeks = weeksParam ? weeksParam.split("-").map(Number) : [];
                const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam) : 0;
                const timeSeconds = timeParam
                    ? parseInt(timeParam.substring(0, 2)) * 3600 +
                      parseInt(timeParam.substring(2, 4)) * 60 +
                      parseInt(timeParam.substring(4, 6))
                    : 0;

                setTimeRemaining(timeSeconds > 0 ? timeSeconds : 30 * 60);

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/courses/${courseCode}`
                );
                if (!response.ok) {
                    throw new Error(`Error fetching quiz content: ${response.statusText}`);
                }

                const data: QuizContent = await response.json();

                const allQuestions: QuizQuestion[] = data.weeks
                    .filter((week) => weeks.includes(parseInt(week.name)))
                    .flatMap((week) =>
                        week.questions.map((q) => ({
                            id: q.id, 
                            question: cleanQuestion(q.question),
                            options: q.options,
                            answer: q.answer[0],
                            weekNumber: week.name,
                            isExpanded: false,
                        }))
                    )
                    .filter((q) => isValidQuestion(q.question));

                if (allQuestions.length === 0) {
                    throw new Error("No valid questions available for the selected weeks.");
                }

                const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
                const selectedQuestions = numQuestions > 0
                    ? shuffledQuestions.slice(0, numQuestions)
                    : shuffledQuestions;

                setQuestions(selectedQuestions);
            } catch (error: any) {
                setFetchError(error.message || "An unknown error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuizContent();
    }, [pathname]);

    useEffect(() => {
        if (timeRemaining === 0 && !quizSubmitted && questions.length > 0) {
            submitQuiz();
        }
    }, [timeRemaining, quizSubmitted, questions]);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                closeReportModal();
            }
        };

        if (isReportModalOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isReportModalOpen]);

    const formatTime = (totalSeconds: number): string => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0"
        )}:${String(seconds).padStart(2, "0")}`;
    };

    const handleAnswerSelect = (answer: string): void => {
        setShowError(false);
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex].selectedAnswer = answer;
        setQuestions(updatedQuestions);
    };

    const submitQuiz = (): void => {
        const correctAnswers = questions.filter(
            (q) => q.selectedAnswer === q.answer
        ).length;
        setScore(correctAnswers);
        setQuizSubmitted(true);
    };

    const goToNextQuestion = (): void => {
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

    const goToPreviousQuestion = (): void => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
            setShowError(false);
        }
    };

    const toggleQuestionExpansion = (index: number): void => {
        if (quizSubmitted) {
            setExpandedQuestionIndex(expandedQuestionIndex === index ? null : index);
        }
    };

    const getScoreColor = (percentage: number): string => {
        if (percentage >= 80) return "text-green-400 dark:bg-green-800/40";
        if (percentage >= 60) return "text-yellow-400 dark:bg-yellow-800/40";
        return "dark:bg-red-800/40 text-red-400";
    };

    const openReportModal = (question: QuizQuestion): void => {
        setQuestionToReport(question);
        setSelectedReason("");
        setReportErrorMessage(null);
        setReportSuccessMessage(null);
        setIsReportModalOpen(true);
    };

    const closeReportModal = (): void => {
        setIsReportModalOpen(false);
        setQuestionToReport(null);
        setSelectedReason("");
        setReportErrorMessage(null);
        setReportSuccessMessage(null);
    };

    const handleReportSubmit = async (): Promise<void> => {
        if (!questionToReport) {
            setReportErrorMessage("No question selected for reporting.");
            return;
        }
    
        if (!selectedReason) {
            setReportErrorMessage("Please select a reason for reporting.");
            return;
        }
    
        setReporting(true);
        setReportErrorMessage(null);
        setReportSuccessMessage(null);
    
        if (!questionToReport.question) {
            setReportErrorMessage("Invalid question selected for reporting.");
            setReporting(false);
            return;
        }
    
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/report-question`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': session?.user?.email || ""
                },
                body: JSON.stringify({ 
                    question_text: questionToReport.question, 
                    reason: selectedReason,
                    reported_by: session?.user?.email || "anonymous",
                }),
            });
    
            if (response.status === 409) {
                setReportErrorMessage("You have already reported this question.");
            } else if (response.ok) {
                const data = await response.json();
                setReportSuccessMessage("Question reported successfully.");
                setTimeout(closeReportModal, 1000); 
            } else {
                const errorData = await response.json();
                setReportErrorMessage(errorData.message || "Failed to report question.");
            }
        } catch (error) {
            console.error('Error reporting question:', error);
            setReportErrorMessage('An error occurred while reporting the question.');
        } finally {
            setReporting(false);
        }
    };    

    let content: React.ReactNode;

    if (isLoading) {
        content = (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
            </div>
        );
    }
    else if (fetchError) {
        content = (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-red-500">{fetchError}</p>
            </div>
        );
    }
    else if (questions.length === 0) {
        content = (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-700 dark:text-gray-300">No questions available.</p>
            </div>
        );
    }
    else if (quizSubmitted) {
        const displayedQuestions = showOnlyIncorrect
            ? questions.filter((q) => q.selectedAnswer !== q.answer)
            : questions;

        const percentage = ((score / questions.length) * 100).toFixed(1);

        content = (
            <div className="lg:w-[75vw] md:w-[90vw] mx-auto px-4 py-8">
                <div className="mb-8 bg-[#5FC4E7] dark:bg-[#ffffff]/20 shadow-lg overflow-hidden dark:border-2">
                    <div className="text-center p-6">
                        <div className="flex justify-center mb-4">
                            <Trophy className="w-16 h-16 dark:text-[#D5D5D5]" />
                        </div>
                        <h1 className="text-2xl font-bold dark:text-[#D5D5D5]">
                            Quiz Complete!
                        </h1>
                        <p className="text-lg mt-2 text-black dark:text-[#D5D5D5] font-semibold">
                            Here's how you performed
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center p-2">
                            <div
                                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                                    Number(percentage)
                                )}`}
                            >
                                <p className="text-md uppercase font-medium mb-1">Score</p>
                                <p className="text-3xl">
                                    {score}/{questions.length}
                                </p>
                            </div>
                            <div
                                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                                    Number(percentage)
                                )}`}
                            >
                                <p className="text-md uppercase font-medium mb-1">
                                    Percentage
                                </p>
                                <p className={`text-3xl font-bold`}>{percentage}%</p>
                            </div>
                            <div
                                className={`text-4xl font-bold flex flex-col justify-center items-center p-4 ${getScoreColor(
                                    Number(percentage)
                                )}`}
                            >
                                <p className="text-md uppercase font-medium mb-1">Questions</p>
                                <p className="text-3xl">
                                    {questions.filter((q) => q.selectedAnswer === q.answer).length} correct
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center space-x-2 bg-[#5FC4E7] dark:bg-[#ffffff]/20 p-3">
                        <Target size={20} />
                        <label className="flex items-center space-x-2 cursor-pointer">
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
                    <span className="text-md text-dark font-medium dark:text-[#D5D5D5] p-4 justify-end">
                        Showing {displayedQuestions.length} of {questions.length} questions
                    </span>
                </div>

                <div className="w-full grid sm:grid-cols-4 grid-cols-3 gap-4 mb-6">
                    {displayedQuestions.map((q, index) => (
                        <div
                            key={q.id} 
                            className={`p-2 py-4 cursor-pointer transition-all duration-300 ${
                                expandedQuestionIndex === index ? "col-span-4" : ""
                            } ${
                                q.selectedAnswer === q.answer
                                    ? "bg-green-200 dark:bg-[#1a271a] text-[#037d00]"
                                    : "bg-red-200 dark:bg-[#341a1a] font-semibold text-[#cb0909]"
                            }`}
                            onClick={() => toggleQuestionExpansion(index)}
                        >
                            <div className="flex justify-between items-center">
                                <p className="text-md text-black dark:text-[#D5D5D5]">
                                    Question {index + 1}
                                </p>
                                {expandedQuestionIndex === index ? (
                                    <ChevronUp size={20} />
                                ) : (
                                    <ChevronDown size={20} />
                                )}
                            </div>
                            {expandedQuestionIndex === index && (
                                <div className="mt-2">
                                    <p className="text-black dark:text-[#D5D5D5]">
                                        {q.question}
                                    </p>
                                    <p className="mt-2">
                                        Your answer:{" "}
                                        <span
                                            className={
                                                q.selectedAnswer === q.answer
                                                    ? "text-green-800 font-semibold"
                                                    : "text-red-800 font-semibold"
                                            }
                                        >
                                            {q.selectedAnswer || "Not answered"}
                                        </span>
                                    </p>
                                    <p className="mt-1 text-green-800 font-semibold">
                                        Correct answer: {q.answer}
                                    </p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            openReportModal(q);
                                        }}
                                        className="mt-2 text-red-500 underline"
                                    >
                                        Report this question
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex flex-row justify-between font-semibold">
                    <button
                        onClick={() => router.push("/quiz")}
                        className="flex items-center px-6 py-3 bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity text-black dark:text-[#D5D5D5]"
                    >
                        <ArrowLeft size={24} className="mr-2 sm:size-[24px] size-[20px]" />
                        <p> Try Another Quiz </p>
                    </button>
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center px-6 py-3 bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity text-black dark:text-[#D5D5D5]"
                    >
                        <p>Return Home</p>
                        <ChevronRight size={24} className="ml-2 mt-1 sm:size-[24px] size-[20px]" />
                    </button>
                </div>

                <ReportModal
                    isOpen={isReportModalOpen}
                    onClose={closeReportModal}
                    selectedReason={selectedReason}
                    setSelectedReason={setSelectedReason}
                    handleReportSubmit={handleReportSubmit}
                    reportErrorMessage={reportErrorMessage}
                    reportSuccessMessage={reportSuccessMessage}
                    reporting={reporting}
                    questionToReport={questionToReport}
                />
            </div>
        ); 
    } 
    else {
        const currentQuestion = questions[currentQuestionIndex];

        content = (
            <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <div className="flex items-center space-x-2">
                        <Clock
                            className={`${timeRemaining <= 30
                                    ? "text-red-500 animate-pulse"
                                    : "text-black dark:text-white"
                                }`}
                        />
                        <span
                            className={`font-mono text-lg sm:text-xl ${timeRemaining <= 30
                                    ? "text-red-500"
                                    : "text-black dark:text-white"
                                }`}
                        >
                            {formatTime(timeRemaining)}
                        </span>
                    </div>
                    <div className="text-lg sm:text-md text-black dark:text-white">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </div>
                </div>

                {showWarning && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg mb-4 text-sm sm:text-base">
                        30 seconds remaining! Please finish your quiz.
                    </div>
                )}

                <div className="flex flex-col items-center justify-center">
                    <div className="flex mb-4 bg-[#5FC4E7] dark:bg-[#008A90] text-black dark:text-[#D5D5D5] min-h-[10vh] w-[70vw] shadow-md">
                        <h2 className="text-base sm:text-xl font-medium flex justify-center items-center p-3 sm:p-4 text-center shadow-sm">
                            {currentQuestionIndex + 1}. {currentQuestion.question}
                        </h2>
                    </div>

                    <div className="space-y-3 w-[60vw]">
                        {currentQuestion.options.map((option: string, index: number) => (
                            <button
                                key={index}
                                onClick={() => handleAnswerSelect(option)}
                                className={`p-3 sm:p-4 text-left dark:border dark:border-[#D5D5D5] transition-colors w-full text-sm sm:text-base text-black dark:text-[#D5D5D5] ${
                                    currentQuestion.selectedAnswer === option
                                        ? "bg-[#82BEE9] dark:bg-white/20 text-white shadow-lg"
                                        : "bg-[#5FC4E7] dark:bg-[#0C1222]"
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => openReportModal(currentQuestion)}
                        className="mt-4 text-red-500 underline"
                    >
                        Report this question
                    </button>

                    {showError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm w-[60vw] text-center">
                            Please select an answer before proceeding
                        </div>
                    )}
                </div>

                <div className="flex justify-between space-x-4 mt-4 sm:mt-6">
                    <button
                        onClick={goToPreviousQuestion}
                        className={`flex items-center px-4 sm:px-6 py-2 text-lg font-semibold bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity ${
                            currentQuestionIndex === 0 ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={currentQuestionIndex === 0}
                    >
                        <ArrowLeft size={20} className="mr-2 inline" />
                        <p>Previous</p>
                    </button>
                    <button
                        onClick={goToNextQuestion}
                        className="flex items-center px-4 sm:px-6 py-2 text-lg font-semibold bg-[#5FC4E7] dark:bg-[#008A90] hover:opacity-90 transition-opacity"
                    >
                        {currentQuestionIndex === questions.length - 1 ? "Submit" : "Next"}
                        <ChevronRight size={20} className="ml-2 inline" />
                    </button>
                </div>

                <ReportModal
                    isOpen={isReportModalOpen}
                    onClose={closeReportModal}
                    selectedReason={selectedReason}
                    setSelectedReason={setSelectedReason}
                    handleReportSubmit={handleReportSubmit}
                    reportErrorMessage={reportErrorMessage}
                    reportSuccessMessage={reportSuccessMessage}
                    reporting={reporting}
                    questionToReport={questionToReport}
                />
            </div>
        );
    } 

    return content; 
}

export default QuizPage;
