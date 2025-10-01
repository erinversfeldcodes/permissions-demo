// Jest setup for all tests
// @testing-library/jest-dom only needed for integration/api tests

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NODE_ENV = 'test'

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock nanoid for predictable IDs in tests
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-123')
}))

// Mock bcryptjs for faster tests
jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (password) => `hashed_${password}`),
  compare: jest.fn(async (password, hash) => hash === `hashed_${password}`)
}))

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ userId: 'test-user-id', email: 'test@example.com' }))
}))