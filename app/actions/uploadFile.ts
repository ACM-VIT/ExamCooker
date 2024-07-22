"use server";

import { Storage, StorageOptions } from "@google-cloud/storage";
import { PrismaClient } from "@prisma/client";
import { auth } from "../auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

const storageOptions: StorageOptions = {
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        type: process.env.GCP_TYPE,
        project_id: process.env.GCP_PROJECT_ID,
        private_key_id: process.env.GCP_PRIVATE_KEY_ID,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.GCP_CLIENT_EMAIL,
        client_id: process.env.GCP_CLIENT_ID,
        universe_domain: process.env.GCP_UNIVERSE_DOMAIN,
    },
};

export async function generateSignedUploadURL(filename: string) {
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
        throw new Error("Missing BUCKET_NAME environment variable");
    }
    console.log("Bucket name:", bucketName);

    let storage: Storage;

    try {
        storage = new Storage(storageOptions);
    } catch (error) {
        console.error("Error initializing Storage:", error);
        throw new Error(
            `Failed to initialize Storage: ${error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    const options = {
        expires: Date.now() + 5 * 60 * 1000,
    };

    try {
        const [response] = await file.generateSignedPostPolicyV4(options);
        console.log(response);
        return response;
    } catch (error) {
        console.error("Error generating signed URL:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        } else {
            throw new Error("Failed to generate signed URL: Unknown error");
        }
    }
}

async function findOrCreateTag(name: string) {
    let tag = await prisma.tag.findUnique({ where: { name } });
    if (!tag) {
        tag = await prisma.tag.create({ data: { name } });
    }
    return tag;
}
export async function storeFileInfoInDatabase(
    originalFilename: string,
    fileUrl: string,
    fileType: string,
    tags: string[],
    year?: string,
    slot?: string
) {
    let data;
    try {
        const session = await auth();
        if (!session || !session.user) {
            redirect("/landing");
        }
        const user = await prisma.user.findUnique({
            where: { email: session.user.email! },
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


        if (fileType === "Note") {
            data = await prisma.note.create({
                data: {
                    title: originalFilename,
                    fileUrl: fileUrl,
                    authorId: user.id,
                    tags: {
                        connect: allTags.map((tag) => ({ id: tag.id })),
                    },
                },
                include: {
                    tags: true,
                },
            });
        } else if (fileType === "PastPaper") {
            data = await prisma.pastPaper.create({
                data: {
                    title: originalFilename,
                    fileUrl: fileUrl,
                    authorId: user.id,
                    tags: {
                        connect: allTags.map((tag) => ({ id: tag.id })),
                    },
                },
                include: {
                    tags: true,
                },
            });
        } else {
            throw new Error("Invalid file type");
        }
        
        fileType === "Note" ? revalidatePath('/notes') : revalidatePath('/past_papers')

    } catch (error) {
        console.error("Error storing file info in database:", error);
        if (error instanceof Error) {
            return {
                success: false,
                error: `Failed to store file information in database: ${error.message}`,
            };
        } else {
            return {
                success: false,
                error: "Failed to store file information in database: Unknown error",
            };
        }
    }
    fileType === "Note" ? redirect('/notes') : redirect('/past_papers')

    return { success: true, data };

}
