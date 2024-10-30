"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
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
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer 
                 hover:shadow-lg transition-shadow duration-200"
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
        <div className="bg-[#5FC4E7] dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl relative">
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
    { courseCode: "BCSE101L", courseName: "Wildlife Ecology" },
    { courseCode: "BCSE102L", courseName: "Forest and Management" },
    { courseCode: "BCSE103L", courseName: "Suppu FTW" },
    { courseCode: "BCSE104L", courseName: "Ethical Hacking" },
  ];

  return (
    <div className="h-[80vh] w-full flex flex-col items-center py-8 ">
      <p className="text-6xl font-bold mb-12 dark:text-white">NPTEL QUIZ</p>

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
          courseName={selectedCourse?.courseName}
          onClose={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default QuizPage;
