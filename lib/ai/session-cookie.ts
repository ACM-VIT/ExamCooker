export const AI_SESSION_COOKIE_NAME = "ec-ai-session";

export function expireAiSessionCookie(response: Response, secure: boolean): Response {
  const updated = new Response(response.body, response);
  updated.headers.append(
    "Set-Cookie",
    `${AI_SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return updated;
}
