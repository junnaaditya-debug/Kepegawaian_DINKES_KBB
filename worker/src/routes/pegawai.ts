import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, unitScopeFilter, WRITE_ROLES } from "../middleware/auth";
import { badRequest, conflict, notFound, parsePagination } from "../lib/http";
import { logAktivitas } from "../lib/audit";
import { parseSheetToRows } from "../lib/excel";
import { monthsBetween } from "../lib/business";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

const LIST_SELECT = `
  SELECT p.id, p.nip, p.nama, p.gelar_depan, p.gelar_belakang, p.status_kepegawaian, p.status_aktif,
         p.unit_kerja_id, uk.nama as unit_kerja_nama, p.jenis_jabatan, p.jabatan_nama_display,
         p.golongan_ruang_aktif, p.nama_pangkat_aktif, p.tmt_pangkat_aktif
  FROM pegawai p
  JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
`;

route.get("/", async (c) => {
  const user = c.get("user");
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);

  const clauses: string[] = [];
  const params: unknown[] = [];

  const scope = unitScopeFilter(user);
  if (scope) {
    clauses.push(scope.sql);
    params.push(scope.param);
  }
  if (user.role === "pegawai") {
    if (!user.pegawaiId) return c.json({ data: [], total: 0, page, pageSize });
    clauses.push("p.id = ?");
    params.push(user.pegawaiId);
  }
  if (q.search) {
    clauses.push("(p.nama LIKE ? OR p.nip LIKE ?)");
    params.push(`%${q.search}%`, `%${q.search}%`);
  }
  if (q.unitKerjaId) {
    clauses.push("p.unit_kerja_id = ?");
    params.push(q.unitKerjaId);
  }
  if (q.jenisJabatan) {
    clauses.push("p.jenis_jabatan = ?");
    params.push(q.jenisJabatan);
  }
  if (q.golongan) {
    clauses.push("p.golongan_ruang_aktif = ?");
    params.push(q.golongan);
  }
  if (q.statusAktif) {
    clauses.push("p.status_aktif = ?");
    params.push(q.statusAktif);
  } else if (q.includeInactive !== "true") {
    clauses.push("p.status_aktif = 'aktif'");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM pegawai p ${where}`)
    .bind(...params)
    .first<{ n: number }>();

  const { results } = await c.env.DB.prepare(
    `${LIST_SELECT} ${where} ORDER BY p.nama LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all();

  return c.json({ data: results, total: countRow?.n ?? 0, page, pageSize });
});

function assertUnitScope(c: any, unitKerjaId: number) {
  const user = c.get("user");
  if (user.role === "kepala_bidang" && Number(user.unitKerjaId) !== Number(unitKerjaId)) {
    throw notFound("Pegawai tidak ditemukan");
  }
}

