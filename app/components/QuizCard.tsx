import React from "react";
import FavouriteIcon from "/public/FavouriteIcon.svg";
import Image from "next/image";
interface QuizCardProps {
  courseName: string;
  courseCode: string;
}

const QuizCard: React.FC<QuizCardProps> = ({ courseName, courseCode }) => {
  return (
    <div className="bg-[#5FC4E7] dark-[#0C1222] h-[10vh] w-[30vw] flex flex-col justify-center space-y-4 p-2 px-2">
      <div className="flex justify-start pl-4 text-black dark:text-white">
        {courseName}
      </div>
      <div className="flex flex-row justify-between">
        <div className="flex justify-start pl-4 text-black dark:text-white">
          {courseCode}
        </div>
        <div className="pr-4">
          <Image src={FavouriteIcon} alt="favicon" />
        </div>
      </div>
    </div>
  );
};

export default QuizCard;
