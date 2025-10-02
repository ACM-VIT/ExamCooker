import React from "react";
import UploadFile from "@/app/components/UploadFile";
import { PrismaClient } from "@/src/generated/prisma";


async function UploadPaperPage() {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-papers">
            <UploadFile allTags={allTags.map((i: { name: string }) => i.name)} variant="Past Papers"/>
        </div>
    );
}

export default UploadPaperPage;
