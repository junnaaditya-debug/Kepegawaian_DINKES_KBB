import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db/client";
import { AppError } from "./utils/errors";
import type { AppEnv } from "./types";
import { jalankanReminderKenaikanPangkat } from "./services/reminderJob";

import authRoutes from "./routes/auth.routes";
import unitKerjaRoutes from "./routes/unitKerja.routes";
import pegawaiRoutes from "./routes/pegawai.routes";
import riwayatJabatanRoutes from "./routes/riwayatJabatan.routes";
import riwayatPangkatRoutes from "./routes/riwayatPangkat.routes";
import riwayatPendidikanRoutes from "./routes/riwayatPendidikan.routes";
import angkaKreditRoutes from "./routes/angkaKredit.routes";
import nilaiSkpRoutes from "./routes/nilaiSkp.routes";
import dokumenRoutes from "./routes/dokumen.routes";
import userRoutes from "./routes/user.routes";
import parameterRoutes from "./routes/parameter.routes";
import kenaikanPangkatRoutes from "./routes/kenaikanPangkat.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import laporanRoutes from "./routes/laporan.routes";
import notifikasiRoutes from "./routes/notifikasi.routes";
import logAktivitasRoutes from "./routes/logAktivitas.routes";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CLIENT_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  return corsMiddleware(c, next);
});

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ message: err.message }, err.statusCode as any);
  }
  console.error(err);
  return c.json({ message: err instanceof Error ? err.message : "Terjadi kesalahan pada server" }, 500);
});

app.notFound((c) => c.json({ message: "Endpoint tidak ditemukan" }, 404));

app.get("/api/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

app.route("/api/auth", authRoutes);
app.route("/api/unit-kerja", unitKerjaRoutes);
app.route("/api/pegawai", pegawaiRoutes);
app.route("/api/pegawai", riwayatJabatanRoutes);
app.route("/api/pegawai", riwayatPangkatRoutes);
app.route("/api/pegawai", riwayatPendidikanRoutes);
app.route("/api/pegawai", angkaKreditRoutes);
app.route("/api/pegawai", nilaiSkpRoutes);
app.route("/api/dokumen", dokumenRoutes);
app.route("/api/users", userRoutes);
app.route("/api/parameter", parameterRoutes);
app.route("/api/kenaikan-pangkat", kenaikanPangkatRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/laporan", laporanRoutes);
app.route("/api/notifikasi", notifikasiRoutes);
app.route("/api/log-aktivitas", logAktivitasRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: AppEnv["Bindings"], ctx: ExecutionContext) {
    const db = createDb(env.DB);
    ctx.waitUntil(jalankanReminderKenaikanPangkat(db));
  },
};
