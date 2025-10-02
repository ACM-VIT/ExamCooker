"use server";

import {PrismaClient} from "@/src/generated/prisma";
import {auth} from "../auth";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";

const prisma = new PrismaClient();

async function findOrCreateTag(name: string) {
    let tag = await prisma.tag.findUnique({where: {name}});
    if (!tag) {
        tag = await prisma.tag.create({data: {name}});
    }
    return tag;
}

// async function preInsert({tags, year, slot, formDatas}: {
//     tags: string[],
//     year: string,
//     slot: string,
//     formDatas: FormData[],
// }) {
//     const session = await auth();
//     if (!session || !session.user) {
//         redirect("/landing");
//     }
//     const user = await prisma.user.findUnique({
//         where: {email: session.user.email!},
//     });
//
//     if (!user) {
//         throw new Error(
//             `User with ID ${session?.user?.email} does not exist`
//         );
//     }
//
//     const allTags = await Promise.all(tags.map(findOrCreateTag));
//
//     if (year) {
//         const yearTag = await findOrCreateTag(year);
//         allTags.push(yearTag);
//     }
//
//     if (slot) {
//         const slotTag = await findOrCreateTag(slot);
//         allTags.push(slotTag);
//     }
//     const promises = formDatas.map(async (formData) => {
//
//         const response = await fetch(`${process.env.NEXT_PUBLIC_MICROSERVICE_URL}/process_pdf`, {
//             method: "POST",
//             body: formData,
//         });
//
//         if (!response.ok) {
//             console.log(response);
//             throw new Error(`Failed to upload file ${formData.get("fileTitle")}`);
//         }
//
//         return await response.json();
//     });
//
//     const results = await Promise.all(promises) as {
//         fileUrl: string,
//         thumbnailUrl: string,
//         filename: string,
//         message: string
//     }[];
//
//
//     return {user, allTags, results};
// }

export default async function uploadFile({results, tags, year, slot, variant}: {
    results: {
        fileUrl: string,
        thumbnailUrl: string,
        filename: string,
        message: string
    }[],
    tags: string[],
    year: string,
    slot: string,
    variant: "Notes" | "Past Papers"
}) {

    // const {allTags, user, results} = await preInsert({tags, year, slot, formDatas});
    const session = await auth();
    if (!session || !session.user) {
        redirect("/landing");
    }
    const user = await prisma.user.findUnique({
        where: {email: session.user.email!},
    });

    if (!user) {
        throw new Error(
            `User with ID ${session?.user?.email} does not exist`
        );
    }

    const allTags = await Promise.all(tags.map(findOrCreateTag));

    if (year) {
        const yearTag = await findOrCreateTag(year);
        allTags.push(yearTag);
    }

    if (slot) {
        const slotTag = await findOrCreateTag(slot);
        allTags.push(slotTag);
    }

    const errors = results.filter(result => result.message !== "processed successfully");

    if (errors.length > 0) {
        return {
            success: false,
            error: errors.map(error => error.message).join(", ")
        };
    }

    const promises = variant === "Notes" ? results.map(result => {
        return prisma.note.create({
            data: {
                title: result.filename,
                fileUrl: result.fileUrl,
                thumbNailUrl: result.thumbnailUrl,
                authorId: user.id,
                tags: {
                    connect: allTags.map((tag) => ({id: tag.id})),
                },
            },
            include: {
                tags: true,
            },
        });
    }) : results.map(result => {
        return prisma.pastPaper.create({
            data: {
                title: result.filename,
                fileUrl: result.fileUrl,
                thumbNailUrl: result.thumbnailUrl,
                authorId: user.id,
                tags: {
                    connect: allTags.map((tag) => ({id: tag.id})),
                },
            },
            include: {
                tags: true,
            },
        });
    });

    const data = await Promise.all(promises);

    await prisma.$disconnect();

    revalidatePath('/notes');

    return {success: true, data};
}