"use server";

import {PrismaClient} from "@/src/generated/prisma";
import {auth} from "../auth";
import {redirect} from "next/navigation";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generateText, Output } from "ai";
import { z } from "zod";
import { normalizeCourseCode } from "@/lib/courseTags";

const prisma = new PrismaClient();
const AI_PAST_PAPER_MODEL = "google/gemini-3-flash";
const COURSE_CODE_REGEX = /^[A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3}$/i;
const SLOT_OPTIONS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
    "D1",
    "D2",
    "E1",
    "E2",
    "F1",
    "F2",
    "G1",
    "G2",
] as const;
const EXAM_TYPE_OPTIONS = ["CAT-1", "CAT-2", "FAT", "MID", "QUIZ", "CIA"] as const;
const PastPaperMetadataSchema = z.object({
    courseTitle: z
        .string()
        .min(2)
        .describe("Course name only. Do not include the course code or brackets."),
    courseCode: z
        .string()
        .regex(COURSE_CODE_REGEX)
        .describe("Course code like CSE1001, without brackets."),
    examType: z
        .enum(EXAM_TYPE_OPTIONS)
        .nullable()
        .describe("One of CAT-1, CAT-2, FAT, MID, QUIZ, CIA if present."),
    slot: z
        .enum(SLOT_OPTIONS)
        .nullable()
        .describe("Slot like A1, B2, etc. Null if not found."),
    year: z
        .string()
        .regex(/^20\d{2}$/)
        .nullable()
        .describe("Year like 2024 if present."),
    academicYear: z
        .string()
        .regex(/^20\d{2}-20\d{2}$/)
        .nullable()
        .describe("Academic year like 2023-2024 if present."),
});
type PastPaperMetadata = z.infer<typeof PastPaperMetadataSchema>;

async function findOrCreateTag(name: string) {
    let tag = await prisma.tag.findUnique({where: {name}});
    if (!tag) {
        tag = await prisma.tag.create({data: {name}});
    }
    return tag;
}

function buildPastPaperTitle(metadata: PastPaperMetadata) {
    const cleanedTitle = metadata.courseTitle.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    const normalizedCode = normalizeCourseCode(metadata.courseCode);
    const base = `${cleanedTitle} [${normalizedCode}]`;
    const suffix = [
        metadata.examType,
        metadata.slot,
        metadata.academicYear ?? metadata.year,
    ].filter(Boolean);
    return suffix.length ? `${base} ${suffix.join(" ")}` : base;
}

async function generatePastPaperTitleFromPdf(input: {
    fileUrl: string;
    fallbackTitle: string;
}) {
    try {
        const response = await fetch(input.fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        const data = Buffer.from(await response.arrayBuffer());

        const { output } = await generateText({
            model: AI_PAST_PAPER_MODEL,
            output: Output.object({
                name: "PastPaperMetadata",
                description:
                    "Extract course metadata from a VIT past paper PDF to build a standardized title.",
                schema: PastPaperMetadataSchema,
            }),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text:
                                "Extract the course title and course code from the PDF. " +
                                "Course titles follow the format 'Course Title [COURSECODE]' in our system, " +
                                "but return courseTitle without brackets or code. " +
                                "If exam type, slot, or year are not found, return null for those fields.",
                        },
                        {
                            type: "file",
                            mediaType: "application/pdf",
                            data,
                            filename: `${input.fallbackTitle}.pdf`,
                        },
                    ],
                },
            ],
        });

        return buildPastPaperTitle(output);
    } catch (error) {
        console.warn("AI title generation failed, using fallback title.", error);
        return input.fallbackTitle;
    }
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

    const promises =
        variant === "Notes"
            ? results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl =
                      normalizeGcsUrl(result.thumbnailUrl) ?? result.thumbnailUrl;
                  return prisma.note.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          thumbNailUrl,
                          authorId: user.id,
                          tags: {
                              connect: allTags.map((tag) => ({ id: tag.id })),
                          },
                      },
                      include: {
                          tags: true,
                      },
                  });
              })
            : results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl =
                      normalizeGcsUrl(result.thumbnailUrl) ?? result.thumbnailUrl;
                  return prisma.pastPaper.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          thumbNailUrl,
                          authorId: user.id,
                          tags: {
                              connect: allTags.map((tag) => ({ id: tag.id })),
                          },
                      },
                      include: {
                          tags: true,
                      },
                  });
              });

    const data = await Promise.all(promises);

    if (variant === "Past Papers") {
        const createdPapers = data as { id: string; title: string; fileUrl: string }[];
        after(async () => {
            const prismaBg = new PrismaClient();
            try {
                await Promise.allSettled(
                    createdPapers.map(async (paper) => {
                        const aiTitle = await generatePastPaperTitleFromPdf({
                            fileUrl: paper.fileUrl,
                            fallbackTitle: paper.title,
                        });
                        if (aiTitle && aiTitle !== paper.title) {
                            await prismaBg.pastPaper.update({
                                where: { id: paper.id },
                                data: { title: aiTitle },
                            });
                        }
                    })
                );
            } finally {
                await prismaBg.$disconnect();
            }
        });
    }

    await prisma.$disconnect();

    if (variant === "Notes") {
        revalidatePath("/notes");
        revalidateTag("notes", "minutes");
    } else {
        revalidatePath("/past_papers");
        revalidateTag("past_papers", "minutes");
    }

    return {success: true, data};
}
