/// <reference types="@cloudflare/workers-types" />

import { ExamCookerCommandAgent } from "./command-agent";
import { ExamCookerStudyBrainAgent } from "./study-brain-agent";
import { routeWorkerRequest } from "./router";
import type { Env } from "./types";

export { ExamCookerCommandAgent };
export { ExamCookerStudyBrainAgent };

export default {
  async fetch(request: Request, env: Env) {
    return routeWorkerRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
