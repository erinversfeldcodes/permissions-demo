// GraphQL Resolvers

import { DateTimeResolver, JSONResolver } from "graphql-scalars";
import { db } from "../../../shared/infrastructure/database";
import { GrantPermissionHandler } from "../../../domains/permissions/commands/GrantPermissionHandler";
import { GetAccessibleUsersHandler } from "../../../domains/access-query/queries/GetAccessibleUsersHandler";
import { GrantPermissionCommand } from "../../../domains/permissions/commands/GrantPermissionCommand";
import { GetAccessibleUsersQuery } from "../../../domains/access-query/queries/GetAccessibleUsersQuery";
import { ConsistencyLevel, PermissionType } from "../../../shared/types";
import { nanoid } from "nanoid";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

import {
  GraphQLContext,
  UserArgs,
  UsersArgs,
  AccessibleUsersArgs,
  CanUserAccessArgs,
  OrganizationNodeArgs,
  OrganizationTreeArgs,
  LoginArgs,
  CreateUserArgs,
  GrantPermissionArgs,
  RevokePermissionArgs,
  BulkGrantPermissionsArgs,
  BulkRevokePermissionsArgs,
  UserResponse,
  AuthResponse,
  CreateUserResponse,
  GrantPermissionResponse,
  RevokePermissionResponse,
  BulkGrantPermissionResponse,
  BulkRevokePermissionResponse,
  UsersConnection,
  AccessCheckResponse,
  OrganizationNodeResponse,
  PermissionResponse,
} from "../types/index";
import {
  validateLoginInput,
  validateCreateUserInput,
  validateGrantPermissionInput,
  validateRevokePermissionInput,
  validateBulkGrantPermissionInput,
  validateBulkRevokePermissionInput,
} from "../validators/index";
import { mapAppErrorToGraphQLError } from "../../../shared/utils/result";

const grantPermissionHandler = new GrantPermissionHandler();
const getAccessibleUsersHandler = new GetAccessibleUsersHandler();

