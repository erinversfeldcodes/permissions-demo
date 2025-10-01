// Organization Node Entity - Domain Model (National -> City -> Suburb)

import { NodeId, Name, DomainError } from "../../../shared/types";

export interface OrganizationNodeProps {
  id: NodeId;
  name: Name;
  parentId?: NodeId;
  level: number;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class OrganizationNode {
  private constructor(private props: OrganizationNodeProps) {
    this.validate();
  }

  static create(
    props: Omit<OrganizationNodeProps, "createdAt" | "updatedAt">,
  ): OrganizationNode {
    return new OrganizationNode({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: OrganizationNodeProps): OrganizationNode {
    return new OrganizationNode(props);
  }

  get id(): NodeId {
    return this.props.id;
  }

  get name(): Name {
    return this.props.name;
  }

  get parentId(): NodeId | undefined {
    return this.props.parentId;
  }

  get level(): number {
    return this.props.level;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata || {};
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeName(newName: Name): void {
    if (!newName || !newName.trim()) {
      throw new DomainError("Node name cannot be empty", "INVALID_NAME");
    }

    this.props.name = newName;
    this.touch();
  }

  moveToParent(newParentId: NodeId, newLevel: number): void {
    if (newParentId === this.props.id) {
      throw new DomainError(
        "Node cannot be its own parent",
        "CIRCULAR_REFERENCE",
      );
    }

    this.props.parentId = newParentId;
    this.props.level = newLevel;
    this.touch();
  }

  makeRoot(): void {
    this.props.parentId = undefined;
    this.props.level = 0;
    this.touch();
  }

  updateMetadata(metadata: Record<string, any>): void {
    this.props.metadata = { ...this.props.metadata, ...metadata };
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

  isRoot(): boolean {
    return this.props.parentId === undefined;
  }

  isChildOf(parentId: NodeId): boolean {
    return this.props.parentId === parentId;
  }

  isAtLevel(level: number): boolean {
    return this.props.level === level;
  }

  private validate(): void {
    if (!this.props.id) {
      throw new DomainError("Organization node must have an id", "MISSING_ID");
    }

    if (!this.props.name?.trim()) {
      throw new DomainError(
        "Organization node must have a name",
        "MISSING_NAME",
      );
    }

    if (this.props.level < 0) {
      throw new DomainError(
        "Organization node level cannot be negative",
        "INVALID_LEVEL",
      );
    }

    if (this.props.parentId === this.props.id) {
      throw new DomainError(
        "Node cannot be its own parent",
        "CIRCULAR_REFERENCE",
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  toPlainObject(): OrganizationNodeProps {
    return { ...this.props };
  }

  equals(other: OrganizationNode): boolean {
    return this.props.id === other.props.id;
  }
}
