import React from "react";
import type { Metadata } from "next";
import UploadFile from "@/app/components/upload-file";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCoursePickerRecords } from "@/lib/data/course-catalog";
import { enforceAnonymousCreateRateLimit } from "@/lib/enforce-anonymous-create-rate-limit";

export const metadata: Metadata = {
    title: "Upload notes",
    alternates: { canonical: "/notes/create" },
    robots: { index: false, follow: true },
};

async function NewNotePage() {
    await enforceAnonymousCreateRateLimit();
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
