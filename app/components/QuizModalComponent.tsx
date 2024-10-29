"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, AlertCircle, Check, Clock, List, HelpCircle } from "lucide-react";

interface QuizModalContentProps {
  courseCode: string;
  onClose: () => void;
}

interface QuizState {
  selectedWeeks: string[];
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

const STORAGE_KEY = "quizSettings";

const QuizModalContent: React.FC<QuizModalContentProps> = ({
  courseCode,
  onClose,
}) => {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const [quizState, setQuizState] = useState<QuizState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          parsed &&
          Array.isArray(parsed.selectedWeeks) &&
          typeof parsed.numQuestions === "number" &&
          typeof parsed.duration === "object"
        ) {
          return parsed;
        }
      }
    }
    return {
      selectedWeeks: [],
      numQuestions: null,
      duration: { hours: 0, minutes: 0, seconds: 0 },
    };
  });

  // Validation state
  const [validation, setValidation] = useState<ValidationState>({
    weeks: { isValid: true, message: "" },
    questions: { isValid: true, message: "" },
    duration: { isValid: true, message: "" },
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizState));
  }, [quizState]);

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
    } else if (
      quizState.numQuestions !== null &&
      totalSeconds < quizState.numQuestions * 30
    ) {
      newValidation.duration = {
        isValid: false,
        message: "Duration too short for number of questions",
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
      const formattedWeeks = quizState.selectedWeeks
        .map((week) => week.split(" ")[1])
        .join("-");
      const formattedDuration = formatDuration(quizState.duration).replace(
        /:/g,
        ""
      );
      router.push(
        `/quiz/weeks=${formattedWeeks}&numQ=${quizState.numQuestions}&time=${formattedDuration}`
      );
    }
  };

  const toggleSlot = (slot: string) => {
    setQuizState((prev) => ({
      ...prev,
      selectedWeeks: prev.selectedWeeks.includes(slot)
        ? prev.selectedWeeks.filter((s) => s !== slot)
        : [...prev.selectedWeeks, slot].sort(),
    }));
  };

  const handleNumQuestionsChange = (value: number) => {
    setQuizState((prev) => ({
      ...prev,
      numQuestions: value,
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
    <div className="relative p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{courseCode}</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <List className="mr-2" size={20} />
          <label className="text-sm font-medium">Select Weeks</label>
        </div>
        <div className="relative">
          <button
            className={`p-3 w-full border rounded-lg text-left flex justify-between items-center ${
              validation.weeks.isValid ? "border-gray-300" : "border-red-500"
            }`}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span>
              {quizState.selectedWeeks.length === 0
                ? "Select Weeks"
                : quizState.selectedWeeks.join(", ")}
            </span>
            <HelpCircle size={20} className="text-gray-400" />
          </button>
          {showDropdown && (
            <div className="absolute z-10 w-full bg-white border mt-1 rounded-lg shadow-lg overflow-y-auto max-h-48">
              {[
                "Week 1",
                "Week 2",
                "Week 3",
                "Week 4",
                "Week 5",
                "Week 6",
                "Week 7",
                "Week 8",
                "Week 9",
                "Week 10",
                "Week 11",
                "Week 12",
              ].map((slot) => (
                <div
                  key={slot}
                  className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleSlot(slot)}
                >
                  <input
                    type="checkbox"
                    checked={quizState.selectedWeeks.includes(slot)}
                    onChange={() => {}}
                    className="mr-3"
                  />
                  <span>{slot}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {validation.weeks.message && (
          <div className="mt-1 text-sm flex items-center gap-1">
            {validation.weeks.isValid ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-red-500" />
            )}
            <span
              className={
                validation.weeks.isValid ? "text-green-600" : "text-red-500"
              }
            >
              {validation.weeks.message}
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <HelpCircle className="mr-2" size={20} />
          <label className="text-sm font-medium">Number of Questions</label>
        </div>
        <input
          type="number"
          min="1"
          max={quizState.selectedWeeks.length * 10}
          value={quizState.numQuestions || ""}
          onChange={(e) => handleNumQuestionsChange(Number(e.target.value))}
          className={`p-3 w-full border rounded-lg ${
            validation.questions.isValid ? "border-gray-300" : "border-red-500"
          }`}
          placeholder="Enter number of questions"
        />
        {validation.questions.message && (
          <div className="mt-1 text-sm flex items-center gap-1">
            {validation.questions.isValid ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-red-500" />
            )}
            <span
              className={
                validation.questions.isValid ? "text-green-600" : "text-red-500"
              }
            >
              {validation.questions.message}
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <Clock className="mr-2" size={20} />
          <label className="text-sm font-medium">Duration</label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Hours", field: "hours" as const, max: 23 },
            { label: "Minutes", field: "minutes" as const, max: 59 },
            { label: "Seconds", field: "seconds" as const, max: 59 },
          ].map((item) => (
            <div key={item.field}>
              <input
                type="number"
                min="0"
                max={item.max}
                value={quizState.duration[item.field]}
                onChange={(e) =>
                  handleDurationChange(item.field, Number(e.target.value))
                }
                className={`p-3 w-full border rounded-lg ${
                  validation.duration.isValid
                    ? "border-gray-300"
                    : "border-red-500"
                }`}
                placeholder={item.label}
              />
            </div>
          ))}
        </div>
        {validation.duration.message && (
          <div className="mt-1 text-sm flex items-center gap-1">
            {validation.duration.isValid ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-red-500" />
            )}
            <span
              className={
                validation.duration.isValid ? "text-green-600" : "text-red-500"
              }
            >
              {validation.duration.message}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={handleStartQuiz}
        disabled={
          !quizState.selectedWeeks.length ||
          !quizState.numQuestions ||
          getTotalSeconds() === 0
        }
        className="w-full bg-emerald-500 text-white p-3 rounded-lg hover:bg-emerald-600 
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
                   disabled:hover:bg-emerald-500 font-medium"
      >
        Start Quiz
      </button>
    </div>
  );
};

export default QuizModalContent;
