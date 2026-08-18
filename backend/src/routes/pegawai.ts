import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog, parsePagination } from "../lib/db";
import { requireRole, scopedUnitKerjaId } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const pegawaiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

pegawaiRoutes.get("/", async (c) => {
  const authUser = c.get("authUser");
  if (authUser.role === "PEGAWAI") {
    if (!authUser.pegawaiId) return c.json({ data: [], pagination: { page: 1, pageSize: 20, total: 0 } });
    const row = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(authUser.pegawaiId).first();
    return c.json({ data: row ? [row] : [], pagination: { page: 1, pageSize: 20, total: row ? 1 : 0 } });
  }

  const { page, pageSize } = parsePagination(c.req.query() as Record<string, string>);
  const search = c.req.query("search")?.trim();
  const unitKerjaId = c.req.query("unitKerjaId");
  const jenisJabatan = c.req.query("jenisJabatan");
  const golongan = c.req.query("golongan");
  const statusAktif = c.req.query("statusAktif") ?? "AKTIF";

  const where: string[] = ["1=1"];
  const binds: unknown[] = [];

  const scopeUnit = scopedUnitKerjaId(authUser);
  if (scopeUnit) {
    where.push("p.unit_kerja_id = ?");
    binds.push(scopeUnit);
  }
  if (search) {
    where.push("(p.nama LIKE ? OR p.nip LIKE ? OR p.nip_lama LIKE ?)");
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (unitKerjaId) {
    where.push("p.unit_kerja_id = ?");
    binds.push(unitKerjaId);
  }
  if (jenisJabatan) {
    where.push("p.jenis_jabatan = ?");
    binds.push(jenisJabatan);
  }
  if (golongan) {
    where.push("p.golongan_ruang_aktif = ?");
    binds.push(golongan);
  }
  if (statusAktif !== "SEMUA") {
    where.push("p.status_aktif = ?");
    binds.push(statusAktif);
  }

  const whereSql = where.join(" AND ");

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM pegawai p WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, uk.nama as unit_kerja_nama
     FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${whereSql}
     ORDER BY p.nama
     LIMIT ? OFFSET ?`
  )
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ data: results, pagination: { page, pageSize, total: totalRow?.total ?? 0 } });
});

async function assertScopeAllowed(c: import("hono").Context<{ Bindings: Env; Variables: Variables }>, pegawai: { unit_kerja_id: string | null; id: string }) {
  const authUser = c.get("authUser");
  if (authUser.role === "PEGAWAI") return authUser.pegawaiId === pegawai.id;
  const scopeUnit = scopedUnitKerjaId(authUser);
  if (!scopeUnit) return true;
  return pegawai.unit_kerja_id === scopeUnit;
}

pegawaiRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const pegawai = await c.env.DB.prepare(
    `SELECT p.*, uk.nama as unit_kerja_nama FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id WHERE p.id = ?`
  )
    .bind(id)
    .first<{ unit_kerja_id: string | null; id: string }>();
  if (!pegawai) return c.json({ error: "Pegawai tidak ditemukan." }, 404);
  if (!(await assertScopeAllowed(c, pegawai))) return c.json({ error: "Anda tidak memiliki akses ke data ini." }, 403);
  return c.json({ data: pegawai });
});

pegawaiRoutes.get("/:id/detail", async (c) => {
  const id = c.req.param("id");
  const pegawai = await c.env.DB.prepare(
    `SELECT p.*, uk.nama as unit_kerja_nama FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id WHERE p.id = ?`
  )
    .bind(id)
    .first<{ unit_kerja_id: string | null; id: string }>();
  if (!pegawai) return c.json({ error: "Pegawai tidak ditemukan." }, 404);
  if (!(await assertScopeAllowed(c, pegawai))) return c.json({ error: "Anda tidak memiliki akses ke data ini." }, 403);

  const [riwayatJabatan, riwayatPangkat, riwayatPendidikan, angkaKredit, dokumen] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM riwayat_jabatan WHERE pegawai_id = ? ORDER BY tmt_jabatan DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM riwayat_pangkat_golongan WHERE pegawai_id = ? ORDER BY tmt_pangkat DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM riwayat_pendidikan WHERE pegawai_id = ? ORDER BY tahun_lulus DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM angka_kredit WHERE pegawai_id = ? ORDER BY tanggal_pak DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM dokumen WHERE pegawai_id = ? AND is_current_version = 1 ORDER BY uploaded_at DESC`).bind(id).all(),
  ]);

  return c.json({
    data: {
      pegawai,
      riwayatJabatan: riwayatJabatan.results,
      riwayatPangkat: riwayatPangkat.results,
      riwayatPendidikan: riwayatPendidikan.results,
      angkaKredit: angkaKredit.results,
      dokumen: dokumen.results,
    },
  });
});

