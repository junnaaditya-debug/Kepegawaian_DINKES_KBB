import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { UPLOAD_DIR } from "./middleware/upload";
import { startReminderJob } from "./jobs/reminder.job";

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

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/unit-kerja", unitKerjaRoutes);
app.use("/api/pegawai", pegawaiRoutes);
app.use("/api/pegawai", riwayatJabatanRoutes);
app.use("/api/pegawai", riwayatPangkatRoutes);
app.use("/api/pegawai", riwayatPendidikanRoutes);
app.use("/api/pegawai", angkaKreditRoutes);
app.use("/api/pegawai", nilaiSkpRoutes);
app.use("/api/dokumen", dokumenRoutes);
app.use("/api/users", userRoutes);
app.use("/api/parameter", parameterRoutes);
app.use("/api/kenaikan-pangkat", kenaikanPangkatRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/laporan", laporanRoutes);
app.use("/api/notifikasi", notifikasiRoutes);
app.use("/api/log-aktivitas", logAktivitasRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SIMPEG-DINKES KBB API berjalan di port ${PORT}`);
  startReminderJob();
});
