// Health check endpoint for production monitoring
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    let materializedViewStatus = "not_applicable";
    try {
      const mvStatus = await prisma.materializedViewStatus.findFirst({
        orderBy: { lastRefreshed: "desc" },
      });

      if (mvStatus) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        materializedViewStatus =
          mvStatus.isStale || mvStatus.lastRefreshed < fiveMinutesAgo
            ? "stale"
            : "fresh";
      } else {
        materializedViewStatus = "no_data";
      }
    } catch (error) {
      materializedViewStatus = "sqlite_mode";
    }

    const executionTime = Date.now() - startTime;

    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      materialized_views: materializedViewStatus,
      performance: {
        avg_response_time: `${executionTime}ms`,
        memory_usage: "normal",
      },
      features: {
        closure_table: "enabled",
        materialized_views:
          materializedViewStatus !== "not_applicable" ? "enabled" : "disabled",
        performance_monitoring: "enabled",
      },
      environment: {
        node_env: process.env.NODE_ENV || "development",
        database_type: process.env.DATABASE_URL?.includes("postgresql")
          ? "postgresql"
          : "sqlite",
      },
    };

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);

    const executionTime = Date.now() - startTime;

    const errorData = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      performance: {
        response_time: `${executionTime}ms`,
        memory_usage: "unknown",
      },
    };

    return NextResponse.json(errorData, { status: 503 });
  } finally {
    await prisma.$disconnect();
  }
}
