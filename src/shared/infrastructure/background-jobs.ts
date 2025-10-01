// Background Job Processing System

import { db } from "./database";
import { GetAccessibleUsersHandler } from "../../domains/access-query/queries/GetAccessibleUsersHandler";

export interface BackgroundJob {
  id: string;
  type: 'REFRESH_MATERIALIZED_VIEW' | 'BULK_USER_SYNC' | 'CLEANUP_EXPIRED_PERMISSIONS';
  payload: Record<string, any>;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  priority: number;
  scheduledAt: Date;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
}

class BackgroundJobProcessor {
  private static instance: BackgroundJobProcessor;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  static getInstance(): BackgroundJobProcessor {
    if (!BackgroundJobProcessor.instance) {
      BackgroundJobProcessor.instance = new BackgroundJobProcessor();
    }
    return BackgroundJobProcessor.instance;
  }

  async start(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log("🚀 Background job processor started");

    // Process jobs every 30 seconds
    this.processingInterval = setInterval(async () => {
      await this.processJobs();
    }, 30000);

    // Process immediately on start
    await this.processJobs();
  }

  async stop(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log("⏹  Background job processor stopped");
  }

  async scheduleJob(type: BackgroundJob['type'], payload: Record<string, any>, priority = 5, delaySeconds = 0): Promise<void> {
    const scheduledAt = new Date(Date.now() + delaySeconds * 1000);

    await db.$executeRaw`
      INSERT INTO background_jobs (id, type, payload, status, priority, scheduled_at, created_at, updated_at, retry_count, max_retries)
      VALUES (gen_random_uuid(), ${type}, ${JSON.stringify(payload)}::jsonb, 'PENDING', ${priority}, ${scheduledAt}, NOW(), NOW(), 0, 3)
    `;

    console.log(`📋 Scheduled background job: ${type} (priority: ${priority})`);
  }

  async scheduleMaterializedViewRefresh(userId: string, priority = 3): Promise<void> {
    // Check if there's already a pending job for this user
    const existingJob = await db.$queryRawUnsafe(`
      SELECT id FROM background_jobs
      WHERE type = 'REFRESH_MATERIALIZED_VIEW'
        AND (payload->>'userId')::text = $1
        AND status IN ('PENDING', 'RUNNING')
      LIMIT 1
    `, userId);

    if ((existingJob as any[]).length > 0) {
      console.log(`⏭  Skipping materialized view refresh for user ${userId} - job already pending`);
      return;
    }

    await this.scheduleJob('REFRESH_MATERIALIZED_VIEW', { userId }, priority);
  }

  private async processJobs(): Promise<void> {
    try {
      // Get next job to process (highest priority first, then oldest)
      const jobs = await db.$queryRawUnsafe(`
        UPDATE background_jobs
        SET status = 'RUNNING', updated_at = NOW()
        WHERE id IN (
          SELECT id FROM background_jobs
          WHERE status = 'PENDING'
            AND scheduled_at <= NOW()
          ORDER BY priority ASC, created_at ASC
          LIMIT 5
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `) as BackgroundJob[];

      if (jobs.length === 0) return;

      console.log(`🔄 Processing ${jobs.length} background jobs`);

      // Process jobs in parallel
      await Promise.allSettled(
        jobs.map(job => this.processJob(job))
      );

    } catch (error) {
      console.error("❌ Error processing background jobs:", error);
    }
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    try {
      console.log(`⚡ Processing job ${job.id} (${job.type})`);

      switch (job.type) {
        case 'REFRESH_MATERIALIZED_VIEW':
          await this.refreshMaterializedView(job.payload.userId);
          break;

        case 'BULK_USER_SYNC':
          await this.bulkUserSync(job.payload);
          break;

        case 'CLEANUP_EXPIRED_PERMISSIONS':
          await this.cleanupExpiredPermissions();
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark as completed
      await db.$executeRaw`
        UPDATE background_jobs
        SET status = 'COMPLETED', updated_at = NOW()
        WHERE id = ${job.id}
      `;

      console.log(`✅ Completed job ${job.id} (${job.type})`);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      const shouldRetry = job.retryCount < job.maxRetries;
      const newStatus = shouldRetry ? 'PENDING' : 'FAILED';
      const nextScheduled = shouldRetry
        ? new Date(Date.now() + Math.pow(2, job.retryCount) * 60000) // Exponential backoff
        : null;

      await db.$executeRaw`
        UPDATE background_jobs
        SET status = ${newStatus},
            retry_count = retry_count + 1,
            scheduled_at = ${nextScheduled},
            error = ${error instanceof Error ? error.message : String(error)},
            updated_at = NOW()
        WHERE id = ${job.id}
      `;

      if (shouldRetry) {
        console.log(`🔄 Job ${job.id} scheduled for retry ${job.retryCount + 1}/${job.maxRetries}`);
      }
    }
  }

  private async refreshMaterializedView(userId: string): Promise<void> {
    const startTime = Date.now();

    // Refresh the materialized view for this user
    await db.$executeRaw`
      REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_hierarchy;
    `;

    // Update the status
    const handler = new GetAccessibleUsersHandler();
    await handler.refreshMaterializedView(userId);

    const duration = Date.now() - startTime;
    console.log(`🔄 Refreshed materialized view for user ${userId} in ${duration}ms`);
  }

  private async bulkUserSync(payload: { batchSize?: number }): Promise<void> {
    const batchSize = payload.batchSize || 100;

    // Find users who need their materialized views refreshed
    const staleUsers = await db.$queryRawUnsafe(`
      SELECT DISTINCT user_id
      FROM materialized_view_status
      WHERE is_stale = true
        OR last_refreshed < NOW() - INTERVAL '1 hour'
      LIMIT $1
    `, batchSize) as { user_id: string }[];

    console.log(`🔄 Bulk syncing ${staleUsers.length} users`);

    // Schedule individual refresh jobs
    for (const user of staleUsers) {
      await this.scheduleMaterializedViewRefresh(user.user_id, 7); // Lower priority for bulk
    }
  }

  private async cleanupExpiredPermissions(): Promise<void> {
    const result = await db.$executeRaw`
      UPDATE user_permissions
      SET is_active = false
      WHERE expires_at < NOW() AND is_active = true
    `;

    console.log(`🧹 Cleaned up ${result} expired permissions`);

    // Mark affected users' materialized views as stale
    await db.$executeRaw`
      UPDATE materialized_view_status
      SET is_stale = true
      WHERE user_id IN (
        SELECT DISTINCT user_id
        FROM user_permissions
        WHERE expires_at < NOW() AND is_active = false AND updated_at > NOW() - INTERVAL '1 minute'
      )
    `;
  }

  async getJobStats(): Promise<{ pending: number; running: number; completed: number; failed: number }> {
    const stats = await db.$queryRawUnsafe(`
      SELECT
        status,
        COUNT(*) as count
      FROM background_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `) as { status: string; count: number }[];

    const result = { pending: 0, running: 0, completed: 0, failed: 0 };
    stats.forEach(stat => {
      result[stat.status.toLowerCase() as keyof typeof result] = Number(stat.count);
    });

    return result;
  }
}

export const backgroundJobs = BackgroundJobProcessor.getInstance();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  backgroundJobs.start().catch(console.error);
}