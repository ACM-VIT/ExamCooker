import React from "react";
import UploadFile from "@/app/components/UploadFile";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { getCourseSearchRecords } from "@/lib/data/courseCatalog";

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
