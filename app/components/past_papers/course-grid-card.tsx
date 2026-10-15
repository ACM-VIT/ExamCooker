import React from "react";
import IntentPrefetchLink from "@/app/components/common/intent-prefetch-link";

type Props = {
    course: {
        code: string;
        title: string;
        paperCount: number;
        noteCount: number;
    };
};

export default function CourseGridCard({ course }: Props) {
    return (
        <div className="group relative h-full">
            <IntentPrefetchLink
                href={`/past_papers/${encodeURIComponent(course.code)}`}
                transitionTypes={["nav-forward"]}
                className="ec-catalog-card"
            >
                <span className="ec-catalog-code">
                    {course.code}
                </span>
                <h3 className="ec-catalog-title">
                    {course.title}
                </h3>
                <div className="mt-auto flex items-end justify-between pt-1">
                    <div className="ec-catalog-stats">
                        <span className="ec-catalog-number">
                            {course.paperCount}
                        </span>
                        <span className="ec-catalog-unit">
                            paper{course.paperCount === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>
            </IntentPrefetchLink>
        </div>
    );
}
