# SIMPEG-DINKES KBB

Sistem Informasi Kepegawaian Dinas Kesehatan Kabupaten Bandung Barat — aplikasi
web untuk mengelola data induk pegawai ASN, riwayat jabatan/kepangkatan,
angka kredit jabatan fungsional, serta **deteksi otomatis pegawai yang
sudah/akan waktunya naik pangkat dan golongan**, sesuai PRD v1.0 (11 Agustus
2026).

## Arsitektur

Dibangun sepenuhnya di atas ekosistem serverless Cloudflare:

| Layer | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS, dideploy ke **Cloudflare Pages** |
| Backend API | Hono (TypeScript) di **Cloudflare Workers** |
| Database | **Cloudflare D1** (SQLite serverless) |
| Penyimpanan Dokumen | **Cloudflare R2** |
| Autentikasi | JWT (HS256) + PBKDF2 password hashing, RBAC 5 role |
| Dokumen/Laporan | `pdf-lib` (PDF) & `xlsx` (Excel), digenerate langsung di Worker |

Struktur repo:

```
backend/    Cloudflare Worker (API, D1, R2, auth, RBAC, audit trail, PDF/Excel)
frontend/   React SPA (dashboard, CRUD pegawai, kenaikan pangkat, laporan, dst)
docs/       Dokumentasi deployment
```

## Fitur Utama (Fase 1 sesuai PRD)

- Data master pegawai (CRUD, pencarian, filter, import CSV massal, export Excel/PDF)
- Riwayat jabatan, riwayat pangkat/golongan (dengan arsip otomatis saat SK baru terbit), riwayat pendidikan
- Modul angka kredit (PAK) untuk jabatan fungsional tertentu
- **Modul deteksi otomatis kenaikan pangkat** — reguler (berbasis masa kerja) & fungsional (berbasis angka kredit), dengan proyeksi periode berikutnya dan tracking status tindak lanjut (Belum Diproses / Sedang Diusulkan / SK Terbit / Ditunda)
- Dashboard & laporan (grafik komposisi pegawai, tren kenaikan pangkat, export siap cetak)
- Manajemen dokumen digital (upload/preview/versi, disimpan di R2)
- Manajemen user & role-based access control (Super Admin, Admin Kepegawaian, Kepala Bidang/Kasubbag, Kepala Dinas, Pegawai)
- Log aktivitas / audit trail menyeluruh
- Notifikasi in-app

**Penting:** seluruh parameter aturan kenaikan pangkat (periode KP, masa kerja
minimum, ambang batas angka kredit per jenjang, predikat SKP minimum) adalah
**konfigurasi**, bukan nilai tetap di kode — dikelola lewat halaman
"Pengaturan Parameter Aturan" oleh Super Admin. Nilai default yang di-seed
adalah nilai umum yang lazim berlaku dan **wajib divalidasi oleh bagian
kepegawaian Dinkes KBB** terhadap regulasi BKN/PANRB terkini sebelum
digunakan untuk pengambilan keputusan resmi (lihat PRD bagian 1 & 6).

## Mulai Cepat (Development Lokal)

Lihat [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) untuk panduan lengkap
setup D1, R2, secrets, hingga deploy ke Cloudflare Pages + Workers.

Ringkas:

```bash
# Backend
cd backend
npm install
cp .dev.vars.example .dev.vars   # isi JWT_SECRET
npm run db:migrate:local
npm run db:seed:local
npm run dev                       # http://127.0.0.1:8787

# Frontend (terminal terpisah)
cd frontend
npm install
npm run dev                       # http://127.0.0.1:5173 (proxy /api ke :8787)
```

Login default setelah seeding: **username `superadmin`**, **password
`SimpegKBB#2026!`** — wajib diganti setelah login pertama.
