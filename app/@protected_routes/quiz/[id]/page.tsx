"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Trophy,
  Target,
  Flag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { WildlifeJSON } from "@/public/assets/quizJSON";
import { ForestJSON } from "@/public/assets/forestJSON";


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
}

interface Week {
  name: string;
  questions?: Question[];
  content?: Question[];
}

interface CourseJSON {
  code: string;
  weeks: Week[];
}

const courseJSONs: { [key: string]: CourseJSON } = {
  "102104073": WildlifeJSON,
  "BCSE102L": ForestJSON,
  "BCSE103L": AnotherSubjectJSON,
  "BCSE104L": EthicalHackingJSON,
};

export default function Component() {
  const pathname = usePathname();
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

  useEffect(() => {
    const params = new URLSearchParams(pathname.split("quiz/")[1]);
    const weeks = params.get("weeks")?.split("-") || [];
    const numQuestions = parseInt(params.get("numQ") || "0");
    const time = params.get("time") || "000000";
    const courseCode = params.get("courseCode") || "";

    const hours = parseInt(time.slice(0, 2));
    const minutes = parseInt(time.slice(2, 4));
    const seconds = parseInt(time.slice(4, 6));
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    setTimeRemaining(totalSeconds);

    const courseJSON = courseJSONs[courseCode];
    if (!courseJSON) {
      console.error(`No JSON found for course code: ${courseCode}`);
      return;
    }

    const allQuestions: QuizQuestion[] = weeks.flatMap((week) => {
      const weekData = courseJSON.weeks.find((w) => w.name === week) as Week | undefined;

      if (!weekData) return [];

      const questionsArray = weekData.questions || weekData.content || [];

      return questionsArray.map((q) => ({
        ...q,
        weekNumber: week,
        isExpanded: false,
      }));
    });

    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
    setQuestions(shuffledQuestions.slice(0, numQuestions));
  }, [pathname]);

  // ... (rest of the component code remains unchanged)

  return (
    // ... (the JSX remains unchanged)
  );
}