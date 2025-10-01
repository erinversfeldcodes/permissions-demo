// Get Accessible Users Query Handler

import {
  GetAccessibleUsersQuery,
  GetAccessibleUsersResult,
  AccessibleUser,
} from "./GetAccessibleUsersQuery";
import { db, dbRead } from "../../../shared/infrastructure/database";
import { backgroundJobs } from "../../../shared/infrastructure/background-jobs";
import { Prisma } from "../../../generated/prisma";
import { ConsistencyLevel, DataSource } from "../../../shared/types";

export class GetAccessibleUsersHandler {
  async handle(
    query: GetAccessibleUsersQuery,
  ): Promise<GetAccessibleUsersResult> {
    const startTime = Date.now();

    try {
      const dataSource = await this.determineDataSource(query);

      let result: GetAccessibleUsersResult;

      switch (dataSource) {
        case DataSource.MATERIALIZED_VIEW:
          result = await this.queryMaterializedView(query, startTime);
          break;
        case DataSource.CLOSURE_TABLE:
          result = await this.queryClosureTable(query, startTime);
          break;
        case DataSource.HYBRID:
          try {
            result = await this.queryMaterializedView(query, startTime);
          } catch (error) {
            console.warn(
              "Materialized view query failed, falling back to closure table:",
              error,
            );
            result = await this.queryClosureTable(query, startTime);
          }
          break;
        default:
          result = await this.queryClosureTable(query, startTime);
      }

      return result;
    } catch (error) {
      console.error("Error in GetAccessibleUsersHandler:", error);
      throw error;
    }
  }

  private async determineDataSource(
    query: GetAccessibleUsersQuery,
  ): Promise<DataSource> {
    if (query.consistencyLevel === ConsistencyLevel.STRONG) {
      return DataSource.CLOSURE_TABLE;
    }

    const viewStatus = await dbRead.materializedViewStatus.findUnique({
      where: { userId: query.requesterId },
    });

    if (!viewStatus || viewStatus.isStale) {
      // Schedule background refresh for next time
      await backgroundJobs.scheduleMaterializedViewRefresh(query.requesterId, 3);
      return DataSource.CLOSURE_TABLE;
    }

    const thresholdMinutes = process.env.MATERIALIZED_VIEW_THRESHOLD_MINUTES
      ? parseInt(process.env.MATERIALIZED_VIEW_THRESHOLD_MINUTES)
      : 5;
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    if (viewStatus.lastRefreshed < thresholdTime) {
      // Schedule background refresh for next time
      await backgroundJobs.scheduleMaterializedViewRefresh(query.requesterId, 4);
      return DataSource.CLOSURE_TABLE;
    }

    return DataSource.MATERIALIZED_VIEW;
  }

  private async queryMaterializedView(
    query: GetAccessibleUsersQuery,
    startTime: number,
  ): Promise<GetAccessibleUsersResult> {
    const offset = query.pagination?.offset || 0;
    const limit = query.pagination?.limit || 20;

    // Build filter conditions for materialized view
    let filterClause = "";
    const params = [query.requesterId];

    if (query.filters?.isActive !== undefined) {
      // Note: materialized view only contains active users by design
      if (!query.filters.isActive) {
        // If requesting inactive users, return empty result since materialized view only has active users
        return {
          users: [],
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          dataSource: DataSource.MATERIALIZED_VIEW,
          executionTime: Date.now() - startTime,
          lastUpdated: new Date(),
        };
      }
    }

    if (query.filters?.organizationNodeIds?.length) {
      const placeholders = query.filters.organizationNodeIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...query.filters.organizationNodeIds);
      filterClause += ` AND target_node_id IN (${placeholders})`;
    }

