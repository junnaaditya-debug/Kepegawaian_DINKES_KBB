# SIMPEG-DINKES KBB

Sistem Informasi Kepegawaian Dinas Kesehatan Kabupaten Bandung Barat — aplikasi web untuk mengelola data
kepegawaian ASN dan secara otomatis mendeteksi pegawai yang sudah/akan waktunya naik pangkat & golongan.

Dibangun berdasarkan PRD v1.0 (11 Agustus 2026), mencakup seluruh scope **Fase 1 (MVP)**:

- Manajemen data master pegawai (data induk, riwayat pendidikan, riwayat jabatan, riwayat pangkat/golongan)
- Manajemen angka kredit jabatan fungsional (PAK) & nilai SKP
- **Modul deteksi otomatis kenaikan pangkat** (reguler berbasis masa kerja & fungsional berbasis angka kredit)
- Dashboard & laporan (export Excel/PDF)
- Manajemen dokumen digital (upload, preview, versi)
- Manajemen pengguna & hak akses (RBAC)
- Notifikasi/reminder in-app (job harian)
- Log aktivitas / audit trail
- Halaman Pengaturan Parameter Aturan — seluruh ambang batas (masa kerja minimum, periode kenaikan pangkat,
  angka kredit per jenjang jabatan) dikonfigurasi lewat UI, **bukan hardcode**, sesuai PRD Bagian 6.

> **PENTING:** Nilai ambang batas default (masa kerja 4 tahun, periode 1 April & 1 Oktober, angka kredit per
> jenjang jabatan fungsional kesehatan) adalah **placeholder** berdasarkan pola umum. Bagian kepegawaian
> Dinkes KBB **wajib memvalidasi** nilai-nilai ini di halaman *Pengaturan Parameter* sesuai regulasi
> BKN/PANRB yang berlaku saat ini sebelum sistem digunakan untuk produksi.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + React Query + React Router + Recharts
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **Autentikasi:** JWT + bcrypt, dengan Role-Based Access Control (RBAC)
- **File storage:** local disk (folder `server/uploads`, dapat diarahkan ke storage lain di masa depan)
- **Export:** ExcelJS (Excel) & PDFKit (PDF)
- **Reminder job:** node-cron (berjalan harian, jam 06:00)

## Struktur Proyek

```
server/   Backend Express + Prisma (API di /api/*)
client/   Frontend React + Vite
docker-compose.yml   Menjalankan Postgres + backend + frontend sekaligus
```

## Menjalankan Secara Lokal (tanpa Docker)

### 1. Database

Siapkan PostgreSQL lokal, lalu buat database & user:

```sql
CREATE USER simpeg WITH PASSWORD 'simpeg' CREATEDB;
CREATE DATABASE simpeg_dinkes_kbb OWNER simpeg;
```

### 2. Backend

```bash
cd server
cp .env.example .env      # sesuaikan DATABASE_URL & JWT_SECRET jika perlu
npm install
npx prisma migrate dev    # membuat skema database
npm run seed               # data awal: unit kerja, parameter, user default
npm run dev                 # jalan di http://localhost:4000
```

Login default yang dibuat oleh seed (**segera ganti password setelah login pertama**):

| Role | Username | Password default |
|---|---|---|
| Super Admin | `superadmin` | `SimpegKBB#2026` |
| Admin Kepegawaian | `admin.kepegawaian` | `AdminKepeg#2026` |
| Kepala Dinas | `kadis` | `AdminKepeg#2026` |

Password default dapat dikustomisasi lewat environment variable `SEED_SUPERADMIN_PASSWORD` dan
`SEED_ADMIN_PASSWORD` sebelum menjalankan `npm run seed`.

### 3. Frontend

```bash
cd client
npm install
npm run dev   # jalan di http://localhost:5173, proxy otomatis ke backend :4000
```

Buka `http://localhost:5173` di browser.

## Menjalankan dengan Docker Compose

```bash
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run seed
```

Frontend akan tersedia di `http://localhost:8080`, backend API di `http://localhost:4000`.

## Environment Variables (Backend — `server/.env`)

| Variable | Keterangan | Default |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | - |
| `JWT_SECRET` | Secret untuk menandatangani JWT | wajib diganti di produksi |
| `JWT_EXPIRES_IN` | Masa berlaku token | `8h` |
| `PORT` | Port server backend | `4000` |
| `CLIENT_ORIGIN` | Origin frontend untuk CORS | `http://localhost:5173` |
| `UPLOAD_DIR` | Folder penyimpanan dokumen | `uploads` |
| `MAX_UPLOAD_MB` | Batas ukuran file upload | `10` |

## Catatan Implementasi Penting

- **Parameter aturan kenaikan pangkat** (masa kerja minimum, periode kenaikan pangkat, ambang batas angka
  kredit per jenjang jabatan fungsional) sepenuhnya dikonfigurasi lewat halaman **Pengaturan Parameter**
  (khusus Super Admin) — sesuai PRD Bagian 6, tidak ada nilai yang di-hardcode di kode program.
- **Modul deteksi kenaikan pangkat** (`server/src/services/promotionEngine.ts`) menghitung dua jalur:
  - **Reguler**: berbasis masa kerja dalam pangkat terakhir dibandingkan parameter masa kerja minimum.
  - **Fungsional**: berbasis akumulasi angka kredit (PAK) dibandingkan ambang batas jenjang berikutnya.
- Saat SK kenaikan pangkat baru diinput pada tab **Riwayat Pangkat**, sistem otomatis mengarsipkan riwayat
  aktif sebelumnya dan menandai status usulan periode terkait menjadi "SK Terbit" (FR-4.6, BR-6).
- **RBAC**: role `KEPALA_BIDANG` hanya melihat data pegawai di unit kerjanya sendiri; `SUPER_ADMIN`,
  `ADMIN_KEPEGAWAIAN`, dan `KEPALA_DINAS` melihat seluruh data. Lihat `server/src/services/scope.ts`.
- **Audit trail**: seluruh operasi create/update/delete/export/login tercatat di tabel `LogAktivitas`,
  dapat dilihat di halaman **Log Aktivitas**.
- Fase 2+ (di luar scope saat ini, lihat PRD Bagian 3.2 & 12): integrasi SIASN/BKN, modul payroll/presensi,
  e-kinerja/SKP penuh, notifikasi email/WhatsApp, self-service pegawai, aplikasi mobile native.

## Pertanyaan Terbuka dari PRD (Bagian 15) — Perlu Ditindaklanjuti Tim Dinkes KBB

Beberapa keputusan/data berikut belum dapat diasumsikan oleh sistem dan sebaiknya divalidasi bersama
bagian kepegawaian sebelum go-live production (lihat PRD Bagian 15 untuk daftar lengkap), antara lain
jumlah pegawai aktif saat ini, ketersediaan data existing untuk migrasi, kebutuhan integrasi SIASN/BKN,
penentuan Super Admin & Admin Kepegawaian per unit, kebijakan hosting (on-premise Diskominfo vs cloud),
serta dokumen resmi terbaru terkait parameter angka kredit jabatan fungsional kesehatan.
