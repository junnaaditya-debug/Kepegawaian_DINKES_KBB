import { AuthUser } from "../middleware/auth";

/**
 * Returns a Prisma "where" fragment restricting queries to the caller's unit kerja
 * when their role is scoped (Kepala Bidang/Kasubbag). Other roles see everything.
 */
export function pegawaiScopeWhere(user: AuthUser) {
  if (user.role === "KEPALA_BIDANG") {
    return user.unitKerjaId ? { unitKerjaId: user.unitKerjaId } : { id: "__none__" };
  }
  if (user.role === "PEGAWAI") {
    return user.pegawaiId ? { id: user.pegawaiId } : { id: "__none__" };
  }
  return {};
}
