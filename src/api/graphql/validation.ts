// Custom GraphQL Validation Rules
// Lightweight alternative to graphql-query-complexity for Next.js compatibility

import { ValidationRule, GraphQLError, FieldNode } from 'graphql';

interface ValidationRuleConfig {
  maxDepth: number;
  maxPaginationLimit: number;
  expensiveFields: Record<string, { maxLimit: number; cost: number }>;
}

const defaultConfig: ValidationRuleConfig = {
  maxDepth: 10,
  maxPaginationLimit: 100,
  expensiveFields: {
    accessibleUsers: { maxLimit: 100, cost: 2 },
    users: { maxLimit: 50, cost: 2 },
    organizationTree: { maxLimit: 1, cost: 50 }, // Only one tree query at a time
    permissions: { maxLimit: 100, cost: 1 }
  }
};

/**
 * Creates depth limiting validation rule
 */
export const createDepthLimitRule = (maxDepth: number = defaultConfig.maxDepth): ValidationRule => {
  return (context) => {
    let currentDepth = 0;
    let maxDepthReached = 0;

    return {
      Field: {
        enter: (node: FieldNode) => {
          currentDepth++;
          maxDepthReached = Math.max(maxDepthReached, currentDepth);

          if (currentDepth > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query depth ${maxDepthReached} exceeds maximum allowed depth of ${maxDepth}. Please simplify your query.`,
                [node]
              )
            );
          }
        },
        leave: () => {
          currentDepth--;
        }
      }
    };
  };
};

/**
 * Creates pagination and field-specific limits validation rule
 */
export const createFieldLimitsRule = (config: ValidationRuleConfig = defaultConfig): ValidationRule => {
  return (context) => {
    let totalCost = 0;

    return {
      Field: (node: FieldNode) => {
        const fieldName = node.name.value;
        const fieldConfig = config.expensiveFields[fieldName];

        if (fieldConfig) {
          // Check pagination limits
          const args = node.arguments;
          if (args) {
            const firstArg = args.find(arg => arg.name.value === 'first');
            if (firstArg && firstArg.value.kind === 'IntValue') {
              const limit = parseInt(firstArg.value.value);

              if (limit > fieldConfig.maxLimit) {
                context.reportError(
                  new GraphQLError(
                    `Field "${fieldName}" requested ${limit} items, but maximum allowed is ${fieldConfig.maxLimit}. Please use pagination.`,
                    [node]
                  )
                );
                return;
              }

              // Calculate cost
              totalCost += limit * fieldConfig.cost;
            } else {
              // Use default pagination size for cost calculation
              const defaultLimit = fieldName === 'accessibleUsers' ? 20 : 10;
              totalCost += defaultLimit * fieldConfig.cost;
            }
          }

          // Special handling for organizationTree (should be limited to 1 per query)
          if (fieldName === 'organizationTree') {
            totalCost += fieldConfig.cost;
          }
        }

        // Overall cost limit (equivalent to complexity limit)
        if (totalCost > 1000) {
          context.reportError(
            new GraphQLError(
              `Query cost ${totalCost} exceeds maximum allowed cost of 1000. Please simplify your request or use pagination.`,
              [node]
            )
          );
        }
      }
    };
  };
};

/**
 * Creates rate limiting validation rule for expensive operations
 */
export const createRateLimitRule = (): ValidationRule => {
  const requestTracker = new Map<string, { count: number; lastReset: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_EXPENSIVE_QUERIES = 30; // per minute

  return (context) => {
    return {
      OperationDefinition: (node) => {
        // Simple rate limiting based on client IP (in production, use Redis)
        const clientId = context.getVariableValues()?.clientId || 'anonymous';
        const now = Date.now();

        let tracker = requestTracker.get(clientId);
        if (!tracker || now - tracker.lastReset > RATE_LIMIT_WINDOW) {
          tracker = { count: 0, lastReset: now };
          requestTracker.set(clientId, tracker);
        }

        tracker.count++;

        if (tracker.count > MAX_EXPENSIVE_QUERIES) {
          context.reportError(
            new GraphQLError(
              'Rate limit exceeded. Please slow down your requests.',
              [node]
            )
          );
        }
      }
    };
  };
};

/**
 * Create all custom validation rules
 */
export const createCustomValidationRules = (config?: Partial<ValidationRuleConfig>): ValidationRule[] => {
  const finalConfig = { ...defaultConfig, ...config };

  return [
    createDepthLimitRule(finalConfig.maxDepth),
    createFieldLimitsRule(finalConfig),
    // Temporarily disable rate limiting for load testing
    // createRateLimitRule()
  ];
};

/**
 * Log query metrics for monitoring
 */
export const logQueryMetrics = (operationName: string | null, cost: number, depth: number) => {
  console.log(`GraphQL Query: ${operationName || 'anonymous'} | Cost: ${cost} | Depth: ${depth}`);
};