type AllowedResourceSource = {
  origin: string;
  pathPrefix: string;
};

const fallbackAzureBaseUrls = [
  "https://examcookerdevsi.blob.core.windows.net/exam-assets",
  "https://examcookerprodsi.blob.core.windows.net/exam-assets",
];
const fallbackGcsBuckets = ["examcooker-dev-media-20260423"];

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAzureBaseUrlFromEnv() {
  const explicitBaseUrl = process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const container = process.env.AZURE_STORAGE_CONTAINER?.trim();
  if (!container) {
    return "";
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (connectionString) {
    const segments = new Map<string, string>();
    for (const part of connectionString.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      segments.set(
        trimmed.slice(0, separatorIndex).trim(),
        trimmed.slice(separatorIndex + 1).trim(),
      );
    }

    const blobEndpoint = segments.get("BlobEndpoint");
    if (blobEndpoint) {
      return `${blobEndpoint.replace(/\/+$/, "")}/${container}`;
    }

    const accountName = segments.get("AccountName");
    const endpointSuffix = segments.get("EndpointSuffix") || "core.windows.net";
    if (accountName) {
      return `https://${accountName}.blob.${endpointSuffix}/${container}`;
    }
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  if (!accountName) {
    return "";
  }

  return `https://${accountName}.blob.core.windows.net/${container}`;
}

function parseAllowedResourceSource(rawValue: string): AllowedResourceSource | null {
  try {
    const parsed = new URL(rawValue);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    const pathPrefix = parsed.pathname.replace(/\/+$/, "") || "/";
    return {
      origin: parsed.origin,
      pathPrefix,
    };
  } catch {
    return null;
  }
}

function getAllowedResourceSources() {
  const configuredValues = [
    getAzureBaseUrlFromEnv(),
    ...fallbackAzureBaseUrls,
    ...readCsvEnv("UPLOAD_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("PDF_MARKDOWN_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("VOICE_PDF_ALLOWED_URL_PREFIXES"),
    ...fallbackGcsBuckets.map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
    ...readCsvEnv("UPLOAD_ALLOWED_GCS_BUCKETS").map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
    ...readCsvEnv("PDF_MARKDOWN_ALLOWED_GCS_BUCKETS").map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
    ...readCsvEnv("VOICE_PDF_ALLOWED_GCS_BUCKETS").map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
  ];

  const uniqueKeys = new Set<string>();
  const sources: AllowedResourceSource[] = [];

  for (const value of configuredValues) {
    const parsed = parseAllowedResourceSource(value);
    if (!parsed) {
      continue;
    }

    const key = `${parsed.origin}${parsed.pathPrefix}`;
    if (uniqueKeys.has(key)) {
      continue;
    }

    uniqueKeys.add(key);
    sources.push(parsed);
  }

  return sources;
}

function matchesAllowedResourceSource(url: URL, source: AllowedResourceSource) {
  if (url.origin !== source.origin) {
    return false;
  }

  if (source.pathPrefix === "/") {
    return true;
  }

  return (
    url.pathname === source.pathPrefix ||
    url.pathname.startsWith(`${source.pathPrefix}/`)
  );
}

export function isAllowedUploadedResourceUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  return getAllowedResourceSources().some((source) =>
    matchesAllowedResourceSource(url, source),
  );
}
