import React from "react";
import UploadFile from "@/app/components/UploadFile";
import { PrismaClient } from "@/src/generated/prisma";

async function NewForumPage() {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-notes">
            <UploadFile allTags={allTags.map((i: { name: string }) => i.name)} variant="Notes"/>
        </div>
    );
}

export default NewForumPage;
