import React from "react";
import UploadFile from "@/app/components/UploadFile";
import { PrismaClient } from "@prisma/client";

async function NewForumPage() {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-notes">
            <UploadFile allTags={allTags.map(i => i.name)} variant="Notes"/>
        </div>
    );
}

export default NewForumPage;
