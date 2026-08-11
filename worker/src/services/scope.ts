import { eq, type SQL } from "drizzle-orm";
import { pegawai } from "../db/schema";
import type { AuthUser } from "../types";

/**
 * Mengembalikan kondisi SQL yang membatasi query ke unit kerja pemanggil jika role-nya
 * scoped (Kepala Bidang/Kasubbag). Role lain (Super Admin, Admin Kepegawaian, Kepala Dinas)
 * melihat seluruh data. Mengembalikan undefined berarti tidak ada pembatasan tambahan.
 */
export function pegawaiScopeCondition(user: AuthUser): SQL | undefined {
  if (user.role === "KEPALA_BIDANG") {
    return user.unitKerjaId ? eq(pegawai.unitKerjaId, user.unitKerjaId) : eq(pegawai.id, "__none__");
  }
  if (user.role === "PEGAWAI") {
    return user.pegawaiId ? eq(pegawai.id, user.pegawaiId) : eq(pegawai.id, "__none__");
  }
  return undefined;
}
