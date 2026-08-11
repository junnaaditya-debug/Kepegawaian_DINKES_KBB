import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { notifikasi } from "../db/schema";
import { AppError } from "../utils/errors";
import { requireAuth } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const [data, unreadRows] = await Promise.all([
    db.select().from(notifikasi).where(eq(notifikasi.userId, authUser.id)).orderBy(desc(notifikasi.createdAt)).limit(50),
    db.select({ count: sql<number>`count(*)`.as("count") }).from(notifikasi).where(and(eq(notifikasi.userId, authUser.id), eq(notifikasi.isRead, false))),
  ]);
  return c.json({ data, unreadCount: unreadRows[0]?.count || 0 });
});

app.put("/:id/baca", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const rows = await db.select().from(notifikasi).where(eq(notifikasi.id, id)).limit(1);
  const existing = rows[0];
  if (!existing || existing.userId !== authUser.id) throw new AppError(404, "Notifikasi tidak ditemukan");
  await db.update(notifikasi).set({ isRead: true }).where(eq(notifikasi.id, id));
  return c.json({ ...existing, isRead: true });
});

app.put("/baca-semua", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  await db.update(notifikasi).set({ isRead: true }).where(and(eq(notifikasi.userId, authUser.id), eq(notifikasi.isRead, false)));
  return c.json({ message: "Semua notifikasi ditandai sudah dibaca" });
});

export default app;
