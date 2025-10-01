// Resolver Types
// GraphQL resolver type definitions and interfaces

import { GraphQLContext } from "./context";
import {
  MeArgs,
  UserArgs,
  UsersArgs,
  AccessibleUsersArgs,
  CanUserAccessArgs,
  OrganizationNodeArgs,
  OrganizationTreeArgs,
  PermissionsArgs,
  LoginArgs,
  CreateUserArgs,
  UpdateUserArgs,
  GrantPermissionArgs,
  RevokePermissionArgs,
  BulkGrantPermissionsArgs,
  BulkRevokePermissionsArgs,
  CreateOrganizationNodeArgs,
  UpdateOrganizationNodeArgs,
} from "./resolver-argument";
import {
  UserResponse,
  AuthResponse,
  CreateUserResponse,
  UpdateUserResponse,
  GrantPermissionResponse,
  RevokePermissionResponse,
  BulkGrantPermissionResponse,
  BulkRevokePermissionResponse,
  CreateOrganizationNodeResponse,
  UpdateOrganizationNodeResponse,
  UsersConnection,
  PermissionsConnection,
  AccessCheckResponse,
  OrganizationNodeResponse,
  PermissionResponse,
} from "./output";

// ============================================================================
// BASE RESOLVER TYPE
// ============================================================================

export type Resolver<TResult, TParent = unknown, TArgs = unknown> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: unknown,
) => Promise<TResult> | TResult;

// ============================================================================
// QUERY RESOLVERS
// ============================================================================

export interface QueryResolvers {
  readonly me: Resolver<UserResponse, unknown, MeArgs>;
  readonly user: Resolver<UserResponse | null, unknown, UserArgs>;
  readonly users: Resolver<UsersConnection, unknown, UsersArgs>;
  readonly accessibleUsers: Resolver<
    UsersConnection,
    unknown,
    AccessibleUsersArgs
  >;
  readonly canUserAccess: Resolver<
    AccessCheckResponse,
    unknown,
    CanUserAccessArgs
  >;
  readonly organizationNode: Resolver<
    OrganizationNodeResponse | null,
    unknown,
    OrganizationNodeArgs
  >;
  readonly organizationTree: Resolver<
    ReadonlyArray<OrganizationNodeResponse>,
    unknown,
    OrganizationTreeArgs
  >;
  readonly permissions: Resolver<
    PermissionsConnection,
    unknown,
    PermissionsArgs
  >;
}

// ============================================================================
// MUTATION RESOLVERS
// ============================================================================

export interface MutationResolvers {
  readonly login: Resolver<AuthResponse, unknown, LoginArgs>;
  readonly createUser: Resolver<CreateUserResponse, unknown, CreateUserArgs>;
  readonly updateUser: Resolver<UpdateUserResponse, unknown, UpdateUserArgs>;
  readonly grantPermission: Resolver<
    GrantPermissionResponse,
    unknown,
    GrantPermissionArgs
  >;
  readonly revokePermission: Resolver<
    RevokePermissionResponse,
    unknown,
    RevokePermissionArgs
  >;
  readonly bulkGrantPermissions: Resolver<
    BulkGrantPermissionResponse,
    unknown,
    BulkGrantPermissionsArgs
  >;
  readonly bulkRevokePermissions: Resolver<
    BulkRevokePermissionResponse,
    unknown,
    BulkRevokePermissionsArgs
  >;
  readonly createOrganizationNode: Resolver<
    CreateOrganizationNodeResponse,
    unknown,
    CreateOrganizationNodeArgs
  >;
  readonly updateOrganizationNode: Resolver<
    UpdateOrganizationNodeResponse,
    unknown,
    UpdateOrganizationNodeArgs
  >;
}

// ============================================================================
// FIELD RESOLVERS
// ============================================================================

export interface UserFieldResolvers {
  readonly organizationNode: Resolver<
    OrganizationNodeResponse | null,
    UserResponse
  >;
  readonly permissions: Resolver<
    ReadonlyArray<PermissionResponse>,
    UserResponse
  >;
  readonly accessibleUsers: Resolver<
    UsersConnection,
    UserResponse,
    AccessibleUsersArgs
  >;
  readonly accessibleUserCount: Resolver<number, UserResponse>;
  readonly canAccess: Resolver<
    boolean,
    UserResponse,
    { readonly targetUserId: string }
  >;
}

export interface OrganizationNodeFieldResolvers {
  readonly parent: Resolver<
    OrganizationNodeResponse | null,
    OrganizationNodeResponse
  >;
  readonly children: Resolver<
    ReadonlyArray<OrganizationNodeResponse>,
    OrganizationNodeResponse
  >;
  readonly users: Resolver<
    ReadonlyArray<UserResponse>,
    OrganizationNodeResponse
  >;
  readonly userCount: Resolver<number, OrganizationNodeResponse>;
}

export interface PermissionFieldResolvers {
  readonly user: Resolver<UserResponse | null, PermissionResponse>;
  readonly node: Resolver<OrganizationNodeResponse | null, PermissionResponse>;
  readonly grantedBy: Resolver<UserResponse | null, PermissionResponse>;
  readonly isEffective: Resolver<boolean, PermissionResponse>;
}