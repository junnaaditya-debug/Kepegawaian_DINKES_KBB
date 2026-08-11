import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import {
  pegawai,
  unitKerja,
  riwayatPendidikan,
  riwayatJabatan,
  riwayatPangkatGolongan,
  angkaKredit,
  nilaiSkp,
  dokumen,
  statusUsulanKenaikanPangkat,
} from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";
import { pegawaiScopeCondition } from "../services/scope";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const { q, unitKerjaId, jenisKelamin, statusAktif, statusKepegawaian, page = "1", pageSize = "20" } = c.req.query();

  const conditions = [pegawaiScopeCondition(authUser)];
  if (q) conditions.push(or(like(pegawai.nama, `%${q}%`), like(pegawai.nip, `%${q}%`), like(pegawai.nipLama, `%${q}%`)));
  if (unitKerjaId) conditions.push(eq(pegawai.unitKerjaId, unitKerjaId));
  if (jenisKelamin) conditions.push(eq(pegawai.jenisKelamin, jenisKelamin as any));
  if (statusAktif) conditions.push(eq(pegawai.statusAktif, statusAktif as any));
  if (statusKepegawaian) conditions.push(eq(pegawai.statusKepegawaian, statusKepegawaian as any));
  const where = and(...conditions.filter(Boolean));

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [totalRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.as("count") }).from(pegawai).where(where),
    db.select().from(pegawai).where(where).orderBy(pegawai.nama).limit(take).offset(skip),
  ]);
  const total = totalRows[0]?.count || 0;

  const ids = rows.map((r) => r.id);
  const unitKerjaIds = [...new Set(rows.map((r) => r.unitKerjaId).filter(Boolean))] as string[];
  const [units, pangkatRows, jabatanRows] = await Promise.all([
    unitKerjaIds.length ? db.select().from(unitKerja).where(inArray(unitKerja.id, unitKerjaIds)) : Promise.resolve([]),
    ids.length ? db.select().from(riwayatPangkatGolongan).where(and(inArray(riwayatPangkatGolongan.pegawaiId, ids), eq(riwayatPangkatGolongan.isAktif, true))) : Promise.resolve([]),
    ids.length ? db.select().from(riwayatJabatan).where(and(inArray(riwayatJabatan.pegawaiId, ids), eq(riwayatJabatan.isAktif, true))) : Promise.resolve([]),
  ]);
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const pangkatMap = new Map(pangkatRows.map((r) => [r.pegawaiId, r]));
  const jabatanMap = new Map(jabatanRows.map((r) => [r.pegawaiId, r]));

  const data = rows.map((p) => ({
    ...p,
    unitKerja: p.unitKerjaId ? unitMap.get(p.unitKerjaId) || null : null,
    riwayatPangkatGolongan: pangkatMap.has(p.id) ? [pangkatMap.get(p.id)] : [],
    riwayatJabatan: jabatanMap.has(p.id) ? [jabatanMap.get(p.id)] : [],
  }));

  return c.json({ data, total, page: Number(page) || 1, pageSize: take });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const scope = pegawaiScopeCondition(authUser);
  const rows = await db.select().from(pegawai).where(scope ? and(eq(pegawai.id, id), scope) : eq(pegawai.id, id)).limit(1);
  const peg = rows[0];
  if (!peg) throw new AppError(404, "Pegawai tidak ditemukan");

  const [unitRows, pendidikan, jabatan, pangkat, ak, skp, dok, statusUsulan] = await Promise.all([
    peg.unitKerjaId ? db.select().from(unitKerja).where(eq(unitKerja.id, peg.unitKerjaId)).limit(1) : Promise.resolve([]),
    db.select().from(riwayatPendidikan).where(eq(riwayatPendidikan.pegawaiId, id)).orderBy(desc(riwayatPendidikan.tahunLulus)),
    db.select().from(riwayatJabatan).where(eq(riwayatJabatan.pegawaiId, id)).orderBy(desc(riwayatJabatan.tmtJabatan)),
    db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.pegawaiId, id)).orderBy(desc(riwayatPangkatGolongan.tmt)),
    db.select().from(angkaKredit).where(eq(angkaKredit.pegawaiId, id)).orderBy(desc(angkaKredit.tanggalPak)),
    db.select().from(nilaiSkp).where(eq(nilaiSkp.pegawaiId, id)).orderBy(desc(nilaiSkp.tahun)),
    db.select().from(dokumen).where(eq(dokumen.pegawaiId, id)).orderBy(desc(dokumen.createdAt)),
    db.select().from(statusUsulanKenaikanPangkat).where(eq(statusUsulanKenaikanPangkat.pegawaiId, id)),
  ]);

  const jabatanUnitIds = [...new Set(jabatan.map((j) => j.unitKerjaId).filter(Boolean))] as string[];
  const jabatanUnits = jabatanUnitIds.length ? await db.select().from(unitKerja).where(inArray(unitKerja.id, jabatanUnitIds)) : [];
  const jabatanUnitMap = new Map(jabatanUnits.map((u) => [u.id, u]));

  return c.json({
    ...peg,
    unitKerja: unitRows[0] || null,
    riwayatPendidikan: pendidikan,
    riwayatJabatan: jabatan.map((j) => ({ ...j, unitKerja: j.unitKerjaId ? jabatanUnitMap.get(j.unitKerjaId) || null : null })),
    riwayatPangkatGolongan: pangkat,
    angkaKredit: ak,
    nilaiSkp: skp,
    dokumen: dok,
    statusUsulanKenaikanPangkat: statusUsulan,
  });
});

