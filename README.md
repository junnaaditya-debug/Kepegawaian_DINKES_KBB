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

## Struktur Proyek

Repo ini berisi **dua implementasi backend** dengan fitur yang identik — pilih salah satu sesuai
infrastruktur target:

```
client/   Frontend React + Vite + TypeScript + Tailwind (dipakai oleh kedua backend)
worker/   Backend Cloudflare Workers + Hono + Drizzle ORM + D1 + R2   ← AKTIF/DIREKOMENDASIKAN
server/   Backend Node.js + Express + Prisma + PostgreSQL             ← referensi/fallback on-premise
docker-compose.yml   Menjalankan versi server/ (Postgres) secara lokal via Docker
```

`worker/` adalah target deploy saat ini (Cloudflare). `server/` tetap dipertahankan sebagai referensi
apabila di kemudian hari dibutuhkan hosting on-premise Diskominfo dengan PostgreSQL biasa (lihat PRD
Bagian 11 soal keputusan infrastruktur).

---

## Opsi A — Cloudflare (Workers + D1 + R2 + Pages)

### Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind, di-deploy ke **Cloudflare Pages**
- **Backend:** **Cloudflare Workers** + **Hono** (framework HTTP yang jalan native di Workers)
- **Database:** **D1** (SQLite serverless Cloudflare) via **Drizzle ORM**
- **File storage:** **R2** (object storage Cloudflare) untuk dokumen (SK, ijazah, PAK, dst.)
- **Autentikasi:** JWT (`hono/jwt`, WebCrypto) + bcrypt, dengan RBAC
- **Export:** ExcelJS (Excel) & pdf-lib (PDF) — keduanya jalan di runtime Workers
- **Reminder job:** Cloudflare Cron Triggers (pengganti node-cron), jadwal harian jam 06:00 WIB

### 1. Login ke Cloudflare

```bash
cd worker
npm install
npx wrangler login
```

### 2. Buat resource Cloudflare (D1 + R2)

```bash
npx wrangler d1 create simpeg-db
# Salin "database_id" dari output di atas ke wrangler.toml (ganti REPLACE_WITH_D1_DATABASE_ID)

npx wrangler r2 bucket create simpeg-dokumen
```

### 3. Set secret JWT

```bash
npx wrangler secret put JWT_SECRET
# masukkan string acak yang panjang saat diminta
```

### 4. Jalankan migrasi & seed ke database remote (D1 production)

```bash
npm run db:migrate:remote
npm run seed:remote
```

Login default yang dibuat oleh seed (**segera ganti password setelah login pertama**):

| Role | Username | Password default |
|---|---|---|
| Super Admin | `superadmin` | `SimpegKBB#2026` |
| Admin Kepegawaian | `admin.kepegawaian` | `AdminKepeg#2026` |
| Kepala Dinas | `kadis` | `AdminKepeg#2026` |

Set `SEED_SUPERADMIN_PASSWORD` / `SEED_ADMIN_PASSWORD` sebelum `npm run seed:remote` untuk memakai
password sendiri, bukan default di atas.

### 5. Deploy Worker (backend)

```bash
npm run deploy
```

Wrangler akan menampilkan URL Worker, mis. `https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev`.
Catat URL ini untuk langkah berikutnya.

Perbarui `CLIENT_ORIGIN` di `wrangler.toml` menjadi URL Cloudflare Pages Anda (langkah berikut), lalu
`npm run deploy` ulang — ini penting agar CORS mengizinkan frontend memanggil API.

### 6. Deploy frontend ke Cloudflare Pages

```bash
cd ../client
npm install
echo "VITE_API_URL=https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev" > .env.production
npm run build
npx wrangler pages deploy dist --project-name=simpeg-dinkes-kbb
```

Wrangler akan menampilkan URL Pages Anda, mis. `https://simpeg-dinkes-kbb.pages.dev` — **ini link
produksi yang bisa dibuka untuk melihat UI secara realtime**.

### Menjalankan Secara Lokal (Cloudflare stack)

```bash
cd worker
cp .dev.vars.example .dev.vars     # isi JWT_SECRET untuk dev lokal
npm install
npx wrangler d1 migrations apply simpeg-db --local
npm run seed:local
npm run dev                          # Worker jalan di http://localhost:8787

# di terminal lain
cd ../client
npm install
npm run dev                          # frontend jalan di http://localhost:5173, proxy otomatis ke :8787
```

### Reminder job / Cron Trigger

Jadwal reminder (`0 23 * * *` UTC = 06:00 WIB) dikonfigurasi di `worker/wrangler.toml` bagian
`[triggers]`. Cloudflare akan otomatis memicu handler `scheduled()` di `worker/src/index.ts` sesuai
jadwal setelah Worker di-deploy — tidak perlu server tambahan.

### Catatan Perubahan dari Versi Express/Postgres

Beberapa hal disesuaikan agar berjalan di runtime Cloudflare Workers (bukan Node.js penuh):

- **Import massal pegawai**: format **CSV** (bukan `.xlsx`) karena parser Excel (exceljs read path)
  bergantung pada API Node yang tidak tersedia di Workers untuk kasus pembacaan file besar. Simpan file
  Excel sebagai CSV (File → Save As → CSV) sebelum diunggah di menu Import.
