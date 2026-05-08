/// <reference types="@cloudflare/workers-types" />

import { ExamCookerCommandAgent } from "./command-agent";
import { routeWorkerRequest } from "./router";
import type { Env } from "./types";

export { ExamCookerCommandAgent };

export default {
  async fetch(request: Request, env: Env) {
    return routeWorkerRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
