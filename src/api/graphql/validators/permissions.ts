// Permission Validators

import {
  GrantPermissionInput,
  RevokePermissionInput,
  BulkGrantPermissionInput,
  BulkRevokePermissionInput,
} from "../types/index";
import {
  Result,
  success,
  failure,
  validateString,
  validateEntityId,
  validateArray,
} from "../../../shared/utils/result";
import { PermissionType } from "../../../shared/types";

export const validatePermissionType = (
  value: unknown,
): Result<PermissionType> => {
  if (typeof value !== "string") {
    return failure({
      message: "Permission type must be a string",
      code: "INVALID_TYPE",
      details: {
        field: "permissionType",
        expectedType: "string",
        actualType: typeof value,
      },
      statusCode: 400,
    });
  }

  if (!Object.values(PermissionType).includes(value as PermissionType)) {
    return failure({
      message: `Invalid permission type. Must be one of: ${Object.values(PermissionType).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      details: {
        field: "permissionType",
        allowedValues: Object.values(PermissionType),
      },
      statusCode: 400,
    });
  }

  return success(value as PermissionType);
};

export const validateGrantPermissionInput = (
  input: unknown,
): Result<GrantPermissionInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Grant permission input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const userIdResult = validateEntityId(obj.userId, "userId");
  if (!userIdResult.success) {
    return failure(userIdResult.error!);
  }

  const nodeIdResult = validateEntityId(obj.nodeId, "nodeId");
  if (!nodeIdResult.success) {
    return failure(nodeIdResult.error!);
  }

  const permissionTypeResult = validatePermissionType(obj.permissionType);
  if (!permissionTypeResult.success) {
    return failure(permissionTypeResult.error!);
  }

  const validatedInput: GrantPermissionInput = {
    userId: userIdResult.data!,
    nodeId: nodeIdResult.data!,
    permissionType: permissionTypeResult.data!,
  };

  if (obj.expiresAt !== undefined) {
    if (!(obj.expiresAt instanceof Date) && typeof obj.expiresAt !== "string") {
      return failure({
        message: "expiresAt must be a Date or ISO string",
        code: "INVALID_TYPE",
        details: {
          field: "expiresAt",
          expectedType: "Date|string",
          actualType: typeof obj.expiresAt,
        },
        statusCode: 400,
      });
    }

    const expiresAt =
      obj.expiresAt instanceof Date
        ? obj.expiresAt
        : new Date(obj.expiresAt as string);

    if (isNaN(expiresAt.getTime())) {
      return failure({
        message: "expiresAt must be a valid date",
        code: "INVALID_DATE",
        details: { field: "expiresAt", value: obj.expiresAt },
        statusCode: 400,
      });
    }

    if (expiresAt <= new Date()) {
      return failure({
        message: "expiresAt must be in the future",
        code: "INVALID_DATE_RANGE",
        details: { field: "expiresAt", value: expiresAt },
        statusCode: 400,
      });
    }

    (validatedInput as any).expiresAt = expiresAt;
  }

  return success(validatedInput);
};

export const validateBulkGrantPermissionInput = (
  input: unknown,
): Result<BulkGrantPermissionInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Bulk grant permission input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const grantsResult = validateArray(
    obj.grants,
    "grants",
    (item, index) => validateGrantPermissionInput(item),
    { minLength: 1, maxLength: 100 },
  );

  if (!grantsResult.success) {
    return failure(grantsResult.error!);
  }

  return success({
    grants: grantsResult.data!,
  });
};

export const validateRevokePermissionInput = (
  input: unknown,
): Result<RevokePermissionInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Revoke permission input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const permissionIdResult = validateEntityId(obj.permissionId, "permissionId");
  if (!permissionIdResult.success) {
    return failure(permissionIdResult.error!);
  }

  const validatedInput: RevokePermissionInput = {
    permissionId: permissionIdResult.data!,
  };

  if (obj.reason !== undefined) {
    const reasonResult = validateString(obj.reason, "reason", {
      maxLength: 500,
    });
    if (!reasonResult.success) {
      return failure(reasonResult.error!);
    }
    (validatedInput as any).reason = reasonResult.data!;
  }

  return success(validatedInput);
};

export const validateBulkRevokePermissionInput = (
  input: unknown,
): Result<BulkRevokePermissionInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Bulk revoke permission input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const permissionIdsResult = validateArray(
    obj.permissionIds,
    "permissionIds",
    (item, index) => validateEntityId(item, `permissionIds[${index}]`),
    { minLength: 1, maxLength: 100 },
  );

  if (!permissionIdsResult.success) {
    return failure(permissionIdsResult.error!);
  }

  const validatedInput: BulkRevokePermissionInput = {
    permissionIds: permissionIdsResult.data!,
  };

  if (obj.reason !== undefined) {
    const reasonResult = validateString(obj.reason, "reason", {
      maxLength: 500,
    });
    if (!reasonResult.success) {
      return failure(reasonResult.error!);
    }
    (validatedInput as any).reason = reasonResult.data!;
  }

  return success(validatedInput);
};
