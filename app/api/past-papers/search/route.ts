import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parsePaperTitle } from "@/lib/paperTitle";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 12;

function clampNumber(value: string | null, fallback: number, max: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = clampNumber(req.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    if (!query) {
        return NextResponse.json({ items: [] });
    }

    const records = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            OR: [
                { title: { contains: query, mode: "insensitive" } },
                {
                    tags: {
                        some: {
                            name: { contains: query, mode: "insensitive" },
                        },
                    },
                },
            ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            title: true,
        },
    });

    const normalizedQuery = query.toLowerCase();
    const grouped = new Map<
        string,
        {
            id: string;
            title: string;
            courseCode: string;
            paperCount: number;
            rank: number;
        }
    >();

    records.forEach((paper) => {
        const parsed = parsePaperTitle(paper.title);
        const courseCode = parsed.courseCode?.trim().toUpperCase();
        const courseName = (parsed.courseName ?? parsed.cleanTitle).trim();

        if (!courseCode || !courseName) {
            return;
        }

        const key = courseCode;
        const titleMatch = courseName.toLowerCase().includes(normalizedQuery);
        const codeMatch = courseCode.toLowerCase().includes(normalizedQuery);
        const startsWithMatch =
            courseName.toLowerCase().startsWith(normalizedQuery) ||
            courseCode.toLowerCase().startsWith(normalizedQuery);
        const rank = startsWithMatch ? 2 : titleMatch || codeMatch ? 1 : 0;
        const existing = grouped.get(key);

        if (existing) {
            existing.paperCount += 1;
            if (rank > existing.rank) {
                existing.rank = rank;
                existing.title = courseName;
            }
            return;
        }

        grouped.set(key, {
            id: paper.id,
            title: courseName,
            courseCode,
            paperCount: 1,
            rank,
        });
    });

    const items = Array.from(grouped.values())
        .sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            if (b.paperCount !== a.paperCount) return b.paperCount - a.paperCount;
            return a.title.localeCompare(b.title);
        })
        .slice(0, limit)
        .map((item) => ({
            id: item.id,
            title: item.title,
            courseCode: item.courseCode,
            metadata: item.courseCode,
            paperCount: item.paperCount,
        }));

    return NextResponse.json({ items });
}
