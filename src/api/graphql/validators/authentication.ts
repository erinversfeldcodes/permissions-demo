// Authentication Validators
// Validators for login and authentication-related input

import { LoginInput } from "../types/index";
import {
  Result,
  success,
  failure,
  validateString,
  validateEmail,
} from "../../../shared/utils/result";

export const validateLoginInput = (input: unknown): Result<LoginInput> => {
  if (!input || typeof input !== "object") {
    return failure({
      message: "Login input must be an object",
      code: "INVALID_INPUT_TYPE",
      statusCode: 400,
    });
  }

  const obj = input as Record<string, unknown>;

  const emailResult = validateEmail(obj.email);
  if (!emailResult.success) {
    return failure(emailResult.error!);
  }

  const passwordResult = validateString(obj.password, "password", {
    minLength: 1,
    maxLength: 128,
  });
  if (!passwordResult.success) {
    return failure(passwordResult.error!);
  }

  return success({
    email: emailResult.data!,
    password: passwordResult.data!,
  });
};
