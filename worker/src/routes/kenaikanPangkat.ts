import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, unitScopeFilter, WRITE_ROLES } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";
import { periodesWithinRange, type PeriodeConfig } from "../lib/business";
import { getDeteksiKenaikanPangkat } from "../lib/kenaikanPangkat";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

async function loadParam<T>(env: Env, kunci: string): Promise<T> {
  const row = await env.DB.prepare(`SELECT nilai FROM parameter_aturan WHERE kunci = ?`).bind(kunci).first<{ nilai: string }>();
  if (!row) throw badRequest(`Parameter '${kunci}' belum dikonfigurasi`);
  return JSON.parse(row.nilai) as T;
}

route.get("/deteksi", async (c) => {
  const user = c.get("user");
  const q = c.req.query();
  const rentangBulan = parseInt(q.rentangBulan ?? "6", 10);
  let unitKerjaId = q.unitKerjaId ? Number(q.unitKerjaId) : undefined;

  const scope = unitScopeFilter(user);
  if (scope) unitKerjaId = Number(scope.param);

  const enriched = await getDeteksiKenaikanPangkat(c.env, {
    rentangBulan,
    jenis: q.jenis,
    unitKerjaId,
    jenisKepegawaian: q.jenisKepegawaian,
  });

  return c.json({ data: enriched, total: enriched.length });
});

route.get("/proyeksi-periode", async (c) => {
  const periodes = await loadParam<PeriodeConfig[]>(c.env, "periode_tahunan");
  const bulan = parseInt(c.req.query("bulanKeDepan") ?? "12", 10);
  return c.json(periodesWithinRange(periodes, new Date(), bulan).map((p) => ({ tanggal: p.date.toISOString().slice(0, 10), label: p.label })));
});

route.patch("/status/:pegawaiId/:tahun/:bulan", requireRole(...WRITE_ROLES), async (c) => {
  const { pegawaiId, tahun, bulan } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const status = body.status as string;
  if (!["belum_diproses", "sedang_diusulkan", "ditunda"].includes(status)) {
    throw badRequest("Status harus salah satu dari: belum_diproses, sedang_diusulkan, ditunda (SK Terbit hanya melalui input Riwayat Pangkat)");
  }
  if (status === "ditunda" && !body.catatan) throw badRequest("Catatan alasan wajib diisi untuk status 'ditunda'");

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(pegawaiId).first();
  if (!pegawai) throw notFound("Pegawai tidak ditemukan");

  await c.env.DB.prepare(
    `INSERT INTO status_usulan_kenaikan_pangkat (pegawai_id, periode_tahun, periode_bulan, jenis_kenaikan, status, catatan, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pegawai_id, periode_tahun, periode_bulan)
     DO UPDATE SET status = excluded.status, catatan = excluded.catatan, updated_by = excluded.updated_by, updated_at = datetime('now')`
  )
    .bind(pegawaiId, tahun, bulan, body.jenisKenaikan ?? "reguler", status, body.catatan ?? null, user.id)
    .run();

  await logAktivitas(c.env, user, "status_change", "status_usulan_kenaikan_pangkat", Number(pegawaiId), { tahun, bulan, status }, c.get("requestIp"));
  return c.json({ ok: true });
});

route.patch("/status/:pegawaiId/:tahun/:bulan/verifikasi", requireRole("kepala_bidang", "super_admin"), async (c) => {
  const { pegawaiId, tahun, bulan } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();

  if (user.role === "kepala_bidang") {
    const pegawai = await c.env.DB.prepare(`SELECT unit_kerja_id FROM pegawai WHERE id = ?`).bind(pegawaiId).first<{ unit_kerja_id: number }>();
    if (!pegawai) throw notFound("Pegawai tidak ditemukan");
    if (pegawai.unit_kerja_id !== user.unitKerjaId) throw forbidden("Pegawai berada di luar unit kerja Anda");
  }

  await c.env.DB.prepare(
    `INSERT INTO status_usulan_kenaikan_pangkat (pegawai_id, periode_tahun, periode_bulan, jenis_kenaikan, diverifikasi_atasan, diverifikasi_oleh, diverifikasi_at, catatan_verifikasi, updated_by)
     VALUES (?, ?, ?, ?, 1, ?, datetime('now'), ?, ?)
     ON CONFLICT(pegawai_id, periode_tahun, periode_bulan)
     DO UPDATE SET diverifikasi_atasan = 1, diverifikasi_oleh = excluded.diverifikasi_oleh, diverifikasi_at = datetime('now'), catatan_verifikasi = excluded.catatan_verifikasi, updated_by = excluded.updated_by, updated_at = datetime('now')`
  )
    .bind(pegawaiId, tahun, bulan, body.jenisKenaikan ?? "reguler", user.id, body.catatan ?? null, user.id)
    .run();

  await logAktivitas(c.env, user, "verify", "status_usulan_kenaikan_pangkat", Number(pegawaiId), { tahun, bulan }, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
