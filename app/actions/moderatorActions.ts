'use server'

import { PrismaClient } from '@prisma/client';
import { auth } from "../auth";

const prisma = new PrismaClient();

export async function fetchUnclearedItems() {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== 'MODERATOR') {
        throw new Error('Access denied');
    }

    const notes = await prisma.note.findMany({
        where: { isClear: false }
    });
    const pastPapers = await prisma.pastPaper.findMany({
        where: { isClear: false }
    });

    return { notes, pastPapers };
}

export async function approveItem(id: string, type: 'note' | 'pastPaper') {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== 'MODERATOR') {
        throw new Error('Access denied');
    }

    if (type === 'note') {
        await prisma.note.update({ where: { id }, data: { isClear: true } });
    } else {
        await prisma.pastPaper.update({ where: { id }, data: { isClear: true } });
    }
}
