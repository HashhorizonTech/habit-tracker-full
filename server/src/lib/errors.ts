export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export const errorBody = (code: string, message: string, details?: Record<string, unknown>): ErrorBody => ({
  error: details ? { code, message, details } : { code, message },
});

export const unauthorized = (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Admin access required") => new AppError(403, "FORBIDDEN", message);

export const accountDisabled = () => new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled");

export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
