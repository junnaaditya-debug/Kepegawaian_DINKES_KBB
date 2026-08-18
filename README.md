# SIMPEG-DINKES KBB

Sistem Informasi Kepegawaian Dinas Kesehatan Kabupaten Bandung Barat — aplikasi
pengelolaan data kepegawaian ASN dengan fitur inti **deteksi otomatis kenaikan
pangkat & golongan**, dibangun sepenuhnya di atas ekosistem serverless
Cloudflare (Pages + Workers + D1 + R2), sesuai PRD `SIMPEG-DINKES KBB v1.0`.

## Arsitektur

```
┌─────────────────────┐        HTTPS/JSON       ┌──────────────────────────┐
│  web/  (Cloudflare   │ ───────────────────────▶│  worker/ (Cloudflare      │
│  Pages — React +     │◀─────────────────────── │  Workers — Hono API)      │
│  Vite + Tailwind)    │                          │  • Auth (JWT + PBKDF2)    │
└─────────────────────┘                          │  • RBAC middleware        │
                                                   │  • Audit log middleware   │
                                                   │  • Deteksi kenaikan       │
                                                   │    pangkat engine         │
                                                   │  • Excel/PDF generation   │
                                                   │  • Cron: reminder harian  │
                                                   └───────────┬───────┬──────┘
                                                                │       │
                                                     ┌──────────▼──┐ ┌──▼───────┐
                                                     │  D1 (SQLite) │ │ R2 (file)│
                                                     │  database    │ │ dokumen  │
                                                     └──────────────┘ └──────────┘
```

- **`worker/`** — Cloudflare Worker (Hono) yang melayani seluruh REST API di
  bawah `/api/*`, terhubung ke database D1 dan bucket R2. Lihat
  [`worker/README.md`](worker/README.md) atau bagian *Setup Backend* di bawah.
- **`web/`** — Single-page app React (Vite + TypeScript + Tailwind CSS) yang
  dideploy sebagai Cloudflare Pages, mengonsumsi API Worker di atas.

Tidak ada mock/data palsu di jalur end-to-end manapun: seluruh CRUD, deteksi
kenaikan pangkat, upload dokumen, dan ekspor laporan bekerja terhadap D1/R2
yang sesungguhnya.

## Fitur Utama (Fase 1 MVP + inti PRD)

- Data master pegawai (CRUD, pencarian/filter, import massal Excel/CSV) — FR-1
- Riwayat kepangkatan/golongan dengan perhitungan Masa Kerja Golongan otomatis,
  arsip otomatis riwayat lama saat SK baru diinput (BR-6) — FR-2
- Riwayat jabatan (struktural/fungsional/pelaksana) & riwayat pendidikan
- Angka kredit jabatan fungsional + ambang batas per jenjang yang dapat
  dikonfigurasi (bukan hardcode) — FR-3
- **Deteksi otomatis kenaikan pangkat** (reguler berbasis masa kerja & 
  fungsional berbasis angka kredit), proyeksi periode, filter unit/jenis/
  rentang waktu, status tindak lanjut, verifikasi atasan — FR-4
- Notifikasi in-app H- (dikonfigurasi) + cron job harian — FR-5
- Dashboard & laporan dengan grafik, export Excel & PDF siap cetak — FR-6
- Manajemen dokumen digital di R2 dengan preview & riwayat versi — FR-7
- Manajemen pengguna & RBAC (5 peran sesuai PRD Bagian 4), audit trail
  lengkap (siapa, kapan, perubahan apa) — FR-8, NFR-5

**Catatan penting (sesuai PRD Bagian 6 & 15):** parameter aturan bisnis
(periode kenaikan pangkat, masa kerja minimum per golongan, ambang batas
angka kredit per jenjang jabatan fungsional, predikat SKP minimum) diisi
dengan **nilai contoh/default yang lazim berlaku** dan disimpan sebagai data
konfigurasi (dapat diubah dari halaman *Pengaturan Parameter Aturan* dan
*Jabatan Fungsional* tanpa perlu mengubah kode). Nilai-nilai ini **wajib
divalidasi oleh bagian Kepegawaian Dinkes KBB** terhadap regulasi BKN/PANRB
terbaru sebelum digunakan sebagai acuan resmi/go-live.

