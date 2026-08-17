import React from "react";
import type { Metadata } from "next";
import UploadFile from "@/app/components/upload-file-with-progress";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCoursePickerRecords } from "@/lib/data/course-catalog";

export const metadata: Metadata = {
    title: "Upload notes",
    alternates: { canonical: "/notes/create" },
    robots: { index: false, follow: true },
};

async function NewNotePage() {
    const courses = await getCoursePickerRecords();
    return (
        <DirectionalTransition>
            <div className="create-notes">
                <UploadFile variant="Notes" courses={courses} />
            </div>
        </DirectionalTransition>
    );
}

export default NewNotePage;