- **Dokumen** disimpan di R2, diakses lewat `/api/dokumen/file/:id` (bukan static file serving `/uploads/*`).
- **ID** memakai `crypto.randomUUID()` (bukan `cuid()`), dan tanggal disimpan sebagai string ISO (D1/SQLite
  tidak punya tipe `DateTime` native).

---

## Opsi B — Node.js + Express + PostgreSQL (referensi/on-premise)

### Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + React Query + React Router + Recharts
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **File storage:** local disk (folder `server/uploads`)
- **Export:** ExcelJS (Excel) & PDFKit (PDF)
- **Reminder job:** node-cron (berjalan harian, jam 06:00)

### Menjalankan Secara Lokal (tanpa Docker)

**1. Database** — siapkan PostgreSQL lokal, lalu buat database & user:

```sql
CREATE USER simpeg WITH PASSWORD 'simpeg' CREATEDB;
CREATE DATABASE simpeg_dinkes_kbb OWNER simpeg;
```

**2. Backend:**

```bash
cd server
cp .env.example .env      # sesuaikan DATABASE_URL & JWT_SECRET jika perlu
npm install
npx prisma migrate dev    # membuat skema database
npm run seed               # data awal: unit kerja, parameter, user default
npm run dev                 # jalan di http://localhost:4000
```

**3. Frontend:**

```bash
cd client
npm install
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev   # jalan di http://localhost:5173
```

> Catatan: menu Import Pegawai di frontend saat ini mengirim CSV (disesuaikan untuk backend Worker).
> Backend Express (`server/src/routes/pegawai.routes.ts`) masih menerima `.xlsx` — jika memakai Opsi B,
> sesuaikan salah satu sisi agar format import cocok.

### Menjalankan dengan Docker Compose

```bash
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run seed
```

Frontend tersedia di `http://localhost:8080`, backend API di `http://localhost:4000`.

### Environment Variables (`server/.env`)

| Variable | Keterangan | Default |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | - |
| `JWT_SECRET` | Secret untuk menandatangani JWT | wajib diganti di produksi |
| `JWT_EXPIRES_IN` | Masa berlaku token | `8h` |
| `PORT` | Port server backend | `4000` |
| `CLIENT_ORIGIN` | Origin frontend untuk CORS | `http://localhost:5173` |
| `UPLOAD_DIR` | Folder penyimpanan dokumen | `uploads` |
| `MAX_UPLOAD_MB` | Batas ukuran file upload | `10` |

---

## Catatan Implementasi Penting (berlaku untuk kedua backend)

- **Parameter aturan kenaikan pangkat** (masa kerja minimum, periode kenaikan pangkat, ambang batas angka
  kredit per jenjang jabatan fungsional) sepenuhnya dikonfigurasi lewat halaman **Pengaturan Parameter**
  (khusus Super Admin) — sesuai PRD Bagian 6, tidak ada nilai yang di-hardcode di kode program.
- **Modul deteksi kenaikan pangkat** (`promotionEngine.ts` di masing-masing backend) menghitung dua jalur:
  - **Reguler**: berbasis masa kerja dalam pangkat terakhir dibandingkan parameter masa kerja minimum.
  - **Fungsional**: berbasis akumulasi angka kredit (PAK) dibandingkan ambang batas jenjang berikutnya.
- Saat SK kenaikan pangkat baru diinput pada tab **Riwayat Pangkat**, sistem otomatis mengarsipkan riwayat
  aktif sebelumnya dan menandai status usulan periode terkait menjadi "SK Terbit" (FR-4.6, BR-6).
- **RBAC**: role `KEPALA_BIDANG` hanya melihat data pegawai di unit kerjanya sendiri; `SUPER_ADMIN`,
  `ADMIN_KEPEGAWAIAN`, dan `KEPALA_DINAS` melihat seluruh data.
- **Audit trail**: seluruh operasi create/update/delete/export/login tercatat di tabel `log_aktivitas`,
  dapat dilihat di halaman **Log Aktivitas**.
- Endpoint export & dokumen mewajibkan JWT Bearer token — frontend mengunduhnya lewat fetch berotentikasi
  (`downloadFile`/`openFileInNewTab` di `client/src/api/client.ts`), bukan `window.open`/`<a href>` biasa.
- Fase 2+ (di luar scope saat ini, lihat PRD Bagian 3.2 & 12): integrasi SIASN/BKN, modul payroll/presensi,
  e-kinerja/SKP penuh, notifikasi email/WhatsApp, self-service pegawai, aplikasi mobile native.

## Pertanyaan Terbuka dari PRD (Bagian 15) — Perlu Ditindaklanjuti Tim Dinkes KBB

Beberapa keputusan/data berikut belum dapat diasumsikan oleh sistem dan sebaiknya divalidasi bersama
bagian kepegawaian sebelum go-live production (lihat PRD Bagian 15 untuk daftar lengkap), antara lain
jumlah pegawai aktif saat ini, ketersediaan data existing untuk migrasi, kebutuhan integrasi SIASN/BKN,
penentuan Super Admin & Admin Kepegawaian per unit, kebijakan hosting (on-premise Diskominfo vs cloud),
serta dokumen resmi terbaru terkait parameter angka kredit jabatan fungsional kesehatan.
