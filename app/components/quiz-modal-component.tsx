"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

interface QuizModalContentProps {
  courseCode: string;
  courseName: string;
  onClose: () => void;
}

interface QuizState {
  selectedWeeks: number[];
  numQuestions: number | null;
  duration: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

interface ValidationState {
  weeks: {
    isValid: boolean;
    message: string;
  };
  questions: {
    isValid: boolean;
    message: string;
  };
  duration: {
    isValid: boolean;
    message: string;
  };
}

export default function QuizModalContent({
  courseCode,
  courseName,
  onClose,
}: QuizModalContentProps) {
  const { push } = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const TOTAL_WEEKS = 12;

  const [quizState, setQuizState] = useState<QuizState>({
    selectedWeeks: [],
    numQuestions: null,
    duration: { hours: 0, minutes: 0, seconds: 0 },
  });

  const [validation, setValidation] = useState<ValidationState>({
    weeks: { isValid: true, message: "" },
    questions: { isValid: true, message: "" },
    duration: { isValid: true, message: "" },
  });

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const getTotalSeconds = () => {
    const { hours, minutes, seconds } = quizState.duration;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const validateInputs = (): boolean => {
    const newValidation = { ...validation };
    let isValid = true;

    if (quizState.selectedWeeks.length === 0) {
      newValidation.weeks = {
        isValid: false,
        message: "Please select at least one week",
      };
      isValid = false;
    } else {
      newValidation.weeks = {
        isValid: true,
        message: `${quizState.selectedWeeks.length} weeks selected`,
      };
    }

    const maxQuestions = quizState.selectedWeeks.length * 10;
    if (!quizState.numQuestions || quizState.numQuestions <= 0) {
      newValidation.questions = {
        isValid: false,
        message: "Please enter a valid number of questions",
      };
      isValid = false;
    } else if (quizState.numQuestions > maxQuestions) {
      newValidation.questions = {
        isValid: false,
        message: `Maximum ${maxQuestions} questions allowed for selected weeks`,
      };
      isValid = false;
    } else {
      newValidation.questions = {
        isValid: true,
        message: `${quizState.numQuestions} questions selected`,
      };
    }

    const totalSeconds = getTotalSeconds();
    if (totalSeconds === 0) {
      newValidation.duration = {
        isValid: false,
        message: "Please set a duration greater than 0",
      };
      isValid = false;
    } else {
      newValidation.duration = {
        isValid: true,
        message: `${formatDuration(quizState.duration)} duration set`,
      };
    }

    setValidation(newValidation);
    return isValid;
  };

  const formatDuration = (duration: {
    hours: number;
    minutes: number;
    seconds: number;
  }) => {
    return `${String(duration.hours).padStart(2, "0")}:${String(
      duration.minutes
    ).padStart(2, "0")}:${String(duration.seconds).padStart(2, "0")}`;
  };

  const handleStartQuiz = () => {
    if (validateInputs()) {
      const formattedWeeks = quizState.selectedWeeks.join("-");
      const formattedDuration = formatDuration(quizState.duration).replace(
        /:/g,
        ""
      );
      const params = new URLSearchParams({
        weeks: formattedWeeks,
        numQ: String(quizState.numQuestions),
        time: formattedDuration,
        course: courseCode,
      });
      push(`/quiz?${params.toString()}`);
    }
  };

  const toggleAllWeeks = () => {
    setQuizState((prev) => ({
      ...prev,
      selectedWeeks:
        prev.selectedWeeks.length === TOTAL_WEEKS
          ? []
          : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1),
    }));
  };

  const toggleWeek = (week: number) => {
    setQuizState((prev) => ({
      ...prev,
      selectedWeeks: prev.selectedWeeks.includes(week)
        ? prev.selectedWeeks.filter((w) => w !== week)
        : [...prev.selectedWeeks, week].sort((a, b) => a - b),
    }));
  };

  const handleNumQuestionsChange = (value: number) => {
    setQuizState((prev) => ({
      ...prev,
      numQuestions: Math.max(0, value),
    }));
  };

  const handleDurationChange = (
    field: "hours" | "minutes" | "seconds",
    value: number
  ) => {
    const maxValue = field === "hours" ? 23 : 59;
    const sanitizedValue = Math.max(0, Math.min(value, maxValue));

    setQuizState((prev) => ({
      ...prev,
      duration: {
        ...prev.duration,
        [field]: sanitizedValue,
      },
    }));
  };

  return (
    <div className="relative p-6 max-w-2xl mx-auto shadow-lg bg-[#C2E6EC] dark:bg-[#0C1222]">
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} className="text-black dark:text-[#D5D5D5]" />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black dark:text-[#D5D5D5]">
            {courseName}
          </h2>
          <h3 className="text-lg font-semibold text-black dark:text-[#D5D5D5]">
            {courseCode}
          </h3>
        </div>
        <button type="button" onClick={handleStartQuiz} className="relative group">
          <div className="absolute inset-0 bg-[#0A0F1C] dark:bg-[#3BF4C7]" />
          <div className="absolute inset-0 blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
          <span
            className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7]
                        dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold
                        group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150 block"
          >
            Start Quiz
          </span>
        </button>
      </div>

      <div className="flex space-x-4 mb-6">
        <div className="w-1/2 flex flex-col justify-between" ref={dropdownRef}>
          <div className="flex items-center mb-2">
            <span id="quiz-weeks-label" className="text-sm font-medium text-black dark:text-[#D5D5D5]">
              Select Weeks
            </span>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-labelledby="quiz-weeks-label"
              aria-expanded={showDropdown}
              className={`p-3 w-full border text-left flex justify-between items-center bg-white dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
                validation.weeks.isValid ? "border-gray-300" : "border-red-500"
              }`}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <p className="text-sm sm:text-base">
                {quizState.selectedWeeks.length === 0
                  ? "Select Weeks"
                  : quizState.selectedWeeks.join(", ")}
              </p>
              <Check
                className="mr-2 text-black dark:text-[#D5D5D5]"
                size={20}
              />
            </button>
            {showDropdown && (
              <div className="absolute z-10 w-full bg-white dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] border mt-1 shadow-lg overflow-y-auto max-h-64">
                <button
                  type="button"
                  onClick={toggleAllWeeks}
                  className="flex w-full cursor-pointer items-center p-2 text-left hover:bg-black/20 dark:hover:bg-white/20 border-b"
                >
                  <input
                    type="checkbox"
                    checked={quizState.selectedWeeks.length === TOTAL_WEEKS}
                    readOnly
                    aria-label="All weeks"
                    className="mr-2"
                  />
                  <span>All Weeks</span>
                </button>
                {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(
                  (week) => (
                    <button
                      type="button"
                      key={week}
                      onClick={() => toggleWeek(week)}
                      className="flex w-full cursor-pointer items-center p-2 text-left hover:bg-black/20 dark:hover:bg-white/20"
                    >
                        <input
                          type="checkbox"
                          checked={quizState.selectedWeeks.includes(week)}
                          readOnly
                          aria-label={`Week ${week}`}
                          className="mr-2"
                      />
                      <span>Week {week}</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
          {!validation.weeks.isValid && (
            <p className="text-red-500 text-xs">{validation.weeks.message}</p>
          )}
        </div>

        <div className="w-1/2">
          <div className="flex items-center mb-2">
            <label htmlFor="quiz-num-questions" className="text-sm font-medium text-black dark:text-[#D5D5D5]">
              Number of Questions
            </label>
          </div>
          <input
            id="quiz-num-questions"
            type="number"
            min="0"
            value={quizState.numQuestions || ""}
            onChange={(e) => handleNumQuestionsChange(Number(e.target.value))}
            placeholder="Enter number"
            className={`text-sm sm:text-base w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] placeholder:text-[#D5D5D5] ${
              validation.questions.isValid ? "border-gray-300" : "border-red-500"
            }`}
            style={{ height: "3rem" }}
          />
          {!validation.questions.isValid && (
            <p className="text-red-500 text-xs">{validation.questions.message}</p>
          )}
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <div className="w-1/3">
          <label htmlFor="quiz-duration-hours" className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Hours
          </label>
          <input
            id="quiz-duration-hours"
            type="number"
            value={quizState.duration.hours}
            onChange={(e) =>
              handleDurationChange("hours", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            }`}
            style={{ height: "3rem" }}
          />
        </div>
        <div className="w-1/3">
          <label htmlFor="quiz-duration-minutes" className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Minutes
          </label>
          <input
            id="quiz-duration-minutes"
            type="number"
            value={quizState.duration.minutes}
            onChange={(e) =>
              handleDurationChange("minutes", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            }`}
            style={{ height: "3rem" }}
          />
        </div>
        <div className="w-1/3">
          <label htmlFor="quiz-duration-seconds" className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Seconds
          </label>
          <input
            id="quiz-duration-seconds"
            type="number"
            value={quizState.duration.seconds}
            onChange={(e) =>
              handleDurationChange("seconds", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            }`}
            style={{ height: "3rem" }}
          />
        </div>
      </div>
      {!validation.duration.isValid && (
        <p className="text-red-500 text-xs">{validation.duration.message}</p>
      )}
    </div>
  );
};
