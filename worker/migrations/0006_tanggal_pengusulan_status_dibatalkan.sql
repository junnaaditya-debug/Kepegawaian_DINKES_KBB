-- Menambahkan kolom tanggal_pengusulan (diisi saat aksi "Usulkan" ditekan) dan status
-- 'dibatalkan' (aksi "Usulan Dibatalkan") pada status_usulan_kenaikan_pangkat. SQLite tidak
-- bisa mengubah CHECK constraint dengan ALTER TABLE, sehingga tabel harus dibuat ulang.

CREATE TABLE status_usulan_kenaikan_pangkat_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  periode_tahun INTEGER NOT NULL,
  periode_bulan INTEGER NOT NULL,
  jenis_kenaikan TEXT NOT NULL CHECK (jenis_kenaikan IN ('reguler','fungsional','pilihan')),
  status TEXT NOT NULL CHECK (status IN ('belum_diproses','sedang_diusulkan','sk_terbit','ditunda','dibatalkan')) DEFAULT 'belum_diproses',
  catatan TEXT,
  tanggal_pengusulan TEXT,
  riwayat_pangkat_golongan_id INTEGER REFERENCES riwayat_pangkat_golongan(id),
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  diverifikasi_atasan INTEGER NOT NULL DEFAULT 0,
  diverifikasi_oleh INTEGER REFERENCES users(id),
  diverifikasi_at TEXT,
  catatan_verifikasi TEXT,
  UNIQUE(pegawai_id, periode_tahun, periode_bulan)
);

INSERT INTO status_usulan_kenaikan_pangkat_new
  (id, pegawai_id, periode_tahun, periode_bulan, jenis_kenaikan, status, catatan, riwayat_pangkat_golongan_id,
   updated_by, updated_at, created_at, diverifikasi_atasan, diverifikasi_oleh, diverifikasi_at, catatan_verifikasi)
SELECT id, pegawai_id, periode_tahun, periode_bulan, jenis_kenaikan, status, catatan, riwayat_pangkat_golongan_id,
       updated_by, updated_at, created_at, diverifikasi_atasan, diverifikasi_oleh, diverifikasi_at, catatan_verifikasi
FROM status_usulan_kenaikan_pangkat;

DROP TABLE status_usulan_kenaikan_pangkat;
ALTER TABLE status_usulan_kenaikan_pangkat_new RENAME TO status_usulan_kenaikan_pangkat;

CREATE INDEX idx_status_usulan_periode ON status_usulan_kenaikan_pangkat(periode_tahun, periode_bulan);
CREATE INDEX idx_status_usulan_pegawai ON status_usulan_kenaikan_pangkat(pegawai_id);
