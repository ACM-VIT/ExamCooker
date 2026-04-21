import React from "react";
import UploadFile from "@/app/components/UploadFile";
import prisma from "@/lib/prisma";

async function NewForumPage() {
    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-notes">
            <UploadFile allTags={allTags.map((i: { name: string }) => i.name)} variant="Notes"/>
        </div>
    );
}

export default NewForumPage;
