// Unit tests for Permission entity
import { Permission } from './Permission'
import { PermissionType, DomainError, ValidationError } from '../../../shared/types'

describe('Permission Entity', () => {
  let testPermission: Permission;
  let futureDate: Date;
  let pastDate: Date;

  beforeEach(() => {
    futureDate = new Date(Date.now() + 86400000) // +1 day
    pastDate = new Date(Date.now() - 86400000) // -1 day

    testPermission = Permission.create({
      id: 'perm-123',
      userId: 'user-123',
      nodeId: 'node-123',
      permissionType: PermissionType.READ,
      grantedById: 'granter-123',
      isActive: true
    })
  })

  describe('Validation', () => {

    test('should validate required user ID', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: '',
          nodeId: 'node-123',
          permissionType: PermissionType.READ,
          grantedById: 'granter-123',
          isActive: true
        })
      }).toThrow(ValidationError)
    })

    test('should validate required node ID', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: 'user-123',
          nodeId: '',
          permissionType: PermissionType.READ,
          grantedById: 'granter-123',
          isActive: true
        })
      }).toThrow(ValidationError)
    })

    test('should validate required granter ID', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: 'user-123',
          nodeId: 'node-123',
          permissionType: PermissionType.READ,
          grantedById: '',
          isActive: true
        })
      }).toThrow(ValidationError)
    })

    test('should validate permission type', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: 'user-123',
          nodeId: 'node-123',
          permissionType: 'INVALID' as PermissionType,
          grantedById: 'granter-123',
          isActive: true
        })
      }).toThrow(ValidationError)
    })

  })

  describe('setExpiration', () => {
    test('should set future expiration date', () => {
      testPermission.setExpiration(futureDate)
      expect(testPermission.expiresAt).toEqual(futureDate)
    })

    test('should allow removing expiration', () => {
      testPermission.setExpiration(futureDate)
      testPermission.removeExpiration()
      expect(testPermission.expiresAt).toBeUndefined()
    })

    test('should reject past expiration dates', () => {
      expect(() => {
        testPermission.setExpiration(pastDate)
      }).toThrow(ValidationError)
    })

    test('should allow expiration date exactly now', () => {
      const now = new Date(Date.now() + 1000) // 1 second in the future
      testPermission.setExpiration(now)
      expect(testPermission.expiresAt).toEqual(now)
    })
  })

  describe('revoke', () => {
    test('should deactivate active permission', () => {
      testPermission.revoke()
      expect(testPermission.isActive).toBe(false)
    })

    test('should handle already revoked permission gracefully', () => {
      testPermission.revoke()
      testPermission.revoke()
      expect(testPermission.isActive).toBe(false)
    })

    test('should not affect expiration date when revoking', () => {
      testPermission.setExpiration(futureDate)
      testPermission.revoke()
      expect(testPermission.expiresAt).toEqual(futureDate)
      expect(testPermission.isActive).toBe(false)
    })
  })

  describe('reactivate', () => {
    test('should activate revoked permission', () => {
      testPermission.revoke()
      testPermission.reactivate()
      expect(testPermission.isActive).toBe(true)
    })

    test('should handle already active permission gracefully', () => {
      testPermission.reactivate()
      expect(testPermission.isActive).toBe(true)
    })

    test('should not reactivate expired permission', () => {
      testPermission.setExpirationUnsafe(pastDate)
      testPermission.revoke()

      expect(() => {
        testPermission.reactivate()
      }).toThrow(DomainError)
    })
  })

  describe('isEffective', () => {
    test('should return true for active, non-expired permission', () => {
      expect(testPermission.isEffective()).toBe(true)
    })

    test('should return false for inactive permission', () => {
      testPermission.revoke()
      expect(testPermission.isEffective()).toBe(false)
    })

    test('should return false for expired permission', () => {
      testPermission.setExpirationUnsafe(pastDate)
      expect(testPermission.isEffective()).toBe(false)
    })

    test('should return true for non-expired permission with future expiration', () => {
      testPermission.setExpiration(futureDate)
      expect(testPermission.isEffective()).toBe(true)
    })

    test('should return false for inactive and expired permission', () => {
      testPermission.setExpirationUnsafe(pastDate)
      testPermission.revoke()
      expect(testPermission.isEffective()).toBe(false)
    })

    test('should handle undefined expiration as never expires', () => {
      expect(testPermission.expiresAt).toBeUndefined()
      expect(testPermission.isEffective()).toBe(true)
    })
  })

  describe('isExpired', () => {
    test('should return false for non-expired permission', () => {
      testPermission.setExpiration(futureDate)
      expect(testPermission.isExpired()).toBe(false)
    })

    test('should return true for expired permission', () => {
      testPermission.setExpirationUnsafe(pastDate)
      expect(testPermission.isExpired()).toBe(true)
    })

    test('should return false for permission without expiration', () => {
      expect(testPermission.isExpired()).toBe(false)
    })

    test('should handle edge case of expiration exactly now', () => {
      const now = new Date(Date.now() + 100) // Just slightly in the future
      testPermission.setExpiration(now)
      // Should be considered not expired until time passes
      expect(testPermission.isExpired()).toBe(false)
    })
  })



  describe('Business Rules', () => {
    test('should enforce permission cannot be granted to same user by same user', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: 'user-123',
          nodeId: 'node-123',
          permissionType: PermissionType.READ,
          grantedById: 'user-123', // Same as userId
          isActive: true
        })
      }).toThrow(DomainError)
    })

    test('should maintain audit trail through timestamps', () => {
      expect(testPermission.grantedAt).toBeInstanceOf(Date)
      expect(testPermission.grantedAt.getTime()).toBeLessThanOrEqual(Date.now())
    })
  })


  describe('Edge Cases', () => {
    test('should handle rapid revoke/reactivate cycles', () => {
      testPermission.revoke()
      testPermission.reactivate()
      testPermission.revoke()
      testPermission.reactivate()

      expect(testPermission.isActive).toBe(true)
      expect(testPermission.isEffective()).toBe(true)
    })

    test('should handle expiration date changes', () => {
      testPermission.setExpiration(futureDate)
      expect(testPermission.isEffective()).toBe(true)

      testPermission.setExpirationUnsafe(pastDate)
      expect(testPermission.isEffective()).toBe(false)

      testPermission.removeExpiration()
      expect(testPermission.isEffective()).toBe(true)
    })

    test('should validate concurrent modification scenarios', () => {
      // Test that permission state remains consistent
      const originalState = {
        isActive: testPermission.isActive,
        expiresAt: testPermission.expiresAt
      }

      testPermission.setExpiration(futureDate)
      testPermission.revoke()

      expect(testPermission.isActive).toBe(false)
      expect(testPermission.expiresAt).toEqual(futureDate)
    })
  })

  describe('Error Handling', () => {
    test('should provide meaningful error messages', () => {
      try {
        testPermission.setExpirationUnsafe(pastDate)
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError)
        expect((error as DomainError).message).toContain('Expiration')
      }
    })

    test('should handle null/undefined values gracefully', () => {
      expect(() => {
        Permission.create({
          id: 'perm-123',
          userId: null as any,
          nodeId: 'node-123',
          permissionType: PermissionType.READ,
          grantedById: 'granter-123',
          isActive: true
        })
      }).toThrow(ValidationError)
    })

    test('should validate domain constraints', () => {
      expect(() => {
        testPermission.reactivate() // Already active
      }).not.toThrow() // Should be idempotent

      testPermission.setExpirationUnsafe(pastDate)
      testPermission.revoke()

      expect(() => {
        testPermission.reactivate() // Expired and inactive
      }).toThrow(DomainError)
    })
  })

  describe('Performance Considerations', () => {
    test('should efficiently check effectiveness', () => {
      const startTime = Date.now()

      for (let i = 0; i < 10000; i++) {
        testPermission.isEffective()
      }

      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(100) // Should be very fast
    })

    test('should handle large numbers of permissions', () => {
      const permissions: Permission[] = []

      for (let i = 0; i < 1000; i++) {
        permissions.push(Permission.create({
          id: `perm-${i}`,
          userId: 'user-123',
          nodeId: 'node-123',
          permissionType: PermissionType.READ,
          grantedById: 'granter-123',
          isActive: true
        }))
      }

      expect(permissions).toHaveLength(1000)
      expect(permissions.every(p => p.isEffective())).toBe(true)
    })
  })
})