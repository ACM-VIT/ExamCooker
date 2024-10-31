import React from "react";

interface QuizCardProps {
  courseCode: string;
  courseName: string;
  availableQuestions: number;
  onClick: () => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  courseCode,
  courseName,
  availableQuestions,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="hover:shadow-xl px-5 py-6 w-full bg-[#5FC4E7] dark:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] dark:border-b-[#3BF4C7]
            dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 border-2 border-[#5FC4E7] hover:border-b-[#ffffff] hover:border-b-2
            dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 transition duration-200 transform hover:scale-105 max-w-96 cursor-pointer"
    >
      <h3 className="text-xl font-semibold mb-2 dark:text-white">{courseName}</h3>
      <div className="flex justify-between items-center">
        <p className="text-gray-600 dark:text-gray-300">{courseCode}</p>
        <div className="flex items-center space-x-1">
          <span className="text-sm dark:text-[#D5D5D5]">
            {availableQuestions} Question{availableQuestions !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuizCard;
