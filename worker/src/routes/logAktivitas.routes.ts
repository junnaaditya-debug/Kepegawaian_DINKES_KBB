import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { logAktivitas, user } from "../db/schema";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth, requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"));

app.get("/", async (c) => {
  const db = c.get("db");
  const { entitas, userId, page = "1", pageSize = "50" } = c.req.query();

  const conditions = [];
  if (entitas) conditions.push(eq(logAktivitas.entitas, entitas));
  if (userId) conditions.push(eq(logAktivitas.userId, userId));
  const where = conditions.length ? and(...conditions) : undefined;

  const take = Math.min(Number(pageSize) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [totalRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.as("count") }).from(logAktivitas).where(where),
    db.select().from(logAktivitas).where(where).orderBy(desc(logAktivitas.createdAt)).limit(take).offset(skip),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users = userIds.length ? await db.select().from(user).where(inArray(user.id, userIds)) : [];
  const userMap = new Map(users.map((u) => [u.id, { id: u.id, nama: u.nama, username: u.username }]));

  return c.json({
    data: rows.map((r) => ({ ...r, user: r.userId ? userMap.get(r.userId) || null : null })),
    total: totalRows[0]?.count || 0,
    page: Number(page) || 1,
    pageSize: take,
  });
});

export default app;
