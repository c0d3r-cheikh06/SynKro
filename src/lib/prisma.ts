import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Checks whether an error thrown by Prisma corresponds to an unreachable PostgreSQL server.
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; name?: string };
  if (
    err.code === "P1001" ||
    err.code === "P1002" ||
    err.code === "P1003" ||
    err.code === "P1017"
  ) {
    return true;
  }
  if (
    err.name === "PrismaClientInitializationError" ||
    (typeof err.message === "string" &&
      (err.message.includes("Can't reach database server") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("Connection terminated") ||
        err.message.includes("does not exist in the current database")))
  ) {
    return true;
  }
  return false;
}

/**
 * Ping database health status without throwing.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (error) {
    const isProduction = process.env.NODE_ENV === "production";
    const message =
      error instanceof Error ? error.message : "Erreur de connexion PostgreSQL";
    return {
      connected: false,
      error: isProduction
        ? "Le service de base de données est actuellement indisponible."
        : isDatabaseConnectionError(error)
          ? "Le serveur PostgreSQL n'est pas joignable sur l'URL configurée (DATABASE_URL)."
          : message,
    };
  }
}
