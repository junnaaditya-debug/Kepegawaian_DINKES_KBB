-- SIMPEG-DINKES KBB initial schema
PRAGMA foreign_keys = ON;

-- ==========================================================================
-- Reference / master tables
-- ==========================================================================

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- super_admin | admin_kepegawaian | kepala_bidang | kepala_dinas | pegawai
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE unit_kerja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('dinas_induk','uptd','puskesmas','bidang')),
  parent_id INTEGER REFERENCES unit_kerja(id),
  alamat TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_unit_kerja_parent ON unit_kerja(parent_id);

CREATE TABLE jenis_jabatan_fungsional (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  rumpun TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE jenjang_jabatan_fungsional (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis_jabatan_fungsional_id INTEGER NOT NULL REFERENCES jenis_jabatan_fungsional(id),
  kode TEXT NOT NULL,
  nama TEXT NOT NULL,                  -- e.g. Ahli Pertama, Ahli Muda, Terampil, Mahir
  urutan INTEGER NOT NULL,             -- ordering within the jenis (1 = lowest)
  golongan_ruang_minimal TEXT NOT NULL,
  angka_kredit_kumulatif_minimal REAL NOT NULL,
  UNIQUE(jenis_jabatan_fungsional_id, kode)
);
CREATE INDEX idx_jenjang_jf_jenis ON jenjang_jabatan_fungsional(jenis_jabatan_fungsional_id);

-- ==========================================================================
-- Users & auth
-- ==========================================================================

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  unit_kerja_id INTEGER REFERENCES unit_kerja(id),
  pegawai_id INTEGER REFERENCES pegawai(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_unit ON users(unit_kerja_id);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ==========================================================================
-- Pegawai (core entity)
-- ==========================================================================

CREATE TABLE pegawai (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nip TEXT NOT NULL UNIQUE,
  nip_lama TEXT,
  nama TEXT NOT NULL,
  gelar_depan TEXT,
  gelar_belakang TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT CHECK (jenis_kelamin IN ('L','P')),
  alamat TEXT,
  no_hp TEXT,
  email TEXT,
  foto_dokumen_id INTEGER,

  status_kepegawaian TEXT NOT NULL CHECK (status_kepegawaian IN ('CPNS','PNS','PPPK')) DEFAULT 'PNS',
  tmt_cpns TEXT,
  tmt_pns TEXT,

  status_aktif TEXT NOT NULL CHECK (status_aktif IN ('aktif','pensiun','mutasi_keluar','meninggal','cuti_di_luar_tanggungan')) DEFAULT 'aktif',
  tanggal_status_berubah TEXT,
  keterangan_status TEXT,

  unit_kerja_id INTEGER NOT NULL REFERENCES unit_kerja(id),

  jenis_jabatan TEXT NOT NULL CHECK (jenis_jabatan IN ('struktural','fungsional','pelaksana')) DEFAULT 'pelaksana',
  jabatan_struktural_nama TEXT,
  jenjang_jabatan_fungsional_id INTEGER REFERENCES jenjang_jabatan_fungsional(id),
  jabatan_nama_display TEXT,           -- denormalized current jabatan name for fast listing

  golongan_ruang_aktif TEXT,
  nama_pangkat_aktif TEXT,
  tmt_pangkat_aktif TEXT,              -- drives Masa Kerja Golongan calculation

  skp_predikat_terakhir TEXT CHECK (skp_predikat_terakhir IN ('Sangat Baik','Baik','Cukup','Kurang','Sangat Kurang')),
  skp_tahun_terakhir INTEGER,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_pegawai_unit ON pegawai(unit_kerja_id);
CREATE INDEX idx_pegawai_status ON pegawai(status_aktif);
CREATE INDEX idx_pegawai_nama ON pegawai(nama);
CREATE INDEX idx_pegawai_golongan ON pegawai(golongan_ruang_aktif);
CREATE INDEX idx_pegawai_jenjang_jf ON pegawai(jenjang_jabatan_fungsional_id);

CREATE TABLE riwayat_unit_kerja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  unit_kerja_id INTEGER NOT NULL REFERENCES unit_kerja(id),
  tmt_mulai TEXT NOT NULL,
  tmt_selesai TEXT,
  keterangan TEXT,
  dokumen_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_riwayat_unit_pegawai ON riwayat_unit_kerja(pegawai_id);

CREATE TABLE riwayat_pendidikan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  jenjang TEXT NOT NULL CHECK (jenjang IN ('SD','SMP','SMA/SMK','D1','D2','D3','D4','S1','Profesi','S2','S3')),
  jurusan TEXT,
  nama_institusi TEXT,
  tahun_lulus INTEGER,
  no_ijazah TEXT,
  dokumen_id INTEGER,
  is_pendidikan_terakhir INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_riwayat_pendidikan_pegawai ON riwayat_pendidikan(pegawai_id);

CREATE TABLE riwayat_jabatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  jenis TEXT NOT NULL CHECK (jenis IN ('struktural','fungsional','pelaksana')),
  jabatan_nama TEXT NOT NULL,
  jenjang_jabatan_fungsional_id INTEGER REFERENCES jenjang_jabatan_fungsional(id),
  unit_kerja_id INTEGER NOT NULL REFERENCES unit_kerja(id),
  no_sk TEXT,
  tanggal_sk TEXT,
  tmt_jabatan TEXT NOT NULL,
  tmt_selesai TEXT,
  pejabat_penetap TEXT,
  dokumen_id INTEGER,
  is_aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_riwayat_jabatan_pegawai ON riwayat_jabatan(pegawai_id);
CREATE INDEX idx_riwayat_jabatan_aktif ON riwayat_jabatan(pegawai_id, is_aktif);

CREATE TABLE riwayat_pangkat_golongan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  golongan_ruang TEXT NOT NULL,        -- e.g. III/a
  nama_pangkat TEXT NOT NULL,
  tmt_pangkat TEXT NOT NULL,
  no_sk TEXT,
  tanggal_sk TEXT,
  pejabat_penetap TEXT,
  jenis_kenaikan TEXT CHECK (jenis_kenaikan IN ('reguler','pilihan','fungsional','penyesuaian_ijazah','cpns','lainnya')) DEFAULT 'reguler',
  dokumen_id INTEGER,
  is_aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_riwayat_pangkat_pegawai ON riwayat_pangkat_golongan(pegawai_id);
CREATE INDEX idx_riwayat_pangkat_aktif ON riwayat_pangkat_golongan(pegawai_id, is_aktif);

CREATE TABLE angka_kredit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  no_pak TEXT,
  tanggal_pak TEXT,
  periode_mulai TEXT,
  periode_selesai TEXT,
  angka_kredit_utama REAL NOT NULL DEFAULT 0,
  angka_kredit_pengembangan_profesi REAL NOT NULL DEFAULT 0,
  angka_kredit_penunjang REAL NOT NULL DEFAULT 0,
  angka_kredit_kumulatif REAL NOT NULL DEFAULT 0,
  dokumen_id INTEGER,
  is_terbaru INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_angka_kredit_pegawai ON angka_kredit(pegawai_id);
CREATE INDEX idx_angka_kredit_terbaru ON angka_kredit(pegawai_id, is_terbaru);

-- ==========================================================================
-- Business rule parameters (configurable, no hardcoding)
-- ==========================================================================

CREATE TABLE parameter_aturan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori TEXT NOT NULL,
  kunci TEXT NOT NULL UNIQUE,
  nilai TEXT NOT NULL,                 -- JSON encoded value
  deskripsi TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE golongan_masa_kerja_minimum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  golongan_ruang TEXT NOT NULL UNIQUE,
  masa_kerja_minimum_bulan INTEGER NOT NULL,
  golongan_ruang_berikutnya TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id)
);

-- ==========================================================================
-- Kenaikan pangkat tracking
-- ==========================================================================

CREATE TABLE status_usulan_kenaikan_pangkat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  periode_tahun INTEGER NOT NULL,
  periode_bulan INTEGER NOT NULL,
  jenis_kenaikan TEXT NOT NULL CHECK (jenis_kenaikan IN ('reguler','fungsional','pilihan')),
  status TEXT NOT NULL CHECK (status IN ('belum_diproses','sedang_diusulkan','sk_terbit','ditunda')) DEFAULT 'belum_diproses',
  catatan TEXT,
  riwayat_pangkat_golongan_id INTEGER REFERENCES riwayat_pangkat_golongan(id),
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pegawai_id, periode_tahun, periode_bulan)
);
CREATE INDEX idx_status_usulan_periode ON status_usulan_kenaikan_pangkat(periode_tahun, periode_bulan);
CREATE INDEX idx_status_usulan_pegawai ON status_usulan_kenaikan_pangkat(pegawai_id);

