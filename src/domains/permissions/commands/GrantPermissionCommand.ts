// Grant Permission Command

import {
  PermissionId,
  UserId,
  NodeId,
  PermissionType,
} from "../../../shared/types";

export interface GrantPermissionCommand {
  id: PermissionId;
  userId: UserId;
  nodeId: NodeId;
  permissionType: PermissionType;
  grantedById: UserId;
  expiresAt?: Date;
}

export interface GrantPermissionResult {
  success: boolean;
  permissionId?: PermissionId;
  error?: string;
  code?: string;
}
