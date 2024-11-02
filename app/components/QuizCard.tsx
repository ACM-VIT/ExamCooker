import React from "react";

interface QuizCardProps {
  courseName: string;
  availableQuestions: number;
  isFeatured?: boolean; 
  onClick: () => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  courseName,
  availableQuestions,
  isFeatured = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`border-2 
        ${
          // isFeatured ? "border-red-500 dark:border-red-500" : 
          "border-[#5FC4E7] dark:border-[#ffffff]/20 hover:border-b-[#ffffff] dark:hover:border-b-[#3BF4C7]"
        } 
      hover:shadow-xl px-5 py-6 w-full bg-[#5FC4E7] dark:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] transition duration-200 transform hover:scale-105 max-w-96 cursor-pointer flex flex-col justify-between relative`}
    >
      <h3 className="text-xl font-semibold mb-4 dark:text-white">{courseName}</h3>
      
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm dark:text-[#D5D5D5]">
            {availableQuestions} Question{availableQuestions !== 1 ? "s" : ""}
          </span>
        </div>

        {/* 
        {isFeatured && (
          <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded">
            Featured
          </span>
        )} 
        */}
      </div>
    </div>
  );
};

export default QuizCard;
