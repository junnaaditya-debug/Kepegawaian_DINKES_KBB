import { logAktivitas } from "../db/schema";
import { newId, nowIso } from "./id";
import type { createDb } from "../db/client";

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

export async function catatAudit(db: ReturnType<typeof createDb>, params: AuditParams) {
  await db.insert(logAktivitas).values({
    id: newId(),
    userId: params.userId ?? null,
    aksi: params.aksi,
    entitas: params.entitas,
    entitasId: params.entitasId ?? null,
    deskripsi: params.deskripsi,
    dataSebelum: params.dataSebelum ? JSON.stringify(params.dataSebelum) : null,
    dataSesudah: params.dataSesudah ? JSON.stringify(params.dataSesudah) : null,
    ipAddress: params.ipAddress ?? null,
    createdAt: nowIso(),
  });
}
