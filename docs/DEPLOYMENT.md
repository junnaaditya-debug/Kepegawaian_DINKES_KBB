# Panduan Deployment — SIMPEG-DINKES KBB

Aplikasi ini terdiri dari dua deployment terpisah di Cloudflare:

1. **Backend API** → Cloudflare Workers (`backend/`), dengan binding ke D1 dan R2.
2. **Frontend** → Cloudflare Pages (`frontend/`), sebagai static SPA yang memanggil API di atas.

## Prasyarat

- Akun Cloudflare dengan akses ke Workers, Pages, D1, dan R2.
- Node.js 20+ dan npm.
- `wrangler` CLI (sudah termasuk sebagai devDependency masing-masing paket; jalankan lewat `npx wrangler` atau `npm run <script>`).
- Login wrangler: `npx wrangler login` (dari folder `backend/` atau `frontend/`).

## 1. Setup Backend (Cloudflare Workers + D1 + R2)

```bash
cd backend
npm install
```

### 1.1 Buat database D1

```bash
npx wrangler d1 create simpeg_dinkes_kbb
```

Salin `database_id` dari output ke `backend/wrangler.toml` (ganti nilai
`REPLACE_WITH_D1_DATABASE_ID`).

### 1.2 Buat bucket R2 untuk dokumen

```bash
npx wrangler r2 bucket create simpeg-dinkes-kbb-dokumen
```

Nama bucket harus sama dengan `bucket_name` pada `wrangler.toml`
(`[[r2_buckets]]`), atau sesuaikan keduanya.

### 1.3 Set secret JWT

```bash
npx wrangler secret put JWT_SECRET
# masukkan string acak yang panjang, mis. hasil:
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Untuk development lokal, salin `.dev.vars.example` menjadi `.dev.vars` dan
isi `JWT_SECRET` di sana (file ini di-gitignore, tidak pernah dikirim ke
Cloudflare).

### 1.4 Jalankan migrasi skema

```bash
npm run db:migrate:local     # database lokal (Miniflare), untuk development
npm run db:migrate:remote    # database produksi di Cloudflare
```

### 1.5 Seed data awal (unit kerja starter, parameter default, akun Super Admin)

```bash
npm run db:seed:local        # atau db:seed:remote untuk produksi
```

Akun awal: username `superadmin`, password `SimpegKBB#2026!`. Ganti segera
setelah login pertama melalui menu "Ubah Password". Skrip seed aman
dijalankan hanya sekali (menggunakan ID tetap) — jangan dijalankan ulang di
database yang sudah berisi data, karena akan mencoba INSERT baris dengan ID
yang sama dan gagal karena constraint UNIQUE/PRIMARY KEY (secara aman, bukan
duplikasi data).

### 1.6 Jalankan lokal / deploy

```bash
npm run dev       # wrangler dev di http://127.0.0.1:8787
npm run deploy    # deploy ke Cloudflare Workers
```

Setelah deploy, catat URL Worker yang diberikan (mis.
`https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev`) — dibutuhkan untuk
konfigurasi frontend.

## 2. Setup Frontend (Cloudflare Pages)

```bash
cd frontend
npm install
```

### 2.1 Konfigurasi URL API

Saat development lokal, `vite.config.ts` sudah memproksi `/api` ke
`http://127.0.0.1:8787`, jadi tidak perlu konfigurasi tambahan.

Untuk build produksi, set environment variable `VITE_API_BASE_URL` ke URL
Worker dari langkah 1.6, contoh:

```
VITE_API_BASE_URL=https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev/api
```

Bisa diset lewat `frontend/.env.production.local` saat build manual, atau
sebagai **Environment Variable** pada project Cloudflare Pages (Settings →
Environment variables → Production).

### 2.2 Build & deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=simpeg-dinkes-kbb
```

Atau hubungkan repository ini ke Cloudflare Pages lewat dashboard (Git
integration) dengan:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `frontend`

### 2.3 CORS

Backend (`backend/src/index.ts`) mengizinkan origin manapun secara default
(`origin: (origin) => origin ?? "*"`) agar mudah dikembangkan. Untuk produksi
yang lebih ketat, ubah ke daftar origin Pages Anda secara eksplisit.

## 3. Setelah Go-Live

1. Login sebagai Super Admin, ganti password default.
2. Buka **Unit Kerja** — sesuaikan struktur Puskesmas/UPTD/Bidang dengan
   struktur organisasi Dinkes KBB yang sebenarnya (data starter di seed
   hanya contoh).
3. Buka **Pengaturan Parameter Aturan** — validasi ulang seluruh parameter
   (periode kenaikan pangkat, masa kerja minimum, ambang batas angka kredit
   per jabatan fungsional & jenjang, predikat SKP minimum) terhadap
   regulasi BKN/PANRB terkini bersama bagian kepegawaian, sebelum data
   pegawai diinput secara masif. Tabel ambang batas angka kredit sengaja
   dikosongkan saat seed karena nilainya sangat spesifik per profesi/jenjang.
4. Gunakan **Import Data** pada halaman Data Pegawai untuk migrasi data awal
   dari Excel/SIMPEG lama (unduh template CSV dari modal import).
5. Buat akun untuk Admin Kepegawaian, Kepala Bidang/Kasubbag, dan Kepala
   Dinas lewat menu **Manajemen User**.

## 4. Backup

D1 mendukung ekspor database melalui:

```bash
npx wrangler d1 export simpeg_dinkes_kbb --remote --output=backup-$(date +%F).sql
```

Jadwalkan perintah ini secara berkala (mis. via CI/CD terjadwal atau cron di
luar Cloudflare) untuk memenuhi NFR-4 (backup harian).
