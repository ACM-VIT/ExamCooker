import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

interface QuizModalContentProps {
  courseCode: string;
  courseName: string;
  weeks: number[];
  availableQuestions: number;
  onClose: () => void;
}

const QuizModalContent: React.FC<QuizModalContentProps> = ({
  courseCode,
  courseName,
  weeks,
  availableQuestions,
  onClose,
}) => {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [quizState, setQuizState] = useState({
    selectedWeeks: [] as number[],
    numQuestions: 1, 
    duration: {
      hours: 0,
      minutes: 30, 
      seconds: 0,
    },
  });

  const [validation, setValidation] = useState({
    weeks: { isValid: true, message: "" },
    questions: { isValid: true, message: "" },
    duration: { isValid: true, message: "" },
  });

  const maxQuestions = useMemo(() => {
    return Math.min(quizState.selectedWeeks.length * 10, availableQuestions);
  }, [quizState.selectedWeeks.length, availableQuestions]);

  useEffect(() => {
    validateInputs();
  }, [quizState.selectedWeeks, quizState.numQuestions, quizState.duration]);

  useEffect(() => {
    localStorage.setItem("quizSettings", JSON.stringify(quizState));
  }, [quizState]);

  useEffect(() => {
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

  const formatDuration = (duration: {
    hours: number;
    minutes: number;
    seconds: number;
  }) => {
    return `${String(duration.hours).padStart(2, "0")}:${String(
      duration.minutes
    ).padStart(2, "0")}:${String(duration.seconds).padStart(2, "0")}`;
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
        message: `${quizState.selectedWeeks.length} week(s) selected`,
      };
    }

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
        message: `${quizState.numQuestions} question(s) selected`,
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
      quizState.numQuestions &&
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

  const handleStartQuiz = () => {
    if (validateInputs()) {
      const formattedWeeks = quizState.selectedWeeks.join("-");
      const formattedDuration = formatDuration(quizState.duration).replace(
        /:/g,
        ""
      ); 
      router.push(
        `/quiz/${courseCode}?weeks=${formattedWeeks}&numQ=${quizState.numQuestions}&time=${formattedDuration}`
      );
      onClose();
    }
  };

  const toggleWeek = (week: number) => {
    setQuizState((prev) => {
      const isSelected = prev.selectedWeeks.includes(week);
      const newSelectedWeeks = isSelected
        ? prev.selectedWeeks.filter((w) => w !== week)
        : [...prev.selectedWeeks, week].sort((a, b) => a - b);

      const newMaxQuestions = Math.min(
        newSelectedWeeks.length * 10,
        availableQuestions
      );
      const newNumQuestions =
        prev.numQuestions > newMaxQuestions
          ? newMaxQuestions
          : prev.numQuestions;

      return {
        ...prev,
        selectedWeeks: newSelectedWeeks,
        numQuestions: newNumQuestions,
      };
    });
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
    <div className="relative overflow-hidden p-6 bg-[#C2E6EC] dark:bg-[#0C1222] rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 transition-colors rounded"
        >
          <ArrowLeft size={24} className="text-black dark:text-[#D5D5D5]" />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black dark:text-[#D5D5D5]">
            {courseName}
          </h2>
        </div>
        <button onClick={handleStartQuiz} className="relative group">
          <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
          <div className="absolute inset-0 blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
          <button
            type="button"
            title="Start Quiz"
            className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7]
                        dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold
                        group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150"
          >
            Start Quiz
          </button>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
        <div className="w-full sm:w-1/2 flex flex-col justify-between" ref={dropdownRef}>
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-black dark:text-[#D5D5D5]">
              Select Weeks
            </label>
          </div>
          <div className="relative">
            <button
              className={`p-3 w-full border text-left flex justify-between items-center bg-white dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
                validation.weeks.isValid ? "border-gray-300" : "border-red-500"
              } rounded whitespace-nowrap overflow-hidden`}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span>
                {quizState.selectedWeeks.length === 0
                  ? "Select Weeks"
                  : quizState.selectedWeeks.join(", ")}
              </span>
              <Check className="mr-2 text-black dark:text-[#D5D5D5]" size={20} />
            </button>
            {showDropdown && (
              <div className="absolute z-10 w-full bg-white dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] border rounded shadow-lg overflow-y-auto max-h-48 top-full left-0 mt-1">
                {weeks.map((week) => (
                  <div
                    key={week}
                    onClick={() => toggleWeek(week)}
                    className={`cursor-pointer p-2 hover:bg-black/20 dark:hover:bg-white/20 flex items-center ${
                      quizState.selectedWeeks.includes(week)
                        ? "bg-black/10 dark:bg-white/10"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={quizState.selectedWeeks.includes(week)}
                      readOnly
                      className="mr-2"
                    />
                    <span>Week {week}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!validation.weeks.isValid && (
            <p className="text-red-500 text-xs mt-1">{validation.weeks.message}</p>
          )}
        </div>

        <div className="w-full sm:w-1/2">
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-black dark:text-[#D5D5D5]">
              Number of Questions ({maxQuestions} available)
            </label>
          </div>
          <input
            type="number"
            value={quizState.numQuestions || ""}
            onChange={(e) => handleNumQuestionsChange(Number(e.target.value))}
            placeholder={
              quizState.selectedWeeks.length > 0
                ? `Enter number (max ${maxQuestions})`
                : "Select weeks first"
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.questions.isValid
                ? "border-gray-300"
                : "border-red-500 placeholder-red-500"
            } rounded`}
            style={{ height: "3rem" }}
            min={1}
            max={maxQuestions}
            disabled={quizState.selectedWeeks.length === 0}
          />
          {!validation.questions.isValid && (
            <p className="text-red-500 text-xs mt-1">
              {validation.questions.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
        <div className="w-full sm:w-1/3">
          <label className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Hours
          </label>
          <input
            type="number"
            value={quizState.duration.hours}
            onChange={(e) =>
              handleDurationChange("hours", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            } rounded`}
            style={{ height: "3rem" }}
            min={0}
            max={23}
          />
        </div>
        <div className="w-full sm:w-1/3">
          <label className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Minutes
          </label>
          <input
            type="number"
            value={quizState.duration.minutes}
            onChange={(e) =>
              handleDurationChange("minutes", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            } rounded`}
            style={{ height: "3rem" }}
            min={0}
            max={59}
          />
        </div>
        <div className="w-full sm:w-1/3">
          <label className="text-sm font-medium text-black dark:text-[#D5D5D5]">
            Seconds
          </label>
          <input
            type="number"
            value={quizState.duration.seconds}
            onChange={(e) =>
              handleDurationChange("seconds", Number(e.target.value))
            }
            className={`w-full p-2 border dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] ${
              validation.duration.isValid ? "border-gray-300" : "border-red-500"
            } rounded`}
            style={{ height: "3rem" }}
            min={0}
            max={59}
          />
        </div>
      </div>
      {!validation.duration.isValid && (
        <p className="text-red-500 text-xs mt-1">
          {validation.duration.message}
        </p>
      )}

      <div className="mt-8 flex justify-end">
      </div>
    </div>
  );
};

export default QuizModalContent;