interface PegawaiBody {
  nip?: string;
  nipLama?: string;
  nama?: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  jenisKelamin?: string;
  alamat?: string;
  noHp?: string;
  email?: string;
  fotoUrl?: string;
  statusKepegawaian?: string;
  tmtCpns?: string;
  tmtPns?: string;
  statusAktif?: string;
  unitKerjaId?: string | null;
  jenisJabatan?: string;
  namaJabatan?: string;
  jenjangJabatan?: string;
  golonganRuangAktif?: string;
  namaPangkatAktif?: string;
  tmtPangkatAktif?: string;
  nilaiSkpTerakhir?: number;
  predikatSkpTerakhir?: string;
  periodeSkpTerakhir?: string;
}

pegawaiRoutes.post("/", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<PegawaiBody>().catch(() => ({} as PegawaiBody));

  if (!body.nip || !body.nama || !body.statusKepegawaian) {
    return c.json({ error: "NIP, nama, dan status kepegawaian wajib diisi." }, 400);
  }

  const dupe = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE nip = ?`).bind(body.nip).first();
  if (dupe) return c.json({ error: "NIP sudah terdaftar." }, 409);

  const id = uuid();
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO pegawai (
      id, nip, nip_lama, nama, gelar_depan, gelar_belakang, tempat_lahir, tanggal_lahir, jenis_kelamin,
      alamat, no_hp, email, foto_url, status_kepegawaian, tmt_cpns, tmt_pns, status_aktif, unit_kerja_id,
      jenis_jabatan, nama_jabatan, jenjang_jabatan, golongan_ruang_aktif, nama_pangkat_aktif, tmt_pangkat_aktif,
      nilai_skp_terakhir, predikat_skp_terakhir, periode_skp_terakhir, is_active, created_at, updated_at, created_by, updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`
  )
    .bind(
      id,
      body.nip,
      body.nipLama ?? null,
      body.nama,
      body.gelarDepan ?? null,
      body.gelarBelakang ?? null,
      body.tempatLahir ?? null,
      body.tanggalLahir ?? null,
      body.jenisKelamin ?? null,
      body.alamat ?? null,
      body.noHp ?? null,
      body.email ?? null,
      body.fotoUrl ?? null,
      body.statusKepegawaian,
      body.tmtCpns ?? null,
      body.tmtPns ?? null,
      body.statusAktif ?? "AKTIF",
      body.unitKerjaId ?? null,
      body.jenisJabatan ?? null,
      body.namaJabatan ?? null,
      body.jenjangJabatan ?? null,
      body.golonganRuangAktif ?? null,
      body.namaPangkatAktif ?? null,
      body.tmtPangkatAktif ?? null,
      body.nilaiSkpTerakhir ?? null,
      body.predikatSkpTerakhir ?? null,
      body.periodeSkpTerakhir ?? null,
      now,
      now,
      authUser.id,
      authUser.id
    )
    .run();

  await writeAuditLog(c.env.DB, { user: authUser, aksi: "CREATE", entityType: "PEGAWAI", entityId: id, dataSesudah: body });

  return c.json({ data: { id } }, 201);
});

pegawaiRoutes.put("/:id", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Pegawai tidak ditemukan." }, 404);

  const body = await c.req.json<PegawaiBody>().catch(() => ({} as PegawaiBody));
  const v = <K extends keyof PegawaiBody>(key: K, col: string) =>
    body[key] !== undefined ? body[key] : existing[col];

  await c.env.DB.prepare(
    `UPDATE pegawai SET
      nip = ?, nip_lama = ?, nama = ?, gelar_depan = ?, gelar_belakang = ?, tempat_lahir = ?, tanggal_lahir = ?,
      jenis_kelamin = ?, alamat = ?, no_hp = ?, email = ?, foto_url = ?, status_kepegawaian = ?, tmt_cpns = ?,
      tmt_pns = ?, status_aktif = ?, unit_kerja_id = ?, jenis_jabatan = ?, nama_jabatan = ?, jenjang_jabatan = ?,
      golongan_ruang_aktif = ?, nama_pangkat_aktif = ?, tmt_pangkat_aktif = ?, nilai_skp_terakhir = ?,
      predikat_skp_terakhir = ?, periode_skp_terakhir = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`
  )
    .bind(
      v("nip", "nip"),
      v("nipLama", "nip_lama"),
      v("nama", "nama"),
      v("gelarDepan", "gelar_depan"),
      v("gelarBelakang", "gelar_belakang"),
      v("tempatLahir", "tempat_lahir"),
      v("tanggalLahir", "tanggal_lahir"),
      v("jenisKelamin", "jenis_kelamin"),
      v("alamat", "alamat"),
      v("noHp", "no_hp"),
      v("email", "email"),
      v("fotoUrl", "foto_url"),
      v("statusKepegawaian", "status_kepegawaian"),
      v("tmtCpns", "tmt_cpns"),
      v("tmtPns", "tmt_pns"),
      v("statusAktif", "status_aktif"),
      v("unitKerjaId", "unit_kerja_id"),
      v("jenisJabatan", "jenis_jabatan"),
      v("namaJabatan", "nama_jabatan"),
      v("jenjangJabatan", "jenjang_jabatan"),
      v("golonganRuangAktif", "golongan_ruang_aktif"),
      v("namaPangkatAktif", "nama_pangkat_aktif"),
      v("tmtPangkatAktif", "tmt_pangkat_aktif"),
      v("nilaiSkpTerakhir", "nilai_skp_terakhir"),
      v("predikatSkpTerakhir", "predikat_skp_terakhir"),
      v("periodeSkpTerakhir", "periode_skp_terakhir"),
      nowIso(),
      authUser.id,
      id
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "UPDATE",
    entityType: "PEGAWAI",
    entityId: id,
    dataSebelum: existing,
    dataSesudah: body,
  });

  return c.json({ message: "Data pegawai berhasil diperbarui." });
});

