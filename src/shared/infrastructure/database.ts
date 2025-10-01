// Database Infrastructure Layer

import { PrismaClient } from "../../generated/prisma";

class DatabaseConnection {
  private static writeInstance: PrismaClient;
  private static readInstance: PrismaClient;

  static getInstance(): PrismaClient {
    return this.getWriteInstance();
  }

  static getWriteInstance(): PrismaClient {
    if (!DatabaseConnection.writeInstance) {
      const databaseUrl = process.env.DATABASE_URL;
      // For high-scale load testing, increase connection limits significantly
      const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT || "200";

      const urlWithPooling = databaseUrl?.includes('?')
        ? `${databaseUrl}&connection_limit=${connectionLimit}&pool_timeout=30&statement_cache_size=100`
        : `${databaseUrl}?connection_limit=${connectionLimit}&pool_timeout=30&statement_cache_size=100`;

      DatabaseConnection.writeInstance = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
        errorFormat: "pretty",
        datasources: {
          db: { url: urlWithPooling },
        },
      });

      process.on("beforeExit", async () => {
        await DatabaseConnection.writeInstance.$disconnect();
        if (DatabaseConnection.readInstance) {
          await DatabaseConnection.readInstance.$disconnect();
        }
      });

      process.on("SIGINT", async () => {
        await DatabaseConnection.writeInstance.$disconnect();
        if (DatabaseConnection.readInstance) {
          await DatabaseConnection.readInstance.$disconnect();
        }
        process.exit(0);
      });
    }

    return DatabaseConnection.writeInstance;
  }

  static getReadInstance(): PrismaClient {
    if (!DatabaseConnection.readInstance) {
      // Use read replica URL if available, otherwise fall back to write instance
      const readDatabaseUrl = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
      const connectionLimit = process.env.DATABASE_READ_CONNECTION_LIMIT || "300";

      const urlWithPooling = readDatabaseUrl?.includes('?')
        ? `${readDatabaseUrl}&connection_limit=${connectionLimit}&pool_timeout=30&statement_cache_size=100`
        : `${readDatabaseUrl}?connection_limit=${connectionLimit}&pool_timeout=30&statement_cache_size=100`;

      DatabaseConnection.readInstance = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
        errorFormat: "pretty",
        datasources: {
          db: { url: urlWithPooling },
        },
      });
    }

    return DatabaseConnection.readInstance;
  }

  static async disconnect(): Promise<void> {
    if (DatabaseConnection.writeInstance) {
      await DatabaseConnection.writeInstance.$disconnect();
    }
    if (DatabaseConnection.readInstance) {
      await DatabaseConnection.readInstance.$disconnect();
    }
  }

  static async transaction<T>(
    callback: (
      prisma: Omit<
        PrismaClient,
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
      >,
    ) => Promise<T>,
  ): Promise<T> {
    const prisma = DatabaseConnection.getInstance();
    return await prisma.$transaction(callback);
  }

  static async executeRaw(query: string, params: any[] = []): Promise<any> {
    const prisma = DatabaseConnection.getInstance();
    return await prisma.$queryRawUnsafe(query, ...params);
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }
}

export const db = DatabaseConnection.getInstance();
export const dbRead = DatabaseConnection.getReadInstance();
export { DatabaseConnection };

export type { PrismaClient } from "../../generated/prisma";
export * from "../../generated/prisma";
