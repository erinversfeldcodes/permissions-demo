// Input Types
// All GraphQL input types for mutations and queries

import {
  PermissionType,
  ConsistencyLevel,
} from "../../../shared/types";

// ============================================================================
// AUTHENTICATION INPUTS
// ============================================================================

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

// ============================================================================
// USER MANAGEMENT INPUTS
// ============================================================================

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly organizationNodeId: string;
}

export interface UpdateUserInput {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
  readonly organizationNodeId?: string;
  readonly isActive?: boolean;
}

// ============================================================================
// PERMISSION MANAGEMENT INPUTS
// ============================================================================

export interface GrantPermissionInput {
  readonly userId: string;
  readonly nodeId: string;
  readonly permissionType: PermissionType;
  readonly expiresAt?: Date;
}

export interface RevokePermissionInput {
  readonly permissionId: string;
  readonly reason?: string;
}

export interface BulkGrantPermissionInput {
  readonly grants: ReadonlyArray<GrantPermissionInput>;
}

export interface BulkRevokePermissionInput {
  readonly permissionIds: ReadonlyArray<string>;
  readonly reason?: string;
}

// ============================================================================
// QUERY FILTER INPUTS
// ============================================================================

export interface UserFilterInput {
  readonly email?: string;
  readonly name?: string;
  readonly organizationNodeIds?: ReadonlyArray<string>;
  readonly permissionTypes?: ReadonlyArray<PermissionType>;
  readonly isActive?: boolean;
  readonly lastLoginAfter?: Date;
  readonly lastLoginBefore?: Date;
}

export interface AccessibleUsersInput {
  readonly consistencyLevel?: ConsistencyLevel;
  readonly filter?: UserFilterInput;
  readonly first?: number;
  readonly after?: string;
}

export interface PermissionFilterInput {
  readonly userId?: string;
  readonly nodeId?: string;
  readonly permissionType?: PermissionType;
  readonly isActive?: boolean;
  readonly grantedById?: string;
  readonly grantedAfter?: Date;
  readonly grantedBefore?: Date;
  readonly expiresAfter?: Date;
  readonly expiresBefore?: Date;
}

// ============================================================================
// ORGANIZATION INPUTS
// ============================================================================

export interface CreateOrganizationNodeInput {
  readonly name: string;
  readonly parentId?: string;
  readonly level: number;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationNodeInput {
  readonly id: string;
  readonly name?: string;
  readonly parentId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly isActive?: boolean;
}