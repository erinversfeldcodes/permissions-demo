// Database Seed Script for Ekko Permissions System
// Creates sample hierarchical organization and users for testing

import { PrismaClient, PermissionType } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.domainEvent.deleteMany();
  await prisma.materializedViewStatus.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.nodeHierarchy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organizationNode.deleteMany();

  console.log('🧹 Cleared existing data');

  // Create organizational hierarchy: National -> City -> Suburb

  // National level (level 2)
  const national1 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'National Office',
      parentId: null,
      level: 2,
      metadata: JSON.stringify({ description: 'Main national headquarters' }),
      isActive: true
    }
  });

  // City level (level 1)
  const city1 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'London Office',
      parentId: national1.id,
      level: 1,
      metadata: JSON.stringify({ description: 'London regional office' }),
      isActive: true
    }
  });

  const city2 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'Manchester Office',
      parentId: national1.id,
      level: 1,
      metadata: JSON.stringify({ description: 'Manchester regional office' }),
      isActive: true
    }
  });

  // Suburb level (level 0) - London suburbs
  const suburb1 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'Westminster Branch',
      parentId: city1.id,
      level: 0,
      metadata: JSON.stringify({ description: 'Westminster local branch' }),
      isActive: true
    }
  });

  const suburb2 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'Camden Branch',
      parentId: city1.id,
      level: 0,
      metadata: JSON.stringify({ description: 'Camden local branch' }),
      isActive: true
    }
  });

  // Manchester suburbs
  const suburb3 = await prisma.organizationNode.create({
    data: {
      id: nanoid(),
      name: 'City Centre Branch',
      parentId: city2.id,
      level: 0,
      metadata: JSON.stringify({ description: 'Manchester city centre branch' }),
      isActive: true
    }
  });

  console.log('🏢 Created organizational hierarchy');

  // Build closure table for hierarchy relationships
  const nodes = [national1, city1, city2, suburb1, suburb2, suburb3];

  // Self-relationships (depth 0)
  for (const node of nodes) {
    await prisma.nodeHierarchy.create({
      data: {
        ancestorId: node.id,
        descendantId: node.id,
        depth: 0
      }
    });
  }

  // Parent-child relationships (depth 1)
  const relationships = [
    { parent: national1, child: city1 },
    { parent: national1, child: city2 },
    { parent: city1, child: suburb1 },
    { parent: city1, child: suburb2 },
    { parent: city2, child: suburb3 }
  ];

  for (const rel of relationships) {
    await prisma.nodeHierarchy.create({
      data: {
        ancestorId: rel.parent.id,
        descendantId: rel.child.id,
        depth: 1
      }
    });
  }

  // Grandparent relationships (depth 2)
  const grandRelationships = [
    { grandparent: national1, grandchild: suburb1 },
    { grandparent: national1, grandchild: suburb2 },
    { grandparent: national1, grandchild: suburb3 }
  ];

  for (const rel of grandRelationships) {
    await prisma.nodeHierarchy.create({
      data: {
        ancestorId: rel.grandparent.id,
        descendantId: rel.grandchild.id,
        depth: 2
      }
    });
  }

  console.log('🔗 Built closure table relationships');

  // Create users
  const password = await bcrypt.hash('Password123!', 12);

  // National admin
  const adminUser = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'admin@ekko.earth',
      name: 'System Administrator',
      passwordHash: password,
      organizationNodeId: national1.id,
      isActive: true
    }
  });

  // City managers
  const londonManager = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'london.manager@ekko.earth',
      name: 'London Manager',
      passwordHash: password,
      organizationNodeId: city1.id,
      isActive: true
    }
  });

  const manchesterManager = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'manchester.manager@ekko.earth',
      name: 'Manchester Manager',
      passwordHash: password,
      organizationNodeId: city2.id,
      isActive: true
    }
  });

  // Suburb staff
  const westminsterStaff = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'westminster.staff@ekko.earth',
      name: 'Westminster Staff Member',
      passwordHash: password,
      organizationNodeId: suburb1.id,
      isActive: true
    }
  });

  const camdenStaff = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'camden.staff@ekko.earth',
      name: 'Camden Staff Member',
      passwordHash: password,
      organizationNodeId: suburb2.id,
      isActive: true
    }
  });

  const cityStaff = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'citycentre.staff@ekko.earth',
      name: 'City Centre Staff Member',
      passwordHash: password,
      organizationNodeId: suburb3.id,
      isActive: true
    }
  });

  console.log('👥 Created users');

  // Create permissions
  // Admin has ADMIN permission at national level (can access everyone)
  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: adminUser.id,
      nodeId: national1.id,
      permissionType: PermissionType.ADMIN,
      grantedById: adminUser.id, // Self-granted for bootstrap
      isActive: true
    }
  });

  // London manager has MANAGE permission at London city level
  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: londonManager.id,
      nodeId: city1.id,
      permissionType: PermissionType.MANAGE,
      grantedById: adminUser.id,
      isActive: true
    }
  });

  // Manchester manager has MANAGE permission at Manchester city level
  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: manchesterManager.id,
      nodeId: city2.id,
      permissionType: PermissionType.MANAGE,
      grantedById: adminUser.id,
      isActive: true
    }
  });

  // Staff members have READ permission at their suburb level
  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: westminsterStaff.id,
      nodeId: suburb1.id,
      permissionType: PermissionType.READ,
      grantedById: londonManager.id,
      isActive: true
    }
  });

  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: camdenStaff.id,
      nodeId: suburb2.id,
      permissionType: PermissionType.READ,
      grantedById: londonManager.id,
      isActive: true
    }
  });

  await prisma.userPermission.create({
    data: {
      id: nanoid(),
      userId: cityStaff.id,
      nodeId: suburb3.id,
      permissionType: PermissionType.READ,
      grantedById: manchesterManager.id,
      isActive: true
    }
  });

  console.log('🔐 Created permissions');

  // Create materialized views for PostgreSQL (if not exists)
  try {
    const isPostgreSQL = process.env.DATABASE_URL?.includes('postgresql') || process.env.DATABASE_URL?.includes('postgres');

    if (isPostgreSQL) {
      console.log('📊 Creating materialized views for PostgreSQL...');

      // Create materialized view for user accessible hierarchy
      await prisma.$executeRawUnsafe(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS user_accessible_hierarchy AS
        SELECT DISTINCT
          requester.id as requester_id,
          target.id as target_user_id,
          target.name as target_name,
          target.email as target_email,
          target.organization_node_id as target_node_id,
          org.name as organization_name,
          org.level as organization_level,
          up.permission_type as permission_through,
          up.granted_at as permission_granted_at
        FROM users requester
        JOIN user_permissions up ON requester.id = up.user_id
        JOIN node_hierarchies nh ON up.node_id = nh.ancestor_id
        JOIN users target ON target.organization_node_id = nh.descendant_id
        JOIN organization_nodes org ON target.organization_node_id = org.id
        WHERE up.is_active = true
          AND target.is_active = true
          AND org.is_active = true
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
          AND requester.id != target.id;
      `);

      // Create unique index on materialized view for performance
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accessible_hierarchy_unique
        ON user_accessible_hierarchy (requester_id, target_user_id);
      `);

      // Create additional indexes for common query patterns
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_user_accessible_hierarchy_requester
        ON user_accessible_hierarchy (requester_id);
      `);

      // Function to refresh materialized view
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION refresh_user_hierarchy_view()
        RETURNS void AS $$
        BEGIN
          REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_hierarchy;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create performance indexes for production load
      console.log('🚀 Creating performance optimization indexes...');

      // Enable trigram extension for fuzzy search
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

      // Composite index for the main join in accessible users query
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_user_active_expires
        ON user_permissions(user_id, is_active, expires_at)
        WHERE is_active = true;
      `);

      // Composite index for hierarchy joins
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_hierarchies_ancestor_descendant
        ON node_hierarchies(ancestor_id, descendant_id);
      `);

      // Index for user filtering and joins
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org_node_active_name
        ON users(organization_node_id, is_active, name);
      `);

      // Index for search functionality (trigram indexes for fuzzy search)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm
        ON users USING gin(name gin_trgm_ops);
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm
        ON users USING gin(email gin_trgm_ops);
      `);

      // Index for materialized view status lookups
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materialized_view_status_stale_refresh
        ON materialized_view_status(is_stale, last_refreshed);
      `);

      // Covering index for organization node joins
      await prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_nodes_id_name
        ON organization_nodes(id) INCLUDE (name);
      `);

      // Update table statistics for query planner
      await prisma.$executeRawUnsafe(`ANALYZE user_permissions;`);
      await prisma.$executeRawUnsafe(`ANALYZE node_hierarchies;`);
      await prisma.$executeRawUnsafe(`ANALYZE users;`);
      await prisma.$executeRawUnsafe(`ANALYZE organization_nodes;`);
      await prisma.$executeRawUnsafe(`ANALYZE materialized_view_status;`);

      console.log('📊 Created materialized views, indexes, and functions');
      console.log('🚀 Applied performance optimizations for production load');
    } else {
      console.log('📝 SQLite detected - materialized views are simulated via regular queries');
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not create materialized views or indexes:', error instanceof Error ? error.message : String(error));
    console.log('   This is expected for SQLite or if views/indexes already exist');
  }

  // Initialize materialized view status for all users
  const users = [adminUser, londonManager, manchesterManager, westminsterStaff, camdenStaff, cityStaff];

  for (const user of users) {
    await prisma.materializedViewStatus.create({
      data: {
        userId: user.id,
        isStale: false,
        lastRefreshed: new Date(),
        refreshCount: 1
      }
    });
  }

  console.log('📊 Initialized materialized view status');

  // Create some sample domain events
  await prisma.domainEvent.create({
    data: {
      id: nanoid(),
      aggregateId: adminUser.id,
      eventType: 'UserCreated',
      eventData: JSON.stringify({
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        organizationNodeId: adminUser.organizationNodeId
      }),
      version: 1,
      userId: adminUser.id
    }
  });

  console.log('📝 Created sample domain events');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log('- Organization hierarchy: National → Cities → Suburbs');
  console.log('- 6 users with different permission levels');
  console.log('- Closure table with 15 relationships');
  console.log('- Ready for testing hierarchical permissions');
  console.log('\n🔑 Login credentials:');
  console.log('- admin@ekko.earth (National Admin - can access everyone)');
  console.log('- london.manager@ekko.earth (City Manager - can access London branches)');
  console.log('- manchester.manager@ekko.earth (City Manager - can access Manchester branches)');
  console.log('- westminster.staff@ekko.earth (Staff - can access Westminster branch only)');
  console.log('- camden.staff@ekko.earth (Staff - can access Camden branch only)');
  console.log('- citycentre.staff@ekko.earth (Staff - can access City Centre branch only)');
  console.log('- Password for all accounts: Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });