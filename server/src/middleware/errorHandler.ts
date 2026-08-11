import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  const message = err instanceof Error ? err.message : "Terjadi kesalahan pada server";
  return res.status(500).json({ message });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
}
