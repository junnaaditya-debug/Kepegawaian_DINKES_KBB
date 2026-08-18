import type { Context, Next } from "hono";
import type { Env, Variables, RoleCode } from "../types";
import { verifyJwt } from "../lib/crypto";
import { unauthorized, forbidden } from "../lib/http";

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw unauthorized("Token tidak ditemukan");
  const token = header.slice("Bearer ".length);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) throw unauthorized("Token tidak valid atau kedaluwarsa");

  c.set("user", {
    id: payload.sub,
    username: payload.username,
    fullName: (payload.fullName as string) ?? payload.username,
    role: payload.role as RoleCode,
    roleId: (payload.roleId as number) ?? 0,
    unitKerjaId: payload.unitKerjaId as number | null,
    pegawaiId: (payload.pegawaiId as number | null) ?? null,
  });
  c.set("requestIp", c.req.header("CF-Connecting-IP") ?? "unknown");
  await next();
}

export function requireRole(...roles: RoleCode[]) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      throw forbidden(`Peran '${user.role}' tidak memiliki akses ke resource ini`);
    }
    await next();
  };
}

/** Roles allowed to create/update/delete pegawai & related records. */
export const WRITE_ROLES: RoleCode[] = ["super_admin", "admin_kepegawaian"];
/** Roles allowed to view everything regardless of unit_kerja scope. */
export const UNSCOPED_READ_ROLES: RoleCode[] = ["super_admin", "admin_kepegawaian", "kepala_dinas"];

/**
 * Returns a SQL fragment + bind param to scope a query by unit kerja when the
 * current user's role is restricted to their own unit (kepala_bidang), or null
 * when no restriction applies (NFR-2).
 */
export function unitScopeFilter(user: { role: RoleCode; unitKerjaId: number | null }, column = "pegawai.unit_kerja_id") {
  if (UNSCOPED_READ_ROLES.includes(user.role)) return null;
  if (user.role === "kepala_bidang") {
    if (user.unitKerjaId == null) throw forbidden("Akun ini belum ditautkan ke unit kerja");
    return { sql: `${column} = ?`, param: user.unitKerjaId };
  }
  // 'pegawai' self-service role is restricted at the route level via pegawaiId.
  return null;
}
