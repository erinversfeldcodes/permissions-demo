// Shared Types for Ekko Permissions System

export type EntityId = string;
export type UserId = EntityId;
export type NodeId = EntityId;
export type PermissionId = EntityId;
export type EventId = EntityId;

// Core Value Objects (simplified for now - could be expanded to full value objects later)
export type Email = string;
export type Name = string;

// Permission Types
export enum PermissionType {
  READ = "READ",
  MANAGE = "MANAGE",
  ADMIN = "ADMIN",
}

// Consistency levels for CQRS
export enum ConsistencyLevel {
  EVENTUAL = "EVENTUAL", // Use materialized view (fast)
  STRONG = "STRONG", // Use closure table (consistent)
}

// Data source types
export enum DataSource {
  MATERIALIZED_VIEW = "MATERIALIZED_VIEW",
  CLOSURE_TABLE = "CLOSURE_TABLE",
  HYBRID = "HYBRID",
}

// Common result types
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export interface PaginationOptions {
  offset?: number;
  limit?: number;
  cursor?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// Domain event base
export interface DomainEvent {
  id: EventId;
  aggregateId: EntityId;
  eventType: string;
  eventData: Record<string, any>;
  version: number;
  occurredAt: Date;
  userId?: UserId;
}

// Query Options
export interface QueryOptions {
  consistencyLevel?: ConsistencyLevel;
  includeInactive?: boolean;
  timeRange?: {
    from: Date;
    to: Date;
  };
}

// Error Types
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: EntityId) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND", { resource, id });
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = "Unauthorized access") {
    super(message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "CONFLICT", details);
    this.name = "ConflictError";
  }
}