export const resolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,

  Query: {
    me: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext,
    ): Promise<UserResponse> => {
      if (!context.isAuthenticated || !context.userId) {
        throw new Error("Authentication required");
      }

      const user = await context.dataloaders.userById.load(context.userId);
      if (!user) {
        throw new Error("User not found");
      }

      const [organizationNode, permissions] = await Promise.all([
        context.dataloaders.organizationNodeById.load(user.organizationNodeId),
        context.dataloaders.userPermissionsByUserId.load(context.userId)
      ]);

      if (!user) {
        throw new Error("User not found");
      }

      // Enrich permissions with additional data if needed
      const enrichedPermissions = await Promise.all(
        permissions.map(async (permission) => {
          return enrichPermission(permission);
        })
      );

      return enrichUser({
        ...user,
        organizationNode,
        permissions: enrichedPermissions
      });
    },

    user: async (
      _: unknown,
      args: UserArgs,
      context: GraphQLContext,
    ): Promise<UserResponse | null> => {
      const { id } = args;
      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      const canAccess = await checkUserAccess(context.userId!, id);
      if (!canAccess) {
        throw new Error("Insufficient permissions to access this user");
      }

      const user = await db.user.findUnique({
        where: { id },
        include: {
          organizationNode: true,
          permissions: {
            where: { isActive: true },
            include: { node: true, grantedBy: true },
          },
        },
      });

      return user ? enrichUser({...user, permissions: user.permissions.map(enrichPermission)}) : null;
    },

    users: async (
      _: unknown,
      args: UsersArgs,
      context: GraphQLContext,
    ): Promise<UsersConnection> => {
      const {
        filter,
        consistencyLevel = ConsistencyLevel.EVENTUAL,
        first = 20,
        after,
      } = args;

      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      // Resolver-level pagination limit validation
      if (first && first > 50) {
        throw new Error("Maximum limit is 50 items for users query. Please use pagination for larger datasets.");
      }

      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const query: GetAccessibleUsersQuery = {
        requesterId: context.userId!,
        consistencyLevel,
        pagination: { offset, limit: first },
        filters: filter,
      };

      const result = await getAccessibleUsersHandler.handle(query);

      return {
        edges: result.users.map((user, index) => ({
          node: enrichUser(user),
          cursor: Buffer.from((offset + index + 1).toString()).toString(
            "base64",
          ),
        })),
        pageInfo: {
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          startCursor:
            result.users.length > 0
              ? Buffer.from(offset.toString()).toString("base64")
              : null,
          endCursor:
            result.users.length > 0
              ? Buffer.from((offset + result.users.length).toString()).toString(
                  "base64",
                )
              : null,
        },
        totalCount: result.totalCount,
        dataSource: result.dataSource,
        lastUpdated: result.lastUpdated,
        executionTimeMs: result.executionTime,
      };
    },

    accessibleUsers: async (
      _: unknown,
      args: AccessibleUsersArgs,
      context: GraphQLContext,
    ): Promise<UsersConnection> => {
      const {
        input: {
          consistencyLevel = ConsistencyLevel.EVENTUAL,
          filter,
          first = 20,
          after,
        }
      } = args;

      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      // Resolver-level pagination limit validation
      if (first && first > 100) {
        throw new Error("Maximum limit is 100 items. Please use pagination for larger datasets.");
      }

      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const query: GetAccessibleUsersQuery = {
        requesterId: context.userId!,
        consistencyLevel,
        pagination: { offset, limit: first },
        filters: filter,
      };

      const result = await getAccessibleUsersHandler.handle(query);

      return {
        edges: result.users.map((user, index) => ({
          node: enrichUser(user),
          cursor: Buffer.from((offset + index + 1).toString()).toString(
            "base64",
          ),
        })),
        pageInfo: {
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          startCursor:
            result.users.length > 0
              ? Buffer.from(offset.toString()).toString("base64")
              : null,
          endCursor:
            result.users.length > 0
              ? Buffer.from((offset + result.users.length).toString()).toString(
                  "base64",
                )
              : null,
        },
        totalCount: result.totalCount,
        dataSource: result.dataSource,
        lastUpdated: result.lastUpdated,
        executionTimeMs: result.executionTime,
      };
    },

    canUserAccess: async (
      _: unknown,
      args: CanUserAccessArgs,
      context: GraphQLContext,
    ): Promise<boolean> => {
      const {
        requesterId,
        targetId,
        consistencyLevel = ConsistencyLevel.STRONG,
      } = args;
      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      const canAccess = await checkUserAccess(requesterId, targetId);

      return canAccess;
    },

    organizationNode: async (
      _: unknown,
      args: OrganizationNodeArgs,
      context: GraphQLContext,
    ): Promise<OrganizationNodeResponse | null> => {
      const { id } = args;
      const node = await context.dataloaders.organizationNodeById.load(id);
      if (!node) return null;

      const [parent, children, users] = await Promise.all([
        node.parentId ? context.dataloaders.organizationNodeById.load(node.parentId) : null,
        context.dataloaders.organizationNodesByParentId.load(id),
        context.dataloaders.usersByOrganizationNodeId.load(id)
      ]);

      return {
        ...node,
        parent,
        children,
        users
      };
    },

    organizationTree: async (
      _: unknown,
      args: OrganizationTreeArgs,
    ): Promise<ReadonlyArray<OrganizationNodeResponse>> => {
      const { rootId, includeInactive = false } = args;
      const whereClause: Record<string, unknown> = {
        isActive: includeInactive ? undefined : true,
      };

      if (rootId) {
        whereClause.id = rootId;
      }

      return await db.organizationNode.findMany({
        where: whereClause,
        include: {
          parent: true,
          children: true,
        },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      });
    },
  },

  Mutation: {
    login: async (_: unknown, args: LoginArgs): Promise<AuthResponse> => {
      const validationResult = validateLoginInput(args.input);
      if (!validationResult.success) {
        throw new Error(validationResult.error!.message);
      }

      const { input } = args;
      const user = await db.user.findUnique({
        where: { email: input.email.toLowerCase() },
        include: { organizationNode: true },
      });

      if (!user || !user.passwordHash) {
        throw new Error("Invalid credentials");
      }

      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new Error("Invalid credentials");
      }

      if (!user.isActive) {
        throw new Error("Account is deactivated");
      }

      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" },
      );

      return {
        token,
        user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    },

    grantPermission: async (
      _: unknown,
      args: GrantPermissionArgs,
      context: GraphQLContext,
    ): Promise<GrantPermissionResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const validationResult = validateGrantPermissionInput(args.input);
      if (!validationResult.success) {
        return {
          success: false,
          errors: [mapAppErrorToGraphQLError(validationResult.error!)],
        };
      }

      const { input } = args;
      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      const command: GrantPermissionCommand = {
        id: nanoid(),
        userId: input.userId,
        nodeId: input.nodeId,
        permissionType: input.permissionType,
        grantedById: context.userId!,
        expiresAt: input.expiresAt,
      };

      const result = await grantPermissionHandler.handle(command);

      if (!result.success) {
        return {
          success: false,
          errors: [
            {
              message: result.error || "Permission grant failed",
              code: result.code || "GRANT_FAILED",
            },
          ],
        };
      }

      const permission = await db.userPermission.findUnique({
        where: { id: result.permissionId },
        include: {
          user: true,
          node: true,
          grantedBy: true,
        },
      });

      return {
        success: true,
        permission: permission ? enrichPermission(permission) : undefined,
        errors: [],
      };
    },

    createUser: async (
      _: unknown,
      args: CreateUserArgs,
      context: GraphQLContext,
    ): Promise<CreateUserResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const validationResult = validateCreateUserInput(args.input);
      if (!validationResult.success) {
        return {
          success: false,
          errors: [mapAppErrorToGraphQLError(validationResult.error!)],
        };
      }

      const { input } = args;
      if (!context.isAuthenticated) {
        throw new Error("Authentication required");
      }

      try {
        const passwordHash = await bcrypt.hash(input.password, 12);

        const user = await db.user.create({
          data: {
            id: nanoid(),
            email: input.email.toLowerCase(),
            name: input.name,
            passwordHash,
            organizationNodeId: input.organizationNodeId,
            isActive: true,
          },
          include: {
            organizationNode: true,
          },
        });

        return {
          success: true,
          user: user as any as UserResponse,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to create user");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to create user",
              code: "CREATE_USER_FAILED",
            },
          ],
        };
      }
    },

    updateUser: async (
      _: unknown,
      args: { id: string; input: any },
      context: GraphQLContext,
    ): Promise<CreateUserResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { id, input } = args;

      try {
        // Check if user exists
        const existingUser = await db.user.findUnique({
          where: { id },
          include: { organizationNode: true },
        });

        if (!existingUser) {
          return {
            success: false,
            errors: [
              {
                message: "User not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        // Update user
        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.email) updateData.email = input.email.toLowerCase();
        if (input.organizationNodeId) updateData.organizationNodeId = input.organizationNodeId;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const user = await db.user.update({
          where: { id },
          data: updateData,
          include: {
            organizationNode: true,
          },
        });

        return {
          success: true,
          user: user as any as UserResponse,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to update user");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to update user",
              code: "UPDATE_USER_FAILED",
            },
          ],
        };
      }
    },

    createOrganizationNode: async (
      _: unknown,
      args: { input: any },
      context: GraphQLContext,
    ): Promise<{ success: boolean; node?: any; errors: any[] }> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { input } = args;

      try {
        // Calculate level based on parent
        let level = 0;
        if (input.parentId) {
          const parent = await db.organizationNode.findUnique({
            where: { id: input.parentId },
          });
          if (!parent) {
            return {
              success: false,
              errors: [
                {
                  message: "Parent organization node not found",
                  code: "PARENT_NOT_FOUND",
                },
              ],
            };
          }
          level = parent.level + 1;
        }

        const node = await db.organizationNode.create({
          data: {
            id: nanoid(),
            name: input.name,
            parentId: input.parentId || null,
            level,
            metadata: input.metadata || {},
            isActive: true,
          },
          include: {
            parent: true,
            children: true,
          },
        });

        // Update closure table if parent exists
        if (input.parentId) {
          // Add self-reference
          await db.nodeHierarchy.create({
            data: {
              ancestorId: node.id,
              descendantId: node.id,
              depth: 0,
            },
          });

          // Add relationships with all ancestors
          const ancestors = await db.nodeHierarchy.findMany({
            where: { descendantId: input.parentId },
          });

          for (const ancestor of ancestors) {
            await db.nodeHierarchy.create({
              data: {
                ancestorId: ancestor.ancestorId,
                descendantId: node.id,
                depth: ancestor.depth + 1,
              },
            });
          }
        } else {
          // Root node - only self-reference
          await db.nodeHierarchy.create({
            data: {
              ancestorId: node.id,
              descendantId: node.id,
              depth: 0,
            },
          });
        }

        return {
          success: true,
          node,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to create organization node");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to create organization node",
              code: "CREATE_NODE_FAILED",
            },
          ],
        };
      }
    },

    updateOrganizationNode: async (
      _: unknown,
      args: { id: string; input: any },
      context: GraphQLContext,
    ): Promise<{ success: boolean; node?: any; errors: any[] }> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { id, input } = args;

      try {
        // Check if node exists
        const existingNode = await db.organizationNode.findUnique({
          where: { id },
        });

        if (!existingNode) {
          return {
            success: false,
            errors: [
              {
                message: "Organization node not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        // Update node
        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.metadata !== undefined) updateData.metadata = input.metadata;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        // Handle parent change if provided
        if (input.parentId !== undefined && input.parentId !== existingNode.parentId) {
          let newLevel = 0;
          if (input.parentId) {
            const parent = await db.organizationNode.findUnique({
              where: { id: input.parentId },
            });
            if (!parent) {
              return {
                success: false,
                errors: [
                  {
                    message: "New parent organization node not found",
                    code: "PARENT_NOT_FOUND",
                  },
                ],
              };
            }
            newLevel = parent.level + 1;
          }
          updateData.parentId = input.parentId;
          updateData.level = newLevel;

          // TODO: Update closure table relationships for hierarchy changes
          // This is complex and would require rebuilding closure table paths
        }

        const node = await db.organizationNode.update({
          where: { id },
          data: updateData,
          include: {
            parent: true,
            children: true,
          },
        });

        return {
          success: true,
          node,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to update organization node");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to update organization node",
              code: "UPDATE_NODE_FAILED",
            },
          ],
        };
      }
    },

    deleteUser: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext,
    ): Promise<CreateUserResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { id } = args;

      try {
        // Check if user exists
        const existingUser = await db.user.findUnique({
          where: { id },
          include: { organizationNode: true },
        });

        if (!existingUser) {
          return {
            success: false,
            errors: [
              {
                message: "User not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        // Soft delete user
        const user = await db.user.update({
          where: { id },
          data: {
            isActive: false,
            // Could add deletedAt timestamp if schema supports it
          },
          include: {
            organizationNode: true,
          },
        });

        // Deactivate user's permissions
        await db.userPermission.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });

        return {
          success: true,
          user: user as any as UserResponse,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to delete user");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to delete user",
              code: "DELETE_USER_FAILED",
            },
          ],
        };
      }
    },

    deleteOrganizationNode: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext,
    ): Promise<{ success: boolean; node?: any; errors: any[] }> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { id } = args;

      try {
        // Check if node exists
        const existingNode = await db.organizationNode.findUnique({
          where: { id },
          include: { children: true, users: true },
        });

        if (!existingNode) {
          return {
            success: false,
            errors: [
              {
                message: "Organization node not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        // Check if node has children or users
        if (existingNode.children.length > 0) {
          return {
            success: false,
            errors: [
              {
                message: "Cannot delete organization node with child nodes",
                code: "HAS_CHILDREN",
              },
            ],
          };
        }

        if (existingNode.users.length > 0) {
          return {
            success: false,
            errors: [
              {
                message: "Cannot delete organization node with users",
                code: "HAS_USERS",
              },
            ],
          };
        }

        // Soft delete node
        const node = await db.organizationNode.update({
          where: { id },
          data: {
            isActive: false,
            // Could add deletedAt timestamp if schema supports it
          },
          include: {
            parent: true,
            children: true,
          },
        });

        return {
          success: true,
          node,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to delete organization node");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to delete organization node",
              code: "DELETE_NODE_FAILED",
            },
          ],
        };
      }
    },

    updatePermission: async (
      _: unknown,
      args: { id: string; input: any },
      context: GraphQLContext,
    ): Promise<GrantPermissionResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const { id, input } = args;

      try {
        // Check if permission exists
        const existingPermission = await db.userPermission.findUnique({
          where: { id },
          include: {
            user: true,
            node: true,
            grantedBy: true,
          },
        });

        if (!existingPermission) {
          return {
            success: false,
            errors: [
              {
                message: "Permission not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        // Update permission
        const updateData: any = {};
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt;

        const permission = await db.userPermission.update({
          where: { id },
          data: updateData,
          include: {
            user: true,
            node: true,
            grantedBy: true,
          },
        });

        return {
          success: true,
          permission: permission ? enrichPermission(permission) : undefined,
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error("Failed to update permission");
        return {
          success: false,
          errors: [
            {
              message: appError.message || "Failed to update permission",
              code: "UPDATE_PERMISSION_FAILED",
            },
          ],
        };
      }
    },

    revokePermission: async (
      _: unknown,
      args: RevokePermissionArgs,
      context: GraphQLContext,
    ): Promise<RevokePermissionResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const permissionId = args.id;

      try {
        const permission = await db.userPermission.findUnique({
          where: { id: permissionId },
          include: {
            user: true,
            node: true,
          },
        });

        if (!permission) {
          return {
            success: false,
            revokedAt: undefined,
            errors: [
              {
                message: "Permission not found",
                code: "NOT_FOUND",
              },
            ],
          };
        }

        const currentUser = await db.user.findUnique({
          where: { id: context.userId! },
          include: {
            permissions: {
              where: { isActive: true },
            },
          },
        });

        const hasAdminPermission = currentUser?.permissions.some(
          (p) => p.permissionType === PermissionType.ADMIN,
        );

        if (!hasAdminPermission && permission.grantedById !== context.userId) {
          return {
            success: false,
            revokedAt: undefined,
            errors: [
              {
                message: "Insufficient permissions to revoke this permission",
                code: "INSUFFICIENT_PERMISSIONS",
              },
            ],
          };
        }

        const updatedPermission = await db.userPermission.update({
          where: { id: permissionId },
          data: { isActive: false },
          include: {
            user: true,
            node: true,
            grantedBy: true,
          },
        });

        return {
          success: true,
          revokedAt: new Date(),
          errors: [],
        };
      } catch (error) {
        const appError =
          error instanceof Error
            ? error
            : new Error("Failed to revoke permission");
        return {
          success: false,
          revokedAt: undefined,
          errors: [
            {
              message: appError.message || "Failed to revoke permission",
              code: "REVOKE_PERMISSION_FAILED",
            },
          ],
        };
      }
    },

    bulkGrantPermissions: async (
      _: unknown,
      args: BulkGrantPermissionsArgs,
      context: GraphQLContext,
    ): Promise<BulkGrantPermissionResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          results: [],
          successCount: 0,
          failureCount: 1,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const validationResult = validateBulkGrantPermissionInput(args.input);
      if (!validationResult.success) {
        return {
          success: false,
          results: [],
          successCount: 0,
          failureCount: 1,
          errors: [mapAppErrorToGraphQLError(validationResult.error!)],
        };
      }

      const {
        input: { grants },
      } = args;
      const results: GrantPermissionResponse[] = [];

      for (const input of grants) {
        const command: GrantPermissionCommand = {
          id: nanoid(),
          userId: input.userId,
          nodeId: input.nodeId,
          permissionType: input.permissionType,
          grantedById: context.userId!,
          expiresAt: input.expiresAt,
        };

        const result = await grantPermissionHandler.handle(command);

        if (!result.success) {
          results.push({
            success: false,
            errors: [
              {
                message: result.error!,
                code: result.code!,
              },
            ],
          });
        } else {
          const permission = await db.userPermission.findUnique({
            where: { id: result.permissionId },
            include: {
              user: true,
              node: true,
              grantedBy: true,
            },
          });

          results.push({
            success: true,
            permission: permission ? enrichPermission(permission) : undefined,
            errors: [],
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        success: successCount > 0,
        results,
        successCount,
        failureCount,
        errors: [],
      };
    },

    bulkRevokePermissions: async (
      _: unknown,
      args: BulkRevokePermissionsArgs,
      context: GraphQLContext,
    ): Promise<BulkRevokePermissionResponse> => {
      if (!context.isAuthenticated) {
        return {
          success: false,
          results: [],
          successCount: 0,
          failureCount: 1,
          errors: [
            {
              message: "Authentication required",
              code: "UNAUTHENTICATED",
            },
          ],
        };
      }

      const validationResult = validateBulkRevokePermissionInput(args.input);
      if (!validationResult.success) {
        return {
          success: false,
          results: [],
          successCount: 0,
          failureCount: 1,
          errors: [mapAppErrorToGraphQLError(validationResult.error!)],
        };
      }

      const {
        input: { permissionIds },
      } = args;
      const results: RevokePermissionResponse[] = [];

      for (const id of permissionIds) {
        try {
          const permission = await db.userPermission.findUnique({
            where: { id },
            include: {
              user: true,
              node: true,
            },
          });

          if (!permission) {
            results.push({
              success: false,
              errors: [
                {
                  message: "Permission not found",
                  code: "NOT_FOUND",
                },
              ],
            });
            continue;
          }

          const currentUser = await db.user.findUnique({
            where: { id: context.userId! },
            include: {
              permissions: {
                where: { isActive: true },
              },
            },
          });

          const hasAdminPermission = currentUser?.permissions.some(
            (p) => p.permissionType === PermissionType.ADMIN,
          );

          if (
            !hasAdminPermission &&
            permission.grantedById !== context.userId
          ) {
            results.push({
              success: false,
              errors: [
                {
                  message: "Insufficient permissions to revoke this permission",
                  code: "INSUFFICIENT_PERMISSIONS",
                },
              ],
            });
            continue;
          }

          await db.userPermission.update({
            where: { id },
            data: { isActive: false },
          });

          results.push({
            success: true,
            revokedAt: new Date(),
            errors: [],
          });
        } catch (error) {
          const appError =
            error instanceof Error
              ? error
              : new Error("Failed to revoke permission");
          results.push({
            success: false,
            errors: [
              {
                message: appError.message || "Failed to revoke permission",
                code: "REVOKE_PERMISSION_FAILED",
              },
            ],
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        success: successCount > 0,
        results,
        successCount,
        failureCount,
        errors: [],
      };
    },
  },

  User: {
    organizationNode: async (
      parent: UserResponse,
    ): Promise<OrganizationNodeResponse | null> => {
      if (
        parent.organizationNode &&
        typeof parent.organizationNode === "object"
      ) {
        return parent.organizationNode;
      }

      if (parent.organizationNodeId) {
        const nodeId = parent.organizationNodeId;
        return await db.organizationNode.findUnique({
          where: { id: nodeId },
        });
      }

      return null;
    },

    accessibleUsers: async (
      parent: UserResponse,
      args: AccessibleUsersArgs,
    ): Promise<UsersConnection> => {
      const {
        input: {
          consistencyLevel = ConsistencyLevel.EVENTUAL,
          first = 20,
          after,
        },
      } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const query: GetAccessibleUsersQuery = {
        requesterId: parent.id,
        consistencyLevel,
        pagination: { offset, limit: first },
      };

      const result = await getAccessibleUsersHandler.handle(query);

      return {
        edges: result.users.map((user, index) => ({
          node: enrichUser(user),
          cursor: Buffer.from((offset + index + 1).toString()).toString(
            "base64",
          ),
        })),
        pageInfo: {
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          startCursor:
            result.users.length > 0
              ? Buffer.from(offset.toString()).toString("base64")
              : null,
          endCursor:
            result.users.length > 0
              ? Buffer.from((offset + result.users.length).toString()).toString(
                  "base64",
                )
              : null,
        },
        totalCount: result.totalCount,
        dataSource: result.dataSource,
        lastUpdated: result.lastUpdated,
        executionTimeMs: result.executionTime,
      };
    },

    accessibleUserCount: async (parent: UserResponse): Promise<number> => {
      const query: GetAccessibleUsersQuery = {
        requesterId: parent.id,
        consistencyLevel: ConsistencyLevel.EVENTUAL,
        pagination: { limit: 1 }, // We only need the count
      };

      const result = await getAccessibleUsersHandler.handle(query);
      return result.totalCount;
    },

    canAccess: async (
      parent: UserResponse,
      { targetUserId }: { targetUserId: string },
    ): Promise<boolean> => {
      return await checkUserAccess(parent.id, targetUserId);
    },

    permissions: async (
      parent: UserResponse,
    ): Promise<ReadonlyArray<PermissionResponse>> => {
      if (parent.permissions && Array.isArray(parent.permissions)) {
        return parent.permissions;
      }

      const permissions = await db.userPermission.findMany({
        where: {
          userId: parent.id,
          isActive: true,
        },
        include: {
          node: true,
          grantedBy: true,
        },
      });

      return permissions.map(permission => enrichPermission(permission));
    },
  },

  Permission: {
    grantedBy: async (parent: PermissionResponse, _args: unknown, context: GraphQLContext): Promise<UserResponse | null> => {
      if (parent.grantedBy) {
        return parent.grantedBy;
      }
      if (parent.grantedById) {
        return await context.dataloaders.userById.load(parent.grantedById);
      }
      return null;
    },
    isEffective: (parent: PermissionResponse): boolean => {
      const now = new Date();
      return parent.isActive && (!parent.expiresAt || parent.expiresAt > now);
    },
  },

  OrganizationNode: {
    children: async (
      parent: OrganizationNodeResponse,
    ): Promise<ReadonlyArray<OrganizationNodeResponse>> => {
      if (parent.children && Array.isArray(parent.children)) {
        return parent.children;
      }

      return await db.organizationNode.findMany({
        where: {
          parentId: parent.id,
          isActive: true,
        },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      });
    },

    parent: async (
      parent: OrganizationNodeResponse,
    ): Promise<OrganizationNodeResponse | null> => {
      if (parent.parent && typeof parent.parent === "object") {
        return parent.parent;
      }

      if (parent.parentId) {
        const parentId = parent.parentId;
        return await db.organizationNode.findUnique({
          where: { id: parentId },
        });
      }

      return null;
    },

    users: async (
      parent: OrganizationNodeResponse,
    ): Promise<ReadonlyArray<UserResponse>> => {
      if (parent.users && Array.isArray(parent.users)) {
        return parent.users;
      }

      return await db.user.findMany({
        where: {
          organizationNodeId: parent.id,
          isActive: true,
        },
        orderBy: { name: "asc" },
      });
    },
  },
};

async function checkUserAccess(
  requesterId: string,
  targetId: string,
): Promise<boolean> {
  if (requesterId === targetId) {
    return true; // Users can always access themselves
  }

  const query: GetAccessibleUsersQuery = {
    requesterId,
    consistencyLevel: ConsistencyLevel.STRONG, // Use strong consistency for access checks
  };

  const result = await getAccessibleUsersHandler.handle(query);
  return result.users.some((user) => user.id === targetId);
}

// Helper function to add computed properties to permission objects
function enrichPermission(permission: any): PermissionResponse {
  const now = new Date();
  return {
    ...permission,
    isEffective: permission.isActive && (!permission.expiresAt || permission.expiresAt > now)
  };
}

// Helper function to convert AccessibleUser to UserResponse
function enrichUser(user: any): UserResponse {
  return {
    ...user,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date()
  };
}

// Re-export GraphQLContext for external use
export type { GraphQLContext };
