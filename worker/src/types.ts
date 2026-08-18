export interface Env {
  DB: D1Database;
  DOCS: R2Bucket;
  ENVIRONMENT: string;
  JWT_ISSUER: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
}

export type RoleCode = "super_admin" | "admin_kepegawaian" | "kepala_bidang" | "kepala_dinas" | "pegawai";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: RoleCode;
  roleId: number;
  unitKerjaId: number | null;
  pegawaiId: number | null;
}

export interface Variables {
  user: AuthUser;
  requestIp: string;
}
