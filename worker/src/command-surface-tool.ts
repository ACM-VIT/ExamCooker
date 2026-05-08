import { tool } from "ai";
import { z } from "zod";
import {
  getCommandSurface,
  type CommandSurfaceContext,
} from "../../lib/command/actions";

export function createCommandSurfaceTool(context: CommandSurfaceContext) {
  return tool({
    description:
      "Return the ExamCooker command surface available in the current user context, including pages, dynamic route templates, and executable app capabilities.",
    inputSchema: z.object({
      query: z.string().optional(),
      goal: z.string().optional(),
    }),
    execute: async ({ query }) =>
      getCommandSurface({
        ...context,
        query: typeof query === "string" && query.trim() ? query : context.query,
      }),
  });
}
