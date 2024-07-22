import React from "react";
import UploadFilePaper from "@/app/components/UploadPapers";
import { PrismaClient } from "@prisma/client";


async function UploadPaperPage() {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-papers">
            <UploadFilePaper allTags={allTags.map(i => i.name)}/>
        </div>
    );
};

export default UploadPaperPage;
