import React from "react";
import Link from "next/link";

interface CourseCardProps {
    course: {
        code: string;
        title: string;
    };
}

function CourseCard({ course }: CourseCardProps) {
    return (
        <Link href={`/courses/${encodeURIComponent(course.code)}`}>
            <div className="flex flex-col justify-start w-full h-full p-4 bg-[#5FC4E7] border-2 border-[#5FC4E7] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 hover:border-b-2 hover:border-b-[#ffffff] dark:hover:border-b-[#3BF4C7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:bg-[#ffffff]/10 transition-all duration-200 transform hover:scale-105 hover:shadow-lg">
                <h4>{course.title}</h4>
                <h6>{course.code}</h6>
            </div>
        </Link>
    );
}

export default CourseCard;
