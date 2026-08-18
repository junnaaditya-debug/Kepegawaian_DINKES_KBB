import type { Env, AuthUser } from "../types";

export type AuditAction =
  | "create" | "update" | "delete"
  | "login" | "login_failed" | "logout"
  | "export" | "upload" | "status_change" | "verify";

export async function logAktivitas(
  env: Env,
  user: AuthUser | null,
  aksi: AuditAction,
  entitas: string,
  entitasId: number | null,
  detail: Record<string, unknown> | null,
  ip: string | null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO log_aktivitas (user_id, username_snapshot, aksi, entitas, entitas_id, detail_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user?.id ?? null,
      user?.username ?? null,
      aksi,
      entitas,
      entitasId,
      detail ? JSON.stringify(detail) : null,
      ip
    )
    .run();
}
