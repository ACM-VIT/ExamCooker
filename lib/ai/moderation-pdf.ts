import { createHash } from "node:crypto";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MODERATION_PDF_TIMEOUT_MS = 30_000;

type TrustedPdfSource = {
  origin: string;
  pathPrefix: string;
};

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getConfiguredAzurePdfBaseUrl() {
  const explicit = process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit;

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const container = process.env.AZURE_STORAGE_CONTAINER?.trim();
  return accountName && container
    ? `https://${accountName}.blob.core.windows.net/${container}`
    : "";
}

function parseTrustedPdfSource(value: string): TrustedPdfSource | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return {
      origin: url.origin,
      pathPrefix: url.pathname.replace(/\/+$/, "") || "/",
    };
  } catch {
    return null;
  }
}

function getTrustedPdfSources() {
  const prefixes = [
    getConfiguredAzurePdfBaseUrl(),
    "https://examcookerdevsi.blob.core.windows.net/exam-assets",
    "https://examcookerprodsi.blob.core.windows.net/exam-assets",
    ...readCsvEnv("MODERATION_PDF_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("PDF_MARKDOWN_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("VOICE_PDF_ALLOWED_URL_PREFIXES"),
    ...[
      ...readCsvEnv("MODERATION_PDF_ALLOWED_GCS_BUCKETS"),
      ...readCsvEnv("PDF_MARKDOWN_ALLOWED_GCS_BUCKETS"),
      ...readCsvEnv("VOICE_PDF_ALLOWED_GCS_BUCKETS"),
    ].map((bucket) => `https://storage.googleapis.com/${bucket}`),
  ];

  return prefixes.flatMap((prefix) => {
    const source = prefix ? parseTrustedPdfSource(prefix) : null;
    return source ? [source] : [];
  });
}

function isTrustedPdfUrl(url: URL) {
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return getTrustedPdfSources().some((source) => {
    if (url.origin !== source.origin) return false;
    return (
      source.pathPrefix === "/" ||
      url.pathname === source.pathPrefix ||
      url.pathname.startsWith(`${source.pathPrefix}/`)
    );
  });
}

async function readBoundedPdfBody(response: Response) {
  if (!response.body) throw new Error("PDF response had no body.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PDF_BYTES) {
        throw new Error("PDF is too large for automatic review.");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const data = Buffer.concat(chunks, totalBytes);
  if (data.subarray(0, 1024).indexOf("%PDF-") === -1) {
    throw new Error("The stored file is not a valid PDF.");
  }
  return data;
}

export function pdfContentHash(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export async function fetchModerationPdf(url: string) {
  const normalizedUrl = normalizeGcsUrl(url) ?? url;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("The stored PDF URL is invalid.");
  }
  if (!isTrustedPdfUrl(parsedUrl)) {
    throw new Error("The stored PDF URL is not from an approved storage source.");
  }

  const response = await fetch(parsedUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(MODERATION_PDF_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Could not fetch PDF (${response.status}).`);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (
    contentType &&
    !["application/pdf", "application/octet-stream", "binary/octet-stream"].includes(
      contentType,
    )
  ) {
    throw new Error("The stored file did not have a PDF content type.");
  }
  const declaredSize = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_PDF_BYTES) {
    throw new Error("PDF is too large for automatic review.");
  }
  return readBoundedPdfBody(response);
}
