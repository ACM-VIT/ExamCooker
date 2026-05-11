"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { db, pastPaper } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { normalizePdfPageEdits } from "@/lib/pdf/page-edits";

const pageRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

const pageEditsSchema = z
  .object({
    pageOrder: z.array(z.number().int().min(0)).max(400).nullable().optional(),
    pageRotations: z
      .record(z.string().regex(/^\d+$/), pageRotationSchema)
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

const schema = z.object({
  id: z.string().min(1),
  pageEdits: pageEditsSchema,
});

export async function updatePastPaperPageEdits(input: z.input<typeof schema>) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") {
    throw new Error("Access denied");
  }

  const parsed = schema.parse(input);
  const pageEdits = normalizePdfPageEdits(parsed.pageEdits ?? null);

  const updatedRows = await db
    .update(pastPaper)
    .set({
      pageEdits,
    })
    .where(eq(pastPaper.id, parsed.id))
    .returning({ id: pastPaper.id });
  if (updatedRows.length === 0) {
    throw new Error("Past paper not found.");
  }

  revalidateTag("past_papers", "minutes");
  revalidateTag(`past_paper:${parsed.id}`, "minutes");
  await invalidatePastPapersSurfaceCache();

  return {
    success: true,
    pageEdits,
  };
}
