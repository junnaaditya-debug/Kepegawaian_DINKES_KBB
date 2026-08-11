import { prisma } from "./prisma";

interface AuditParams {
  userId?: string | null;
  aksi: string;
  entitas: string;
  entitasId?: string | null;
  deskripsi?: string;
  dataSebelum?: unknown;
  dataSesudah?: unknown;
  ipAddress?: string | null;
}

export async function catatAudit(params: AuditParams) {
  await prisma.logAktivitas.create({
    data: {
      userId: params.userId ?? null,
      aksi: params.aksi,
      entitas: params.entitas,
      entitasId: params.entitasId ?? null,
      deskripsi: params.deskripsi,
      dataSebelum: params.dataSebelum as any,
      dataSesudah: params.dataSesudah as any,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
