import type { Context, Next } from "hono";
import { verifyJwt } from "../lib/jwt";
import type { Env, Variables } from "../types";

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Tidak terautentikasi. Silakan login." }, 401);
  }
  const token = authHeader.slice("Bearer ".length);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali." }, 401);
  }

  c.set("authUser", {
    id: payload.sub,
    username: payload.username,
    role: payload.role as Variables["authUser"]["role"],
    unitKerjaId: payload.unitKerjaId,
    pegawaiId: payload.pegawaiId,
  });

  await next();
}
