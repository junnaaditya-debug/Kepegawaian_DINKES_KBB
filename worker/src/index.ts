import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import { HttpError } from "./lib/http";
import { generateReminders } from "./lib/notify";

import auth from "./routes/auth";
import unitKerja from "./routes/unitKerja";
import users from "./routes/users";
import pegawai from "./routes/pegawai";
import riwayatPendidikan from "./routes/riwayatPendidikan";
import riwayatJabatan from "./routes/riwayatJabatan";
import riwayatPangkat from "./routes/riwayatPangkat";
import angkaKredit from "./routes/angkaKredit";
import jabatanFungsional from "./routes/jabatanFungsional";
import parameterAturan from "./routes/parameterAturan";
import kenaikanPangkat from "./routes/kenaikanPangkat";
import notifikasi from "./routes/notifikasi";
import dashboard from "./routes/dashboard";
import laporan from "./routes/laporan";
import dokumen from "./routes/dokumen";
import logAktivitasRoute from "./routes/logAktivitas";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Disposition"],
  });
  return corsMiddleware(c, next);
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, details: err.details ?? null }, err.status as any);
  }
  console.error(err);
  return c.json({ error: "Terjadi kesalahan pada server" }, 500);
});

app.get("/api/health", (c) => c.json({ status: "ok", environment: c.env.ENVIRONMENT }));

app.route("/api/auth", auth);
app.route("/api/unit-kerja", unitKerja);
app.route("/api/users", users);
app.route("/api/pegawai", pegawai);
app.route("/api/pegawai", riwayatPendidikan);
app.route("/api/pegawai", riwayatJabatan);
app.route("/api/pegawai", riwayatPangkat);
app.route("/api/pegawai", angkaKredit);
app.route("/api/jabatan-fungsional", jabatanFungsional);
app.route("/api/parameter-aturan", parameterAturan);
app.route("/api/kenaikan-pangkat", kenaikanPangkat);
app.route("/api/notifikasi", notifikasi);
app.route("/api/dashboard", dashboard);
app.route("/api/laporan", laporan);
app.route("/api/dokumen", dokumen);
app.route("/api/log-aktivitas", logAktivitasRoute);

app.notFound((c) => c.json({ error: "Endpoint tidak ditemukan" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Job terjadwal harian (PRD Bagian 9, langkah 1): hasilkan reminder H- kenaikan pangkat.
    ctx.waitUntil(generateReminders(env).catch((err) => console.error("generateReminders failed", err)));
  },
};
