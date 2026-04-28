import React from "react";
import CreateForum from "@/app/components/create-forum";
import { db, tag } from "@/src/db";

async function NewForumPage () {
    const allTags = await db.select({ name: tag.name }).from(tag).orderBy(tag.name);
    return (
        <div className="create-foum">
            <CreateForum allTags={allTags.map((row) => row.name)}/>
        </div>
    );
}

export default NewForumPage;
