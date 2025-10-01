// API tests for authentication and authorization
import { createServer } from 'http'
import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import request from 'supertest'
import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { typeDefs } from '../../api/graphql/schema'
import { resolvers } from '../../api/graphql/resolvers'
import { PermissionType } from '../../shared/types'
import { GraphQLContext } from '../../api/graphql/types/context'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'file:./test-auth.db'
    }
  }
})

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true
})

describe('Authentication & Authorization API Tests', () => {
  let app: any;
  let testUsers: any[];
  let testNodes: any[];

  beforeAll(async () => {
    const handler = startServerAndCreateNextHandler(server, {
      context: async (req): Promise<GraphQLContext> => {
        const user = await getUserFromRequest(req)
        return {
          userId: user?.id,
          user,
          isAuthenticated: !!user,
          requestId: nanoid(),
          userAgent: req.headers?.['user-agent'],
          ipAddress: req.socket?.remoteAddress,
          permissions: user ? [] : undefined
        }
      }
    })

    app = createServer(async (req, res) => {
      if (req.url === '/api/graphql' && req.method === 'POST') {
        return await handler(req as any as NextApiRequest, res as any as NextApiResponse)
      }
      res.statusCode = 404
      res.end('Not Found')
    })

    await server.start()
  })

  afterAll(async () => {
    await server.stop()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await setupTestData()
  })

  async function getUserFromRequest(req: any): Promise<any> {
    const authHeader = req.headers?.authorization
    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')
    if (token.startsWith('mock-token-')) {
      const userId = token.replace('mock-token-', '')
      return await prisma.user.findUnique({ where: { id: userId } })
    }

    return null
  }

  async function setupTestData() {
    // Clean database
    await prisma.userPermission.deleteMany()
    await prisma.nodeHierarchy.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organizationNode.deleteMany()

    // Create organization hierarchy
    const national = await prisma.organizationNode.create({
      data: {
        id: 'auth-national',
        name: 'Auth National',
        level: 0,
        parentId: null,
        isActive: true
      }
    })

    const city = await prisma.organizationNode.create({
      data: {
        id: 'auth-city',
        name: 'Auth City',
        level: 1,
        parentId: national.id,
        isActive: true
      }
    })

    const suburb = await prisma.organizationNode.create({
      data: {
        id: 'auth-suburb',
        name: 'Auth Suburb',
        level: 2,
        parentId: city.id,
        isActive: true
      }
    })

    testNodes = [national, city, suburb]

    // Create closure table
    for (const node of testNodes) {
      await prisma.nodeHierarchy.create({
        data: {
          ancestorId: node.id,
          descendantId: node.id,
          depth: 0
        }
      })
    }

    await prisma.nodeHierarchy.create({
      data: { ancestorId: national.id, descendantId: city.id, depth: 1 }
    })

    await prisma.nodeHierarchy.create({
      data: { ancestorId: city.id, descendantId: suburb.id, depth: 1 }
    })

    await prisma.nodeHierarchy.create({
      data: { ancestorId: national.id, descendantId: suburb.id, depth: 2 }
    })

    // Create users with different permission levels
    const adminUser = await prisma.user.create({
      data: {
        id: 'auth-admin',
        email: 'admin@auth.test',
        name: 'Auth Admin',
        passwordHash: '$2b$10$test',
        organizationNodeId: national.id,
        isActive: true
      }
    })

    const managerUser = await prisma.user.create({
      data: {
        id: 'auth-manager',
        email: 'manager@auth.test',
        name: 'Auth Manager',
        passwordHash: '$2b$10$test',
        organizationNodeId: city.id,
        isActive: true
      }
    })

    const userUser = await prisma.user.create({
      data: {
        id: 'auth-user',
        email: 'user@auth.test',
        name: 'Auth User',
        passwordHash: '$2b$10$test',
        organizationNodeId: suburb.id,
        isActive: true
      }
    })

    const inactiveUser = await prisma.user.create({
      data: {
        id: 'auth-inactive',
        email: 'inactive@auth.test',
        name: 'Inactive User',
        passwordHash: '$2b$10$test',
        organizationNodeId: suburb.id,
        isActive: false
      }
    })

    testUsers = [adminUser, managerUser, userUser, inactiveUser]

    // Create permissions
    await prisma.userPermission.create({
      data: {
        userId: adminUser.id,
        nodeId: national.id,
        permissionType: PermissionType.ADMIN,
        grantedById: adminUser.id,
        isActive: true
      }
    })

    await prisma.userPermission.create({
      data: {
        userId: managerUser.id,
        nodeId: city.id,
        permissionType: PermissionType.MANAGE,
        grantedById: adminUser.id,
        isActive: true
      }
    })

    await prisma.userPermission.create({
      data: {
        userId: userUser.id,
        nodeId: suburb.id,
        permissionType: PermissionType.READ,
        grantedById: managerUser.id,
        isActive: true
      }
    })
  }

  function makeAuthenticatedRequest(userId?: string) {
    const req = request(app).post('/api/graphql')
    if (userId) {
      req.set('Authorization', `Bearer mock-token-${userId}`)
    }
    return req
  }

  describe('Authentication Tests', () => {
    test('should reject requests without authentication', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
            email
          }
        }
      `

      const response = await makeAuthenticatedRequest()
        .send({ query })
        .expect(200)

      expect(response.body.errors).toBeDefined()
      expect(response.body.errors[0].message).toContain('authentication')
    })

    test('should reject requests with invalid token', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
          }
        }
      `

      const response = await request(app)
        .post('/api/graphql')
        .set('Authorization', 'Bearer invalid-token')
        .send({ query })
        .expect(200)

      expect(response.body.errors).toBeDefined()
    })

    test('should accept requests with valid authentication', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
            email
            name
          }
        }
      `

      const response = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query })
        .expect(200)

      expect(response.body.data.currentUser).toEqual({
        id: testUsers[0].id,
        email: 'admin@auth.test',
        name: 'Auth Admin'
      })
    })

    test('should reject requests from inactive users', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
          }
        }
      `

      const response = await makeAuthenticatedRequest(testUsers[3].id)
        .send({ query })
        .expect(200)

      expect(response.body.errors).toBeDefined()
      expect(response.body.errors[0].message).toContain('inactive')
    })
  })

  describe('Authorization Tests', () => {
    test('admin should access all data', async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            users {
              id
              name
            }
            totalCount
          }
        }
      `

      const response = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query })
        .expect(200)

      expect(response.body.data.accessibleUsers.totalCount).toBeGreaterThan(0)
    })

    test('manager should only access subordinate data', async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            users {
              id
              name
            }
            totalCount
          }
        }
      `

      const response = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query })
        .expect(200)

      const users = response.body.data.accessibleUsers.users
      // Manager should not see admin users from higher levels
      expect(users.every((u: any) => u.id !== testUsers[0].id)).toBe(true)
    })

    test('regular user should have limited access', async () => {
      const query = `
        query GetAccessibleUsers {
          accessibleUsers {
            users {
              id
            }
            totalCount
          }
        }
      `

      const response = await makeAuthenticatedRequest(testUsers[2].id)
        .send({ query })
        .expect(200)

      // Regular user should have minimal access
      expect(response.body.data.accessibleUsers.totalCount).toBeLessThanOrEqual(1)
    })

    test('should enforce permission hierarchy for granting permissions', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      // Manager trying to grant ADMIN permission (should fail)
      const variables = {
        input: {
          userId: testUsers[2].id,
          nodeId: testNodes[2].id,
          permissionType: 'ADMIN'
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(false)
      expect(result.code).toBe('INSUFFICIENT_AUTHORITY')
    })

    test('should allow appropriate permission granting', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            permissionId
            error
          }
        }
      `

      // Admin granting MANAGE permission (should succeed)
      const variables = {
        input: {
          userId: testUsers[2].id,
          nodeId: testNodes[1].id,
          permissionType: 'MANAGE'
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(true)
      expect(result.permissionId).toBeDefined()
    })

    test('should enforce organizational boundaries', async () => {
      // Create user in different organization
      const otherOrg = await prisma.organizationNode.create({
        data: {
          name: 'Other Org',
          level: 0,
          parentId: null,
          isActive: true
        }
      })

      const otherUser = await prisma.user.create({
        data: {
          email: 'other@org.test',
          name: 'Other User',
          passwordHash: '$2b$10$test',
          organizationNodeId: otherOrg.id,
          isActive: true
        }
      })

      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      // Manager trying to grant permission to user in different org
      const variables = {
        input: {
          userId: otherUser.id,
          nodeId: testNodes[1].id,
          permissionType: 'READ'
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(false)
    })
  })

  describe('Permission Validation Tests', () => {
    test('should validate required fields in grant permission', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      const variables = {
        input: {
          userId: '',
          nodeId: testNodes[0].id,
          permissionType: 'READ'
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(false)
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('should validate permission expiration dates', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      const pastDate = new Date(Date.now() - 86400000).toISOString()

      const variables = {
        input: {
          userId: testUsers[2].id,
          nodeId: testNodes[2].id,
          permissionType: 'READ',
          expiresAt: pastDate
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(false)
      expect(result.error).toContain('expiration')
    })

    test('should prevent duplicate active permissions', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      const variables = {
        input: {
          userId: testUsers[2].id,
          nodeId: testNodes[2].id,
          permissionType: 'READ'
        }
      }

      // First grant should succeed
      const firstResponse = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query: mutation, variables })
        .expect(200)

      expect(firstResponse.body.data.grantPermission.success).toBe(true)

      // Second grant should fail (duplicate)
      const secondResponse = await makeAuthenticatedRequest(testUsers[0].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = secondResponse.body.data.grantPermission
      expect(result.success).toBe(false)
      expect(result.code).toBe('PERMISSION_EXISTS')
    })

    test('should prevent self-granting permissions', async () => {
      const mutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            error
            code
          }
        }
      `

      const variables = {
        input: {
          userId: testUsers[1].id,
          nodeId: testNodes[1].id,
          permissionType: 'ADMIN'
        }
      }

      const response = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query: mutation, variables })
        .expect(200)

      const result = response.body.data.grantPermission
      expect(result.success).toBe(false)
      expect(result.code).toBe('SELF_GRANT_FORBIDDEN')
    })
  })

  describe('Revocation Authorization Tests', () => {
    test('should allow revoking own granted permissions', async () => {
      // First grant a permission
      const grantMutation = `
        mutation GrantPermission($input: GrantPermissionInput!) {
          grantPermission(input: $input) {
            success
            permissionId
          }
        }
      `

      const grantVariables = {
        input: {
          userId: testUsers[2].id,
          nodeId: testNodes[1].id,
          permissionType: 'READ'
        }
      }

      const grantResponse = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query: grantMutation, variables: grantVariables })
        .expect(200)

      const permissionId = grantResponse.body.data.grantPermission.permissionId

      // Then revoke it
      const revokeMutation = `
        mutation RevokePermission($permissionId: ID!) {
          revokePermission(permissionId: $permissionId) {
            success
            error
          }
        }
      `

      const revokeResponse = await makeAuthenticatedRequest(testUsers[1].id)
        .send({ query: revokeMutation, variables: { permissionId } })
        .expect(200)

      expect(revokeResponse.body.data.revokePermission.success).toBe(true)
    })

    test('should prevent unauthorized revocation', async () => {
      const revokeMutation = `
        mutation RevokePermission($permissionId: ID!) {
          revokePermission(permissionId: $permissionId) {
            success
            error
            code
          }
        }
      `

      // Regular user trying to revoke manager permission
      const managerPermission = await prisma.userPermission.findFirst({
        where: { userId: testUsers[1].id }
      })

      const response = await makeAuthenticatedRequest(testUsers[2].id)
        .send({
          query: revokeMutation,
          variables: { permissionId: managerPermission?.id }
        })
        .expect(200)

      const result = response.body.data.revokePermission
      expect(result.success).toBe(false)
      expect(result.code).toBe('INSUFFICIENT_AUTHORITY')
    })
  })

  describe('Session Management Tests', () => {
    test('should handle concurrent sessions for same user', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
            name
          }
        }
      `

      // Make multiple concurrent requests with same user
      const requests = Array.from({ length: 5 }, () =>
        makeAuthenticatedRequest(testUsers[0].id).send({ query })
      )

      const responses = await Promise.all(requests)

      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.data.currentUser.id).toBe(testUsers[0].id)
      })
    })

    test('should handle rapid authentication changes', async () => {
      const query = `
        query GetCurrentUser {
          currentUser {
            id
          }
        }
      `

      // Alternate between different users rapidly
      const userIds = [testUsers[0].id, testUsers[1].id, testUsers[2].id]
      const requests = []

      for (let i = 0; i < 9; i++) {
        const userId = userIds[i % 3]
        requests.push(makeAuthenticatedRequest(userId).send({ query }))
      }

      const responses = await Promise.all(requests)

      responses.forEach((response, index) => {
        const expectedUserId = userIds[index % 3]
        expect(response.status).toBe(200)
        expect(response.body.data.currentUser.id).toBe(expectedUserId)
      })
    })
  })
})