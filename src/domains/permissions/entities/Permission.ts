// Permission Entity - Permission Domain Model

import {
  PermissionId,
  UserId,
  NodeId,
  PermissionType,
  DomainError,
  ValidationError,
} from "../../../shared/types";

export interface PermissionProps {
  id: PermissionId;
  userId: UserId;
  nodeId: NodeId;
  permissionType: PermissionType;
  grantedById: UserId;
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export class Permission {
  private constructor(private props: PermissionProps) {
    this.validate();
  }

  static create(props: Omit<PermissionProps, "grantedAt">): Permission {
    return new Permission({
      ...props,
      grantedAt: new Date(),
    });
  }

  static fromPersistence(props: PermissionProps): Permission {
    return new Permission(props);
  }

  // For testing purposes only - bypasses validation
  static forTesting(props: PermissionProps): Permission {
    return new Permission(props);
  }

  // Internal method to set expiration without validation (for testing)
  setExpirationUnsafe(expiresAt: Date): void {
    this.props.expiresAt = expiresAt;
  }

  get id(): PermissionId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get nodeId(): NodeId {
    return this.props.nodeId;
  }

  get permissionType(): PermissionType {
    return this.props.permissionType;
  }

  get grantedById(): UserId {
    return this.props.grantedById;
  }

  get grantedAt(): Date {
    return this.props.grantedAt;
  }

  get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  setExpiration(expiresAt: Date): void {
    if (expiresAt < new Date()) {
      throw new ValidationError(
        "Expiration date must be in the future",
        { code: "INVALID_EXPIRATION" },
      );
    }

    if (expiresAt <= this.props.grantedAt) {
      throw new ValidationError(
        "Expiration date must be after grant date",
        { code: "INVALID_EXPIRATION" },
      );
    }

    this.props.expiresAt = expiresAt;
  }

  removeExpiration(): void {
    this.props.expiresAt = undefined;
  }

  revoke(): void {
    this.props.isActive = false;
  }

  reactivate(): void {
    if (this.isExpired()) {
      throw new DomainError(
        "Cannot reactivate expired permission",
        "PERMISSION_EXPIRED",
      );
    }

    this.props.isActive = true;
  }

  isExpired(): boolean {
    if (!this.props.expiresAt) {
      return false;
    }

    return this.props.expiresAt <= new Date();
  }

  isEffective(): boolean {
    return this.props.isActive && !this.isExpired();
  }

  isForUser(userId: UserId): boolean {
    return this.props.userId === userId;
  }

  isForNode(nodeId: NodeId): boolean {
    return this.props.nodeId === nodeId;
  }

  isOfType(type: PermissionType): boolean {
    return this.props.permissionType === type;
  }

  isGrantedBy(userId: UserId): boolean {
    return this.props.grantedById === userId;
  }

  hasHigherOrEqualPriorityThan(other: Permission): boolean {
    const priorityOrder: Record<PermissionType, number> = {
      [PermissionType.READ]: 1,
      [PermissionType.MANAGE]: 2,
      [PermissionType.ADMIN]: 3,
    };

    return (
      priorityOrder[this.props.permissionType] >=
      priorityOrder[other.props.permissionType]
    );
  }

  conflictsWith(other: Permission): boolean {
    return (
      this.props.userId === other.props.userId &&
      this.props.nodeId === other.props.nodeId &&
      this.props.permissionType === other.props.permissionType &&
      this.props.id !== other.props.id
    );
  }

  private validate(): void {
    if (!this.props.id) {
      throw new ValidationError("Permission must have an id");
    }

    if (!this.props.userId) {
      throw new ValidationError("Permission must have a user id");
    }

    if (!this.props.nodeId) {
      throw new ValidationError("Permission must have a node id");
    }

    if (!Object.values(PermissionType).includes(this.props.permissionType)) {
      throw new ValidationError("Invalid permission type");
    }

    if (!this.props.grantedById) {
      throw new ValidationError("Permission must have a granter id");
    }

    if (this.props.grantedAt > new Date()) {
      throw new ValidationError("Grant date cannot be in the future");
    }

    if (this.props.expiresAt && this.props.expiresAt <= this.props.grantedAt) {
      throw new ValidationError("Expiration date must be after grant date");
    }

    if (this.props.userId === this.props.grantedById) {
      throw new DomainError(
        "User cannot grant permission to themselves",
        "SELF_GRANT_NOT_ALLOWED",
      );
    }
  }

  toPlainObject(): PermissionProps {
    return { ...this.props };
  }

  equals(other: Permission): boolean {
    return this.props.id === other.props.id;
  }

  static createReadPermission(
    id: PermissionId,
    userId: UserId,
    nodeId: NodeId,
    grantedById: UserId,
    expiresAt?: Date,
  ): Permission {
    return Permission.create({
      id,
      userId,
      nodeId,
      permissionType: PermissionType.READ,
      grantedById,
      expiresAt,
      isActive: true,
    });
  }

  static createManagePermission(
    id: PermissionId,
    userId: UserId,
    nodeId: NodeId,
    grantedById: UserId,
    expiresAt?: Date,
  ): Permission {
    return Permission.create({
      id,
      userId,
      nodeId,
      permissionType: PermissionType.MANAGE,
      grantedById,
      expiresAt,
      isActive: true,
    });
  }

  static createAdminPermission(
    id: PermissionId,
    userId: UserId,
    nodeId: NodeId,
    grantedById: UserId,
    expiresAt?: Date,
  ): Permission {
    return Permission.create({
      id,
      userId,
      nodeId,
      permissionType: PermissionType.ADMIN,
      grantedById,
      expiresAt,
      isActive: true,
    });
  }
}
