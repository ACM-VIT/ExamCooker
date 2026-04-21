"use server";

import prisma from "@/lib/prisma";
import {auth} from "../auth";
import {redirect} from "next/navigation";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";
import {
    canonicalizePastPaperExamTag,
    getPastPaperExamTagAliases,
    getPastPaperExamTagFromTitle,
} from "@/lib/pastPaperTags";
import type { PastPaperExamTag } from "@/lib/pastPaperTags";
import type { PrismaClient } from "@/src/generated/prisma";

function mergeAliases(existingAliases: string[], canonicalAliases: readonly string[]) {
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const alias of [...existingAliases, ...canonicalAliases]) {
        const value = String(alias || "").trim();
        const key = value.toLowerCase();
        if (!value || seen.has(key)) continue;
        seen.add(key);
        merged.push(value);
    }

    return merged;
}

async function findOrCreateTagWithClient(
    client: PrismaClient,
    name: string,
    aliases: readonly string[] = [],
) {
    const trimmedName = name.trim();
    let tag = await client.tag.findUnique({
        where: {name: trimmedName},
        select: {id: true, name: true, aliases: true},
    });

    if (!tag) {
        try {
            return await client.tag.create({
                data: {name: trimmedName, aliases: [...aliases]},
                select: {id: true, name: true, aliases: true},
            });
        } catch (error) {
            tag = await client.tag.findUnique({
                where: {name: trimmedName},
                select: {id: true, name: true, aliases: true},
            });
            if (!tag) throw error;
        }
    }

    if (aliases.length > 0) {
        const mergedAliases = mergeAliases(tag.aliases, aliases);
        if (mergedAliases.length !== tag.aliases.length) {
            tag = await client.tag.update({
                where: {id: tag.id},
                data: {aliases: mergedAliases},
                select: {id: true, name: true, aliases: true},
            });
        }
    }

    return tag;
}

async function findOrCreateTag(name: string) {
    return findOrCreateTagWithClient(prisma, name);
}

async function ensureExamTag(client: PrismaClient, tag: PastPaperExamTag) {
    return findOrCreateTagWithClient(
        client,
        tag,
        getPastPaperExamTagAliases(tag),
    );
}

async function findOrCreateSelectedTag(name: string) {
    const examTag = canonicalizePastPaperExamTag(name);
    if (examTag) return ensureExamTag(prisma, examTag);
    return findOrCreateTag(name);
}

function uniqueTags<T extends {id: string}>(tags: T[]) {
    const seen = new Set<string>();
    return tags.filter((tag) => {
        if (seen.has(tag.id)) return false;
        seen.add(tag.id);
        return true;
    });
}

async function buildPastPaperTagsForTitle(
    title: string,
    baseTags: Awaited<ReturnType<typeof findOrCreateSelectedTag>>[],
) {
    const examTag = getPastPaperExamTagFromTitle(title);
    if (!examTag) return uniqueTags(baseTags);

    const canonicalExamTag = await ensureExamTag(prisma, examTag);
    return uniqueTags([
        ...baseTags.filter((tag) => !canonicalizePastPaperExamTag(tag.name)),
        canonicalExamTag,
    ]);
}

async function syncPastPaperExamTagFromTitle(
    client: PrismaClient,
    paperId: string,
    title: string,
) {
    const examTag = getPastPaperExamTagFromTitle(title);
    if (!examTag) return;

    const [canonicalExamTag, paper] = await Promise.all([
        ensureExamTag(client, examTag),
        client.pastPaper.findUnique({
            where: {id: paperId},
            select: {
                tags: {select: {id: true, name: true}},
            },
        }),
    ]);

    if (!paper) return;

    const nextTagIds = uniqueTags([
        ...paper.tags.filter((tag) => !canonicalizePastPaperExamTag(tag.name)),
        canonicalExamTag,
    ]).map((tag) => tag.id);

    await client.pastPaper.update({
        where: {id: paperId},
        data: {
            tags: {
                set: nextTagIds.map((id) => ({id})),
            },
        },
    });
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

    const allTags = await Promise.all(tags.map(findOrCreateSelectedTag));

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
            : results.map(async (result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl =
                      normalizeGcsUrl(result.thumbnailUrl) ?? result.thumbnailUrl;
                  const paperTags = await buildPastPaperTagsForTitle(
                      result.filename,
                      allTags,
                  );
                  return prisma.pastPaper.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          thumbNailUrl,
                          authorId: user.id,
                          tags: {
                              connect: paperTags.map((tag) => ({ id: tag.id })),
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
            try {
                await Promise.allSettled(
                    createdPapers.map(async (paper) => {
                        const aiTitle = await generatePastPaperTitleFromPdf({
                            fileUrl: paper.fileUrl,
                            fallbackTitle: paper.title,
                        });
                        const nextTitle = aiTitle || paper.title;
                        if (aiTitle && aiTitle !== paper.title) {
                            await prisma.pastPaper.update({
                                where: { id: paper.id },
                                data: { title: aiTitle },
                            });
                        }
                        await syncPastPaperExamTagFromTitle(
                            prisma,
                            paper.id,
                            nextTitle,
                        );
                    })
                );
                revalidateTag("past_papers", "minutes");
            } catch (error) {
                console.error("Failed to post-process uploaded past papers:", error);
            }
        });
    }

    if (variant === "Notes") {
        revalidatePath("/notes");
        revalidateTag("notes", "minutes");
    } else {
        revalidatePath("/past_papers");
        revalidateTag("past_papers", "minutes");
    }

    return {success: true, data};
}
