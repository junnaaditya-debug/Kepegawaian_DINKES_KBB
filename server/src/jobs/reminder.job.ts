import cron from "node-cron";
import { prisma } from "../utils/prisma";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";

const BULAN_LABEL = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function bulanMenujuPeriode(periode: { tahun: number; bulan: number }): number {
  const now = new Date();
  const target = new Date(periode.tahun, periode.bulan - 1, 1);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

/**
 * FR-5.1: notifikasi in-app kepada Admin Kepegawaian saat ada pegawai yang mendekati
 * masa kenaikan pangkat (H-6 bulan, H-3 bulan secara default, dapat dikonfigurasi).
 */
export async function jalankanReminderKenaikanPangkat() {
  const parameter = await prisma.parameterAturan.findFirst();
  const ambangBulan = [parameter?.reminderBulanSebelum1 ?? 6, parameter?.reminderBulanSebelum2 ?? 3];

  const kandidat = await deteksiKenaikanPangkat({ bulanKeDepan: Math.max(...ambangBulan) + 1 });
  const relevan = kandidat.filter((k) => {
    const bulanMenuju = bulanMenujuPeriode(k.proyeksiPeriode);
    return ambangBulan.includes(bulanMenuju) && k.statusTindakLanjut === "BELUM_DIPROSES";
  });

  if (relevan.length === 0) return { dibuat: 0 };

  const penerima = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] }, isActive: true },
  });

  let dibuat = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const user of penerima) {
    for (const k of relevan) {
      const judul = `Pengingat Kenaikan Pangkat: ${k.nama}`;
      const pesan = `${k.nama} (${k.nip}) diproyeksikan naik pangkat pada periode ${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}. Segera tindak lanjuti.`;

      const sudahAda = await prisma.notifikasi.findFirst({
        where: { userId: user.id, judul, createdAt: { gte: new Date(today) } },
      });
      if (sudahAda) continue;

      await prisma.notifikasi.create({
        data: { userId: user.id, judul, pesan, jenis: "KENAIKAN_PANGKAT", link: `/kenaikan-pangkat` },
      });
      dibuat++;
    }
  }

  return { dibuat };
}

export function startReminderJob() {
  // setiap hari pukul 06:00
  cron.schedule("0 6 * * *", async () => {
    try {
      const hasil = await jalankanReminderKenaikanPangkat();
      // eslint-disable-next-line no-console
      console.log(`[reminder-job] ${hasil.dibuat} notifikasi dibuat`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[reminder-job] gagal dijalankan", err);
    }
  });
}
