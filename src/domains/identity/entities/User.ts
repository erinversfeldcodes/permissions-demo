// User Entity - Identity Domain Model

import {
  UserId,
  NodeId,
  Email,
  Name,
  DomainError,
  ValidationError,
} from "../../../shared/types";
import { hash, compare } from "bcryptjs";

export interface UserProps {
  id: UserId;
  email: Email;
  name: Name;
  passwordHash?: string;
  organizationNodeId: NodeId;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private props: UserProps) {
    this.validate();
  }

  static create(props: Omit<UserProps, "createdAt" | "updatedAt">): User {
    return new User({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get name(): Name {
    return this.props.name;
  }

  get organizationNodeId(): NodeId {
    return this.props.organizationNodeId;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  async setPassword(plainPassword: string): Promise<void> {
    this.validatePassword(plainPassword);

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    this.props.passwordHash = await hash(plainPassword, saltRounds);
    this.touch();
  }

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!this.props.passwordHash) {
      return false;
    }

    return await compare(plainPassword, this.props.passwordHash);
  }

  hasPassword(): boolean {
    return !!this.props.passwordHash;
  }

  changeName(newName: Name): void {
    this.validateName(newName);
    this.props.name = newName;
    this.touch();
  }

  changeEmail(newEmail: Email): void {
    this.validateEmail(newEmail);
    this.props.email = newEmail;
    this.touch();
  }

  moveToOrganizationNode(nodeId: NodeId): void {
    if (!nodeId) {
      throw new DomainError(
        "Organization node ID is required",
        "MISSING_NODE_ID",
      );
    }

    this.props.organizationNodeId = nodeId;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.touch();
  }

  isInOrganizationNode(nodeId: NodeId): boolean {
    return this.props.organizationNodeId === nodeId;
  }

  hasLoggedInSince(date: Date): boolean {
    return this.props.lastLoginAt ? this.props.lastLoginAt > date : false;
  }

  private validate(): void {
    if (!this.props.id) {
      throw new DomainError("User must have an id", "MISSING_ID");
    }

    this.validateEmail(this.props.email);
    this.validateName(this.props.name);

    if (!this.props.organizationNodeId) {
      throw new DomainError(
        "User must be assigned to an organization node",
        "MISSING_ORGANIZATION_NODE",
      );
    }
  }

  private validateEmail(email: Email): void {
    if (!email) {
      throw new ValidationError("Email is required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("Invalid email format");
    }
  }

  private validateName(name: Name): void {
    if (!name?.trim()) {
      throw new ValidationError("Name is required");
    }

    if (name.length < 2) {
      throw new ValidationError("Name must be at least 2 characters long");
    }

    if (name.length > 100) {
      throw new ValidationError("Name must be less than 100 characters long");
    }
  }

  private validatePassword(password: string): void {
    if (!password) {
      throw new ValidationError("Password is required");
    }

    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      throw new ValidationError(
        "Password must be less than 128 characters long",
      );
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      throw new ValidationError(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  toPlainObject(): Omit<UserProps, "passwordHash"> {
    const { passwordHash, ...safeProps } = this.props;
    return safeProps;
  }

  toPlainObjectWithPassword(): UserProps {
    return { ...this.props };
  }

  equals(other: User): boolean {
    return this.props.id === other.props.id;
  }
}
