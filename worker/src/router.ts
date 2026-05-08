import { routeAgentRequest } from "agents";
import { jsonResponse } from "./http";
import type { Env } from "./types";

export async function routeWorkerRequest(request: Request, env: Env) {
  const agentResponse = await routeAgentRequest(request, env, {
    cors: true,
  });

  if (agentResponse) return agentResponse;

  const { pathname } = new URL(request.url);

  if (pathname === "/health") {
    return jsonResponse({
      ok: true,
      service: "examcooker-command-agent",
      routes: [
        "/agents/exam-cooker-command-agent/global",
      ],
    });
  }

  return jsonResponse({ error: "Not found" }, { status: 404 });
}
