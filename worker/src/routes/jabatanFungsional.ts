import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, kode, nama, rumpun, is_active FROM jenis_jabatan_fungsional ORDER BY nama`
  ).all();
  return c.json(results);
});

route.get("/:id/jenjang", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM jenjang_jabatan_fungsional WHERE jenis_jabatan_fungsional_id = ? ORDER BY urutan`
  )
    .bind(c.req.param("id"))
    .all();
  return c.json(results);
});

route.get("/jenjang/all", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT jf.*, j.nama as jenis_nama, j.kode as jenis_kode
     FROM jenjang_jabatan_fungsional jf
     JOIN jenis_jabatan_fungsional j ON j.id = jf.jenis_jabatan_fungsional_id
     ORDER BY j.nama, jf.urutan`
  ).all();
  return c.json(results);
});

route.post("/", requireRole("super_admin"), async (c) => {
  const body = await c.req.json();
  if (!body.kode || !body.nama) throw badRequest("kode dan nama wajib diisi");
  const result = await c.env.DB.prepare(
    `INSERT INTO jenis_jabatan_fungsional (kode, nama, rumpun) VALUES (?, ?, ?)`
  )
    .bind(body.kode, body.nama, body.rumpun ?? null)
    .run();
  const id = result.meta.last_row_id;
  await logAktivitas(c.env, c.get("user"), "create", "jenis_jabatan_fungsional", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

// FR-3.2 / BR-3: ambang batas angka kredit dikonfigurasi Super Admin, bukan hardcode.
route.post("/:id/jenjang", requireRole("super_admin"), async (c) => {
  const jenisId = c.req.param("id");
  const body = await c.req.json();
  if (!body.kode || !body.nama || body.urutan == null || !body.golongan_ruang_minimal || body.angka_kredit_kumulatif_minimal == null) {
    throw badRequest("kode, nama, urutan, golongan_ruang_minimal, angka_kredit_kumulatif_minimal wajib diisi");
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO jenjang_jabatan_fungsional (jenis_jabatan_fungsional_id, kode, nama, urutan, golongan_ruang_minimal, angka_kredit_kumulatif_minimal)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(jenisId, body.kode, body.nama, body.urutan, body.golongan_ruang_minimal, body.angka_kredit_kumulatif_minimal)
    .run();
  const id = result.meta.last_row_id;
  await logAktivitas(c.env, c.get("user"), "create", "jenjang_jabatan_fungsional", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

route.put("/jenjang/:jenjangId", requireRole("super_admin"), async (c) => {
  const id = c.req.param("jenjangId");
  const body = await c.req.json();
  const existing = await c.env.DB.prepare(`SELECT id FROM jenjang_jabatan_fungsional WHERE id = ?`).bind(id).first();
  if (!existing) throw notFound("Jenjang tidak ditemukan");
  await c.env.DB.prepare(
    `UPDATE jenjang_jabatan_fungsional SET nama = ?, urutan = ?, golongan_ruang_minimal = ?, angka_kredit_kumulatif_minimal = ? WHERE id = ?`
  )
    .bind(body.nama, body.urutan, body.golongan_ruang_minimal, body.angka_kredit_kumulatif_minimal, id)
    .run();
  await logAktivitas(c.env, c.get("user"), "update", "jenjang_jabatan_fungsional", Number(id), body, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
