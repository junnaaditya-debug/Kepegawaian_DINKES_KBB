import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { notFound } from "../lib/http";
import { generateReminders } from "../lib/notify";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifikasi
     WHERE (user_id = ? OR (user_id IS NULL AND (role_target = ? OR role_target IS NULL) AND (unit_kerja_id = ? OR unit_kerja_id IS NULL)))
     ORDER BY created_at DESC LIMIT 100`
  )
    .bind(user.id, user.role, user.unitKerjaId)
    .all();
  return c.json(results);
});

route.get("/unread-count", async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM notifikasi
     WHERE is_read = 0 AND (user_id = ? OR (user_id IS NULL AND (role_target = ? OR role_target IS NULL) AND (unit_kerja_id = ? OR unit_kerja_id IS NULL)))`
  )
    .bind(user.id, user.role, user.unitKerjaId)
    .first<{ n: number }>();
  return c.json({ count: row?.n ?? 0 });
});

route.patch("/:id/read", async (c) => {
  const result = await c.env.DB.prepare(`UPDATE notifikasi SET is_read = 1 WHERE id = ?`).bind(c.req.param("id")).run();
  if (result.meta.changes === 0) throw notFound("Notifikasi tidak ditemukan");
  return c.json({ ok: true });
});

route.post("/mark-all-read", async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare(
    `UPDATE notifikasi SET is_read = 1
     WHERE is_read = 0 AND (user_id = ? OR (user_id IS NULL AND (role_target = ? OR role_target IS NULL) AND (unit_kerja_id = ? OR unit_kerja_id IS NULL)))`
  )
    .bind(user.id, user.role, user.unitKerjaId)
    .run();
  return c.json({ ok: true });
});

route.post("/generate", requireRole("super_admin", "admin_kepegawaian"), async (c) => {
  const result = await generateReminders(c.env);
  return c.json(result);
});

export default route;
