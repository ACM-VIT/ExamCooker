function redact(value: string) {
  let text = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (/secret|token|password|credential|private.?key|api.?key|database_url|connection_string/i.test(key) && secret && secret.length >= 4) {
      text = text.split(secret).join("[redacted]");
    }
  }
  return text
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, "[redacted URL]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(failed query|query|params|parameters)\s*:[\s\S]*/gi, "$1: [redacted]")
    .replace(/\b(password|passwd|pwd|token|secret|authorization|cookie|api[_-]?key|database_url|connection[_-]?string)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[redacted]")
    .slice(0, 6000);
}

// Keep diagnostics useful without serializing arbitrary database/transport objects.
export function logMcpError(context: string, error: unknown) {
  const seen = new Set<unknown>();
  const describe = (value: unknown, depth: number): Record<string, unknown> => {
    if (!(value instanceof Error)) return { name: "NonError", message: "Non-Error thrown value" };
    if (seen.has(value)) return { name: "CircularCause" };
    seen.add(value);
    const code = "code" in value ? value.code : undefined;
    return {
      name: redact(value.name),
      message: redact(value.message),
      ...(typeof code === "string" || typeof code === "number" ? { code: redact(String(code)) } : {}),
      stack: redact((value.stack ?? "").split("\n").filter((line) => /^\s+at\s/.test(line)).join("\n")),
      ...(value.cause && depth < 3 ? { cause: describe(value.cause, depth + 1) } : {}),
    };
  };
  console.error(context, describe(error, 0));
}
