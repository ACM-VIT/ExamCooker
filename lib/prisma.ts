import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var __prisma: PrismaClient | undefined;
}

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient
  prismaBeforeExitHookRegistered?: boolean
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  const adapter = new PrismaPg(
    {
      connectionString,
      max: readPositiveInt("DATABASE_POOL_MAX", 5),
      connectionTimeoutMillis: readPositiveInt("DATABASE_CONNECTION_TIMEOUT_MS", 10_000),
      idleTimeoutMillis: readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 30_000),
      query_timeout: readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 20_000),
      statement_timeout: readPositiveInt("DATABASE_STATEMENT_TIMEOUT_MS", 20_000),
    },
    {
      onPoolError(error) {
        console.error("[prisma] pg pool error", error)
      },
      onConnectionError(error) {
        console.error("[prisma] pg connection error", error)
      },
    },
  )

  return new PrismaClient({ adapter })
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
    global.__prisma = globalForPrisma.prisma
  }

  return globalForPrisma.prisma
}

if (!globalForPrisma.prismaBeforeExitHookRegistered) {
  process.on('beforeExit', async () => {
    await globalForPrisma.prisma?.$disconnect()
  })
  globalForPrisma.prismaBeforeExitHookRegistered = true
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = Reflect.get(client, prop)
    return typeof value === "function" ? value.bind(client) : value
  },
  set(_target, prop, value) {
    return Reflect.set(getPrisma(), prop, value)
  },
})

export default prisma;
