import React from "react";
import type { Metadata } from "next";
import UploadFile from "@/app/components/upload-file-with-classifier";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCoursePickerRecords } from "@/lib/data/course-catalog";

export const metadata: Metadata = {
    title: "Upload past paper",
    alternates: { canonical: "/past_papers/create" },
    robots: { index: false, follow: true },
};

async function UploadPaperPage() {
    const courses = await getCoursePickerRecords();
    return (
        <DirectionalTransition>
            <div className="create-papers">
                <UploadFile courses={courses} />
            </div>
        </DirectionalTransition>
    );
}

export default UploadPaperPage;
