import { revalidateTag } from "next/cache";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { PAPER_REVALIDATION_HEADER, verifyPaperRevalidation } from "@/lib/cache/past-papers-revalidation";

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const headers = { "Cache-Control": "private, no-store" };
  if (!verifyPaperRevalidation(request.headers.get(PAPER_REVALIDATION_HEADER), secret)) {
    return new Response(null, { status: 403, headers });
  }

  // This endpoint only expires public data. No caller-supplied tags or paths,
  // database writes, or forwarding back to the other deployment.
  await invalidatePastPapersSurfaceCache({ propagate: false });
  for (const tag of ["past_papers", "courses", "notes"]) {
    revalidateTag(tag, { expire: 0 });
  }
  return new Response(null, { status: 204, headers });
}
