import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const parameterRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const READ_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS"] as const;
parameterRoutes.use("*", requireRole(...READ_ROLES));

parameterRoutes.get("/", async (c) => {
  const [periode, masaKerja, angkaKredit, skp, umum] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM parameter_periode_kp ORDER BY bulan, tanggal`).all(),
    c.env.DB.prepare(`SELECT * FROM parameter_masa_kerja_reguler ORDER BY golongan_ruang`).all(),
    c.env.DB.prepare(`SELECT * FROM parameter_angka_kredit_jenjang ORDER BY jenis_jabatan_fungsional, jenjang_jabatan`).all(),
    c.env.DB.prepare(`SELECT * FROM parameter_skp_minimum ORDER BY urutan_peringkat`).all(),
    c.env.DB.prepare(`SELECT * FROM parameter_umum ORDER BY nama`).all(),
  ]);

  return c.json({
    data: {
      periodeKp: periode.results,
      masaKerjaReguler: masaKerja.results,
      angkaKreditJenjang: angkaKredit.results,
      skpMinimum: skp.results,
      umum: umum.results,
    },
  });
});

function writeOnly(c: import("hono").Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<Response>) {
  const authUser = c.get("authUser");
  if (authUser.role !== "SUPER_ADMIN") {
    return Promise.resolve(c.json({ error: "Hanya Super Admin yang dapat mengubah parameter aturan." }, 403));
  }
  return next();
}

// --- Periode KP ---
parameterRoutes.post("/periode-kp", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{ namaPeriode?: string; bulan?: number; tanggal?: number }>().catch(() => ({} as never));
  if (!body.namaPeriode || !body.bulan || !body.tanggal) return c.json({ error: "Nama periode, bulan, dan tanggal wajib diisi." }, 400);
  const id = uuid();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO parameter_periode_kp (id, nama_periode, bulan, tanggal, is_active, updated_at, updated_by) VALUES (?,?,?,?,1,?,?)`
  ).bind(id, body.namaPeriode, body.bulan, body.tanggal, now, authUser.id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "CREATE", entityType: "PARAMETER_PERIODE_KP", entityId: id, dataSesudah: body });
  return c.json({ data: { id } }, 201);
}));

parameterRoutes.put("/periode-kp/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const body = await c.req.json<{ namaPeriode?: string; bulan?: number; tanggal?: number; isActive?: boolean }>().catch(() => ({} as never));
  const existing = await c.env.DB.prepare(`SELECT * FROM parameter_periode_kp WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Parameter tidak ditemukan." }, 404);
  await c.env.DB.prepare(
    `UPDATE parameter_periode_kp SET nama_periode = ?, bulan = ?, tanggal = ?, is_active = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  ).bind(
    body.namaPeriode ?? existing.nama_periode,
    body.bulan ?? existing.bulan,
    body.tanggal ?? existing.tanggal,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
    nowIso(),
    authUser.id,
    id
  ).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "UPDATE", entityType: "PARAMETER_PERIODE_KP", entityId: id, dataSebelum: existing, dataSesudah: body });
  return c.json({ message: "Parameter periode berhasil diperbarui." });
}));

parameterRoutes.delete("/periode-kp/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM parameter_periode_kp WHERE id = ?`).bind(id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "DELETE", entityType: "PARAMETER_PERIODE_KP", entityId: id });
  return c.json({ message: "Parameter periode berhasil dihapus." });
}));

// --- Masa Kerja Reguler ---
parameterRoutes.post("/masa-kerja-reguler", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{ golonganRuang?: string; masaKerjaMinimumBulan?: number; keterangan?: string }>().catch(() => ({} as never));
  if (!body.masaKerjaMinimumBulan) return c.json({ error: "Masa kerja minimum (bulan) wajib diisi." }, 400);
  const id = uuid();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO parameter_masa_kerja_reguler (id, golongan_ruang, masa_kerja_minimum_bulan, keterangan, is_active, updated_at, updated_by) VALUES (?,?,?,?,1,?,?)`
  ).bind(id, body.golonganRuang ?? null, body.masaKerjaMinimumBulan, body.keterangan ?? null, now, authUser.id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "CREATE", entityType: "PARAMETER_MASA_KERJA", entityId: id, dataSesudah: body });
  return c.json({ data: { id } }, 201);
}));

parameterRoutes.put("/masa-kerja-reguler/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const body = await c.req.json<{ golonganRuang?: string; masaKerjaMinimumBulan?: number; keterangan?: string; isActive?: boolean }>().catch(() => ({} as never));
  const existing = await c.env.DB.prepare(`SELECT * FROM parameter_masa_kerja_reguler WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Parameter tidak ditemukan." }, 404);
  await c.env.DB.prepare(
    `UPDATE parameter_masa_kerja_reguler SET golongan_ruang = ?, masa_kerja_minimum_bulan = ?, keterangan = ?, is_active = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  ).bind(
    body.golonganRuang ?? existing.golongan_ruang,
    body.masaKerjaMinimumBulan ?? existing.masa_kerja_minimum_bulan,
    body.keterangan ?? existing.keterangan,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
    nowIso(),
    authUser.id,
    id
  ).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "UPDATE", entityType: "PARAMETER_MASA_KERJA", entityId: id, dataSebelum: existing, dataSesudah: body });
  return c.json({ message: "Parameter masa kerja berhasil diperbarui." });
}));

parameterRoutes.delete("/masa-kerja-reguler/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM parameter_masa_kerja_reguler WHERE id = ?`).bind(id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "DELETE", entityType: "PARAMETER_MASA_KERJA", entityId: id });
  return c.json({ message: "Parameter masa kerja berhasil dihapus." });
}));

