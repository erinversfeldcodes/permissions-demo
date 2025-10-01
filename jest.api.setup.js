// Jest setup for API tests
const { execSync } = require('child_process')

// Global test server setup
let testServer

beforeAll(async () => {
  // Setup test database
  try {
    execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'ignore' })
    execSync('npx prisma migrate dev --skip-seed', { stdio: 'ignore' })
    execSync('npx prisma generate', { stdio: 'ignore' })
  } catch (error) {
    console.error('Failed to setup test database:', error)
  }

  // Create test data for API tests
  const { createTestData } = require('./tests/helpers/test-data')
  await createTestData()
})

// Clean up test data after each test
afterEach(async () => {
  const { db } = require('./src/shared/infrastructure/database')

  try {
    // Clean up non-essential test data but keep base structure
    await db.userPermission.deleteMany({
      where: {
        grantedBy: { email: { contains: 'test' } }
      }
    })
  } catch (error) {
    console.error('Failed to clean API test data:', error)
  }
})

afterAll(async () => {
  const { DatabaseConnection } = require('./src/shared/infrastructure/database')
  await DatabaseConnection.disconnect()

  if (testServer) {
    testServer.close()
  }
})