## Struktur Direktori

```
worker/                 Cloudflare Worker API (Hono + D1 + R2)
  src/
    routes/              Endpoint per modul (pegawai, kenaikan-pangkat, dst.)
    lib/                 Auth/JWT, business rules engine, PDF/Excel, audit
    middleware/          authMiddleware, RBAC, unit-kerja scoping
  migrations/            Skema D1 + seed data referensi
  scripts/hash-password.mjs   Utilitas generate hash password (PBKDF2)

web/                     Frontend React (Vite + Tailwind), deploy ke Pages
  src/
    pages/                Halaman (Dashboard, Pegawai, Kenaikan Pangkat, ...)
    pages/pengaturan/      Halaman khusus Super Admin
    components/            Komponen bersama (Layout, modal form, dsb.)
    lib/                    API client, auth context, format helpers
```

## Cara Tercepat: Deploy via GitHub Actions (Recommended)

Repo ini sudah menyertakan workflow `.github/workflows/deploy.yml` yang
men-deploy backend (Worker + D1 + R2) dan frontend (Pages) secara otomatis —
jalan di infrastruktur GitHub, sehingga tidak terpengaruh kebijakan jaringan
lingkungan development manapun.

1. Buka **Settings → Secrets and variables → Actions** pada repo GitHub ini,
   tambahkan 3 secret berikut:

   | Secret | Cara mendapatkan |
   |---|---|
   | `CLOUDFLARE_ACCOUNT_ID` | Dashboard Cloudflare → sidebar kanan halaman overview akun |
   | `CLOUDFLARE_API_TOKEN` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Custom Token dengan izin **Account: Workers Scripts (Edit), Cloudflare Pages (Edit), D1 (Edit), Workers R2 Storage (Edit)** |
   | `JWT_SECRET` | String acak yang panjang & rahasia, mis. hasil `openssl rand -base64 48` |

2. Buka tab **Actions** → pilih workflow **"Deploy SIMPEG-DINKES KBB to
   Cloudflare"** → **Run workflow**.
3. Workflow ini otomatis (idempoten, aman dijalankan berulang):
   - Membuat database D1 `simpeg-dinkes-kbb-db` dan bucket R2
     `simpeg-dinkes-kbb-docs` bila belum ada
   - Menjalankan migrasi skema + seed data referensi
   - Set secret `JWT_SECRET` pada Worker
   - Deploy Worker API, lalu build & deploy frontend ke Cloudflare Pages
     dengan `VITE_API_BASE_URL` otomatis diarahkan ke URL Worker yang baru
     dideploy
4. Setelah selesai (lihat ringkasan URL di halaman run tersebut, tab
   *Summary*), akses frontend di `https://simpeg-dinkes-kbb.pages.dev` dan
   login dengan akun Super Admin default (lihat bagian *Setup Backend* di
   bawah) — **segera ganti password default setelah login pertama**.

Ingin deploy manual dari mesin sendiri (tanpa GitHub Actions)? Ikuti langkah
di bawah ini.

## Setup Backend (`worker/`)

Prasyarat: Node.js 18+, akun Cloudflare, `wrangler` (terpasang sebagai
devDependency, dipanggil lewat `npx`).

