import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { pegawaiRoutes } from "./routes/pegawai";
import { riwayatJabatanRoutes } from "./routes/riwayatJabatan";
import { riwayatPangkatRoutes } from "./routes/riwayatPangkat";
import { riwayatPendidikanRoutes } from "./routes/riwayatPendidikan";
import { angkaKreditRoutes } from "./routes/angkaKredit";
import { parameterRoutes } from "./routes/parameter";
import { dokumenRoutes } from "./routes/dokumen";
import { unitKerjaRoutes } from "./routes/unitKerja";
import { userRoutes } from "./routes/users";
import { kenaikanPangkatRoutes } from "./routes/kenaikanPangkat";
import { dashboardRoutes } from "./routes/dashboard";
import { laporanRoutes } from "./routes/laporan";
import { auditLogRoutes } from "./routes/auditLog";
import { notifikasiRoutes } from "./routes/notifikasi";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/api/health", (c) => c.json({ status: "ok", environment: c.env.ENVIRONMENT, time: new Date().toISOString() }));

app.route("/api/auth", authRoutes);

// All routes below require a valid access token.
app.use("/api/*", authMiddleware);

app.route("/api/pegawai", pegawaiRoutes);
app.route("/api/riwayat-jabatan", riwayatJabatanRoutes);
app.route("/api/riwayat-pangkat", riwayatPangkatRoutes);
app.route("/api/riwayat-pendidikan", riwayatPendidikanRoutes);
app.route("/api/angka-kredit", angkaKreditRoutes);
app.route("/api/parameter", parameterRoutes);
app.route("/api/dokumen", dokumenRoutes);
app.route("/api/unit-kerja", unitKerjaRoutes);
app.route("/api/users", userRoutes);
app.route("/api/kenaikan-pangkat", kenaikanPangkatRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/laporan", laporanRoutes);
app.route("/api/audit-log", auditLogRoutes);
app.route("/api/notifikasi", notifikasiRoutes);

app.notFound((c) => c.json({ error: "Rute tidak ditemukan." }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Terjadi kesalahan pada server." }, 500);
});

export default app;
