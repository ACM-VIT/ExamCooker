import React, { createContext, useContext, useState, useEffect } from "react";

interface Course {
  courseCode: string;
  courseName: string;
  questionCount: number;
  weeks: number[];
}

interface CoursesContextProps {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
}

const CoursesContext = createContext<CoursesContextProps>({
  courses: [],
  isLoading: false,
  error: null,
});

export const useCourses = () => useContext(CoursesContext);

export const CoursesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`);
        if (!response.ok) {
          throw new Error(`Error fetching courses: ${response.statusText}`);
        }
        
        const data = await response.json();

        // Map backend snake_case properties to frontend camelCase
        const formattedCourses: Course[] = data.courses.map((course: any) => ({
          courseCode: course.course_code,
          courseName: course.course_name,
          questionCount: course.question_count,
          weeks: course.weeks ? course.weeks.sort((a: number, b: number) => a - b) : [],
        }));

        setCourses(formattedCourses);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  return (
    <CoursesContext.Provider value={{ courses, isLoading, error }}>
      {children}
    </CoursesContext.Provider>
  );
};
