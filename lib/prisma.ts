import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var __prisma: PrismaClient | undefined;
}

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
  prismaBeforeExitHookRegistered?: boolean
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

if (!globalForPrisma.prismaBeforeExitHookRegistered) {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
  globalForPrisma.prismaBeforeExitHookRegistered = true
}

global.__prisma = prisma;

export default prisma;
