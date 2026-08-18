import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  DOCS_BUCKET: R2Bucket;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  ENVIRONMENT: string;
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
  authUser: AuthUser;
}
