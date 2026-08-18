import { Hono } from "hono";
import { nowIso } from "../lib/db";
import type { Env, Variables } from "../types";

export const notifikasiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

notifikasiRoutes.get("/", async (c) => {
  const authUser = c.get("authUser");
  const unreadOnly = c.req.query("unreadOnly") === "1";
  const sql = unreadOnly
    ? `SELECT * FROM notifikasi WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 50`
    : `SELECT * FROM notifikasi WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`;
  const { results } = await c.env.DB.prepare(sql).bind(authUser.id).all();
  const unreadCountRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM notifikasi WHERE user_id = ? AND is_read = 0`)
    .bind(authUser.id)
    .first<{ cnt: number }>();
  return c.json({ data: results, unreadCount: unreadCountRow?.cnt ?? 0 });
});

notifikasiRoutes.post("/:id/read", async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  await c.env.DB.prepare(`UPDATE notifikasi SET is_read = 1 WHERE id = ? AND user_id = ?`).bind(id, authUser.id).run();
  return c.json({ message: "Notifikasi ditandai sudah dibaca." });
});

notifikasiRoutes.post("/read-all", async (c) => {
  const authUser = c.get("authUser");
  await c.env.DB.prepare(`UPDATE notifikasi SET is_read = 1 WHERE user_id = ? AND is_read = 0`).bind(authUser.id).run();
  return c.json({ message: "Semua notifikasi ditandai sudah dibaca." });
});
