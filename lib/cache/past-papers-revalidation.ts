import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "examcooker:public-paper-cache:v1";
const MAX_AGE_MS = 60_000;
export const PAPER_REVALIDATION_HEADER = "x-ec-paper-revalidation";
export const PAPER_REVALIDATION_PATH = "/__ec_cutover/revalidate-past-papers";

function signature(timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${PURPOSE}:${timestamp}`).digest();
}

export function signPaperRevalidation(secret: string, now = Date.now()) {
  const timestamp = String(now);
  return `${timestamp}.${signature(timestamp, secret).toString("hex")}`;
}

export function verifyPaperRevalidation(token: string | null, secret: string, now = Date.now()) {
  if (!token || !secret || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [timestamp, mac] = token.split(".");
  const age = now - Number(timestamp);
  if (age < -5_000 || age > MAX_AGE_MS) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), signature(timestamp, secret));
}

/** During the anonymous canary, all authenticated edits execute on Azure. */
export async function revalidateCloudflarePaperCache() {
  if (process.env.NODE_ENV !== "production" ||
    (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")) return;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl !== "https://examcooker.acmvit.in" && baseUrl !== "https://exam-cooker.acmvit.in") return;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Paper cache invalidation requires the application secret");

  const response = await fetch(`https://examcooker.acmvit.in${PAPER_REVALIDATION_PATH}`, {
    method: "POST",
    headers: { [PAPER_REVALIDATION_HEADER]: signPaperRevalidation(secret) },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Cloudflare paper cache invalidation returned ${response.status}`);
}
