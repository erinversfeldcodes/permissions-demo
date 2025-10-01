// Get Accessible Users Query - CQRS Query Side

import {
  UserId,
  ConsistencyLevel,
  DataSource,
  PaginationOptions,
} from "../../../shared/types";

export interface GetAccessibleUsersQuery {
  requesterId: UserId;
  consistencyLevel: ConsistencyLevel;
  pagination?: PaginationOptions;
  filters?: {
    isActive?: boolean;
    organizationNodeIds?: readonly string[];
    searchTerm?: string;
  };
}

export interface AccessibleUser {
  id: UserId;
  email: string;
  name: string;
  organizationNodeId: string;
  organizationNodeName: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GetAccessibleUsersResult {
  users: AccessibleUser[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  dataSource: DataSource;
  executionTime: number;
  lastUpdated?: Date;
}
