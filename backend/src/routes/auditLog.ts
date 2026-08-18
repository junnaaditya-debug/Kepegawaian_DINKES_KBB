import { Hono } from "hono";
import { parsePagination } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const auditLogRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

auditLogRoutes.get("/", requireRole("SUPER_ADMIN", "KEPALA_DINAS"), async (c) => {
  const { page, pageSize } = parsePagination(c.req.query() as Record<string, string>);
  const entityType = c.req.query("entityType");
  const userId = c.req.query("userId");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");

  const where: string[] = ["1=1"];
  const binds: unknown[] = [];
  if (entityType) {
    where.push("entity_type = ?");
    binds.push(entityType);
  }
  if (userId) {
    where.push("user_id = ?");
    binds.push(userId);
  }
  if (dateFrom) {
    where.push("created_at >= ?");
    binds.push(dateFrom);
  }
  if (dateTo) {
    where.push("created_at <= ?");
    binds.push(dateTo);
  }
  const whereSql = where.join(" AND ");

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM log_aktivitas WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM log_aktivitas WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ data: results, pagination: { page, pageSize, total: totalRow?.total ?? 0 } });
});

auditLogRoutes.get("/entity/:entityType/:entityId", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_DINAS"), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM log_aktivitas WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`
  )
    .bind(c.req.param("entityType"), c.req.param("entityId"))
    .all();
  return c.json({ data: results });
});
