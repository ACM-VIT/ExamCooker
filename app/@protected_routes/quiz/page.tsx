"use client";

import React, { useState } from "react";
// import { X } from "lucide-react";
import QuizModalContent from "@/app/components/QuizModalComponent";

interface Course {
  courseCode: string;
  courseName: string;
}

interface QuizCardProps {
  courseCode: string;
  courseName: string;
  onClick: () => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  courseCode,
  courseName,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="hover:shadow-xl px-5 py-6 w-full bg-[#5FC4E7] dark:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] dark:border-b-[#3BF4C7]
            dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 border-2 border-[#5FC4E7] hover:border-b-[#ffffff] hover:border-b-2
            dark:hover:border-b-[#3BF4C7]  dark:hover:bg-[#ffffff]/10 transition duration-200 transform hover:scale-105 max-w-96 cursor-pointer"
    >
      <h3 className="text-xl font-semibold mb-2 dark:text-white">
        {courseName}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">{courseCode}</p>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl relative border-2 border-[#D5D5D5] border-dashed">
          {children}
        </div>
      </div>
    </div>
  );
};

interface QuizModalContentProps {
  courseName: string;
  onClose: () => void;
}

const QuizPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (course: Course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCourse(null);
  };

  const courses: Course[] = [
    { courseCode: "102104073", courseName: "Wildlife Ecology" },
    { courseCode: "102104082", courseName: "Forest and Management" },
    { courseCode: "109106067", courseName: "Spoken English" },
    { courseCode: "102104086", courseName: "Conservation Economics" },
  ];

  return (
    <div className="h-[80vh] w-full flex flex-col items-center justify-start py-8 ">
      <h1 className="mb-12 text-black dark:text-[#D5D5D5]">NPTEL QUIZ</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl px-4">
        {courses.map((course) => (
          <QuizCard
            key={course.courseCode}
            courseCode={course.courseCode}
            courseName={course.courseName}
            onClick={() => handleCardClick(course)}
          />
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <QuizModalContent
          courseCode={selectedCourse?.courseCode || ""}
          courseName={selectedCourse?.courseName || ""}
          onClose={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default QuizPage;