import type { Context, Next } from "hono";
import type { Env, Role, Variables } from "../types";

/** Restricts a route to a fixed set of roles. */
export function requireRole(...roles: Role[]) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authUser = c.get("authUser");
    if (!authUser || !roles.includes(authUser.role)) {
      return c.json({ error: "Anda tidak memiliki hak akses untuk aksi ini." }, 403);
    }
    await next();
  };
}

/** Roles that can see data across all unit kerja (no scoping applied). */
const UNSCOPED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_DINAS"];

/**
 * Returns the unit_kerja_id a request should be scoped to, or null if the
 * current user is allowed to see all unit kerja (per PRD NFR-2).
 * KEPALA_BIDANG is restricted to their own unit kerja; PEGAWAI only ever
 * sees their own record (enforced separately in the pegawai routes).
 */
export function scopedUnitKerjaId(authUser: Variables["authUser"]): string | null {
  if (UNSCOPED_ROLES.includes(authUser.role)) return null;
  if (authUser.role === "KEPALA_BIDANG") return authUser.unitKerjaId;
  return authUser.unitKerjaId;
}
