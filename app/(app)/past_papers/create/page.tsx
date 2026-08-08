import React from "react";
import type { Metadata } from "next";
import UploadFile from "@/app/components/upload-file";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCoursePickerRecords } from "@/lib/data/course-catalog";
import { enforceAnonymousCreateRateLimit } from "@/lib/enforce-anonymous-create-rate-limit";

export const metadata: Metadata = {
    title: "Upload past paper",
    alternates: { canonical: "/past_papers/create" },
    robots: { index: false, follow: true },
};

async function UploadPaperPage() {
    await enforceAnonymousCreateRateLimit();
    const courses = await getCoursePickerRecords();
    return (
        <DirectionalTransition>
            <div className="create-papers">
                <UploadFile variant="Past Papers" courses={courses} />
            </div>
        </DirectionalTransition>
    );
}

export default UploadPaperPage;
