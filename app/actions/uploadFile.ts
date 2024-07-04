'use server';


import { Storage, StorageOptions } from "@google-cloud/storage"; import { PrismaClient } from "@prisma/client";
import path from 'path';


const prisma = new PrismaClient();

const keyFilePath = path.join(process.cwd(), 'gcp.json');

const storageConfig: StorageOptions = {
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
};


export async function generateSignedUploadURL(filename: string) {
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
        throw new Error("Missing BUCKET_NAME environment variable");
    }
    console.log("Bucket name:", bucketName);


    let storage: Storage;

    try {
        storage = new Storage(storageConfig);
    } catch (error) {
        console.error("Error initializing Storage:", error);
        throw new Error(`Failed to initialize Storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    };

    try {
        storage = new Storage({
            keyFilename: keyFilePath
        });
    } catch (error) {
        console.error("Error initializing Storage:", error);
        throw new Error(`Failed to initialize Storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    const options = {
        expires: Date.now() + 5 * 60 * 1000,
    };

    try {
        const [response] = await file.generateSignedPostPolicyV4(options);
        console.log(response)
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

export async function storeFileInfoInDatabase(originalFilename: string, fileUrl: string, userId: string, fileType: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error(`User with ID ${userId} does not exist`);
        }

        let data;
        if (fileType === "Note") {
            data = await prisma.note.create({
                data: {
                    title: originalFilename,
                    fileUrl: fileUrl,
                    authorId: userId,
                },
            });
        } else if (fileType === "PastPaper") {
            data = await prisma.pastPaper.create({
                data: {
                    title: originalFilename,
                    fileUrl: fileUrl,
                    authorId: userId,
                },
            });
        } else {
            throw new Error("Invalid file type");
        }
        return data;
    } catch (error) {
        console.error("Error storing file info in database:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to store file information in database: ${error.message}`);
        } else {
            throw new Error('Failed to store file information in database: Unknown error');
        }
    }
}
