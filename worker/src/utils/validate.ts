import type { ZodSchema } from "zod";
import { AppError } from "./errors";

export function parseBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new AppError(400, message);
  }
  return result.data;
}
