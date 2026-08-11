import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { pegawai, riwayatJabatan, riwayatPangkatGolongan } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { pegawaiScopeCondition } from "../services/scope";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/ringkasan", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const scope = pegawaiScopeCondition(authUser);
  const scopedPegawaiIds = scope ? (await db.select({ id: pegawai.id }).from(pegawai).where(scope)).map((r) => r.id) : null;

  const [totalRows, totalAktifRows, perJenisKelamin, perStatusKepegawaian] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.as("count") }).from(pegawai).where(scope),
    db.select({ count: sql<number>`count(*)`.as("count") }).from(pegawai).where(scope ? and(scope, eq(pegawai.statusAktif, "AKTIF")) : eq(pegawai.statusAktif, "AKTIF")),
    db.select({ jenisKelamin: pegawai.jenisKelamin, jumlah: sql<number>`count(*)`.as("jumlah") }).from(pegawai).where(scope).groupBy(pegawai.jenisKelamin),
    db.select({ status: pegawai.statusKepegawaian, jumlah: sql<number>`count(*)`.as("jumlah") }).from(pegawai).where(scope).groupBy(pegawai.statusKepegawaian),
  ]);

  const totalPegawai = totalRows[0]?.count || 0;
  const totalAktif = totalAktifRows[0]?.count || 0;

  const perGolonganQuery = db
    .select({ golongan: riwayatPangkatGolongan.golonganRuang, jumlah: sql<number>`count(*)`.as("jumlah") })
    .from(riwayatPangkatGolongan)
    .where(eq(riwayatPangkatGolongan.isAktif, true))
    .groupBy(riwayatPangkatGolongan.golonganRuang);
  const perJenisJabatanQuery = db
    .select({ jenis: riwayatJabatan.jenisJabatan, jumlah: sql<number>`count(*)`.as("jumlah") })
    .from(riwayatJabatan)
    .where(eq(riwayatJabatan.isAktif, true))
    .groupBy(riwayatJabatan.jenisJabatan);

  const [perGolonganAll, perJenisJabatanAll, kandidat] = await Promise.all([
    perGolonganQuery,
    perJenisJabatanQuery,
    deteksiKenaikanPangkat(db, { bulanKeDepan: 12, unitKerjaId: authUser.role === "KEPALA_BIDANG" ? authUser.unitKerjaId || undefined : undefined }),
  ]);

  // Jika scoped, filter agregat golongan/jabatan ke pegawai dalam cakupan unit kerja.
  let perGolongan = perGolonganAll;
  let perJenisJabatan = perJenisJabatanAll;
  if (scopedPegawaiIds) {
    const idSet = new Set(scopedPegawaiIds);
    const pangkatRows = await db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.isAktif, true));
    const jabatanRows = await db.select().from(riwayatJabatan).where(eq(riwayatJabatan.isAktif, true));
    const golCount = new Map<string, number>();
    for (const r of pangkatRows) if (idSet.has(r.pegawaiId)) golCount.set(r.golonganRuang, (golCount.get(r.golonganRuang) || 0) + 1);
    const jabCount = new Map<string, number>();
    for (const r of jabatanRows) if (idSet.has(r.pegawaiId)) jabCount.set(r.jenisJabatan, (jabCount.get(r.jenisJabatan) || 0) + 1);
    perGolongan = [...golCount.entries()].map(([golongan, jumlah]) => ({ golongan, jumlah }));
    perJenisJabatan = [...jabCount.entries()].map(([jenis, jumlah]) => ({ jenis: jenis as any, jumlah }));
  }

  const now = new Date();
  const dueBerjalan = kandidat.filter((k) => k.proyeksiPeriode.tahun === now.getFullYear() && k.proyeksiPeriode.bulan <= now.getMonth() + 1).length;

  return c.json({
    totalPegawai,
    totalAktif,
    totalNonAktif: totalPegawai - totalAktif,
    perGolongan,
    perJenisKelamin: perJenisKelamin.map((g) => ({ jenisKelamin: g.jenisKelamin, jumlah: g.jumlah })),
    perStatusKepegawaian: perStatusKepegawaian.map((g) => ({ status: g.status, jumlah: g.jumlah })),
    perJenisJabatan,
    dueKenaikanPangkatBerjalan: dueBerjalan,
    dueKenaikanPangkat12Bulan: kandidat.length,
  });
});

export default app;