```bash
cd worker
npm install

# 1. Buat database D1 dan salin database_id ke wrangler.toml
npx wrangler d1 create simpeg-dinkes-kbb-db
#   -> update `database_id` pada [[d1_databases]] di wrangler.toml

# 2. Buat bucket R2 untuk dokumen
npx wrangler r2 bucket create simpeg-dinkes-kbb-docs

# 3. Jalankan migrasi skema + seed data referensi (roles, unit kerja contoh,
#    jenis/jenjang jabatan fungsional, parameter aturan default)
npx wrangler d1 migrations apply simpeg-dinkes-kbb-db --local   # untuk dev lokal
npx wrangler d1 migrations apply simpeg-dinkes-kbb-db --remote  # untuk production

# 4. Set secret JWT (WAJIB diganti dari nilai contoh)
npx wrangler secret put JWT_SECRET
#   untuk dev lokal, salin worker/.dev.vars.example -> worker/.dev.vars dan isi

# 5. Jalankan lokal
npm run dev        # http://localhost:8787

# 6. Deploy ke Cloudflare
npm run deploy
```

Akun **Super Admin** default hasil seed: `superadmin` /
`Admin#DinkesKBB2026` — **wajib diganti** saat login pertama kali (sistem
akan memaksa ganti password / `must_change_password`).

Untuk reset password user lain secara manual di database:
`node scripts/hash-password.mjs "PasswordBaru"` lalu update kolom
`password_hash` pada tabel `users` (atau gunakan menu *Manajemen Pengguna*
di aplikasi).

### Cron job reminder harian

`wrangler.toml` sudah mengaktifkan Cron Trigger (`0 1 * * *`, 01:00 UTC
setiap hari) yang memanggil `generateReminders()` untuk memicu notifikasi
in-app H- kenaikan pangkat (FR-5.1). Tidak perlu konfigurasi tambahan setelah
`wrangler deploy`.

## Setup Frontend (`web/`)

```bash
cd web
npm install
npm run dev          # http://localhost:5173, proxy /api -> localhost:8787

# Build & deploy ke Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name=simpeg-dinkes-kbb
```

Karena frontend (Pages) dan API (Workers) adalah dua deployment terpisah,
set environment variable `VITE_API_BASE_URL` saat build production ke origin
Worker yang sudah dideploy (lihat `web/.env.example`), misalnya:

```bash
VITE_API_BASE_URL=https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev npm run build
```

Di lingkungan dev, variabel ini dikosongkan dan Vite akan mem-proxy `/api`
ke Worker lokal (`vite.config.ts`).

Untuk keamanan tambahan di production, set variabel `CORS_ORIGIN` pada
Worker (`wrangler.toml` `[vars]` atau `wrangler secret put`) ke origin Pages
yang sebenarnya, menggantikan default `*`.

## Peran & Hak Akses (RBAC)

| Peran | Kode | Cakupan |
|---|---|---|
| Super Admin | `super_admin` | Semua data, kelola user & parameter aturan |
| Admin Kepegawaian | `admin_kepegawaian` | CRUD data pegawai, dokumen, usulan kenaikan pangkat (seluruh unit) |
| Kepala Bidang/Kasubbag | `kepala_bidang` | Lihat & verifikasi data pegawai **di unit kerjanya saja** |
| Kepala Dinas | `kepala_dinas` | Lihat dashboard & laporan ringkasan seluruh unit, tanpa input data |
| Pegawai (opsional Fase 2) | `pegawai` | Self-service lihat data & status kenaikan pangkat sendiri |

## Pengujian yang Sudah Dilakukan

- End-to-end API (curl): login → CRUD pegawai → input riwayat pangkat (SK
  baru mengarsipkan riwayat lama sesuai BR-6) → deteksi kenaikan pangkat
  otomatis menyesuaikan → export Excel/PDF valid → upload/retrieve dokumen
  dari R2.
- End-to-end UI (Playwright, Chromium headless): login → dashboard →
  data pegawai → detail pegawai (semua tab) → kenaikan pangkat → laporan →
  seluruh halaman pengaturan Super Admin, tanpa error konsol.

## Fase Selanjutnya (di luar scope Fase 1, per PRD Bagian 12)

Modul angka kredit lanjutan, notifikasi email/WhatsApp gateway, self-service
pegawai penuh, serta integrasi SIASN/MySAPK BKN disiapkan sebagai perluasan
Fase 2/3 dan sengaja tidak termasuk dalam build ini.