pegawaiRoutes.patch("/:id/status", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Pegawai tidak ditemukan." }, 404);

  const body = await c.req.json<{ statusAktif?: string; keterangan?: string; tanggal?: string }>().catch(() => ({} as never));
  if (!body.statusAktif) return c.json({ error: "Status aktif wajib diisi." }, 400);

  await c.env.DB.prepare(
    `UPDATE pegawai SET status_aktif = ?, keterangan_non_aktif = ?, tanggal_non_aktif = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  )
    .bind(body.statusAktif, body.keterangan ?? null, body.tanggal ?? null, nowIso(), authUser.id, id)
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "STATUS_CHANGE",
    entityType: "PEGAWAI",
    entityId: id,
    dataSebelum: existing,
    dataSesudah: body,
    deskripsi: `Status kepegawaian diubah menjadi ${body.statusAktif}.`,
  });

  return c.json({ message: "Status pegawai berhasil diperbarui." });
});

pegawaiRoutes.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Pegawai tidak ditemukan." }, 404);

  await c.env.DB.prepare(`UPDATE pegawai SET is_active = 0, updated_at = ? WHERE id = ?`).bind(nowIso(), id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "PEGAWAI",
    entityId: id,
    dataSebelum: existing,
    deskripsi: "Data pegawai dihapus (soft delete).",
  });

  return c.json({ message: "Data pegawai berhasil dihapus." });
});

pegawaiRoutes.post("/import", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{ rows?: PegawaiBody[] }>().catch(() => ({ rows: [] }));
  const rows = body.rows ?? [];
  if (rows.length === 0) return c.json({ error: "Tidak ada data untuk diimpor." }, 400);
  if (rows.length > 2000) return c.json({ error: "Maksimum 2000 baris per proses import." }, 400);

  const now = nowIso();
  const errors: { row: number; nip?: string; error: string }[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.nip || !row.nama || !row.statusKepegawaian) {
      errors.push({ row: i + 1, nip: row.nip, error: "NIP, nama, dan status kepegawaian wajib diisi." });
      continue;
    }
    const dupe = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE nip = ?`).bind(row.nip).first();
    if (dupe) {
      errors.push({ row: i + 1, nip: row.nip, error: "NIP sudah terdaftar, baris dilewati." });
      continue;
    }
    const id = uuid();
    await c.env.DB.prepare(
      `INSERT INTO pegawai (
        id, nip, nip_lama, nama, gelar_depan, gelar_belakang, tempat_lahir, tanggal_lahir, jenis_kelamin,
        alamat, no_hp, email, status_kepegawaian, tmt_cpns, tmt_pns, status_aktif, unit_kerja_id,
        jenis_jabatan, nama_jabatan, jenjang_jabatan, golongan_ruang_aktif, nama_pangkat_aktif, tmt_pangkat_aktif,
        is_active, created_at, updated_at, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`
    )
      .bind(
        id,
        row.nip,
        row.nipLama ?? null,
        row.nama,
        row.gelarDepan ?? null,
        row.gelarBelakang ?? null,
        row.tempatLahir ?? null,
        row.tanggalLahir ?? null,
        row.jenisKelamin ?? null,
        row.alamat ?? null,
        row.noHp ?? null,
        row.email ?? null,
        row.statusKepegawaian,
        row.tmtCpns ?? null,
        row.tmtPns ?? null,
        row.statusAktif ?? "AKTIF",
        row.unitKerjaId ?? null,
        row.jenisJabatan ?? null,
        row.namaJabatan ?? null,
        row.jenjangJabatan ?? null,
        row.golonganRuangAktif ?? null,
        row.namaPangkatAktif ?? null,
        row.tmtPangkatAktif ?? null,
        now,
        now,
        authUser.id,
        authUser.id
      )
      .run();
    inserted++;
  }

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "PEGAWAI",
    deskripsi: `Bulk import pegawai: ${inserted} berhasil, ${errors.length} gagal dari ${rows.length} baris.`,
  });

  return c.json({ data: { inserted, failed: errors.length, errors } });
});
