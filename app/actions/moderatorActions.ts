"use server";

import { PrismaClient } from "@/src/generated/prisma";
import { auth } from "../auth";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function fetchUnclearedItems() {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const notes = await prisma.note.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
    });
    const pastPapers = await prisma.pastPaper.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
    });

    const totalUsers = await prisma.user.count();

    return { notes, pastPapers, totalUsers };
}

export async function approveItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    type === "note"
        ? await prisma.note.update({ where: { id }, data: { isClear: true } })
        : await prisma.pastPaper.update({
              where: { id },
              data: { isClear: true },
          });

    revalidatePath("/mod");
}

export async function renameItem(
    id: string,
    type: "note" | "pastPaper",
    title: string
) {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    if (type === "note") {
        await prisma.note.update({ where: { id }, data: { title } });
    }

    if (type === "pastPaper") {
        await prisma.pastPaper.update({ where: { id }, data: { title } });
    }

    revalidatePath("/mod");
}

export async function deleteItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    if (type === "note") {
        await prisma.note.delete({ where: { id } });
    }

    if (type === "pastPaper") {
        await prisma.pastPaper.delete({ where: { id } });
    }
    revalidatePath("/mod");
}
