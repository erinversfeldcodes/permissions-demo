// Context Types
// GraphQL execution context and related types

import { UserResponse } from "./output";
import { DataLoaders } from "../dataloaders";

export interface GraphQLContext {
  readonly userId?: string;
  readonly user?: UserResponse;
  readonly isAuthenticated: boolean;
  readonly requestId: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly permissions?: ReadonlyArray<string>;
  readonly dataloaders: DataLoaders;
}