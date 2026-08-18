import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole, scopedUnitKerjaId } from "../middleware/rbac";
import { evaluatePegawai, loadEngineParams, type PegawaiRow } from "../lib/promotionEngine";
import type { Env, Variables } from "../types";

export const kenaikanPangkatRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

kenaikanPangkatRoutes.get("/", async (c) => {
  const authUser = c.get("authUser");
  const unitKerjaId = c.req.query("unitKerjaId");
  const jenisKepegawaian = c.req.query("jenisKepegawaian");
  const jenisKenaikan = c.req.query("jenisKenaikan"); // REGULER | PILIHAN_FUNGSIONAL | SEMUA
  const rentangBulan = parseInt(c.req.query("rentangBulan") ?? "6", 10);
  const hanyaSudahWaktunya = c.req.query("hanyaSudahWaktunya") === "1";

  const where: string[] = ["p.status_aktif = 'AKTIF'"];
  const binds: unknown[] = [];

  const scopeUnit = scopedUnitKerjaId(authUser);
  if (scopeUnit) {
    where.push("p.unit_kerja_id = ?");
    binds.push(scopeUnit);
  } else if (unitKerjaId) {
    where.push("p.unit_kerja_id = ?");
    binds.push(unitKerjaId);
  }
  if (jenisKepegawaian) {
    where.push("p.status_kepegawaian = ?");
    binds.push(jenisKepegawaian);
  }

  const { results: pegawaiRows } = await c.env.DB.prepare(
    `SELECT p.id, p.nip, p.nama, p.unit_kerja_id, uk.nama as unit_kerja_nama, p.status_kepegawaian, p.status_aktif,
            p.jenis_jabatan, p.nama_jabatan, p.jenjang_jabatan, p.golongan_ruang_aktif, p.nama_pangkat_aktif,
            p.tmt_pangkat_aktif, p.predikat_skp_terakhir,
            (SELECT angka_kredit_kumulatif FROM angka_kredit ak WHERE ak.pegawai_id = p.id AND ak.is_current = 1 LIMIT 1) as angka_kredit_kumulatif
     FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${where.join(" AND ")}`
  )
    .bind(...binds)
    .all<PegawaiRow>();

  const params = await loadEngineParams(c.env.DB);
  const asOf = nowIso();

  let candidates = pegawaiRows
    .map((row) => evaluatePegawai(row, params, asOf))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (jenisKenaikan && jenisKenaikan !== "SEMUA") {
    candidates = candidates.filter((k) => k.jenisKenaikan === jenisKenaikan);
  }
  candidates = candidates.filter((k) => k.bulanMenujuPeriode !== null && k.bulanMenujuPeriode <= rentangBulan);
  if (hanyaSudahWaktunya) {
    candidates = candidates.filter((k) => k.memenuhiSyarat);
  }

  // Attach tindak-lanjut status per (pegawai, periode) if one has been recorded.
  const pegawaiIds = candidates.map((k) => k.pegawai.id);
  let statusMap = new Map<string, { id: string; status: string; catatan: string | null }>();
  if (pegawaiIds.length > 0) {
    const placeholders = pegawaiIds.map(() => "?").join(",");
    const { results: statusRows } = await c.env.DB.prepare(
      `SELECT id, pegawai_id, periode_tanggal, status, catatan FROM status_usulan_kenaikan_pangkat WHERE pegawai_id IN (${placeholders})`
    )
      .bind(...pegawaiIds)
      .all<{ id: string; pegawai_id: string; periode_tanggal: string; status: string; catatan: string | null }>();
    statusMap = new Map(statusRows.map((r) => [`${r.pegawai_id}|${r.periode_tanggal}`, r]));
  }

  const data = candidates
    .sort((a, b) => (a.bulanMenujuPeriode ?? 999) - (b.bulanMenujuPeriode ?? 999))
    .map((k) => {
      const key = `${k.pegawai.id}|${k.proyeksiPeriodeBerikutnya}`;
      const statusEntry = statusMap.get(key);
      return {
        pegawaiId: k.pegawai.id,
        nip: k.pegawai.nip,
        nama: k.pegawai.nama,
        unitKerjaId: k.pegawai.unit_kerja_id,
        unitKerjaNama: k.pegawai.unit_kerja_nama,
        statusKepegawaian: k.pegawai.status_kepegawaian,
        jenisJabatan: k.pegawai.jenis_jabatan,
        namaJabatan: k.pegawai.nama_jabatan,
        jenjangJabatan: k.pegawai.jenjang_jabatan,
        golonganRuangAktif: k.pegawai.golongan_ruang_aktif,
        namaPangkatAktif: k.pegawai.nama_pangkat_aktif,
        tmtPangkatAktif: k.pegawai.tmt_pangkat_aktif,
        jenisKenaikan: k.jenisKenaikan,
        masaKerjaBulan: k.masaKerjaBulan,
        masaKerjaMinimumBulan: k.masaKerjaMinimumBulan,
        angkaKreditKumulatif: k.angkaKreditKumulatif,
        angkaKreditMinimum: k.angkaKreditMinimum,
        angkaKreditGap: k.angkaKreditGap,
        skpTerpenuhi: k.skpTerpenuhi,
        memenuhiSyarat: k.memenuhiSyarat,
        proyeksiPeriodeBerikutnya: k.proyeksiPeriodeBerikutnya,
        bulanMenujuPeriode: k.bulanMenujuPeriode,
        statusUsulanId: statusEntry?.id ?? null,
        statusTindakLanjut: statusEntry?.status ?? "BELUM_DIPROSES",
        catatanTindakLanjut: statusEntry?.catatan ?? null,
      };
    });

  return c.json({ data, meta: { total: data.length, asOf } });
});

