import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const riwayatJabatanRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

riwayatJabatanRoutes.get("/pegawai/:pegawaiId", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT rj.*, uk.nama as unit_kerja_nama FROM riwayat_jabatan rj
     LEFT JOIN unit_kerja uk ON uk.id = rj.unit_kerja_id
     WHERE rj.pegawai_id = ? ORDER BY rj.tmt_jabatan DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json({ data: results });
});

riwayatJabatanRoutes.post("/", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    pegawaiId?: string;
    jenisJabatan?: string;
    namaJabatan?: string;
    jenjangJabatan?: string;
    unitKerjaId?: string | null;
    noSk?: string;
    tanggalSk?: string;
    tmtJabatan?: string;
    keterangan?: string;
    jadikanAktif?: boolean;
  }>().catch(() => ({} as never));

  if (!body.pegawaiId || !body.jenisJabatan || !body.namaJabatan || !body.tmtJabatan) {
    return c.json({ error: "Pegawai, jenis jabatan, nama jabatan, dan TMT jabatan wajib diisi." }, 400);
  }

  const id = uuid();
  const now = nowIso();

  if (body.jadikanAktif !== false) {
    await c.env.DB.prepare(`UPDATE riwayat_jabatan SET is_aktif = 0, tmt_berakhir = ? WHERE pegawai_id = ? AND is_aktif = 1`)
      .bind(body.tmtJabatan, body.pegawaiId)
      .run();
  }

  await c.env.DB.prepare(
    `INSERT INTO riwayat_jabatan (id, pegawai_id, jenis_jabatan, nama_jabatan, jenjang_jabatan, unit_kerja_id, no_sk, tanggal_sk, tmt_jabatan, is_aktif, keterangan, created_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      body.pegawaiId,
      body.jenisJabatan,
      body.namaJabatan,
      body.jenjangJabatan ?? null,
      body.unitKerjaId ?? null,
      body.noSk ?? null,
      body.tanggalSk ?? null,
      body.tmtJabatan,
      body.jadikanAktif !== false ? 1 : 0,
      body.keterangan ?? null,
      now,
      authUser.id
    )
    .run();

  if (body.jadikanAktif !== false) {
    await c.env.DB.prepare(
      `UPDATE pegawai SET jenis_jabatan = ?, nama_jabatan = ?, jenjang_jabatan = ?, updated_at = ?, updated_by = ? WHERE id = ?`
    )
      .bind(body.jenisJabatan, body.namaJabatan, body.jenjangJabatan ?? null, now, authUser.id, body.pegawaiId)
      .run();
  }

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "RIWAYAT_JABATAN",
    entityId: id,
    dataSesudah: body,
    deskripsi: `Tambah riwayat jabatan untuk pegawai ${body.pegawaiId}.`,
  });

  return c.json({ data: { id } }, 201);
});

riwayatJabatanRoutes.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM riwayat_jabatan WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Riwayat jabatan tidak ditemukan." }, 404);

  await c.env.DB.prepare(`DELETE FROM riwayat_jabatan WHERE id = ?`).bind(id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "RIWAYAT_JABATAN",
    entityId: id,
    dataSebelum: existing,
  });

  return c.json({ message: "Riwayat jabatan berhasil dihapus." });
});
