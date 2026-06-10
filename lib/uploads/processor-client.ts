import type { ProcessedUploadResult } from "@/lib/uploads/create-uploaded-resources";
import { UPLOAD_SUCCESS_MESSAGE } from "@/lib/uploads/create-uploaded-resources";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getProcessorBaseUrl() {
  const baseUrl =
    process.env.MICROSERVICE_URL || process.env.NEXT_PUBLIC_MICROSERVICE_URL;

  if (!baseUrl) {
    throw new Error("Upload processor URL is not configured.");
  }

  return baseUrl.replace(/\/$/, "");
}

export function normalizeProcessedUploadResult(
  payload: unknown,
  fallbackFilename: string,
): ProcessedUploadResult {
  if (!isRecord(payload)) {
    return {
      fileUrl: "",
      thumbnailUrl: null,
      filename: fallbackFilename,
      message: "Upload processor returned an invalid response.",
    };
  }

  const fileUrl = getStringField(payload, "fileUrl", "file_url", "url") ?? "";
  const filename =
    getStringField(payload, "filename", "fileName", "name") ?? fallbackFilename;
  const message =
    getStringField(payload, "message") ??
    (fileUrl
      ? UPLOAD_SUCCESS_MESSAGE
      : "Upload processor did not return a file URL.");

  return {
    fileUrl,
    filename,
    message,
    thumbnailUrl: getStringField(
      payload,
      "thumbnailUrl",
      "thumbnail_url",
      "thumbNailUrl",
    ),
  };
}

export async function processUploadFile(input: {
  file: File;
  title: string;
}) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("filetitle", input.title);

  const response = await fetch(`${getProcessorBaseUrl()}/process_pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const details = errorText ? `: ${errorText.slice(0, 240)}` : "";
    throw new Error(`Failed to upload file ${input.title}${details}`);
  }

  const payload = await response.json();
  const result = normalizeProcessedUploadResult(payload, input.title);
  if (result.message !== UPLOAD_SUCCESS_MESSAGE) {
    throw new Error(result.message);
  }

  return result;
}