kenaikanPangkatRoutes.put(
  "/:pegawaiId/status",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  async (c) => {
    const authUser = c.get("authUser");
    const pegawaiId = c.req.param("pegawaiId");
    const body = await c.req.json<{
      periodeTanggal?: string;
      jenisKenaikan?: string;
      status?: string;
      catatan?: string;
    }>().catch(() => ({} as never));

    if (!body.periodeTanggal || !body.jenisKenaikan || !body.status) {
      return c.json({ error: "Periode, jenis kenaikan, dan status wajib diisi." }, 400);
    }
    const validStatuses = ["BELUM_DIPROSES", "SEDANG_DIUSULKAN", "SK_TERBIT", "DITUNDA"];
    if (!validStatuses.includes(body.status)) return c.json({ error: "Status tidak valid." }, 400);

    const existing = await c.env.DB.prepare(
      `SELECT * FROM status_usulan_kenaikan_pangkat WHERE pegawai_id = ? AND periode_tanggal = ?`
    )
      .bind(pegawaiId, body.periodeTanggal)
      .first<Record<string, unknown>>();

    const now = nowIso();
    let id: string;
    if (existing) {
      id = existing.id as string;
      await c.env.DB.prepare(
        `UPDATE status_usulan_kenaikan_pangkat SET status = ?, catatan = ?, updated_by = ?, updated_at = ? WHERE id = ?`
      )
        .bind(body.status, body.catatan ?? null, authUser.id, now, id)
        .run();
    } else {
      id = uuid();
      await c.env.DB.prepare(
        `INSERT INTO status_usulan_kenaikan_pangkat (id, pegawai_id, periode_tanggal, jenis_kenaikan, status, catatan, updated_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
        .bind(id, pegawaiId, body.periodeTanggal, body.jenisKenaikan, body.status, body.catatan ?? null, authUser.id, now, now)
        .run();
    }

    await writeAuditLog(c.env.DB, {
      user: authUser,
      aksi: "STATUS_CHANGE",
      entityType: "STATUS_USULAN_KP",
      entityId: id,
      dataSebelum: existing,
      dataSesudah: body,
      deskripsi: `Status tindak lanjut kenaikan pangkat pegawai ${pegawaiId} diubah menjadi ${body.status}.`,
    });

    return c.json({ data: { id }, message: "Status tindak lanjut berhasil diperbarui." });
  }
);
