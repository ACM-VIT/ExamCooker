"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Clock, Flag } from "lucide-react";
import { WildlifeJSON } from "@/public/assets/quizJSON";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

interface QuizQuestion extends Question {
  selectedAnswer?: string;
  isMarked?: boolean;
  weekNumber: string;
}

interface Week {
  name: string;
  questions?: Question[];
  content?: Question[];
}

const QuizPage = () => {
  const pathname = usePathname();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(pathname.split("quiz/")[1]);
    const weeks = params.get("weeks")?.split("-") || [];
    const numQuestions = parseInt(params.get("numQ") || "0");
    const time = params.get("time") || "000000";

    const hours = parseInt(time.slice(0, 2));
    const minutes = parseInt(time.slice(2, 4));
    const seconds = parseInt(time.slice(4, 6));
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    setTimeRemaining(totalSeconds);

    const allQuestions: QuizQuestion[] = weeks.flatMap((week) => {
      const weekData = WildlifeJSON.weeks.find((w) => w.name === week) as
        | Week
        | undefined;

      if (!weekData) return [];

      const questionsArray = weekData.questions || weekData.content || [];

      return questionsArray.map((q) => ({
        ...q,
        weekNumber: week,
      }));
    });

    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
    setQuestions(shuffledQuestions.slice(0, numQuestions));
  }, [pathname]);

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
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const handleAnswerSelect = (answer: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].selectedAnswer = answer;
    setQuestions(updatedQuestions);
    setCountdownStarted(false);
  };

  const toggleMarkQuestion = () => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].isMarked =
      !updatedQuestions[currentQuestionIndex].isMarked;
    setQuestions(updatedQuestions);
  };

  const submitQuiz = () => {
    const correctAnswers = questions.filter(
      (q) => q.selectedAnswer === q.answer
    ).length;
    setScore(correctAnswers);
    setQuizSubmitted(true);
  };

  const goToNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion.selectedAnswer) {
      setCountdownStarted(true);
      return;
    }

    if (currentQuestionIndex === questions.length - 1) {
      submitQuiz();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCountdownStarted(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (quizSubmitted) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Quiz Results</h1>
          <div className="mb-4">
            <p className="text-lg">
              Score: {score} out of {questions.length} (
              {((score / questions.length) * 100).toFixed(1)}%)
            </p>
          </div>
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  q.selectedAnswer === q.answer ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p className="font-medium">
                  {index + 1}. {q.question}
                </p>
                <p className="mt-2">
                  Your answer:{" "}
                  <span
                    className={
                      q.selectedAnswer === q.answer
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {q.selectedAnswer || "Not answered"}
                  </span>
                </p>
                <p className="mt-1 text-green-600">
                  Correct answer: {q.answer}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/")}
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Clock
            className={`${
              timeRemaining <= 30
                ? "text-red-500 animate-pulse"
                : "text-gray-500"
            }`}
          />
          <span
            className={`font-mono text-xl ${
              timeRemaining <= 30 ? "text-red-500" : ""
            }`}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
      </div>

      {showWarning && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          30 seconds remaining! Please finish your quiz.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-medium">
            {currentQuestionIndex + 1}. {currentQuestion.question}
          </h2>
          <button
            onClick={toggleMarkQuestion}
            className={`p-2 rounded-full ${
              currentQuestion.isMarked
                ? "text-yellow-500 bg-yellow-50"
                : "text-gray-400 hover:bg-gray-50"
            }`}
          >
            <Flag size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              className={`w-full p-4 text-left rounded-lg border transition-colors ${
                currentQuestion.selectedAnswer === option
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {countdownStarted && !currentQuestion.selectedAnswer && (
          <div className="mt-4 text-red-500">
            Please select an answer before proceeding.
          </div>
        )}
      </div>

      <div className="flex justify-end items-center mb-6">
        <button
          onClick={goToNextQuestion}
          className="flex items-center space-x-2 px-6 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          <span>
            {currentQuestionIndex === questions.length - 1
              ? "Submit Quiz"
              : "Next"}
          </span>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-10 gap-2">
        {questions.map((q, index) => (
          <div
            key={index}
            className={`p-2 rounded text-center ${
              index === currentQuestionIndex
                ? "bg-blue-500 text-white"
                : q.selectedAnswer
                ? "bg-green-100"
                : q.isMarked
                ? "bg-yellow-100"
                : "bg-gray-100"
            }`}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizPage;