route.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT p.*, uk.nama as unit_kerja_nama, jf.nama as jenjang_fungsional_nama, jjf.nama as jenis_fungsional_nama
     FROM pegawai p
     JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     LEFT JOIN jenjang_jabatan_fungsional jf ON jf.id = p.jenjang_jabatan_fungsional_id
     LEFT JOIN jenis_jabatan_fungsional jjf ON jjf.id = jf.jenis_jabatan_fungsional_id
     WHERE p.id = ?`
  )
    .bind(id)
    .first<any>();
  if (!row) throw notFound("Pegawai tidak ditemukan");
  if (user.role === "pegawai" && user.pegawaiId !== row.id) throw notFound("Pegawai tidak ditemukan");
  await assertUnitScope(c, row.unit_kerja_id);

  const masaKerjaBulan = row.tmt_pangkat_aktif ? monthsBetween(row.tmt_pangkat_aktif, new Date()) : null;

  return c.json({ ...row, masa_kerja_golongan_bulan: masaKerjaBulan });
});

const REQUIRED_FIELDS = ["nip", "nama", "unit_kerja_id", "status_kepegawaian", "jenis_jabatan"];

route.post("/", requireRole(...WRITE_ROLES), async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  for (const f of REQUIRED_FIELDS) {
    if (!body[f]) throw badRequest(`Field '${f}' wajib diisi`);
  }
  const dupe = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE nip = ?`).bind(body.nip).first();
  if (dupe) throw conflict("NIP sudah terdaftar");

  const result = await c.env.DB.prepare(
    `INSERT INTO pegawai (
      nip, nip_lama, nama, gelar_depan, gelar_belakang, tempat_lahir, tanggal_lahir, jenis_kelamin,
      alamat, no_hp, email, status_kepegawaian, tmt_cpns, tmt_pns, status_aktif, unit_kerja_id,
      jenis_jabatan, jabatan_struktural_nama, jenjang_jabatan_fungsional_id, jabatan_nama_display,
      golongan_ruang_aktif, nama_pangkat_aktif, tmt_pangkat_aktif, skp_predikat_terakhir, skp_tahun_terakhir,
      created_by, updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      body.nip, body.nip_lama ?? null, body.nama, body.gelar_depan ?? null, body.gelar_belakang ?? null,
      body.tempat_lahir ?? null, body.tanggal_lahir ?? null, body.jenis_kelamin ?? null,
      body.alamat ?? null, body.no_hp ?? null, body.email ?? null,
      body.status_kepegawaian, body.tmt_cpns ?? null, body.tmt_pns ?? null,
      body.status_aktif ?? "aktif", body.unit_kerja_id,
      body.jenis_jabatan, body.jabatan_struktural_nama ?? null, body.jenjang_jabatan_fungsional_id ?? null,
      body.jabatan_nama_display ?? body.jabatan_struktural_nama ?? null,
      body.golongan_ruang_aktif ?? null, body.nama_pangkat_aktif ?? null, body.tmt_pangkat_aktif ?? null,
      body.skp_predikat_terakhir ?? null, body.skp_tahun_terakhir ?? null,
      user.id, user.id
    )
    .run();

  const id = result.meta.last_row_id as number;

  if (body.golongan_ruang_aktif && body.tmt_pangkat_aktif) {
    await c.env.DB.prepare(
      `INSERT INTO riwayat_pangkat_golongan (pegawai_id, golongan_ruang, nama_pangkat, tmt_pangkat, jenis_kenaikan, is_aktif, created_by)
       VALUES (?, ?, ?, ?, 'cpns', 1, ?)`
    )
      .bind(id, body.golongan_ruang_aktif, body.nama_pangkat_aktif ?? "", body.tmt_pangkat_aktif, user.id)
      .run();
  }

  await logAktivitas(c.env, user, "create", "pegawai", id, { nip: body.nip, nama: body.nama }, c.get("requestIp"));
  return c.json({ id }, 201);
});

route.put("/:id", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const existing = await c.env.DB.prepare(`SELECT id, unit_kerja_id FROM pegawai WHERE id = ?`).bind(id).first<any>();
  if (!existing) throw notFound("Pegawai tidak ditemukan");
  await assertUnitScope(c, existing.unit_kerja_id);

  const body = await c.req.json();
  for (const f of REQUIRED_FIELDS) {
    if (!body[f]) throw badRequest(`Field '${f}' wajib diisi`);
  }
  if (body.nip) {
    const dupe = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE nip = ? AND id != ?`).bind(body.nip, id).first();
    if (dupe) throw conflict("NIP sudah digunakan pegawai lain");
  }

  await c.env.DB.prepare(
    `UPDATE pegawai SET
      nip=?, nip_lama=?, nama=?, gelar_depan=?, gelar_belakang=?, tempat_lahir=?, tanggal_lahir=?, jenis_kelamin=?,
      alamat=?, no_hp=?, email=?, status_kepegawaian=?, tmt_cpns=?, tmt_pns=?, status_aktif=?, tanggal_status_berubah=?,
      keterangan_status=?, unit_kerja_id=?, jenis_jabatan=?, jabatan_struktural_nama=?, jenjang_jabatan_fungsional_id=?,
      jabatan_nama_display=?, skp_predikat_terakhir=?, skp_tahun_terakhir=?, updated_by=?, updated_at=datetime('now')
     WHERE id=?`
  )
    .bind(
      body.nip, body.nip_lama ?? null, body.nama, body.gelar_depan ?? null, body.gelar_belakang ?? null,
      body.tempat_lahir ?? null, body.tanggal_lahir ?? null, body.jenis_kelamin ?? null,
      body.alamat ?? null, body.no_hp ?? null, body.email ?? null,
      body.status_kepegawaian, body.tmt_cpns ?? null, body.tmt_pns ?? null,
      body.status_aktif ?? "aktif", body.tanggal_status_berubah ?? null, body.keterangan_status ?? null,
      body.unit_kerja_id, body.jenis_jabatan, body.jabatan_struktural_nama ?? null,
      body.jenjang_jabatan_fungsional_id ?? null, body.jabatan_nama_display ?? body.jabatan_struktural_nama ?? null,
      body.skp_predikat_terakhir ?? null, body.skp_tahun_terakhir ?? null,
      user.id, id
    )
    .run();

  await logAktivitas(c.env, user, "update", "pegawai", Number(id), body, c.get("requestIp"));
  return c.json({ ok: true });
});

