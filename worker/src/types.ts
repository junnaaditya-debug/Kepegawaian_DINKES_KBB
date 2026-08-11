import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface Bindings {
  DB: D1Database;
  DOKUMEN_BUCKET: R2Bucket;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: string;
  CLIENT_ORIGIN: string;
}

export type Role = "SUPER_ADMIN" | "ADMIN_KEPEGAWAIAN" | "KEPALA_BIDANG" | "KEPALA_DINAS" | "PEGAWAI";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  unitKerjaId: string | null;
  pegawaiId: string | null;
}

export interface Variables {
  user: AuthUser;
  db: ReturnType<typeof import("./db/client").createDb>;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
