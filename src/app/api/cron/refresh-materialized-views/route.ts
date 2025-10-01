// Materialized View Refresh Cron Job

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  DatabaseConnection,
} from "../../../../shared/infrastructure/database";

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    await DatabaseConnection.executeRaw(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_hierarchy;
    `);

    await db.materializedViewStatus.updateMany({
      where: { isStale: true },
      data: {
        isStale: false,
        lastRefreshed: new Date(),
        refreshCount: { increment: 1 },
      },
    });

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Materialized views refreshed successfully",
      executionTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Materialized view refresh failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh materialized views",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