route.delete("/:id", requireRole("super_admin"), async (c) => {
  const id = c.req.param("id");
  const deps = await c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM riwayat_pangkat_golongan WHERE pegawai_id = ?) +
      (SELECT COUNT(*) FROM riwayat_jabatan WHERE pegawai_id = ?) +
      (SELECT COUNT(*) FROM dokumen WHERE pegawai_id = ?) as n`
  )
    .bind(id, id, id)
    .first<{ n: number }>();
  if (deps && deps.n > 0) {
    throw badRequest("Pegawai memiliki riwayat/dokumen terkait, ubah status menjadi non-aktif sebagai gantinya");
  }
  const result = await c.env.DB.prepare(`DELETE FROM pegawai WHERE id = ?`).bind(id).run();
  if (result.meta.changes === 0) throw notFound("Pegawai tidak ditemukan");
  await logAktivitas(c.env, c.get("user"), "delete", "pegawai", Number(id), null, c.get("requestIp"));
  return c.json({ ok: true });
});

// FR-1.6: bulk import dari Excel/CSV
route.post("/import", requireRole(...WRITE_ROLES), async (c) => {
  const user = c.get("user");
  const form = await c.req.formData();
  const file: unknown = form.get("file");
  if (!(file instanceof File)) throw badRequest("File tidak ditemukan (field 'file')");

  const buffer = await file.arrayBuffer();
  const rows = parseSheetToRows(buffer);
  if (rows.length === 0) throw badRequest("File kosong atau format tidak dikenali");

  const unitRows = await c.env.DB.prepare(`SELECT id, kode FROM unit_kerja`).all<{ id: number; kode: string }>();
  const unitByKode = new Map(unitRows.results.map((u) => [u.kode.toUpperCase(), u.id]));

  const errors: { row: number; message: string }[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header is row 1
    if (!r.nip || !r.nama) {
      errors.push({ row: rowNum, message: "nip dan nama wajib diisi" });
      continue;
    }
    if (!["L", "P"].includes(r.jenis_kelamin?.toUpperCase())) {
      errors.push({ row: rowNum, message: "jenis_kelamin harus L atau P" });
      continue;
    }
    const unitKerjaId = unitByKode.get((r.unit_kerja_kode ?? "").toUpperCase());
    if (!unitKerjaId) {
      errors.push({ row: rowNum, message: `unit_kerja_kode '${r.unit_kerja_kode}' tidak ditemukan` });
      continue;
    }
    const dupe = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE nip = ?`).bind(r.nip).first();
    if (dupe) {
      errors.push({ row: rowNum, message: `NIP ${r.nip} sudah terdaftar, dilewati` });
      continue;
    }
    try {
      const result = await c.env.DB.prepare(
        `INSERT INTO pegawai (
          nip, nip_lama, nama, gelar_depan, gelar_belakang, tempat_lahir, tanggal_lahir, jenis_kelamin,
          alamat, no_hp, email, status_kepegawaian, tmt_cpns, tmt_pns, unit_kerja_id, jenis_jabatan,
          jabatan_struktural_nama, jabatan_nama_display, golongan_ruang_aktif, nama_pangkat_aktif, tmt_pangkat_aktif,
          created_by, updated_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          r.nip, r.nip_lama || null, r.nama, r.gelar_depan || null, r.gelar_belakang || null,
          r.tempat_lahir || null, r.tanggal_lahir || null, r.jenis_kelamin.toUpperCase(),
          r.alamat || null, r.no_hp || null, r.email || null,
          r.status_kepegawaian || "PNS", r.tmt_cpns || null, r.tmt_pns || null,
          unitKerjaId, r.jenis_jabatan || "pelaksana",
          r.jabatan_struktural_nama || null, r.jabatan_struktural_nama || null,
          r.golongan_ruang_aktif || null, r.nama_pangkat_aktif || null, r.tmt_pangkat_aktif || null,
          user.id, user.id
        )
        .run();

      const pegawaiId = result.meta.last_row_id as number;
      if (r.golongan_ruang_aktif && r.tmt_pangkat_aktif) {
        await c.env.DB.prepare(
          `INSERT INTO riwayat_pangkat_golongan (pegawai_id, golongan_ruang, nama_pangkat, tmt_pangkat, jenis_kenaikan, is_aktif, created_by)
           VALUES (?, ?, ?, ?, 'lainnya', 1, ?)`
        )
          .bind(pegawaiId, r.golongan_ruang_aktif, r.nama_pangkat_aktif || "", r.tmt_pangkat_aktif, user.id)
          .run();
      }
      inserted++;
    } catch (e: any) {
      errors.push({ row: rowNum, message: e.message ?? "Gagal menyimpan baris" });
    }
  }

  await logAktivitas(c.env, user, "create", "pegawai", null, { action: "bulk_import", inserted, errorCount: errors.length }, c.get("requestIp"));
  return c.json({ inserted, totalRows: rows.length, errors });
});

export default route;
