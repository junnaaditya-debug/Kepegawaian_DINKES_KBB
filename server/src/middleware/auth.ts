import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { AppError } from "../utils/AppError";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  unitKerjaId: string | null;
  pegawaiId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET as string;

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Token autentikasi diperlukan");
  }
  const token = header.substring("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, "Token tidak valid atau kadaluarsa");
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, "Belum login");
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "Anda tidak memiliki akses untuk aksi ini");
    }
    next();
  };
}

/**
 * Pegawai self-service role only sees itself; roles scoped to a unit (Kepala Bidang/Kasubbag)
 * only see their own unitKerjaId. Super Admin, Admin Kepegawaian, Kepala Dinas see all.
 */
export function getUnitScope(user: AuthUser): string | null {
  if (user.role === "KEPALA_BIDANG") return user.unitKerjaId;
  return null;
}
