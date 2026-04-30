import React from "react";
import UploadFile from "@/app/components/upload-file";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCourseSearchRecords } from "@/lib/data/course-catalog";

async function UploadPaperPage() {
    const courses = await getCourseSearchRecords();
    return (
        <DirectionalTransition>
            <div className="create-papers">
                <UploadFile variant="Past Papers" courses={courses} />
            </div>
        </DirectionalTransition>
    );
}

export default UploadPaperPage;
