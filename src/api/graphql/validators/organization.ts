// Organization Validators
// Validators for organization node creation, updates, and organization-related operations

import { CreateOrganizationNodeInput } from "../types/index";
import {
  Result,
  success,
  failure,
  validateString,
  validateEntityId,
  validateNumber,
} from "../../../shared/utils/result";

export const validateCreateOrganizationNodeInput = (
  input: unknown,
): Result<CreateOrganizationNodeInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Create organization node input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const nameResult = validateString(obj.name, "name", {
    minLength: 1,
    maxLength: 100,
  });
  if (!nameResult.success) {
    return failure(nameResult.error!);
  }

  const levelResult = validateNumber(obj.level, "level", {
    min: 0,
    max: 10,
    integer: true,
  });
  if (!levelResult.success) {
    return failure(levelResult.error!);
  }

  const validatedInput: CreateOrganizationNodeInput = {
    name: nameResult.data!,
    level: levelResult.data!,
  };

  if (obj.parentId !== undefined && obj.parentId !== null) {
    const parentIdResult = validateEntityId(obj.parentId, "parentId");
    if (!parentIdResult.success) {
      return failure(parentIdResult.error!);
    }
    (validatedInput as any).parentId = parentIdResult.data!;
  }

  if (obj.metadata !== undefined) {
    if (obj.metadata !== null && typeof obj.metadata !== "object") {
      return failure({
        message: "metadata must be an object or null",
        code: "INVALID_TYPE",
        details: {
          field: "metadata",
          expectedType: "object|null",
          actualType: typeof obj.metadata,
        },
        statusCode: 400,
      });
    }

    if (obj.metadata !== null) {
      try {
        JSON.stringify(obj.metadata);
        (validatedInput as any).metadata = obj.metadata as Record<
          string,
          unknown
        >;
      } catch (error) {
        return failure({
          message: "metadata must be JSON serializable",
          code: "INVALID_JSON",
          details: { field: "metadata" },
          statusCode: 400,
        });
      }
    }
  }

  return success(validatedInput);
};