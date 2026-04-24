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
        <Link href={`/past_papers/${encodeURIComponent(course.code)}`}>
            <div className="flex h-full w-full flex-col justify-start border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:border-b-2 hover:border-b-[#ffffff] dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10 dark:lg:bg-[#0C1222]">
                <h4>{course.title}</h4>
                <h6>{course.code}</h6>
            </div>
        </Link>
    );
}

export default CourseCard;
