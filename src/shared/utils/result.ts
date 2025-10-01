// Result Handling Utilities
// Provides consistent error handling patterns across the API layer

import { DomainError, ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '../types';
import { GraphQLError as APIGraphQLError } from '../../api/graphql/types/index';

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface Result<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AppError;
}

export interface AppError {
  readonly message: string;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly statusCode?: number;
}

// ============================================================================
// RESULT CONSTRUCTORS
// ============================================================================

export const success = <T>(data: T): Result<T> => ({
  success: true,
  data,
});

export const failure = <T>(error: AppError): Result<T> => ({
  success: false,
  error,
});

export const fromError = <T>(error: Error): Result<T> => ({
  success: false,
  error: mapDomainErrorToAppError(error),
});

// ============================================================================
// ERROR MAPPING
// ============================================================================

export const mapDomainErrorToAppError = (error: Error): AppError => {
  if (error instanceof ValidationError) {
    return {
      message: error.message,
      code: 'VALIDATION_ERROR',
      details: error.details,
      statusCode: 400,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      message: error.message,
      code: 'NOT_FOUND',
      details: error.details,
      statusCode: 404,
    };
  }

  if (error instanceof UnauthorizedError) {
    return {
      message: error.message,
      code: 'UNAUTHORIZED',
      details: error.details,
      statusCode: 401,
    };
  }

  if (error instanceof ConflictError) {
    return {
      message: error.message,
      code: 'CONFLICT',
      details: error.details,
      statusCode: 409,
    };
  }

  if (error instanceof DomainError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      statusCode: 400,
    };
  }

  // Unknown error - log it but don't expose internal details
  console.error('Unknown error:', error);
  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
};

export const mapAppErrorToGraphQLError = (error: AppError): APIGraphQLError => ({
  message: error.message,
  code: error.code,
  extensions: {
    ...error.details,
    statusCode: error.statusCode,
  },
});

// ============================================================================
// RESULT TRANSFORMATION
// ============================================================================

export const map = <T, U>(
  result: Result<T>,
  mapper: (data: T) => U
): Result<U> => {
  if (result.success && result.data !== undefined) {
    try {
      return success(mapper(result.data));
    } catch (error) {
      return fromError(error as Error);
    }
  }
  return failure(result.error!);
};


// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const validateRequired = <T>(
  value: T | null | undefined,
  fieldName: string
): Result<T> => {
  if (value === null || value === undefined) {
    return failure({
      message: `${fieldName} is required`,
      code: 'REQUIRED_FIELD_MISSING',
      details: { field: fieldName },
      statusCode: 400,
    });
  }
  return success(value);
};

export const validateString = (
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): Result<string> => {
  if (typeof value !== 'string') {
    return failure({
      message: `${fieldName} must be a string`,
      code: 'INVALID_TYPE',
      details: { field: fieldName, expectedType: 'string', actualType: typeof value },
      statusCode: 400,
    });
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    return failure({
      message: `${fieldName} must be at least ${options.minLength} characters long`,
      code: 'MIN_LENGTH_VIOLATION',
      details: { field: fieldName, minLength: options.minLength, actualLength: value.length },
      statusCode: 400,
    });
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return failure({
      message: `${fieldName} must be no more than ${options.maxLength} characters long`,
      code: 'MAX_LENGTH_VIOLATION',
      details: { field: fieldName, maxLength: options.maxLength, actualLength: value.length },
      statusCode: 400,
    });
  }

  if (options.pattern && !options.pattern.test(value)) {
    return failure({
      message: `${fieldName} format is invalid`,
      code: 'PATTERN_VIOLATION',
      details: { field: fieldName, pattern: options.pattern.source },
      statusCode: 400,
    });
  }

  return success(value);
};

export const validateEmail = (value: unknown): Result<string> => {
  const stringResult = validateString(value, 'email', {
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  });

  if (!stringResult.success) {
    return stringResult;
  }

  return success(stringResult.data!.toLowerCase().trim());
};

export const validateEntityId = (value: unknown, fieldName: string): Result<string> => {
  return validateString(value, fieldName, {
    minLength: 1,
    maxLength: 255,
  });
};

export const validateNumber = (
  value: unknown,
  fieldName: string,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): Result<number> => {
  if (typeof value !== 'number' || isNaN(value)) {
    return failure({
      message: `${fieldName} must be a valid number`,
      code: 'INVALID_TYPE',
      details: { field: fieldName, expectedType: 'number', actualType: typeof value },
      statusCode: 400,
    });
  }

  if (options.integer && !Number.isInteger(value)) {
    return failure({
      message: `${fieldName} must be an integer`,
      code: 'INVALID_NUMBER_TYPE',
      details: { field: fieldName, expectedType: 'integer' },
      statusCode: 400,
    });
  }

  if (options.min !== undefined && value < options.min) {
    return failure({
      message: `${fieldName} must be at least ${options.min}`,
      code: 'MIN_VALUE_VIOLATION',
      details: { field: fieldName, minValue: options.min, actualValue: value },
      statusCode: 400,
    });
  }

  if (options.max !== undefined && value > options.max) {
    return failure({
      message: `${fieldName} must be no more than ${options.max}`,
      code: 'MAX_VALUE_VIOLATION',
      details: { field: fieldName, maxValue: options.max, actualValue: value },
      statusCode: 400,
    });
  }

  return success(value);
};

export const validateArray = <T>(
  value: unknown,
  fieldName: string,
  itemValidator: (item: unknown, index: number) => Result<T>,
  options: {
    minLength?: number;
    maxLength?: number;
  } = {}
): Result<ReadonlyArray<T>> => {
  if (!Array.isArray(value)) {
    return failure({
      message: `${fieldName} must be an array`,
      code: 'INVALID_TYPE',
      details: { field: fieldName, expectedType: 'array', actualType: typeof value },
      statusCode: 400,
    });
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    return failure({
      message: `${fieldName} must contain at least ${options.minLength} items`,
      code: 'MIN_LENGTH_VIOLATION',
      details: { field: fieldName, minLength: options.minLength, actualLength: value.length },
      statusCode: 400,
    });
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return failure({
      message: `${fieldName} must contain no more than ${options.maxLength} items`,
      code: 'MAX_LENGTH_VIOLATION',
      details: { field: fieldName, maxLength: options.maxLength, actualLength: value.length },
      statusCode: 400,
    });
  }

  const validatedItems: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const itemResult = itemValidator(value[i], i);
    if (!itemResult.success) {
      return failure({
        message: `${fieldName}[${i}]: ${itemResult.error!.message}`,
        code: itemResult.error!.code,
        details: {
          ...itemResult.error!.details,
          field: fieldName,
          index: i,
        },
        statusCode: itemResult.error!.statusCode,
      });
    }
    validatedItems.push(itemResult.data!);
  }

  return success(validatedItems as ReadonlyArray<T>);
};

// ============================================================================
// BULK OPERATION HELPERS
// ============================================================================

export const combineResults = <T>(
  results: ReadonlyArray<Result<T>>
): {
  readonly successes: ReadonlyArray<T>;
  readonly failures: ReadonlyArray<AppError>;
  readonly successCount: number;
  readonly failureCount: number;
} => {
  const successes: T[] = [];
  const failures: AppError[] = [];

  for (const result of results) {
    if (result.success && result.data !== undefined) {
      successes.push(result.data);
    } else if (result.error) {
      failures.push(result.error);
    }
  }

  return {
    successes: successes as ReadonlyArray<T>,
    failures: failures as ReadonlyArray<AppError>,
    successCount: successes.length,
    failureCount: failures.length,
  };
};

