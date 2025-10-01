// Grant Permission Command Handler

import { Permission } from "../entities/Permission";
import {
  GrantPermissionCommand,
  GrantPermissionResult,
} from "./GrantPermissionCommand";
import {
  db,
  DatabaseConnection,
} from "../../../shared/infrastructure/database";
import {
  DomainError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../../shared/types";
import { nanoid } from "nanoid";

export class GrantPermissionHandler {
  async handle(
    command: GrantPermissionCommand,
  ): Promise<GrantPermissionResult> {
    try {
      if (!command.userId || command.userId.trim() === '') {
        throw new ValidationError("userId is required", { code: "VALIDATION_ERROR" });
      }

      if (!command.nodeId || command.nodeId.trim() === '') {
        throw new ValidationError("nodeId is required", { code: "VALIDATION_ERROR" });
      }

      if (!command.grantedById || command.grantedById.trim() === '') {
        throw new ValidationError("grantedById is required", { code: "VALIDATION_ERROR" });
      }

      if (!command.permissionType || !['READ', 'MANAGE', 'ADMIN'].includes(command.permissionType)) {
        throw new ValidationError("Valid permission type is required", { code: "VALIDATION_ERROR" });
      }

      if (command.expiresAt && command.expiresAt <= new Date()) {
        throw new ValidationError("Expiration date must be in the future", { code: "VALIDATION_ERROR" });
      }

      if (command.userId === command.grantedById) {
        throw new DomainError("Cannot grant permission to yourself", "SELF_GRANT_FORBIDDEN", {});
      }

      return await DatabaseConnection.transaction(async (prisma) => {
        const user = await prisma.user.findUnique({
          where: { id: command.userId },
          include: { organizationNode: true },
        });

        if (!user) {
          throw new NotFoundError("User", command.userId);
        }

        if (!user.isActive) {
          throw new DomainError(
            "Cannot grant permission to inactive user",
            "USER_INACTIVE",
          );
        }

        const node = await prisma.organizationNode.findUnique({
          where: { id: command.nodeId },
        });

        if (!node) {
          throw new NotFoundError("Organization node", command.nodeId);
        }

        if (!node.isActive) {
          throw new DomainError(
            "Cannot grant permission for inactive organization node",
            "NODE_INACTIVE",
          );
        }

        const granter = await prisma.user.findUnique({
          where: { id: command.grantedById },
          include: {
            permissions: {
              where: {
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              include: {
                node: true,
              },
            },
          },
        });

        if (!granter) {
          throw new NotFoundError("Granter", command.grantedById);
        }

        const hasAuthority = await this.checkGranterAuthority(
          command.grantedById,
          command.nodeId,
          command.permissionType,
          prisma,
        );

        if (!hasAuthority) {
          throw new DomainError(
            "Granter does not have authority to grant this permission",
            "INSUFFICIENT_AUTHORITY",
          );
        }

        const existingPermission = await prisma.userPermission.findFirst({
          where: {
            userId: command.userId,
            nodeId: command.nodeId,
            permissionType: command.permissionType,
            isActive: true,
          },
        });

        if (existingPermission) {
          throw new ConflictError(
            "User already has this permission for this node",
            { existingPermissionId: existingPermission.id },
          );
        }

        const permission = Permission.create({
          id: command.id,
          userId: command.userId,
          nodeId: command.nodeId,
          permissionType: command.permissionType,
          grantedById: command.grantedById,
          expiresAt: command.expiresAt,
          isActive: true,
        });

        await prisma.userPermission.create({
          data: {
            id: permission.id,
            userId: permission.userId,
            nodeId: permission.nodeId,
            permissionType: permission.permissionType,
            grantedById: permission.grantedById,
            grantedAt: permission.grantedAt,
            expiresAt: permission.expiresAt,
            isActive: permission.isActive,
          },
        });

        await prisma.domainEvent.create({
          data: {
            id: nanoid(),
            aggregateId: permission.id,
            eventType: "PermissionGranted",
            eventData: JSON.stringify({
              permissionId: permission.id,
              userId: permission.userId,
              nodeId: permission.nodeId,
              permissionType: permission.permissionType,
              grantedById: permission.grantedById,
              grantedAt: permission.grantedAt.toISOString(),
              expiresAt: permission.expiresAt?.toISOString(),
            }),
            version: 1,
            occurredAt: new Date(),
            userId: command.grantedById,
          },
        });

        await prisma.materializedViewStatus.upsert({
          where: { userId: command.userId },
          update: { isStale: true },
          create: {
            userId: command.userId,
            isStale: true,
            lastRefreshed: new Date(),
            refreshCount: 0,
          },
        });

        return {
          success: true,
          permissionId: permission.id,
        };
      });
    } catch (error) {
      console.error("Error granting permission:", error);

      if (error instanceof DomainError) {
        return {
          success: false,
          error: error.message,
          code: error.code,
        };
      }

      return {
        success: false,
        error: "An unexpected error occurred while granting permission",
        code: "INTERNAL_ERROR",
      };
    }
  }

  private async checkGranterAuthority(
    granterId: string,
    targetNodeId: string,
    permissionType: string,
    prisma: any,
  ): Promise<boolean> {
    const granterPermissions = await prisma.userPermission.findMany({
      where: {
        userId: granterId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        permissionType: {
          in: ["ADMIN", "MANAGE"],
        },
      },
      include: {
        node: true,
      },
    });

    for (const permission of granterPermissions) {
      const isAncestor = await prisma.nodeHierarchy.findFirst({
        where: {
          ancestorId: permission.nodeId,
          descendantId: targetNodeId,
        },
      });

      if (isAncestor || permission.nodeId === targetNodeId) {
        if (permission.permissionType === "ADMIN") {
          return true;
        }
        if (
          permission.permissionType === "MANAGE" &&
          permissionType === "READ"
        ) {
          return true;
        }
      }
    }

    return false;
  }
}
