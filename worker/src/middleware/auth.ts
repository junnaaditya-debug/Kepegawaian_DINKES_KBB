import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { AppError } from "../utils/errors";
import type { AppEnv, AuthUser, Role } from "../types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Token autentikasi diperlukan");
  }
  const token = header.substring("Bearer ".length);
  try {
    const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as unknown as AuthUser;
    c.set("user", payload);
  } catch {
    throw new AppError(401, "Token tidak valid atau kadaluarsa");
  }
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw new AppError(401, "Belum login");
    if (!roles.includes(user.role)) {
      throw new AppError(403, "Anda tidak memiliki akses untuk aksi ini");
    }
    await next();
  });
}
