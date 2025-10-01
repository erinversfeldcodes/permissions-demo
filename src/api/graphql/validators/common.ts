// Common Validators
// Common validators for enums, pagination, and shared validation logic

import {
  Result,
  success,
  failure,
  validateString,
  validateNumber,
} from "../../../shared/utils/result";
import { ConsistencyLevel } from "../../../shared/types";

export const validateConsistencyLevel = (
  value: unknown,
): Result<ConsistencyLevel> => {
  if (typeof value !== "string") {
    return failure({
      message: "Consistency level must be a string",
      code: "INVALID_TYPE",
      details: {
        field: "consistencyLevel",
        expectedType: "string",
        actualType: typeof value,
      },
      statusCode: 400,
    });
  }

  if (!Object.values(ConsistencyLevel).includes(value as ConsistencyLevel)) {
    return failure({
      message: `Invalid consistency level. Must be one of: ${Object.values(ConsistencyLevel).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      details: {
        field: "consistencyLevel",
        allowedValues: Object.values(ConsistencyLevel),
      },
      statusCode: 400,
    });
  }

  return success(value as ConsistencyLevel);
};

export const validatePaginationArgs = (args: {
  first?: unknown;
  after?: unknown;
}): Result<{ first: number; offset: number }> => {
  let first = 20;
  let offset = 0;

  if (args.first !== undefined) {
    const firstResult = validateNumber(args.first, "first", {
      min: 1,
      max: 1000,
      integer: true,
    });
    if (!firstResult.success) {
      return failure(firstResult.error!);
    }
    first = firstResult.data!;
  }

  if (args.after !== undefined) {
    const afterResult = validateString(args.after, "after", {
      maxLength: 1000,
    });
    if (!afterResult.success) {
      return failure(afterResult.error!);
    }

    try {
      offset = parseInt(
        Buffer.from(afterResult.data!, "base64").toString(),
        10,
      );
      if (isNaN(offset) || offset < 0) {
        return failure({
          message: "Invalid cursor format",
          code: "INVALID_CURSOR",
          details: { field: "after" },
          statusCode: 400,
        });
      }
    } catch (error) {
      return failure({
        message: "Invalid cursor encoding",
        code: "INVALID_CURSOR",
        details: { field: "after" },
        statusCode: 400,
      });
    }
  }

  return success({ first, offset });
};