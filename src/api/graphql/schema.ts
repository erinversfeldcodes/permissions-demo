// GraphQL Schema Definition for Ekko Permissions System

import { gql } from "graphql-tag";

export const typeDefs = gql`
  # Scalars
  scalar DateTime
  scalar JSON

  # Enums
  enum PermissionType {
    READ
    MANAGE
    ADMIN
  }

  enum ConsistencyLevel {
    EVENTUAL
    STRONG
  }

  enum DataSource {
    MATERIALIZED_VIEW
    CLOSURE_TABLE
    HYBRID
  }

  # Core Types
  type User {
    id: ID!
    email: String!
    name: String!
    organizationNode: OrganizationNode!
    isActive: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Permission-based queries
    permissions: [Permission!]!
    accessibleUsers(
      consistencyLevel: ConsistencyLevel = EVENTUAL
      first: Int = 20
      after: String
    ): UserConnection!
    accessibleUserCount: Int!
    canAccess(targetUserId: ID!): Boolean!
  }

  type OrganizationNode {
    id: ID!
    name: String!
    parent: OrganizationNode
    children: [OrganizationNode!]!
    level: Int!
    metadata: JSON
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Hierarchical queries
    ancestors: [OrganizationNode!]!
    descendants: [OrganizationNode!]!
    path: [OrganizationNode!]!

    # User queries
    users: [User!]!
    userCount: Int!

    # Permission queries
    permissions: [Permission!]!
  }

  type Permission {
    id: ID!
    user: User!
    node: OrganizationNode!
    permissionType: PermissionType!
    grantedBy: User!
    grantedAt: DateTime!
    expiresAt: DateTime
    isActive: Boolean!
    isEffective: Boolean!
  }

  # Connection types for pagination
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
    dataSource: DataSource!
    lastUpdated: DateTime!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Query result metadata
  type QueryMetadata {
    dataSource: DataSource!
    executionTime: Float!
    consistencyLevel: ConsistencyLevel!
    lastUpdated: DateTime
  }

  # Input Types
  input CreateUserInput {
    email: String!
    name: String!
    password: String!
    organizationNodeId: ID!
  }

  input UpdateUserInput {
    name: String
    email: String
    organizationNodeId: ID
    isActive: Boolean
  }

  input CreateOrganizationNodeInput {
    name: String!
    parentId: ID
    metadata: JSON
  }

  input UpdateOrganizationNodeInput {
    name: String
    parentId: ID
    metadata: JSON
    isActive: Boolean
  }

  input GrantPermissionInput {
    userId: ID!
    nodeId: ID!
    permissionType: PermissionType!
    expiresAt: DateTime
  }

  input UpdatePermissionInput {
    isActive: Boolean
    expiresAt: DateTime
  }

  input UserFilter {
    isActive: Boolean
    organizationNodeIds: [ID!]
    permissionTypes: [PermissionType!]
    searchTerm: String
  }

  input AuthInput {
    email: String!
    password: String!
  }

  # Auth Response
  type AuthResponse {
    token: String!
    user: User!
    expiresAt: DateTime!
  }

  # Mutation Response Types
  type UserMutationResponse {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type OrganizationNodeMutationResponse {
    success: Boolean!
    node: OrganizationNode
    errors: [Error!]
  }

  type PermissionMutationResponse {
    success: Boolean!
    permission: Permission
    errors: [Error!]
  }

  type Error {
    message: String!
    code: String!
    field: String
  }

  # Queries - Optimized for different consistency requirements
  type Query {
    # Current user context
    me: User

    # User queries
    user(id: ID!): User
    users(
      filter: UserFilter
      consistencyLevel: ConsistencyLevel = EVENTUAL
      first: Int = 20
      after: String
    ): UserConnection!

    # Organization queries
    organizationNode(id: ID!): OrganizationNode
    organizationNodes(parentId: ID): [OrganizationNode!]!
    organizationTree: [OrganizationNode!]!

    # Permission queries
    permission(id: ID!): Permission
    userPermissions(userId: ID!): [Permission!]!
    nodePermissions(nodeId: ID!): [Permission!]!

    # Access queries - showcasing CQRS optimization
    accessibleUsers(
      consistencyLevel: ConsistencyLevel = EVENTUAL
      filter: UserFilter
      first: Int = 20
      after: String
    ): UserConnection!

    canUserAccess(
      requesterId: ID!
      targetId: ID!
      consistencyLevel: ConsistencyLevel = STRONG
    ): Boolean!

    # Analytics queries (eventual consistency)
    permissionStats: PermissionStats!
    organizationStats: OrganizationStats!
  }

  # Analytics types
  type PermissionStats {
    totalPermissions: Int!
    activePermissions: Int!
    expiredPermissions: Int!
    permissionsByType: [PermissionTypeCount!]!
    recentGrants: [Permission!]!
  }

  type PermissionTypeCount {
    type: PermissionType!
    count: Int!
  }

  type OrganizationStats {
    totalNodes: Int!
    activeNodes: Int!
    totalUsers: Int!
    activeUsers: Int!
    averageUsersPerNode: Float!
  }

  # Mutations - Command side of CQRS
  type Mutation {
    # Authentication
    login(input: AuthInput!): AuthResponse!
    logout: Boolean!

    # User management
    createUser(input: CreateUserInput!): UserMutationResponse!
    updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    deleteUser(id: ID!): UserMutationResponse!
    activateUser(id: ID!): UserMutationResponse!
    deactivateUser(id: ID!): UserMutationResponse!

    # Organization management
    createOrganizationNode(
      input: CreateOrganizationNodeInput!
    ): OrganizationNodeMutationResponse!
    updateOrganizationNode(
      id: ID!
      input: UpdateOrganizationNodeInput!
    ): OrganizationNodeMutationResponse!
    deleteOrganizationNode(id: ID!): OrganizationNodeMutationResponse!
    moveOrganizationNode(
      id: ID!
      newParentId: ID
    ): OrganizationNodeMutationResponse!
    archiveOrganizationNode(id: ID!): OrganizationNodeMutationResponse!

    # Permission management
    grantPermission(input: GrantPermissionInput!): PermissionMutationResponse!
    revokePermission(id: ID!): PermissionMutationResponse!
    updatePermission(id: ID!, input: UpdatePermissionInput!): PermissionMutationResponse!
    updatePermissionExpiration(
      id: ID!
      expiresAt: DateTime
    ): PermissionMutationResponse!

    # Bulk operations
    bulkGrantPermissions(
      inputs: [GrantPermissionInput!]!
    ): [PermissionMutationResponse!]!
    bulkRevokePermissions(ids: [ID!]!): [PermissionMutationResponse!]!

    # System operations
    refreshMaterializedViews(userIds: [ID!]): Boolean!
    rebuildClosureTable: Boolean!
  }

  # Subscriptions for real-time updates
  type Subscription {
    # Permission changes
    permissionGranted(userId: ID): Permission!
    permissionRevoked(userId: ID): Permission!

    # User access changes
    accessibleUsersUpdated(userId: ID!): UserConnection!

    # Organization changes
    organizationNodeMoved: OrganizationNode!
    organizationNodeCreated: OrganizationNode!
  }
`;
