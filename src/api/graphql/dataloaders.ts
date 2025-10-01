// GraphQL DataLoader Implementation for Query Batching

import DataLoader from 'dataloader';
import { dbRead } from '../../shared/infrastructure/database';
import { User, OrganizationNode, UserPermission } from '../../generated/prisma';

export interface DataLoaders {
  userById: DataLoader<string, User | null>;
  organizationNodeById: DataLoader<string, OrganizationNode | null>;
  userPermissionsByUserId: DataLoader<string, UserPermission[]>;
  organizationNodesByParentId: DataLoader<string, OrganizationNode[]>;
  usersByOrganizationNodeId: DataLoader<string, User[]>;
}

export function createDataLoaders(): DataLoaders {
  return {
    userById: new DataLoader<string, User | null>(
      async (userIds) => {
        const users = await dbRead.user.findMany({
          where: { id: { in: [...userIds] } },
        });

        const userMap = new Map(users.map(user => [user.id, user]));
        return userIds.map(id => userMap.get(id) || null);
      },
      {
        maxBatchSize: 100,
        cacheKeyFn: (key) => key,
      }
    ),

    organizationNodeById: new DataLoader<string, OrganizationNode | null>(
      async (nodeIds) => {
        const nodes = await dbRead.organizationNode.findMany({
          where: { id: { in: [...nodeIds] } },
        });

        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        return nodeIds.map(id => nodeMap.get(id) || null);
      },
      {
        maxBatchSize: 100,
        cacheKeyFn: (key) => key,
      }
    ),

    userPermissionsByUserId: new DataLoader<string, UserPermission[]>(
      async (userIds) => {
        const permissions = await dbRead.userPermission.findMany({
          where: {
            userId: { in: [...userIds] },
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          include: {
            node: true,
          }
        });

        const permissionMap = new Map<string, UserPermission[]>();
        permissions.forEach(permission => {
          const existing = permissionMap.get(permission.userId) || [];
          existing.push(permission);
          permissionMap.set(permission.userId, existing);
        });

        return userIds.map(id => permissionMap.get(id) || []);
      },
      {
        maxBatchSize: 50,
        cacheKeyFn: (key) => key,
      }
    ),

    organizationNodesByParentId: new DataLoader<string, OrganizationNode[]>(
      async (parentIds) => {
        const nodes = await dbRead.organizationNode.findMany({
          where: { parentId: { in: [...parentIds] } },
          orderBy: { name: 'asc' }
        });

        const nodeMap = new Map<string, OrganizationNode[]>();
        nodes.forEach(node => {
          if (node.parentId) {
            const existing = nodeMap.get(node.parentId) || [];
            existing.push(node);
            nodeMap.set(node.parentId, existing);
          }
        });

        return parentIds.map(id => nodeMap.get(id) || []);
      },
      {
        maxBatchSize: 50,
        cacheKeyFn: (key) => key,
      }
    ),

    usersByOrganizationNodeId: new DataLoader<string, User[]>(
      async (nodeIds) => {
        const users = await dbRead.user.findMany({
          where: {
            organizationNodeId: { in: [...nodeIds] },
            isActive: true
          },
          orderBy: { name: 'asc' }
        });

        const userMap = new Map<string, User[]>();
        users.forEach(user => {
          const existing = userMap.get(user.organizationNodeId) || [];
          existing.push(user);
          userMap.set(user.organizationNodeId, existing);
        });

        return nodeIds.map(id => userMap.get(id) || []);
      },
      {
        maxBatchSize: 50,
        cacheKeyFn: (key) => key,
      }
    ),
  };
}

// Batch loader for accessible users with caching
export function createAccessibleUsersLoader() {
  return new DataLoader<
    { userId: string; organizationNodeIds?: string[]; searchTerm?: string },
    { id: string; name: string; email: string; organizationNodeId: string }[]
  >(
    async (queries) => {
      // Group queries by similar parameters for efficient batching
      const results = await Promise.all(
        queries.map(async (query) => {
          const { userId, organizationNodeIds, searchTerm } = query;

          let filterClause = '';
          const params = [userId];

          if (organizationNodeIds?.length) {
            const placeholders = organizationNodeIds.map((_, i) => `$${params.length + i + 1}`).join(',');
            params.push(...organizationNodeIds);
            filterClause += ` AND target_node_id IN (${placeholders})`;
          }

          if (searchTerm) {
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
            filterClause += ` AND (target_name ILIKE $${params.length - 1} OR target_email ILIKE $${params.length})`;
          }

          const users = await dbRead.$queryRawUnsafe(`
            SELECT DISTINCT
              target_user_id as id,
              target_name as name,
              target_email as email,
              target_node_id as organization_node_id
            FROM user_accessible_hierarchy
            WHERE requester_id = $1
              ${filterClause}
            ORDER BY target_name ASC
            LIMIT 100
          `, ...params);

          return (users as { id: string; name: string; email: string; organization_node_id: string }[]).map(user => ({
            ...user,
            organizationNodeId: user.organization_node_id
          }));
        })
      );

      return results;
    },
    {
      maxBatchSize: 10,
      cacheKeyFn: (key) => key,
    }
  );
}

// Clear all DataLoader caches (useful for testing or after data mutations)
export function clearDataLoaderCaches(dataLoaders: DataLoaders): void {
  Object.values(dataLoaders).forEach(loader => loader.clearAll());
}

export default DataLoader;