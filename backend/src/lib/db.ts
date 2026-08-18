import type { D1Database } from "@cloudflare/workers-types";
import type { AuthUser } from "../types";

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface AuditLogInput {
  user: AuthUser | null;
  aksi: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "LOGIN_FAILED" | "EXPORT" | "UPLOAD" | "STATUS_CHANGE";
  entityType: string;
  entityId?: string | null;
  deskripsi?: string;
  dataSebelum?: unknown;
  dataSesudah?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(db: D1Database, input: AuditLogInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO log_aktivitas
        (id, user_id, username, aksi, entity_type, entity_id, deskripsi, data_sebelum, data_sesudah, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      uuid(),
      input.user?.id ?? null,
      input.user?.username ?? null,
      input.aksi,
      input.entityType,
      input.entityId ?? null,
      input.deskripsi ?? null,
      input.dataSebelum !== undefined ? JSON.stringify(input.dataSebelum) : null,
      input.dataSesudah !== undefined ? JSON.stringify(input.dataSesudah) : null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      nowIso()
    )
    .run();
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export function parsePagination(query: Record<string, string | undefined>): Pagination {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize ?? "20", 10) || 20));
  return { page, pageSize };
}