// --- Angka Kredit per Jenjang ---
parameterRoutes.post("/angka-kredit-jenjang", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    jenisJabatanFungsional?: string;
    jenjangJabatan?: string;
    golonganRuang?: string;
    angkaKreditMinimum?: number;
    keterangan?: string;
  }>().catch(() => ({} as never));
  if (!body.jenisJabatanFungsional || !body.jenjangJabatan || body.angkaKreditMinimum === undefined) {
    return c.json({ error: "Jenis jabatan fungsional, jenjang, dan angka kredit minimum wajib diisi." }, 400);
  }
  const id = uuid();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO parameter_angka_kredit_jenjang (id, jenis_jabatan_fungsional, jenjang_jabatan, golongan_ruang, angka_kredit_minimum, keterangan, is_active, updated_at, updated_by) VALUES (?,?,?,?,?,?,1,?,?)`
  ).bind(id, body.jenisJabatanFungsional, body.jenjangJabatan, body.golonganRuang ?? null, body.angkaKreditMinimum, body.keterangan ?? null, now, authUser.id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "CREATE", entityType: "PARAMETER_ANGKA_KREDIT", entityId: id, dataSesudah: body });
  return c.json({ data: { id } }, 201);
}));

parameterRoutes.put("/angka-kredit-jenjang/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const body = await c.req.json<{
    jenisJabatanFungsional?: string;
    jenjangJabatan?: string;
    golonganRuang?: string;
    angkaKreditMinimum?: number;
    keterangan?: string;
    isActive?: boolean;
  }>().catch(() => ({} as never));
  const existing = await c.env.DB.prepare(`SELECT * FROM parameter_angka_kredit_jenjang WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Parameter tidak ditemukan." }, 404);
  await c.env.DB.prepare(
    `UPDATE parameter_angka_kredit_jenjang SET jenis_jabatan_fungsional = ?, jenjang_jabatan = ?, golongan_ruang = ?, angka_kredit_minimum = ?, keterangan = ?, is_active = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  ).bind(
    body.jenisJabatanFungsional ?? existing.jenis_jabatan_fungsional,
    body.jenjangJabatan ?? existing.jenjang_jabatan,
    body.golonganRuang ?? existing.golongan_ruang,
    body.angkaKreditMinimum ?? existing.angka_kredit_minimum,
    body.keterangan ?? existing.keterangan,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
    nowIso(),
    authUser.id,
    id
  ).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "UPDATE", entityType: "PARAMETER_ANGKA_KREDIT", entityId: id, dataSebelum: existing, dataSesudah: body });
  return c.json({ message: "Parameter angka kredit berhasil diperbarui." });
}));

parameterRoutes.delete("/angka-kredit-jenjang/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM parameter_angka_kredit_jenjang WHERE id = ?`).bind(id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "DELETE", entityType: "PARAMETER_ANGKA_KREDIT", entityId: id });
  return c.json({ message: "Parameter angka kredit berhasil dihapus." });
}));

// --- SKP Minimum ---
parameterRoutes.post("/skp-minimum", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{ predikatMinimum?: string; urutanPeringkat?: number; keterangan?: string }>().catch(() => ({} as never));
  if (!body.predikatMinimum || body.urutanPeringkat === undefined) return c.json({ error: "Predikat dan urutan peringkat wajib diisi." }, 400);
  const id = uuid();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO parameter_skp_minimum (id, predikat_minimum, urutan_peringkat, keterangan, is_active, updated_at, updated_by) VALUES (?,?,?,?,1,?,?)`
  ).bind(id, body.predikatMinimum, body.urutanPeringkat, body.keterangan ?? null, now, authUser.id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "CREATE", entityType: "PARAMETER_SKP", entityId: id, dataSesudah: body });
  return c.json({ data: { id } }, 201);
}));

parameterRoutes.delete("/skp-minimum/:id", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM parameter_skp_minimum WHERE id = ?`).bind(id).run();
  await writeAuditLog(c.env.DB, { user: authUser, aksi: "DELETE", entityType: "PARAMETER_SKP", entityId: id });
  return c.json({ message: "Parameter SKP berhasil dihapus." });
}));

// --- Parameter umum (key-value) ---
parameterRoutes.put("/umum/:kode", (c) => writeOnly(c, async () => {
  const authUser = c.get("authUser");
  const kode = c.req.param("kode");
  const body = await c.req.json<{ nama?: string; nilai?: string; tipeData?: string; keterangan?: string }>().catch(() => ({} as never));
  if (!body.nilai) return c.json({ error: "Nilai parameter wajib diisi." }, 400);

  const existing = await c.env.DB.prepare(`SELECT * FROM parameter_umum WHERE kode = ?`).bind(kode).first<Record<string, unknown>>();
  const now = nowIso();
  if (existing) {
    await c.env.DB.prepare(`UPDATE parameter_umum SET nama = ?, nilai = ?, tipe_data = ?, keterangan = ?, updated_at = ?, updated_by = ? WHERE kode = ?`)
      .bind(body.nama ?? existing.nama, body.nilai, body.tipeData ?? existing.tipe_data, body.keterangan ?? existing.keterangan, now, authUser.id, kode)
      .run();
  } else {
    await c.env.DB.prepare(`INSERT INTO parameter_umum (kode, nama, nilai, tipe_data, keterangan, updated_at, updated_by) VALUES (?,?,?,?,?,?,?)`)
      .bind(kode, body.nama ?? kode, body.nilai, body.tipeData ?? "STRING", body.keterangan ?? null, now, authUser.id)
      .run();
  }

  await writeAuditLog(c.env.DB, { user: authUser, aksi: "UPDATE", entityType: "PARAMETER_UMUM", entityId: kode, dataSebelum: existing, dataSesudah: body });
  return c.json({ message: "Parameter berhasil disimpan." });
}));
