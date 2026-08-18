import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const riwayatPangkatRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

riwayatPangkatRoutes.get("/pegawai/:pegawaiId", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM riwayat_pangkat_golongan WHERE pegawai_id = ? ORDER BY tmt_pangkat DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json({ data: results });
});

/**
 * Records a new SK Kenaikan Pangkat: archives the previous active riwayat,
 * activates the new one, and syncs the employee's active pangkat/golongan.
 * This is the "SK terbit" step described in PRD section 9 (FR-4.6 / BR-6).
 */
riwayatPangkatRoutes.post("/", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    pegawaiId?: string;
    golonganRuang?: string;
    namaPangkat?: string;
    tmtPangkat?: string;
    noSk?: string;
    tanggalSk?: string;
    pejabatPenetap?: string;
    jenisKenaikan?: string;
    keterangan?: string;
    statusUsulanId?: string;
  }>().catch(() => ({} as never));

  if (!body.pegawaiId || !body.golonganRuang || !body.namaPangkat || !body.tmtPangkat) {
    return c.json({ error: "Pegawai, golongan/ruang, nama pangkat, dan TMT pangkat wajib diisi." }, 400);
  }

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(body.pegawaiId).first();
  if (!pegawai) return c.json({ error: "Pegawai tidak ditemukan." }, 404);

  const id = uuid();
  const now = nowIso();

  await c.env.DB.prepare(`UPDATE riwayat_pangkat_golongan SET is_aktif = 0 WHERE pegawai_id = ? AND is_aktif = 1`)
    .bind(body.pegawaiId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO riwayat_pangkat_golongan (id, pegawai_id, golongan_ruang, nama_pangkat, tmt_pangkat, no_sk, tanggal_sk, pejabat_penetap, jenis_kenaikan, is_aktif, keterangan, created_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)`
  )
    .bind(
      id,
      body.pegawaiId,
      body.golonganRuang,
      body.namaPangkat,
      body.tmtPangkat,
      body.noSk ?? null,
      body.tanggalSk ?? null,
      body.pejabatPenetap ?? null,
      body.jenisKenaikan ?? "REGULER",
      body.keterangan ?? null,
      now,
      authUser.id
    )
    .run();

  await c.env.DB.prepare(
    `UPDATE pegawai SET golongan_ruang_aktif = ?, nama_pangkat_aktif = ?, tmt_pangkat_aktif = ?, updated_at = ?, updated_by = ? WHERE id = ?`
  )
    .bind(body.golonganRuang, body.namaPangkat, body.tmtPangkat, now, authUser.id, body.pegawaiId)
    .run();

  // If this SK resolves an open promotion tracking entry, mark it SK_TERBIT and link it.
  if (body.statusUsulanId) {
    await c.env.DB.prepare(
      `UPDATE status_usulan_kenaikan_pangkat SET status = 'SK_TERBIT', riwayat_pangkat_golongan_id = ?, updated_by = ?, updated_at = ? WHERE id = ?`
    )
      .bind(id, authUser.id, now, body.statusUsulanId)
      .run();
  }

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "RIWAYAT_PANGKAT_GOLONGAN",
    entityId: id,
    dataSesudah: body,
    deskripsi: `SK Kenaikan Pangkat baru diinput untuk pegawai ${body.pegawaiId}; riwayat lama diarsipkan dan data pangkat aktif diperbarui.`,
  });

  return c.json({ data: { id } }, 201);
});

riwayatPangkatRoutes.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM riwayat_pangkat_golongan WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Riwayat pangkat tidak ditemukan." }, 404);

  await c.env.DB.prepare(`DELETE FROM riwayat_pangkat_golongan WHERE id = ?`).bind(id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "RIWAYAT_PANGKAT_GOLONGAN",
    entityId: id,
    dataSebelum: existing,
  });

  return c.json({ message: "Riwayat pangkat berhasil dihapus." });
});
