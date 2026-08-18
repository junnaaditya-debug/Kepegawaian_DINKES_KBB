import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM parameter_aturan ORDER BY kategori, kunci`).all();
  const parsed = (results as any[]).map((r) => ({ ...r, nilai: JSON.parse(r.nilai) }));
  return c.json(parsed);
});

route.put("/:kunci", requireRole("super_admin"), async (c) => {
  const kunci = c.req.param("kunci");
  const body = await c.req.json();
  if (body.nilai === undefined) throw badRequest("nilai wajib diisi");
  const existing = await c.env.DB.prepare(`SELECT id FROM parameter_aturan WHERE kunci = ?`).bind(kunci).first();
  if (!existing) throw notFound("Parameter tidak ditemukan");
  await c.env.DB.prepare(
    `UPDATE parameter_aturan SET nilai = ?, deskripsi = COALESCE(?, deskripsi), updated_by = ?, updated_at = datetime('now') WHERE kunci = ?`
  )
    .bind(JSON.stringify(body.nilai), body.deskripsi ?? null, c.get("user").id, kunci)
    .run();
  await logAktivitas(c.env, c.get("user"), "update", "parameter_aturan", null, { kunci, nilai: body.nilai }, c.get("requestIp"));
  return c.json({ ok: true });
});

route.get("/golongan-masa-kerja", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM golongan_masa_kerja_minimum ORDER BY id`).all();
  return c.json(results);
});

route.put("/golongan-masa-kerja/:golongan", requireRole("super_admin"), async (c) => {
  const golongan = decodeURIComponent(c.req.param("golongan")!);
  const body = await c.req.json();
  if (body.masa_kerja_minimum_bulan == null) throw badRequest("masa_kerja_minimum_bulan wajib diisi");
  const existing = await c.env.DB.prepare(`SELECT id FROM golongan_masa_kerja_minimum WHERE golongan_ruang = ?`).bind(golongan).first();
  if (!existing) throw notFound("Golongan tidak ditemukan");
  await c.env.DB.prepare(
    `UPDATE golongan_masa_kerja_minimum SET masa_kerja_minimum_bulan = ?, golongan_ruang_berikutnya = COALESCE(?, golongan_ruang_berikutnya), updated_by = ?, updated_at = datetime('now')
     WHERE golongan_ruang = ?`
  )
    .bind(body.masa_kerja_minimum_bulan, body.golongan_ruang_berikutnya ?? null, c.get("user").id, golongan)
    .run();
  await logAktivitas(c.env, c.get("user"), "update", "golongan_masa_kerja_minimum", null, { golongan, ...body }, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