const pegawaiSchema = z.object({
  nip: z.string().min(8),
  nipLama: z.string().optional(),
  nama: z.string().min(1),
  gelarDepan: z.string().optional(),
  gelarBelakang: z.string().optional(),
  tempatLahir: z.string().optional(),
  tanggalLahir: z.string().optional(),
  jenisKelamin: z.enum(["L", "P"]),
  alamat: z.string().optional(),
  noHp: z.string().optional(),
  email: z.string().optional(),
  agama: z.string().optional(),
  statusKepegawaian: z.enum(["CPNS", "PNS", "PPPK"]),
  tmtCpns: z.string().optional(),
  tmtPns: z.string().optional(),
  unitKerjaId: z.string().optional(),
});

app.post("/", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const body = parseBody(pegawaiSchema, await c.req.json());
  const db = c.get("db");
  const authUser = c.get("user");

  const existing = await db.select().from(pegawai).where(eq(pegawai.nip, body.nip)).limit(1);
  if (existing[0]) throw new AppError(409, "NIP sudah terdaftar");

  const row = {
    id: newId(),
    ...body,
    nipLama: body.nipLama || null,
    gelarDepan: body.gelarDepan || null,
    gelarBelakang: body.gelarBelakang || null,
    tempatLahir: body.tempatLahir || null,
    tanggalLahir: body.tanggalLahir || null,
    alamat: body.alamat || null,
    noHp: body.noHp || null,
    email: body.email || null,
    agama: body.agama || null,
    tmtCpns: body.tmtCpns || null,
    tmtPns: body.tmtPns || null,
    unitKerjaId: body.unitKerjaId || null,
    statusAktif: "AKTIF" as const,
    tanggalNonAktif: null,
    keteranganNonAktif: null,
    fotoUrl: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: authUser.id,
    updatedBy: authUser.id,
  };
  await db.insert(pegawai).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "Pegawai", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

const pegawaiUpdateSchema = pegawaiSchema.omit({ nip: true }).partial().extend({
  statusAktif: z.enum(["AKTIF", "PENSIUN", "MUTASI_KELUAR", "MENINGGAL", "CUTI_DI_LUAR_TANGGUNGAN", "NON_AKTIF_LAINNYA"]).optional(),
  tanggalNonAktif: z.string().optional(),
  keteranganNonAktif: z.string().optional(),
});

app.put("/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(pegawai).where(eq(pegawai.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(pegawaiUpdateSchema, await c.req.json());
  const updated = { ...body, updatedAt: nowIso(), updatedBy: authUser.id };
  await db.update(pegawai).set(updated).where(eq(pegawai.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "Pegawai", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(pegawai).where(eq(pegawai.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "Pegawai tidak ditemukan");

  await db.delete(pegawai).where(eq(pegawai.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "Pegawai", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

/**
 * Bulk import dari CSV (versi Cloudflare Workers tidak memakai exceljs karena bergantung
 * pada Node fs/stream yang tidak tersedia di runtime Workers). Kolom minimal: nip, nama.
 * Kolom opsional: nipLama, jenisKelamin, statusKepegawaian, unitKerjaNama.
 */
app.post("/import", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) throw new AppError(400, "File CSV wajib diunggah");

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new AppError(400, "File CSV kosong atau tidak memiliki data");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const idxNip = idx("nip");
  const idxNama = idx("nama");
  if (idxNip === -1 || idxNama === -1) throw new AppError(400, "Kolom 'nip' dan 'nama' wajib ada pada file CSV");
  const idxNipLama = idx("nipLama");
  const idxJenisKelamin = idx("jeniskelamin");
  const idxStatusKepegawaian = idx("statuskepegawaian");
  const idxUnitKerjaNama = idx("unitkerjanama");

  const unitList = await db.select().from(unitKerja);
  const unitByName = new Map(unitList.map((u) => [u.nama.toLowerCase(), u.id]));

  let sukses = 0;
  const gagal: { baris: number; alasan: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const nip = cols[idxNip];
    const nama = cols[idxNama];
    if (!nip || !nama) continue;

    try {
      const jenisKelamin = idxJenisKelamin > -1 ? (cols[idxJenisKelamin] || "L").toUpperCase() : "L";
      const statusKepegawaian = idxStatusKepegawaian > -1 ? (cols[idxStatusKepegawaian] || "PNS").toUpperCase() : "PNS";
      const unitKerjaNama = idxUnitKerjaNama > -1 ? cols[idxUnitKerjaNama] : "";
      const unitKerjaId = unitKerjaNama ? unitByName.get(unitKerjaNama.toLowerCase()) : undefined;

      const existing = await db.select().from(pegawai).where(eq(pegawai.nip, nip)).limit(1);
      if (existing[0]) {
        await db.update(pegawai).set({ nama, updatedAt: nowIso(), updatedBy: authUser.id }).where(eq(pegawai.id, existing[0].id));
      } else {
        await db.insert(pegawai).values({
          id: newId(),
          nip,
          nipLama: idxNipLama > -1 ? cols[idxNipLama] || null : null,
          nama,
          jenisKelamin: (["L", "P"].includes(jenisKelamin) ? jenisKelamin : "L") as any,
          statusKepegawaian: (["CPNS", "PNS", "PPPK"].includes(statusKepegawaian) ? statusKepegawaian : "PNS") as any,
          unitKerjaId: unitKerjaId || null,
          statusAktif: "AKTIF",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: authUser.id,
          updatedBy: authUser.id,
        });
      }
      sukses++;
    } catch (e: any) {
      gagal.push({ baris: i + 1, alasan: e.message || "Gagal menyimpan" });
    }
  }

  await catatAudit(db, { userId: authUser.id, aksi: "IMPORT", entitas: "Pegawai", deskripsi: `Import massal: ${sukses} sukses, ${gagal.length} gagal` });
  return c.json({ sukses, gagal });
});

export default app;
