// User Management Validators

import { CreateUserInput, UpdateUserInput } from "../types/index";
import {
  Result,
  success,
  failure,
  validateString,
  validateEmail,
  validateEntityId,
} from "../../../shared/utils/result";

export const validateCreateUserInput = (
  input: unknown,
): Result<CreateUserInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Create user input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const emailResult = validateEmail(obj.email);
  if (!emailResult.success) {
    return failure(emailResult.error!);
  }

  const nameResult = validateString(obj.name, "name", {
    minLength: 1,
    maxLength: 100,
  });
  if (!nameResult.success) {
    return failure(nameResult.error!);
  }

  const passwordResult = validateString(obj.password, "password", {
    minLength: 8,
    maxLength: 128,
  });
  if (!passwordResult.success) {
    return failure(passwordResult.error!);
  }

  const password = passwordResult.data!;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return failure({
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      code: "WEAK_PASSWORD",
      statusCode: 400,
    });
  }

  const organizationNodeIdResult = validateEntityId(
    obj.organizationNodeId,
    "organizationNodeId",
  );
  if (!organizationNodeIdResult.success) {
    return failure(organizationNodeIdResult.error!);
  }

  return success({
    email: emailResult.data!,
    name: nameResult.data!,
    password: passwordResult.data!,
    organizationNodeId: organizationNodeIdResult.data!,
  });
};

export const validateUpdateUserInput = (
  input: unknown,
): Result<UpdateUserInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Update user input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const idResult = validateEntityId(obj.id, "id");
  if (!idResult.success) {
    return failure(idResult.error!);
  }

  const validatedInput: UpdateUserInput = {
    id: idResult.data!,
  };

  if (obj.name !== undefined) {
    const nameResult = validateString(obj.name, "name", {
      minLength: 1,
      maxLength: 100,
    });
    if (!nameResult.success) {
      return failure(nameResult.error!);
    }
    (validatedInput as any).name = nameResult.data!;
  }

  if (obj.email !== undefined) {
    const emailResult = validateEmail(obj.email);
    if (!emailResult.success) {
      return failure(emailResult.error!);
    }
    (validatedInput as any).email = emailResult.data!;
  }

  if (obj.organizationNodeId !== undefined) {
    const nodeIdResult = validateEntityId(
      obj.organizationNodeId,
      "organizationNodeId",
    );
    if (!nodeIdResult.success) {
      return failure(nodeIdResult.error!);
    }
    (validatedInput as any).organizationNodeId = nodeIdResult.data!;
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
    (validatedInput as any).isActive = obj.isActive;
  }

  return success(validatedInput);
};