    if (query.filters?.searchTerm) {
      params.push(`%${query.filters.searchTerm}%`, `%${query.filters.searchTerm}%`);
      filterClause += ` AND (target_name ILIKE $${params.length - 1} OR target_email ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    // Query the materialized view directly for maximum performance
    const [users, totalCountResult] = await Promise.all([
      dbRead.$queryRawUnsafe(`
        SELECT DISTINCT
          target_user_id as id,
          target_name as name,
          target_email as email,
          target_node_id as organization_node_id,
          organization_name as organization_node_name,
          organization_level
        FROM user_accessible_hierarchy
        WHERE requester_id = $1
          ${filterClause}
        ORDER BY target_name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, ...params),
      dbRead.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT target_user_id) as total
        FROM user_accessible_hierarchy
        WHERE requester_id = $1
          ${filterClause}
      `, ...params.slice(0, -2)) // Remove limit and offset for count query
    ]);

    const totalCount = (totalCountResult as any[])[0]?.total || 0;
    const executionTime = Date.now() - startTime;

    const viewStatus = await dbRead.materializedViewStatus.findUnique({
      where: { userId: query.requesterId },
    });

    return {
      users: (users as any[]).map(this.mapMaterializedViewResult),
      totalCount: parseInt(totalCount),
      hasNextPage: offset + limit < totalCount,
      hasPreviousPage: offset > 0,
      dataSource: DataSource.MATERIALIZED_VIEW,
      executionTime,
      lastUpdated: viewStatus?.lastRefreshed || new Date(),
    };
  }

  private mapMaterializedViewResult(row: any): AccessibleUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      organizationNodeId: row.organization_node_id,
      organizationNodeName: row.organization_node_name || "",
      isActive: true, // Materialized view only contains active users
      lastLoginAt: null, // Not available in materialized view
      createdAt: new Date(), // Not available in materialized view
      updatedAt: new Date(), // Not available in materialized view
    };
  }

  private async queryClosureTable(
    query: GetAccessibleUsersQuery,
    startTime: number,
  ): Promise<GetAccessibleUsersResult> {
    const offset = query.pagination?.offset || 0;
    const limit = query.pagination?.limit || 20;

    // Build optimized query using raw SQL to avoid N+1 and deep nesting
    const [users, totalCountResult] = await Promise.all([
      this.getAccessibleUsersOptimized(query, offset, limit),
      this.getAccessibleUsersCount(query),
    ]);

    const totalCount = totalCountResult[0]?.total || 0;
    const executionTime = Date.now() - startTime;

    return {
      users: users.map(this.mapRawUserResult),
      totalCount: parseInt(totalCount),
      hasNextPage: offset + limit < totalCount,
      hasPreviousPage: offset > 0,
      dataSource: DataSource.CLOSURE_TABLE,
      executionTime,
      lastUpdated: new Date(),
    };
  }

  private buildWhereClause(
    query: GetAccessibleUsersQuery,
  ): Prisma.UserWhereInput {
    const baseWhere: Prisma.UserWhereInput = {
      id: { not: query.requesterId },
      organizationNode: {
        descendantRelations: {
          some: {
            ancestor: {
              permissions: {
                some: {
                  userId: query.requesterId,
                  isActive: true,
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
              },
            },
          },
        },
      },
    };

    if (query.filters?.isActive !== undefined) {
      baseWhere.isActive = query.filters.isActive;
    }

    if (query.filters?.organizationNodeIds?.length) {
      baseWhere.organizationNodeId = {
        in: [...query.filters.organizationNodeIds],
      };
    }

    if (query.filters?.searchTerm) {
      const searchTerm = query.filters.searchTerm;
      baseWhere.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    return baseWhere;
  }

  private mapPrismaUserResult(user: any): AccessibleUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationNodeId: user.organizationNodeId,
      organizationNodeName: user.organizationNode?.name || "",
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }


  private async getAccessibleUsersOptimized(
    query: GetAccessibleUsersQuery,
    offset: number,
    limit: number,
  ): Promise<any[]> {
    const params = [query.requesterId, query.requesterId];
    let filterClause = "";

    if (query.filters?.isActive !== undefined) {
      params.push(query.filters.isActive);
      filterClause += " AND u2.is_active = $" + params.length;
    }

    if (query.filters?.organizationNodeIds?.length) {
      const placeholders = query.filters.organizationNodeIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...query.filters.organizationNodeIds);
      filterClause += ` AND u2.organization_node_id IN (${placeholders})`;
    }

    if (query.filters?.searchTerm) {
      params.push(`%${query.filters.searchTerm}%`, `%${query.filters.searchTerm}%`);
      filterClause += ` AND (u2.name ILIKE $${params.length - 1} OR u2.email ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const sql = `
      SELECT DISTINCT
        u2.id,
        u2.email,
        u2.name,
        u2.organization_node_id,
        on2.name as organization_node_name,
        u2.is_active,
        u2.last_login_at,
        u2.created_at,
        u2.updated_at
      FROM users u1
      JOIN user_permissions up ON u1.id = up.user_id
      JOIN node_hierarchies nh ON up.node_id = nh.ancestor_id
      JOIN users u2 ON u2.organization_node_id = nh.descendant_id
      JOIN organization_nodes on2 ON u2.organization_node_id = on2.id
      WHERE u1.id = $1
        AND u2.id != $2
        AND up.is_active = true
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
        ${filterClause}
      ORDER BY u2.name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    return await dbRead.$queryRawUnsafe(sql, ...params);
  }

  private async getAccessibleUsersCount(query: GetAccessibleUsersQuery): Promise<any[]> {
    const params = [query.requesterId, query.requesterId];
    let filterClause = "";

    if (query.filters?.isActive !== undefined) {
      params.push(query.filters.isActive);
      filterClause += " AND u2.is_active = $" + params.length;
    }

    if (query.filters?.organizationNodeIds?.length) {
      const placeholders = query.filters.organizationNodeIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...query.filters.organizationNodeIds);
      filterClause += ` AND u2.organization_node_id IN (${placeholders})`;
    }

    if (query.filters?.searchTerm) {
      params.push(`%${query.filters.searchTerm}%`, `%${query.filters.searchTerm}%`);
      filterClause += ` AND (u2.name ILIKE $${params.length - 1} OR u2.email ILIKE $${params.length})`;
    }

    const sql = `
      SELECT COUNT(DISTINCT u2.id) as total
      FROM users u1
      JOIN user_permissions up ON u1.id = up.user_id
      JOIN node_hierarchies nh ON up.node_id = nh.ancestor_id
      JOIN users u2 ON u2.organization_node_id = nh.descendant_id
      WHERE u1.id = $1
        AND u2.id != $2
        AND up.is_active = true
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
        ${filterClause}
    `;

    return await dbRead.$queryRawUnsafe(sql, ...params);
  }

  private mapRawUserResult(user: any): AccessibleUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationNodeId: user.organization_node_id,
      organizationNodeName: user.organization_node_name || "",
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async refreshMaterializedView(userId: string): Promise<void> {
    await db.materializedViewStatus.upsert({
      where: { userId },
      update: {
        isStale: false,
        lastRefreshed: new Date(),
        refreshCount: { increment: 1 },
      },
      create: {
        userId,
        isStale: false,
        lastRefreshed: new Date(),
        refreshCount: 1,
      },
    });
  }
}
