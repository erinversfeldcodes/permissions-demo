// Next.js App Router GraphQL API Route
// Integrates Apollo Server with Next.js for Vercel deployment

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { typeDefs } from '../../../api/graphql/schema';
import { resolvers, GraphQLContext } from '../../../api/graphql/resolvers';
import { db } from '../../../shared/infrastructure/database';
import { createDataLoaders } from '../../../api/graphql/dataloaders';
import { createCustomValidationRules } from '../../../api/graphql/validation';

// Create Apollo Server instance
const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV === 'development',
  includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
  validationRules: createCustomValidationRules({
    maxDepth: 15,
    maxPaginationLimit: 100,
    expensiveFields: {
      accessibleUsers: { maxLimit: 100, cost: 2 },
      users: { maxLimit: 50, cost: 2 },
      organizationTree: { maxLimit: 1, cost: 50 },
      permissions: { maxLimit: 100, cost: 1 }
    }
  }),
  formatError: (error) => {
    // Log errors for debugging
    console.error('GraphQL Error:', error);

    // Handle complexity errors
    if (error.message.includes('Query is too complex')) {
      return new Error('Query complexity exceeds limit. Please simplify your request or use pagination.');
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      if (error.message.includes('Database') || error.message.includes('Prisma')) {
        return new Error('Internal server error');
      }
    }

    return error;
  }
});

// Create the request handler
const handler = startServerAndCreateNextHandler<Request, GraphQLContext>(server, {
  context: async (request) => {
    // Debug: Log headers for troubleshooting Vercel bypass
    if (process.env.NODE_ENV === 'development') {
      console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    }

    // Extract JWT token from Authorization header
    const authorization = request.headers.get('authorization');
    let userId: string | undefined;
    let user: any | undefined;
    let isAuthenticated = false;

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.substring(7);

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        userId = decoded.userId;
        isAuthenticated = true;

        // Optionally fetch full user data
        if (userId) {
          user = await db.user.findUnique({
            where: { id: userId },
            include: {
              organizationNode: true,
              permissions: {
                where: { isActive: true },
                include: { node: true, grantedBy: true }
              }
            }
          });
        }
      } catch (error) {
        console.warn('Invalid JWT token:', error);
        // Continue with unauthenticated context
      }
    }

    return {
      userId,
      user,
      isAuthenticated,
      requestId: randomUUID(),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      dataloaders: createDataLoaders()
    };
  }
});

// Export handlers for Next.js App Router
export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}