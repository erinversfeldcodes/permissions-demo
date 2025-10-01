// Resolver Argument Types
// All GraphQL resolver argument types

import {
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  GrantPermissionInput,
  RevokePermissionInput,
  BulkGrantPermissionInput,
  BulkRevokePermissionInput,
  CreateOrganizationNodeInput,
  UpdateOrganizationNodeInput,
  UserFilterInput,
  AccessibleUsersInput,
  PermissionFilterInput,
} from "./input";
import { ConsistencyLevel } from "../../../shared/types";

// ============================================================================
// QUERY ARGUMENT TYPES
// ============================================================================

export interface MeArgs {
  // No arguments needed - explicitly empty interface for clarity
  readonly _?: never;
}

export interface UserArgs {
  readonly id: string;
}

export interface UsersArgs {
  readonly filter?: UserFilterInput;
  readonly consistencyLevel?: ConsistencyLevel;
  readonly first?: number;
  readonly after?: string;
}

export interface AccessibleUsersArgs {
  readonly input: AccessibleUsersInput;
}

export interface CanUserAccessArgs {
  readonly requesterId: string;
  readonly targetId: string;
  readonly consistencyLevel?: ConsistencyLevel;
}

export interface OrganizationNodeArgs {
  readonly id: string;
}

export interface OrganizationTreeArgs {
  readonly rootId?: string;
  readonly maxDepth?: number;
  readonly includeInactive?: boolean;
}

export interface PermissionsArgs {
  readonly filter?: PermissionFilterInput;
  readonly first?: number;
  readonly after?: string;
}

// ============================================================================
// MUTATION ARGUMENT TYPES
// ============================================================================

export interface LoginArgs {
  readonly input: LoginInput;
}

export interface CreateUserArgs {
  readonly input: CreateUserInput;
}

export interface UpdateUserArgs {
  readonly input: UpdateUserInput;
}

export interface GrantPermissionArgs {
  readonly input: GrantPermissionInput;
}

export interface RevokePermissionArgs {
  readonly id: string;
}

export interface BulkGrantPermissionsArgs {
  readonly input: BulkGrantPermissionInput;
}

export interface BulkRevokePermissionsArgs {
  readonly input: BulkRevokePermissionInput;
}

export interface CreateOrganizationNodeArgs {
  readonly input: CreateOrganizationNodeInput;
}

export interface UpdateOrganizationNodeArgs {
  readonly input: UpdateOrganizationNodeInput;
}