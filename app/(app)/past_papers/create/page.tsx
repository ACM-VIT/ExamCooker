import React from "react";
import UploadFile from "@/app/components/UploadFile";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { getCourseSearchRecords } from "@/lib/data/courseCatalog";

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
