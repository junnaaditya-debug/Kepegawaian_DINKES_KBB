import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { parsePagination } from "../lib/http";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware, requireRole("super_admin"));

route.get("/", async (c) => {
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (q.entitas) {
    clauses.push("entitas = ?");
    params.push(q.entitas);
  }
  if (q.userId) {
    clauses.push("user_id = ?");
    params.push(q.userId);
  }
  if (q.aksi) {
    clauses.push("aksi = ?");
    params.push(q.aksi);
  }
  if (q.dari) {
    clauses.push("created_at >= ?");
    params.push(q.dari);
  }
  if (q.sampai) {
    clauses.push("created_at <= ?");
    params.push(q.sampai);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM log_aktivitas ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM log_aktivitas ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all();

  return c.json({ data: results, total: countRow?.n ?? 0, page, pageSize });
});

export default route;
