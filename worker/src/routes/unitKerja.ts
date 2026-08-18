import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, kode, nama, jenis, parent_id, alamat, is_active FROM unit_kerja ORDER BY jenis, nama`
  ).all();
  return c.json(results);
});

route.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM unit_kerja WHERE id = ?`).bind(id).first();
  if (!row) throw notFound("Unit kerja tidak ditemukan");
  return c.json(row);
});

route.post("/", requireRole("super_admin"), async (c) => {
  const body = await c.req.json();
  const { kode, nama, jenis, parent_id, alamat } = body;
  if (!kode || !nama || !jenis) throw badRequest("kode, nama, jenis wajib diisi");
  const result = await c.env.DB.prepare(
    `INSERT INTO unit_kerja (kode, nama, jenis, parent_id, alamat) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(kode, nama, jenis, parent_id ?? null, alamat ?? null)
    .run();
  const id = result.meta.last_row_id;
  await logAktivitas(c.env, c.get("user"), "create", "unit_kerja", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

route.put("/:id", requireRole("super_admin"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { kode, nama, jenis, parent_id, alamat, is_active } = body;
  const existing = await c.env.DB.prepare(`SELECT id FROM unit_kerja WHERE id = ?`).bind(id).first();
  if (!existing) throw notFound("Unit kerja tidak ditemukan");
  await c.env.DB.prepare(
    `UPDATE unit_kerja SET kode = ?, nama = ?, jenis = ?, parent_id = ?, alamat = ?, is_active = ? WHERE id = ?`
  )
    .bind(kode, nama, jenis, parent_id ?? null, alamat ?? null, is_active ?? 1, id)
    .run();
  await logAktivitas(c.env, c.get("user"), "update", "unit_kerja", Number(id), body, c.get("requestIp"));
  return c.json({ ok: true });
});

route.delete("/:id", requireRole("super_admin"), async (c) => {
  const id = c.req.param("id");
  const inUse = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM pegawai WHERE unit_kerja_id = ?`).bind(id).first<{ n: number }>();
  if (inUse && inUse.n > 0) throw badRequest("Unit kerja masih digunakan oleh data pegawai, nonaktifkan saja");
  await c.env.DB.prepare(`DELETE FROM unit_kerja WHERE id = ?`).bind(id).run();
  await logAktivitas(c.env, c.get("user"), "delete", "unit_kerja", Number(id), null, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
