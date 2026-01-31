import { NextRequest } from "next/server";

const ALLOWED_HOST = "storage.googleapis.com";
const ALLOWED_PATH_PREFIX = "/examcooker/";

function sanitizeFilename(name: string) {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[^\w.\- ]+/g, "_").trim();
  const base = safe || "document";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function extractFileNameFromUrl(url: URL) {
  const lastSegment = url.pathname.split("/").pop() || "document.pdf";
  try {
    return sanitizeFilename(decodeURIComponent(lastSegment));
  } catch {
    return sanitizeFilename(lastSegment);
  }
}

function isAllowedUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    url.hostname === ALLOWED_HOST &&
    url.pathname.startsWith(ALLOWED_PATH_PREFIX)
  );
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return new Response("Missing url", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!isAllowedUrl(targetUrl)) {
    return new Response("Forbidden", { status: 403 });
  }

  const filenameParam = req.nextUrl.searchParams.get("filename");
  const filename = filenameParam
    ? sanitizeFilename(filenameParam)
    : extractFileNameFromUrl(targetUrl);

  const upstream = await fetch(targetUrl.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Unable to download file", { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
