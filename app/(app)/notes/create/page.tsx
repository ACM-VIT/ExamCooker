import React from "react";
import UploadFile from "@/app/components/upload-file";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCourseSearchRecords } from "@/lib/data/course-catalog";

async function NewNotePage() {
    const courses = await getCourseSearchRecords();
    return (
        <DirectionalTransition>
            <div className="create-notes">
                <UploadFile variant="Notes" courses={courses} />
            </div>
        </DirectionalTransition>
    );
}

export default NewNotePage;
