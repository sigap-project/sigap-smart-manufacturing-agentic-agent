import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development (Hot Module Replacement)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isDummyDatabaseUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.includes("c123456789") ||
    url.includes("YourStrongPassword") ||
    url.includes("dummy") ||
    url.trim() === ""
  );
}

function getOrCreatePrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log:
        process.env.DEBUG_PRISMA === "true"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (isDummyDatabaseUrl(process.env.DATABASE_URL)) {
      throw new Error(
        `[Prisma Offline] Database is not configured or DATABASE_URL is placeholder. Access to '${String(
          prop
        )}' is disabled.`
      );
    }
    const client = getOrCreatePrisma();
    return (client as any)[prop];
  },
});

