// API tests for GraphQL endpoints
import { createServer } from "http";
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
const request = require("supertest");
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { typeDefs } from "../../api/graphql/schema";
import { resolvers } from "../../api/graphql/resolvers";
import { PermissionType } from "../../shared/types";
import { GraphQLContext } from "../../api/graphql/types/context";
import { nanoid } from "nanoid";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || "file:./test.db",
    },
  },
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

describe("GraphQL API Tests", () => {
  let app: any;
  let testData: {
    users: any[];
    nodes: any[];
    permissions: any[];
  };

  beforeAll(async () => {
    const handler = startServerAndCreateNextHandler(server, {
      context: async (): Promise<GraphQLContext> => ({
        userId: undefined,
        user: undefined,
        isAuthenticated: false,
        requestId: nanoid(),
        userAgent: undefined,
        ipAddress: undefined,
        permissions: undefined,
      }),
    });

    app = createServer(async (req, res) => {
      if (req.url === "/api/graphql" && req.method === "POST") {
        return await handler(
          req as any as NextApiRequest,
          res as any as NextApiResponse,
        );
      }
      res.statusCode = 404;
      res.end("Not Found");
    });

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.domainEvent.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.nodeHierarchy.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organizationNode.deleteMany();
    await prisma.materializedViewStatus.deleteMany();

    testData = await createTestData();
  });

  async function createTestData() {
    const national = await prisma.organizationNode.create({
      data: {
        id: "test-national",
        name: "Test National",
        level: 0,
        parentId: null,
        isActive: true,
      },
    });

    const city = await prisma.organizationNode.create({
      data: {
        id: "test-city",
        name: "Test City",
        level: 1,
        parentId: national.id,
        isActive: true,
      },
    });

    const suburb = await prisma.organizationNode.create({
      data: {
        id: "test-suburb",
        name: "Test Suburb",
        level: 2,
        parentId: city.id,
        isActive: true,
      },
    });

    const nodes = [national, city, suburb];

    for (const node of nodes) {
      await prisma.nodeHierarchy.create({
        data: {
          ancestorId: node.id,
          descendantId: node.id,
          depth: 0,
        },
      });
    }

    await prisma.nodeHierarchy.create({
      data: { ancestorId: national.id, descendantId: city.id, depth: 1 },
    });

    await prisma.nodeHierarchy.create({
      data: { ancestorId: city.id, descendantId: suburb.id, depth: 1 },
    });

    await prisma.nodeHierarchy.create({
      data: { ancestorId: national.id, descendantId: suburb.id, depth: 2 },
    });

    const adminUser = await prisma.user.create({
      data: {
        id: "test-admin",
        email: "admin@test.com",
        name: "Test Admin",
        passwordHash: "$2b$10$test",
        organizationNodeId: national.id,
        isActive: true,
      },
    });

    const managerUser = await prisma.user.create({
      data: {
        id: "test-manager",
        email: "manager@test.com",
        name: "Test Manager",
        passwordHash: "$2b$10$test",
        organizationNodeId: city.id,
        isActive: true,
      },
    });

    const localUser = await prisma.user.create({
      data: {
        id: "test-local",
        email: "local@test.com",
        name: "Test Local",
        passwordHash: "$2b$10$test",
        organizationNodeId: suburb.id,
        isActive: true,
      },
    });

    const users = [adminUser, managerUser, localUser];

    const adminPermission = await prisma.userPermission.create({
      data: {
        id: "test-admin-perm",
        userId: adminUser.id,
        nodeId: national.id,
        permissionType: PermissionType.ADMIN,
        grantedById: adminUser.id,
        isActive: true,
      },
    });

    const managerPermission = await prisma.userPermission.create({
      data: {
        id: "test-manager-perm",
        userId: managerUser.id,
        nodeId: city.id,
        permissionType: PermissionType.MANAGE,
        grantedById: adminUser.id,
        isActive: true,
      },
    });

    const localPermission = await prisma.userPermission.create({
      data: {
        id: "test-local-perm",
        userId: localUser.id,
        nodeId: suburb.id,
        permissionType: PermissionType.READ,
        grantedById: managerUser.id,
        isActive: true,
      },
    });

    const permissions = [adminPermission, managerPermission, localPermission];

    return { users, nodes, permissions };
  }

  function createAuthenticatedRequest(userId: string) {
    return request(app)
      .post("/api/graphql")
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer mock-token-${userId}`);
  }

  describe("User Queries", () => {
    test("should get current user", async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
            email
            name
            organizationNode {
              id
              name
              level
            }
            isActive
          }
        }
      `;

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query })
        .expect(200);

      expect(response.body.data.currentUser).toEqual({
        id: testData.users[0].id,
        email: "admin@test.com",
        name: "Test Admin",
        organizationNode: {
          id: "test-national",
          name: "Test National",
          level: 0,
        },
        isActive: true,
      });
    });

    test("should get accessible users with pagination", async () => {
      const query = `
        query GetAccessibleUsers($pagination: PaginationInput) {
          accessibleUsers(pagination: $pagination) {
            users {
              id
              email
              name
              organizationNodeName
              isActive
            }
            totalCount
            hasNextPage
            hasPreviousPage
            executionTime
            dataSource
          }
        }
      `;

      const variables = {
        pagination: { offset: 0, limit: 10 },
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      expect(response.body.data.accessibleUsers.users).toBeInstanceOf(Array);
      expect(
        response.body.data.accessibleUsers.totalCount,
      ).toBeGreaterThanOrEqual(0);
      expect(response.body.data.accessibleUsers.hasNextPage).toBeDefined();
      expect(response.body.data.accessibleUsers.hasPreviousPage).toBeDefined();
      expect(response.body.data.accessibleUsers.executionTime).toBeGreaterThan(
        0,
      );
      expect(response.body.data.accessibleUsers.dataSource).toBeDefined();
    });

    test("should filter accessible users by search term", async () => {
      const query = `
        query GetAccessibleUsers($filters: AccessibleUsersFilters) {
          accessibleUsers(filters: $filters) {
            users {
              id
              name
              email
            }
            totalCount
          }
        }
      `;

      const variables = {
        filters: { searchTerm: "Manager" },
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      const users = response.body.data.accessibleUsers.users;
      expect(
        users.every(
          (user: any) =>
            user.name.includes("Manager") || user.email.includes("manager"),
        ),
      ).toBe(true);
    });

    test("should filter accessible users by organization node", async () => {
      const query = `
        query GetAccessibleUsers($filters: AccessibleUsersFilters) {
          accessibleUsers(filters: $filters) {
            users {
              id
              name
            }
            totalCount
          }
        }
      `;

      const variables = {
        filters: { organizationNodeIds: ["test-city"] },
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      expect(response.body.data.accessibleUsers).toBeDefined();
    });
  });

  describe("Permission Queries", () => {
    test("should get user permissions", async () => {
      const query = `
        query GetUserPermissions($userId: ID!) {
          userPermissions(userId: $userId) {
            id
            permissionType
            isActive
            grantedAt
            expiresAt
            node {
              id
              name
              level
            }
            grantedBy {
              id
              name
              email
            }
          }
        }
      `;

      const variables = {
        userId: testData.users[1].id,
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      const permissions = response.body.data.userPermissions;
      expect(permissions).toBeInstanceOf(Array);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions[0]).toHaveProperty("permissionType");
      expect(permissions[0]).toHaveProperty("node");
      expect(permissions[0]).toHaveProperty("grantedBy");
    });

    test("should check user access to specific node", async () => {
      const query = `
        query CheckUserAccess($userId: ID!, $nodeId: ID!, $permissionType: PermissionType!) {
          hasAccess(userId: $userId, nodeId: $nodeId, permissionType: $permissionType)
        }
      `;

      const variables = {
        userId: testData.users[1].id,
        nodeId: "test-city",
        permissionType: "MANAGE",
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      expect(response.body.data.hasAccess).toBe(true);
    });
  });

  describe("Organization Queries", () => {
    test("should get organization hierarchy", async () => {
      const query = `
        query GetOrganizationHierarchy {
          organizationHierarchy {
            id
            name
            level
            isActive
            children {
              id
              name
              level
              children {
                id
                name
                level
              }
            }
          }
        }
      `;

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query })
        .expect(200);

      const hierarchy = response.body.data.organizationHierarchy;
      expect(hierarchy).toBeInstanceOf(Array);
      expect(hierarchy.length).toBeGreaterThan(0);
      expect(hierarchy[0]).toHaveProperty("children");
    });

    test("should get organization node details", async () => {
      const query = `
        query GetOrganizationNode($id: ID!) {
          organizationNode(id: $id) {
            id
            name
            level
            isActive
            parent {
              id
              name
            }
            children {
              id
              name
            }
            users {
              id
              name
              email
            }
          }
        }
      `;

      const variables = {
        id: "test-city",
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      const node = response.body.data.organizationNode;
      expect(node.id).toBe("test-city");
      expect(node.name).toBe("Test City");
      expect(node.level).toBe(1);
      expect(node.parent).toBeDefined();
      expect(node.children).toBeInstanceOf(Array);
      expect(node.users).toBeInstanceOf(Array);
    });
  });

  describe("Permission Mutations", () => {
    test("should grant permission successfully", async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            permissionId
            error
            code
          }
        }
      `;

      const variables = {
        input: {
          userId: testData.users[2].id,
          nodeId: "test-city",
          permissionType: "READ",
          expiresAt: null,
        },
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query: mutation, variables })
        .expect(200);

      const result = response.body.data.grantPermission;
      expect(result.success).toBe(true);
      expect(result.permissionId).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should fail to grant permission without authority", async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            permissionId
            error
            code
          }
        }
      `;

      const variables = {
        input: {
          userId: testData.users[0].id,
          nodeId: "test-national",
          permissionType: "ADMIN",
          expiresAt: null,
        },
      };

      const response = await createAuthenticatedRequest(testData.users[2].id)
        .send({ query: mutation, variables })
        .expect(200);

      const result = response.body.data.grantPermission;
      expect(result.success).toBe(false);
      expect(result.error).toContain("insufficient");
      expect(result.code).toBe("INSUFFICIENT_AUTHORITY");
    });

    test("should revoke permission successfully", async () => {
      const mutation = `
        mutation RevokePermission($permissionId: ID!) {
          revokePermission(permissionId: $permissionId) {
            success
            error
            code
          }
        }
      `;

      const variables = {
        permissionId: testData.permissions[2].id,
      };

      const response = await createAuthenticatedRequest(testData.users[1].id)
        .send({ query: mutation, variables })
        .expect(200);

      const result = response.body.data.revokePermission;
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    test("should handle permission expiration", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            permissionId
            error
          }
        }
      `;

      const variables = {
        input: {
          userId: testData.users[2].id,
          nodeId: "test-suburb",
          permissionType: "MANAGE",
          expiresAt: futureDate,
        },
      };

      const response = await createAuthenticatedRequest(testData.users[1].id)
        .send({ query: mutation, variables })
        .expect(200);

      const result = response.body.data.grantPermission;
      expect(result.success).toBe(true);
      expect(result.permissionId).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid GraphQL syntax", async () => {
      const invalidQuery = `
        query {
          invalidField {
            nonExistentField
          }
        }
      `;

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query: invalidQuery })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("Cannot query field");
    });

    test("should handle unauthorized access", async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
            email
          }
        }
      `;

      const response = await request(app)
        .post("/api/graphql")
        .send({ query })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("authentication");
    });

    test("should handle non-existent user queries", async () => {
      const query = `
        query GetUserPermissions($userId: ID!) {
          userPermissions(userId: $userId) {
            id
          }
        }
      `;

      const variables = {
        userId: "non-existent-user",
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      expect(response.body.errors).toBeDefined();
    });

    test("should handle database connection errors gracefully", async () => {
      await prisma.$disconnect();

      const query = `
        query GetCurrentUser {
          currentUser {
            id
          }
        }
      `;

      const response = await createAuthenticatedRequest(
        testData.users[0].id,
      ).send({ query });

      expect(response.body.errors).toBeDefined();

      await prisma.$connect();
    });
  });

  describe("Performance Tests", () => {
    test("should respond to queries within acceptable time", async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            users {
              id
              name
              email
              organizationNodeName
            }
            totalCount
            executionTime
          }
        }
      `;

      const startTime = Date.now();

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.data.accessibleUsers.executionTime).toBeGreaterThan(
        0,
      );
    });

    test("should handle pagination efficiently", async () => {
      const query = `
        query GetAccessibleUsers($pagination: PaginationInput!) {
          accessibleUsers(pagination: $pagination) {
            users {
              id
              name
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `;

      const variables = {
        pagination: { offset: 0, limit: 5 },
      };

      const response = await createAuthenticatedRequest(testData.users[0].id)
        .send({ query, variables })
        .expect(200);

      const result = response.body.data.accessibleUsers;
      expect(result.users.length).toBeLessThanOrEqual(5);
      expect(typeof result.hasNextPage).toBe("boolean");
      expect(typeof result.hasPreviousPage).toBe("boolean");
    });
  });

  describe("Data Consistency", () => {
    test("should maintain consistency across multiple requests", async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            totalCount
          }
        }
      `;

      const requests = Array.from({ length: 5 }, () =>
        createAuthenticatedRequest(testData.users[0].id).send({ query }),
      );

      const responses = await Promise.all(requests);

      const counts = responses.map(
        (r: any) => r.body.data.accessibleUsers.totalCount,
      );
      expect(new Set(counts).size).toBe(1); // All counts should be the same
    });

    test("should reflect permission changes immediately", async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            totalCount
          }
        }
      `;

      const initialResponse = await createAuthenticatedRequest(
        testData.users[0].id,
      )
        .send({ query })
        .expect(200);

      const initialCount = initialResponse.body.data.accessibleUsers.totalCount;

      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
          }
        }
      `;

      const newUser = await prisma.user.create({
        data: {
          email: "newuser@test.com",
          name: "New User",
          passwordHash: "$2b$10$test",
          organizationNodeId: "test-suburb",
          isActive: true,
        },
      });

      const variables = {
        input: {
          userId: newUser.id,
          nodeId: "test-suburb",
          permissionType: "READ",
          expiresAt: null,
        },
      };

      await createAuthenticatedRequest(testData.users[0].id)
        .send({ query: mutation, variables })
        .expect(200);

      const finalResponse = await createAuthenticatedRequest(
        testData.users[0].id,
      )
        .send({ query })
        .expect(200);

      const finalCount = finalResponse.body.data.accessibleUsers.totalCount;
      expect(finalCount).toBeGreaterThan(initialCount);
    });
  });
});
