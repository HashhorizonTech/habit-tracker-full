import type { z } from "zod";
import { AppError } from "./errors.js";

/** Parses request input, mapping failures to `400 VALIDATION_ERROR`. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", describeIssues(result.error));
  return result.data;
}

export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}
