// Query and Filter Validators
// Validators for query filters, search parameters, and filtering operations

import { UserFilterInput, AccessibleUsersInput } from "../types/index";
import {
  Result,
  success,
  failure,
  validateString,
  validateEntityId,
  validateArray,
  validateNumber,
} from "../../../shared/utils/result";
import { validatePermissionType } from "./permissions";
import { validateConsistencyLevel } from "./common";

export const validateUserFilterInput = (
  input: unknown,
): Result<UserFilterInput> => {
  if (input === null || input === undefined) {
    return success({});
  }

  if (typeof input !== "object") {
    return failure({
      message: "User filter must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;
  const filter: UserFilterInput = {};

  if (obj.email !== undefined) {
    const emailResult = validateString(obj.email, "email", { maxLength: 254 });
    if (!emailResult.success) {
      return failure(emailResult.error!);
    }
    (filter as any).email = emailResult.data!;
  }

  if (obj.name !== undefined) {
    const nameResult = validateString(obj.name, "name", { maxLength: 100 });
    if (!nameResult.success) {
      return failure(nameResult.error!);
    }
    (filter as any).name = nameResult.data!;
  }

  if (obj.organizationNodeIds !== undefined) {
    const nodeIdsResult = validateArray(
      obj.organizationNodeIds,
      "organizationNodeIds",
      (item, index) => validateEntityId(item, `organizationNodeIds[${index}]`),
      { maxLength: 50 },
    );
    if (!nodeIdsResult.success) {
      return failure(nodeIdsResult.error!);
    }
    (filter as any).organizationNodeIds = nodeIdsResult.data!;
  }

  if (obj.permissionTypes !== undefined) {
    const permissionTypesResult = validateArray(
      obj.permissionTypes,
      "permissionTypes",
      (item, index) => validatePermissionType(item),
      { maxLength: 10 },
    );
    if (!permissionTypesResult.success) {
      return failure(permissionTypesResult.error!);
    }
    (filter as any).permissionTypes = permissionTypesResult.data!;
  }

  if (obj.isActive !== undefined) {
    if (typeof obj.isActive !== "boolean") {
      return failure({
        message: "isActive must be a boolean",
        code: "INVALID_TYPE",
        details: {
          field: "isActive",
          expectedType: "boolean",
          actualType: typeof obj.isActive,
        },
        statusCode: 400,
      });
    }
    (filter as any).isActive = obj.isActive;
  }

  return success(filter);
};

export const validateAccessibleUsersInput = (
  input: unknown,
): Result<AccessibleUsersInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Accessible users input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;
  const validatedInput: AccessibleUsersInput = {};

  if (obj.consistencyLevel !== undefined) {
    const consistencyLevelResult = validateConsistencyLevel(
      obj.consistencyLevel,
    );
    if (!consistencyLevelResult.success) {
      return failure(consistencyLevelResult.error!);
    }
    (validatedInput as any).consistencyLevel = consistencyLevelResult.data!;
  }

  if (obj.filter !== undefined) {
    const filterResult = validateUserFilterInput(obj.filter);
    if (!filterResult.success) {
      return failure(filterResult.error!);
    }
    (validatedInput as any).filter = filterResult.data!;
  }

  if (obj.first !== undefined) {
    const firstResult = validateNumber(obj.first, "first", {
      min: 1,
      max: 1000,
      integer: true,
    });
    if (!firstResult.success) {
      return failure(firstResult.error!);
    }
    (validatedInput as any).first = firstResult.data!;
  }

  if (obj.after !== undefined) {
    const afterResult = validateString(obj.after, "after", { maxLength: 1000 });
    if (!afterResult.success) {
      return failure(afterResult.error!);
    }
    (validatedInput as any).after = afterResult.data!;
  }

  return success(validatedInput);
};