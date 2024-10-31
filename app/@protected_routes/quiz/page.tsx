"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import QuizModalContent from "@/app/components/QuizModalComponent";
import QuizCard from "@/app/components/QuizCard";
import { useCourses, CoursesProvider } from "../../components/CoursesContext";
import UnderConstructionModal from "@/app/components/UnderConstructionModal";

interface Course {
  courseCode: string;
  courseName: string;
  questionCount: number;
  weeks: number[];
}

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

const QuizPage: React.FC = () => {
  const { courses, isLoading, error } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isUnderConstructionModalOpen, setIsUnderConstructionModalOpen] = useState(false);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const coursesPerPage = 6; 

  const handleCardClick = (course: Course) => {
    if (course.questionCount > 0) {
      setSelectedCourse(course);
      setIsQuizModalOpen(true);
    } else {
      setSelectedCourse(course);
      setIsUnderConstructionModalOpen(true);
    }
  };

  const handleCloseQuizModal = () => {
    setIsQuizModalOpen(false);
    setSelectedCourse(null);
  };

  const handleCloseUnderConstructionModal = () => {
    setIsUnderConstructionModalOpen(false);
    setSelectedCourse(null);
  };

  const filteredCourses = courses.filter(
    (course) =>
      course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.courseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const indexOfLastCourse = currentPage * coursesPerPage;
  const indexOfFirstCourse = indexOfLastCourse - coursesPerPage;
  const currentCourses = filteredCourses.slice(indexOfFirstCourse, indexOfLastCourse);
  const totalPages = Math.ceil(filteredCourses.length / coursesPerPage);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Content */}
      <div className="flex-grow">
        <div className="h-[80vh] w-full flex flex-col items-center justify-start py-8">
          <h1 className="mb-12 text-black dark:text-[#D5D5D5] text-4xl font-bold">NPTEL QUIZ</h1>

          {/* Search Input */}
          <div className="mb-6 w-full max-w-4xl px-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search courses..."
              className="w-full p-3 border rounded-lg dark:bg-[#3D414E] dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Courses Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center mt-6">
              <div className="animate-spin h-16 w-16 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center mt-6">
              <p className="text-red-500">{error}</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex items-center justify-center mt-6">
              <p className="text-gray-700 dark:text-gray-300">No courses found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl px-4">
              {currentCourses.map((course) => (
                <QuizCard
                  key={course.courseCode}
                  courseCode={course.courseCode}
                  courseName={course.courseName}
                  availableQuestions={course.questionCount}
                  onClick={() => handleCardClick(course)}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-6">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 bg-blue-500 text-white rounded ${
                  currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
                }`}
              >
                Previous
              </button>
              <span className="text-lg text-black dark:text-white">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 bg-blue-500 text-white rounded ${
                  currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
                }`}
              >
                Next
              </button>
            </div>
          )}

          {/* Loading and Error States */}
          {isLoading && (
            <div className="flex items-center justify-center mt-6">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center mt-6">
              <p className="text-red-500">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quiz Modal */}
      {selectedCourse && isQuizModalOpen && (
        <Modal isOpen={isQuizModalOpen} onClose={handleCloseQuizModal}>
          <QuizModalContent
            courseCode={selectedCourse.courseCode}
            courseName={selectedCourse.courseName}
            weeks={selectedCourse.weeks}
            availableQuestions={selectedCourse.questionCount}
            onClose={handleCloseQuizModal}
          />
        </Modal>
      )}

      {/* Under Construction Modal */}
      {selectedCourse && selectedCourse.questionCount === 0 && isUnderConstructionModalOpen && (
        <Modal isOpen={isUnderConstructionModalOpen} onClose={handleCloseUnderConstructionModal}>
          <UnderConstructionModal
            courseName={selectedCourse.courseName}
            onClose={handleCloseUnderConstructionModal}
          />
        </Modal>
      )}
    </div>
  );
};

export default function WrappedQuizPage() {
  return (
    <CoursesProvider>
      <QuizPage />
    </CoursesProvider>
  );
}
