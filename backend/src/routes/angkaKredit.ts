import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const angkaKreditRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

angkaKreditRoutes.get("/pegawai/:pegawaiId", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM angka_kredit WHERE pegawai_id = ? ORDER BY tanggal_pak DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json({ data: results });
});

angkaKreditRoutes.post("/", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    pegawaiId?: string;
    nomorPak?: string;
    tanggalPak?: string;
    periodeAwal?: string;
    periodeAkhir?: string;
    angkaKreditKumulatif?: number;
    unsurUtama?: number;
    pengembanganProfesi?: number;
    unsurPenunjang?: number;
    keterangan?: string;
  }>().catch(() => ({} as never));

  if (!body.pegawaiId || body.angkaKreditKumulatif === undefined) {
    return c.json({ error: "Pegawai dan angka kredit kumulatif wajib diisi." }, 400);
  }

  const id = uuid();
  const now = nowIso();

  await c.env.DB.prepare(`UPDATE angka_kredit SET is_current = 0 WHERE pegawai_id = ? AND is_current = 1`)
    .bind(body.pegawaiId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO angka_kredit (id, pegawai_id, nomor_pak, tanggal_pak, periode_awal, periode_akhir, angka_kredit_kumulatif, unsur_utama, pengembangan_profesi, unsur_penunjang, keterangan, is_current, created_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
  )
    .bind(
      id,
      body.pegawaiId,
      body.nomorPak ?? null,
      body.tanggalPak ?? null,
      body.periodeAwal ?? null,
      body.periodeAkhir ?? null,
      body.angkaKreditKumulatif,
      body.unsurUtama ?? 0,
      body.pengembanganProfesi ?? 0,
      body.unsurPenunjang ?? 0,
      body.keterangan ?? null,
      now,
      authUser.id
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "ANGKA_KREDIT",
    entityId: id,
    dataSesudah: body,
    deskripsi: `PAK baru dicatat untuk pegawai ${body.pegawaiId} (kumulatif: ${body.angkaKreditKumulatif}).`,
  });

  return c.json({ data: { id } }, 201);
});

angkaKreditRoutes.delete("/:id", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM angka_kredit WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Data angka kredit tidak ditemukan." }, 404);

  await c.env.DB.prepare(`DELETE FROM angka_kredit WHERE id = ?`).bind(id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "ANGKA_KREDIT",
    entityId: id,
    dataSebelum: existing,
  });

  return c.json({ message: "Data angka kredit berhasil dihapus." });
});
