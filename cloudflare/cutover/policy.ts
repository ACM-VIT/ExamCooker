export type Backend = "azure" | "cloudflare";
export const COOKIE = "__Host-ec-rollout";
export const ROLLOUT = "cf-canary-2026-09-27";
export const PREFIX = "/__ec_cutover";

export function originUrl(input: URL) {
  const url = new URL("https://examcooker.acmvit.in");
  // Assign path separately: new URL("//host/path", origin) changes the host.
  url.pathname = input.pathname;
  url.search = input.search;
  return url;
}

export function hasSession(request: Request) {
  return /(?:^|;\s*)(?:__Secure-)?(?:next-auth|authjs)\.session-token(?:\.\d+)?=/.test(request.headers.get("cookie") || "") || request.headers.has("authorization");
}
export function isDocument(request: Request) {
  return request.method === "GET" && !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    !/prefetch|prerender/i.test(`${request.headers.get("purpose") || ""} ${request.headers.get("sec-purpose") || ""}`) &&
    !new URL(request.url).searchParams.has("_rsc") &&
    (request.headers.get("sec-fetch-dest") === "document" || (request.headers.get("accept") || "").includes("text/html"));
}
export function isPublicPage(path: string) {
  return path === "/" || /^\/(past_papers|notes|syllabus|resources)(\/|$)/.test(path);
}
export function isAzureOnly(path: string) {
  return /^\/(api|auth|signin|signout|native-auth|mod|cli|mcp|ecp|delete|blocked|quiz)(\/|$)/.test(path) || /^\/(past_papers|notes)\/create(?:\/|$)/.test(path) || path === "/sw.js" || path === "/manifest.webmanifest";
}
export function routeLabel(path: string) {
  return path.replace(/\/paper\/[^/]+/, "/paper/[id]")
    .replace(/^\/(notes|syllabus)\/(?!course(?:\/|$))[^/]+/, "/$1/[id]")
    .replace(/\/(past_papers|resources|syllabus\/course)\/[^/]+/, "/$1/[course]");
}
export function chooseBackend(request: Request, assigned: Backend | null, percent: number, random: number): Backend {
  const path = new URL(request.url).pathname;
  if (hasSession(request) || isAzureOnly(path) || percent <= 0) return "azure";
  if (assigned) return assigned;
  if (!isDocument(request) || !isPublicPage(path) || /bot|crawler|spider|headless/i.test(request.headers.get("user-agent") || "")) return "azure";
  return random * 100 < percent ? "cloudflare" : "azure";
}
