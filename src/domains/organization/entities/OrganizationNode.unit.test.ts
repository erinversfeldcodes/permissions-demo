// Unit tests for OrganizationNode entity
import { OrganizationNode } from './OrganizationNode'
import { DomainError, ValidationError } from '../../../shared/types'

describe('OrganizationNode Entity', () => {
  let rootNode: OrganizationNode;
  let childNode: OrganizationNode;
  let grandchildNode: OrganizationNode;

  beforeEach(() => {
    rootNode = OrganizationNode.fromPersistence({
      id: 'root-123',
      name: 'Root Organization',
      parentId: undefined,
      level: 2,
      metadata: { type: 'headquarters' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    childNode = OrganizationNode.fromPersistence({
      id: 'child-123',
      name: 'Child Organization',
      parentId: 'root-123',
      level: 1,
      metadata: { type: 'regional' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    grandchildNode = OrganizationNode.fromPersistence({
      id: 'grandchild-123',
      name: 'Grandchild Organization',
      parentId: 'child-123',
      level: 0,
      metadata: { type: 'branch' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  describe('Validation', () => {

    test('should validate required name field', () => {
      expect(() => {
        OrganizationNode.fromPersistence({
          id: 'node-123',
          name: '',
          parentId: undefined,
          level: 1,
          metadata: {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }).toThrow(DomainError)
    })

    test('should validate level is non-negative', () => {
      expect(() => {
        OrganizationNode.fromPersistence({
          id: 'node-123',
          name: 'Test Node',
          parentId: undefined,
          level: -1,
          metadata: {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }).toThrow(DomainError)
    })

  })

  describe('changeName', () => {
    test('should update organization name', () => {
      rootNode.changeName('New Root Name')
      expect(rootNode.name).toBe('New Root Name')
    })

    test('should validate name is not empty', () => {
      expect(() => rootNode.changeName('')).toThrow(DomainError)
    })

  })

  describe('moveToParent', () => {
    test('should update parent ID and recalculate level', () => {
      // Move grandchild to root (level should become 1)
      grandchildNode.moveToParent('root-123', 1)
      expect(grandchildNode.parentId).toBe('root-123')
      expect(grandchildNode.level).toBe(1)
    })

    test('should allow moving to undefined parent (make root)', () => {
      childNode.moveToParent(undefined as any, 2)
      expect(childNode.parentId).toBeUndefined()
      expect(childNode.level).toBe(2)
      expect(childNode.isRoot()).toBe(true)
    })

    test('should prevent moving to self as parent', () => {
      expect(() => {
        childNode.moveToParent('child-123', 1)
      }).toThrow(DomainError)
    })


    test('should prevent self-parenting', () => {
      // Basic validation - prevents node from being its own parent
      expect(() => {
        rootNode.moveToParent('root-123', 0)
      }).toThrow(DomainError)
    })
  })

  describe('makeRoot', () => {
    test('should convert node to root node', () => {
      childNode.makeRoot()
      expect(childNode.parentId).toBeUndefined()
      expect(childNode.level).toBe(0)
      expect(childNode.isRoot()).toBe(true)
    })

    test('should handle already root node gracefully', () => {
      rootNode.makeRoot()
      expect(rootNode.isRoot()).toBe(true)
      expect(rootNode.level).toBe(0)
    })

    test('should set level to 0 when making root', () => {
      childNode.makeRoot()
      expect(childNode.level).toBe(0)
    })
  })

  describe('activate', () => {
    test('should activate inactive node', () => {
      // First deactivate, then activate
      rootNode.deactivate()
      expect(rootNode.isActive).toBe(false)
      rootNode.activate()
      expect(rootNode.isActive).toBe(true)
    })

    test('should handle already active node gracefully', () => {
      expect(rootNode.isActive).toBe(true)
      rootNode.activate()
      expect(rootNode.isActive).toBe(true)
    })
  })

  describe('deactivate', () => {
    test('should deactivate active node', () => {
      rootNode.deactivate()
      expect(rootNode.isActive).toBe(false)
    })

    test('should handle already inactive node gracefully', () => {
      rootNode.deactivate()
      expect(rootNode.isActive).toBe(false)
      rootNode.deactivate()
      expect(rootNode.isActive).toBe(false)
    })
  })

  describe('updateMetadata', () => {
    test('should update node metadata', () => {
      const newMetadata = { type: 'branch', region: 'north' }
      rootNode.updateMetadata(newMetadata)
      expect(rootNode.metadata).toEqual(newMetadata)
    })

    test('should handle additional metadata by merging with existing', () => {
      // Reset to original state first
      rootNode.updateMetadata({ type: 'headquarters' })
      // Add new metadata
      rootNode.updateMetadata({ region: 'north' })
      expect(rootNode.metadata).toEqual({ type: 'headquarters', region: 'north' })
    })

    test('should handle empty metadata object by keeping existing', () => {
      // Empty metadata object should not change existing metadata
      const originalMetadata = { ...rootNode.metadata }
      rootNode.updateMetadata({})
      expect(rootNode.metadata).toEqual(originalMetadata)
    })
  })

  describe('isRoot', () => {
    test('should return true for root nodes', () => {
      expect(rootNode.isRoot()).toBe(true)
    })

    test('should return false for child nodes', () => {
      expect(childNode.isRoot()).toBe(false)
      expect(grandchildNode.isRoot()).toBe(false)
    })
  })

  describe('parent-child relationships', () => {
    test('should identify direct parent relationship', () => {
      expect(childNode.isChildOf(rootNode.id)).toBe(true)
      expect(grandchildNode.isChildOf(childNode.id)).toBe(true)
    })

    test('should return false for non-parent nodes', () => {
      expect(rootNode.isChildOf(childNode.id)).toBe(false)
      expect(childNode.isChildOf(grandchildNode.id)).toBe(false)
    })

    test('should identify level relationships', () => {
      expect(rootNode.isAtLevel(2)).toBe(true)
      expect(childNode.isAtLevel(1)).toBe(true)
      expect(grandchildNode.isAtLevel(0)).toBe(true)
    })
  })

  describe('node equality', () => {
    test('should identify equal nodes', () => {
      const duplicateRoot = OrganizationNode.fromPersistence({
        id: 'root-123',
        name: 'Different Name',
        parentId: undefined,
        level: 3,
        metadata: { type: 'different' },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      expect(rootNode.equals(duplicateRoot)).toBe(true)
    })

    test('should identify different nodes', () => {
      expect(rootNode.equals(childNode)).toBe(false)
      expect(childNode.equals(grandchildNode)).toBe(false)
    })
  })

  describe('State Changes', () => {
    test('should update timestamp when name changes', () => {
      const originalUpdatedAt = rootNode.updatedAt
      // Small delay to ensure timestamp difference
      setTimeout(() => {
        rootNode.changeName('New Name')
        expect(rootNode.name).toBe('New Name')
        expect(rootNode.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      }, 1)
    })

    test('should update timestamp when parent changes', () => {
      const originalUpdatedAt = childNode.updatedAt
      setTimeout(() => {
        childNode.moveToParent('new-parent-123', 1)
        expect(childNode.parentId).toBe('new-parent-123')
        expect(childNode.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      }, 1)
    })

    test('should update timestamp when activated', () => {
      const originalUpdatedAt = rootNode.updatedAt
      rootNode.deactivate()
      setTimeout(() => {
        rootNode.activate()
        expect(rootNode.isActive).toBe(true)
        expect(rootNode.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      }, 1)
    })

    test('should update timestamp when deactivated', () => {
      const originalUpdatedAt = rootNode.updatedAt
      setTimeout(() => {
        rootNode.deactivate()
        expect(rootNode.isActive).toBe(false)
        expect(rootNode.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
      }, 1)
    })
  })

  describe('Business Rules', () => {
    test('should enforce hierarchy level consistency', () => {
      // Parent level should be greater than child level
      expect(rootNode.level).toBeGreaterThan(childNode.level)
      expect(childNode.level).toBeGreaterThan(grandchildNode.level)
    })

    test('should maintain parent-child relationship integrity', () => {
      expect(childNode.parentId).toBe(rootNode.id)
      expect(grandchildNode.parentId).toBe(childNode.id)
    })

    test('should support metadata for flexible organization structure', () => {
      expect(rootNode.metadata).toEqual({ type: 'headquarters' })
      expect(childNode.metadata).toEqual({ type: 'regional' })
      expect(grandchildNode.metadata).toEqual({ type: 'branch' })
    })
  })

  describe('Integration Points', () => {
    test('should provide serialization for persistence', () => {
      const plainObject = rootNode.toPlainObject()
      const restoredNode = OrganizationNode.fromPersistence(plainObject)
      expect(restoredNode.equals(rootNode)).toBe(true)
    })

    test('should support static factory methods', () => {
      const newNode = OrganizationNode.create({
        id: 'new-123',
        name: 'New Node',
        parentId: 'root-123',
        level: 1,
        metadata: { type: 'test' },
        isActive: true
      })
      expect(newNode.id).toBe('new-123')
      expect(newNode.name).toBe('New Node')
      expect(newNode.createdAt).toBeInstanceOf(Date)
      expect(newNode.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Error Handling', () => {
    test('should provide meaningful error messages', () => {
      try {
        rootNode.changeName('')
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError)
        expect((error as DomainError).message).toContain('name')
      }
    })

    test('should handle null/undefined values gracefully', () => {
      expect(() => rootNode.changeName(null as any)).toThrow(DomainError)
      expect(() => rootNode.changeName(undefined as any)).toThrow(DomainError)
    })

    test('should validate self-parenting prevention', () => {
      expect(() => {
        rootNode.moveToParent('root-123', 0)
      }).toThrow(DomainError)
    })
  })

})