-- ==========================================================================
-- Documents
-- ==========================================================================

CREATE TABLE dokumen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL CHECK (jenis IN ('sk_cpns','sk_pns','sk_pangkat','sk_jabatan','ijazah','sertifikat','pak','skp','usulan_kp','foto','lainnya')),
  nama_file TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  ukuran_bytes INTEGER NOT NULL,
  pegawai_id INTEGER REFERENCES pegawai(id),
  entitas_terkait_tipe TEXT,
  entitas_terkait_id INTEGER,
  versi INTEGER NOT NULL DEFAULT 1,
  dokumen_induk_id INTEGER REFERENCES dokumen(id),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_dokumen_pegawai ON dokumen(pegawai_id);
CREATE INDEX idx_dokumen_entitas ON dokumen(entitas_terkait_tipe, entitas_terkait_id);

-- ==========================================================================
-- Notifications & audit trail
-- ==========================================================================

CREATE TABLE notifikasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  role_target TEXT,
  unit_kerja_id INTEGER REFERENCES unit_kerja(id),
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  tipe TEXT NOT NULL DEFAULT 'info',
  entitas_tipe TEXT,
  entitas_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifikasi_user ON notifikasi(user_id, is_read);

CREATE TABLE log_aktivitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username_snapshot TEXT,
  aksi TEXT NOT NULL,                  -- create | update | delete | login | logout | export | login_failed
  entitas TEXT NOT NULL,
  entitas_id INTEGER,
  detail_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_log_aktivitas_entitas ON log_aktivitas(entitas, entitas_id);
CREATE INDEX idx_log_aktivitas_user ON log_aktivitas(user_id);
CREATE INDEX idx_log_aktivitas_created ON log_aktivitas(created_at);
