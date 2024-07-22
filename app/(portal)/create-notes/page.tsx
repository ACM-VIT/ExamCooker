import React from "react";
import UploadFileNotes from "@/app/components/UploadNotes";
import { PrismaClient } from "@prisma/client";

async function NewForumPage() {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-notes">
            <UploadFileNotes allTags={allTags.map(i => i.name)}/>
        </div>
    );
};

export default NewForumPage;
