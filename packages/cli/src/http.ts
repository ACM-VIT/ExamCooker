type RequestOptions = {
  method?: string;
  token?: string;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const payload = text ? safelyParseJson(text) : null;
  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload, response.statusText, contentType),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function requestRaw(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  return response;
}

function safelyParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(
  payload: unknown,
  fallback: string,
  contentType?: string,
) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    if (
      contentType?.includes("text/html") ||
      /^\s*<!doctype html/i.test(payload) ||
      /^\s*<html/i.test(payload)
    ) {
      return `Unexpected HTML response from server (${fallback || "request failed"}). Check the base URL.`;
    }

    return payload;
  }

  return fallback || "Request failed";
}
