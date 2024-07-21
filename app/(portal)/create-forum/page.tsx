import React from "react";
import CreateForum from "@/app/components/create-forum";
import { PrismaClient } from "@prisma/client";

async function NewForumPage () {
    const prisma = new PrismaClient();

    const allTags = await prisma.tag.findMany();
    return (
        <div className="create-foum">
            <CreateForum allTags={allTags.map(i=>i.name)}/>
        </div>
    );
};

export default NewForumPage;
