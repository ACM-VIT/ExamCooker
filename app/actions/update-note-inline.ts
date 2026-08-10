"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { db, note, noteToTag } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { findOrCreateTag } from "@/db/helpers";
import { clearedModerationReview } from "@/lib/ai/moderation-review-types";

const schema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  courseId: z.string().min(1).nullable(),
  tags: z.array(z.string()).max(50),
});

function normalizeTags(tags: string[]) {
  const map = new Map<string, string>();

  for (const tagName of tags) {
    const cleaned = tagName.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!map.has(key)) {
      map.set(key, cleaned);
    }
  }

  return Array.from(map.values());
}

export async function updateNoteInline(input: z.input<typeof schema>) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") {
    throw new Error("Access denied");
  }

  const parsed = schema.parse(input);
  const tagNames = normalizeTags(parsed.tags);

  await db.transaction(async (tx) => {
    const tagRecords = await Promise.all(
      tagNames.map((tagName) =>
        findOrCreateTag(tagName, { caseInsensitive: true, dbClient: tx }),
      ),
    );

    await tx
      .update(note)
      .set({
        title: parsed.title,
        courseId: parsed.courseId,
        ...clearedModerationReview,
      })
      .where(eq(note.id, parsed.id));

    await tx.delete(noteToTag).where(eq(noteToTag.a, parsed.id));
    if (tagRecords.length > 0) {
      await tx.insert(noteToTag).values(
        tagRecords.map((tagRecord) => ({
          a: parsed.id,
          b: tagRecord.id,
        })),
      );
    }
  });

  revalidateTag("notes", "minutes");
  revalidateTag(`note:${parsed.id}`, "minutes");
  revalidateTag("courses", "minutes");
  await invalidatePastPapersSurfaceCache();

  return { success: true };
}
