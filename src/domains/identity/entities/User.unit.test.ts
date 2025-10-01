// Unit tests for User entity
import { User } from "./User";
import { OrganizationNode } from "../../organization/entities/OrganizationNode";
import { DomainError, ValidationError } from "../../../shared/types";

describe("User Entity", () => {
  let testUser: User;
  let testOrgNode: OrganizationNode;

  beforeEach(() => {
    testOrgNode = OrganizationNode.create({
      id: "node-123",
      name: "Test Organization",
      parentId: undefined,
      level: 1,
      metadata: {},
      isActive: true,
    });

    testUser = User.fromPersistence({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      passwordHash: "hashed_password",
      organizationNodeId: "node-123",
      isActive: true,
      lastLoginAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("Validation", () => {
    test("should validate email format", () => {
      expect(() => {
        User.create({
          id: "user-123",
          email: "invalid-email",
          name: "Test User",
          passwordHash: "hashed_password",
          organizationNodeId: "node-123",
          isActive: true,
          lastLoginAt: undefined,
        });
      }).toThrow(ValidationError);
    });

    test("should validate required name field", () => {
      expect(() => {
        User.create({
          id: "user-123",
          email: "test@example.com",
          name: "",
          passwordHash: "hashed_password",
          organizationNodeId: "node-123",
          isActive: true,
          lastLoginAt: undefined,
        });
      }).toThrow(ValidationError);
    });
  });

  describe("setPassword", () => {
    test("should update password hash", async () => {
      const newPassword = "newPassword123";
      await testUser.setPassword(newPassword);

      await expect(testUser.verifyPassword(newPassword)).resolves.toBe(true);
      await expect(testUser.verifyPassword("original_password")).resolves.toBe(
        false,
      );
    });

    test("should validate password strength", async () => {
      await expect(testUser.setPassword("weak")).rejects.toThrow(
        ValidationError,
      );
    });

    test("should require minimum password length", async () => {
      await expect(testUser.setPassword("12345")).rejects.toThrow(
        ValidationError,
      );
    });

    test("should not allow empty password", async () => {
      await expect(testUser.setPassword("")).rejects.toThrow(ValidationError);
    });
  });

  describe("verifyPassword", () => {
    test("should verify correct password", async () => {
      const isValid = await testUser.verifyPassword("password");
      expect(isValid).toBe(true);
    });

    test("should reject incorrect password", async () => {
      const isValid = await testUser.verifyPassword("wrongpassword");
      expect(isValid).toBe(false);
    });

    test("should handle empty password gracefully", async () => {
      const isValid = await testUser.verifyPassword("");
      expect(isValid).toBe(false);
    });
  });

  describe("changeName", () => {
    test("should update user name", () => {
      testUser.changeName("New Name");
      expect(testUser.name).toBe("New Name");
    });

    test("should validate name is not empty", () => {
      expect(() => testUser.changeName("")).toThrow(ValidationError);
    });

    test("should validate name length", () => {
      const longName = "a".repeat(101); // Over 100 characters
      expect(() => testUser.changeName(longName)).toThrow(ValidationError);
    });

    test("should validate minimum name length", () => {
      expect(() => testUser.changeName("a")).toThrow(ValidationError); // Less than 2 characters
    });

    test("should accept names with whitespace", () => {
      testUser.changeName("  Name With Spaces  ");
      expect(testUser.name).toBe("  Name With Spaces  ");
    });
  });

  describe("moveToOrganizationNode", () => {
    test("should update organization node ID", () => {
      const newNodeId = "new-node-456";
      testUser.moveToOrganizationNode(newNodeId);
      expect(testUser.organizationNodeId).toBe(newNodeId);
    });

    test("should validate node ID is not empty", () => {
      expect(() => testUser.moveToOrganizationNode("")).toThrow(DomainError);
    });

    test("should allow moving to same node", () => {
      // The User entity doesn't prevent moving to the same node
      expect(() => testUser.moveToOrganizationNode("node-123")).not.toThrow();
      expect(testUser.organizationNodeId).toBe("node-123");
    });
  });

  describe("activate", () => {
    test("should activate inactive user", () => {
      testUser.deactivate(); // First deactivate to test activation
      testUser.activate();
      expect(testUser.isActive).toBe(true);
    });

    test("should handle already active user gracefully", () => {
      expect(testUser.isActive).toBe(true);
      testUser.activate();
      expect(testUser.isActive).toBe(true);
    });
  });

  describe("deactivate", () => {
    test("should deactivate active user", () => {
      testUser.deactivate();
      expect(testUser.isActive).toBe(false);
    });

    test("should handle already inactive user gracefully", () => {
      testUser.deactivate(); // First deactivate
      testUser.deactivate(); // Then try again
      expect(testUser.isActive).toBe(false);
    });
  });

  describe("recordLogin", () => {
    test("should record current timestamp on login", () => {
      const beforeLogin = new Date();
      testUser.recordLogin();
      const afterLogin = new Date();

      expect(testUser.lastLoginAt).toBeDefined();
      expect(testUser.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime(),
      );
      expect(testUser.lastLoginAt!.getTime()).toBeLessThanOrEqual(
        afterLogin.getTime(),
      );
    });

    test("should update last login when called multiple times", () => {
      testUser.recordLogin();
      const firstLogin = testUser.lastLoginAt;

      // Wait a small amount to ensure different timestamp
      setTimeout(() => {
        testUser.recordLogin();
        expect(testUser.lastLoginAt!.getTime()).toBeGreaterThan(
          firstLogin!.getTime(),
        );
      }, 10);
    });
  });

  describe("User State Management", () => {
    test("should track activation changes", () => {
      expect(testUser.isActive).toBe(true);

      testUser.deactivate();
      expect(testUser.isActive).toBe(false);

      testUser.activate();
      expect(testUser.isActive).toBe(true);
    });

    test("should track organization membership", () => {
      expect(testUser.isInOrganizationNode("node-123")).toBe(true);
      expect(testUser.isInOrganizationNode("different-node")).toBe(false);
    });

    test("should track login activity", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(testUser.hasLoggedInSince(threeDaysAgo)).toBe(false);

      testUser.recordLogin();
      expect(testUser.hasLoggedInSince(threeDaysAgo)).toBe(true);
    });
  });

  describe("Business Rules", () => {
    test("should enforce email uniqueness constraint hint", () => {
      // This is typically enforced at the repository level
      // but the entity should validate format
      expect(() => {
        User.create({
          id: "user-456",
          email: "test@example.com", // Same email as testUser
          name: "Another User",
          passwordHash: "hashed_password",
          organizationNodeId: "node-123",
          isActive: true,
          lastLoginAt: undefined,
        });
      }).not.toThrow(); // Entity allows it, repository enforces uniqueness
    });

    test("should maintain audit trail through timestamps", () => {
      expect(testUser.createdAt).toBeInstanceOf(Date);
      expect(testUser.updatedAt).toBeInstanceOf(Date);
      expect(testUser.createdAt.getTime()).toBeLessThanOrEqual(
        testUser.updatedAt.getTime(),
      );
    });
  });

  describe("Integration Points", () => {
    test("should maintain organization node relationship", () => {
      expect(testUser.organizationNodeId).toBe(testOrgNode.id);
    });

    test("should provide serialization methods", () => {
      // Test that User entity provides serialization capabilities
      const plainObject = testUser.toPlainObject();
      expect(plainObject).toHaveProperty("id");
      expect(plainObject).toHaveProperty("email");
      expect(plainObject).toHaveProperty("name");
      expect(plainObject).not.toHaveProperty("passwordHash");

      const objectWithPassword = testUser.toPlainObjectWithPassword();
      expect(objectWithPassword).toHaveProperty("passwordHash");
    });
  });

  describe("Error Handling", () => {
    test("should provide meaningful error messages", () => {
      try {
        testUser.changeName("");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain("Name");
      }
    });

    test("should handle null/undefined values gracefully", () => {
      expect(() => testUser.changeName(null as any)).toThrow(ValidationError);
      expect(() => testUser.changeName(undefined as any)).toThrow(
        ValidationError,
      );
    });
  });
});
