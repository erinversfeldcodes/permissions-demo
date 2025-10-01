// Output Types
// All GraphQL response types and data structures

import {
  PermissionType,
  DataSource,
  ConsistencyLevel,
} from "../../../shared/types";

// ============================================================================
// BASE RESPONSE TYPES
// ============================================================================

export interface BaseResponse {
  readonly success: boolean;
  readonly errors: ReadonlyArray<GraphQLError>;
}

export interface GraphQLError {
  readonly message: string;
  readonly code: string;
  readonly path?: ReadonlyArray<string | number>;
  readonly extensions?: Record<string, unknown>;
}

// ============================================================================
// USER RESPONSE TYPES
// ============================================================================

export interface UserResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly organizationNodeId: string;
  readonly organizationNode?: OrganizationNodeResponse;
  readonly isActive: boolean;
  readonly lastLoginAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly permissions?: ReadonlyArray<PermissionResponse>;
}

export interface AuthResponse {
  readonly token: string;
  readonly user: UserResponse;
  readonly expiresAt: Date;
}

export interface CreateUserResponse extends BaseResponse {
  readonly user?: UserResponse;
}

export interface UpdateUserResponse extends BaseResponse {
  readonly user?: UserResponse;
}

// ============================================================================
// PERMISSION RESPONSE TYPES
// ============================================================================

export interface PermissionResponse {
  readonly id: string;
  readonly userId: string;
  readonly user?: UserResponse;
  readonly nodeId: string;
  readonly node?: OrganizationNodeResponse;
  readonly permissionType: PermissionType;
  readonly grantedById: string;
  readonly grantedBy?: UserResponse;
  readonly grantedAt: Date;
  readonly expiresAt?: Date;
  readonly isActive: boolean;
  readonly isEffective: boolean;
}

export interface GrantPermissionResponse extends BaseResponse {
  readonly permission?: PermissionResponse;
}

export interface RevokePermissionResponse extends BaseResponse {
  readonly permission?: PermissionResponse;
}

export interface BulkGrantPermissionResponse extends BaseResponse {
  readonly results: ReadonlyArray<GrantPermissionResponse>;
  readonly successCount: number;
  readonly failureCount: number;
}

export interface BulkRevokePermissionResponse extends BaseResponse {
  readonly results: ReadonlyArray<RevokePermissionResponse>;
  readonly successCount: number;
  readonly failureCount: number;
}

// ============================================================================
// ORGANIZATION RESPONSE TYPES
// ============================================================================

export interface OrganizationNodeResponse {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string | null;
  readonly parent?: OrganizationNodeResponse | null;
  readonly level: number;
  readonly metadata: Record<string, unknown> | string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly children?: ReadonlyArray<OrganizationNodeResponse>;
  readonly users?: ReadonlyArray<UserResponse>;
  readonly userCount?: number;
}

export interface CreateOrganizationNodeResponse extends BaseResponse {
  readonly organizationNode?: OrganizationNodeResponse;
}

export interface UpdateOrganizationNodeResponse extends BaseResponse {
  readonly organizationNode?: OrganizationNodeResponse;
}

// ============================================================================
// QUERY RESPONSE TYPES
// ============================================================================

export interface PageInfo {
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly startCursor?: string | null;
  readonly endCursor?: string | null;
}

export interface Connection<T> {
  readonly edges: ReadonlyArray<Edge<T>>;
  readonly pageInfo: PageInfo;
  readonly totalCount: number;
}

export interface Edge<T> {
  readonly node: T;
  readonly cursor: string;
}

export interface UsersConnection extends Connection<UserResponse> {
  readonly dataSource: DataSource;
  readonly lastUpdated?: Date;
  readonly executionTimeMs: number;
}

export interface PermissionsConnection extends Connection<PermissionResponse> {
  readonly dataSource: DataSource;
  readonly lastUpdated?: Date;
  readonly executionTimeMs: number;
}

// ============================================================================
// ACCESS CONTROL RESPONSE TYPES
// ============================================================================

export interface AccessCheckResponse {
  readonly canAccess: boolean;
  readonly reason?: string;
  readonly requiredPermission?: PermissionType;
  readonly checkedAt: Date;
}

export interface AccessibleUsersResponse {
  readonly users: UsersConnection;
  readonly metadata: QueryMetadata;
}

export interface QueryMetadata {
  readonly dataSource: DataSource;
  readonly consistencyLevel: ConsistencyLevel;
  readonly executionTimeMs: number;
  readonly cacheHit: boolean;
  readonly lastUpdated?: Date;
  readonly staleness?: number; // milliseconds since last update
}