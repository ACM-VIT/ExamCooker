import { PrismaClient } from "@/src/generated/prisma";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["error", "warn", "query"] : ["error", "warn"],
    errorFormat: process.env.NODE_ENV === "production" ? "minimal" : "pretty",
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

export default prisma;
