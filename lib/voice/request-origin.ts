import { getPublicRequestOrigin } from "@/lib/auth-origin";

export function isVoiceRequestSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Non-browser clients may omit Origin; the route still requires a session.
  if (origin === null) return true;
  try {
    const parsed = new URL(origin);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) return false;
    const publicOrigin = getPublicRequestOrigin(request);
    return origin === (publicOrigin?.origin ?? new URL(request.url).origin);
  } catch {
    return false;
  }
}
