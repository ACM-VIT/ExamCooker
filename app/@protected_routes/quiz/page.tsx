"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import QuizModalContent from "@/app/components/QuizModalComponent";
import QuizCard from "@/app/components/QuizCard";
import { useCourses, CoursesProvider } from "../../components/CoursesContext";
import UnderConstructionModal from "@/app/components/UnderConstructionModal";
import Image from "next/image";
import debounce from "lodash/debounce";
import SearchIcon from "@/app/components/assets/seacrh.svg";

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

  const debouncedSetSearchQuery = React.useMemo(
    () => debounce((query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchQuery(e.target.value);
  };

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

  const maxVisiblePages = 5;

  const getPageNumbers = () => {
    const pageNumbers = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return { pageNumbers, startPage, endPage };
  };

  const { pageNumbers, startPage, endPage } = getPageNumbers();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col items-center justify-start flex-grow py-8 px-4">
        <h1 className="mb-12 text-black dark:text-[#D5D5D5] text-4xl font-bold">NPTEL QUIZ</h1>

        {/* Search Input */}
        <form className="relative flex items-center w-full max-w-4xl mb-6">
          <div className="relative flex items-center bg-white dark:bg-[#3D414E] border border-black dark:border-[#D5D5D5] w-full px-4 py-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
            <Image src={SearchIcon} alt="search" className="dark:invert" />
            <input
              type="text"
              className="ml-3 flex-grow bg-transparent focus:outline-none dark:text-[#D5D5D5]"
              placeholder="Search for quizzes..."
              onChange={handleSearchChange}
            />
          </div>
        </form>

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

        {totalPages > 1 && (
          <div className="mt-auto w-full max-w-4xl flex justify-center items-center space-x-2 py-4">
            {currentPage > 1 && (
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-3 py-1.5 text-sm font-medium bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90] text-white rounded"
              >
                &lt;
              </button>
            )}

            {startPage > 1 && (
              <>
                <button
                  onClick={() => handlePageChange(1)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    1 === currentPage
                      ? "bg-[#73E8CC] dark:bg-[#232530] text-white"
                      : "bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90] text-white"
                  }`}
                >
                  1
                </button>
                {startPage > 2 && <span className="text-gray-500">...</span>}
              </>
            )}

            {pageNumbers.map((number) => (
              <button
                key={number}
                onClick={() => handlePageChange(number)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  number === currentPage
                    ? "bg-[#73E8CC] dark:bg-[#232530] text-white"
                    : "bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90] text-white"
                }`}
              >
                {number}
              </button>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <span className="text-gray-500">...</span>}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    totalPages === currentPage
                      ? "bg-[#73E8CC] dark:bg-[#232530] text-white"
                      : "bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90] text-white"
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            {currentPage < totalPages && (
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-1.5 text-sm font-medium bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90] text-white rounded"
              >
                &gt;
              </button>
            )}
          </div>
        )}
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
