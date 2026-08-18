-- SIMPEG-DINKES KBB — Seed data
-- Run with: npm run db:seed:local  (or db:seed:remote for production)
--
-- IMPORTANT (per PRD section 1 & 6): the promotion-rule parameters seeded
-- here (periode KP, masa kerja minimum, predikat SKP) are common defaults
-- and MUST be validated/adjusted by Dinkes KBB kepegawaian staff via the
-- "Pengaturan Parameter Aturan" page before the system is used for real
-- decisions. Angka kredit thresholds per jabatan fungsional are intentionally
-- left empty — they vary per profession/jenjang and must be entered by an
-- authorized Super Admin based on the current BKN/PANRB regulation.

-- ============================================================
-- Unit Kerja (starter structure — rename/extend via UI as needed)
-- ============================================================
INSERT INTO unit_kerja (id, kode, nama, jenis, parent_id, alamat, is_active, created_at, updated_at) VALUES
  ('uk-dinas-induk', 'DINKES', 'Dinas Kesehatan Kabupaten Bandung Barat', 'DINAS_INDUK', NULL, 'Kab. Bandung Barat', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('uk-sekretariat', 'SEKR', 'Sekretariat', 'BIDANG', 'uk-dinas-induk', NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('uk-bidang-sdk', 'BSDK', 'Bidang Sumber Daya Kesehatan', 'BIDANG', 'uk-dinas-induk', NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('uk-puskesmas-contoh', 'PKM01', 'Puskesmas Contoh', 'PUSKESMAS', 'uk-dinas-induk', NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ============================================================
-- Default Super Admin user
-- Username: superadmin   Password: SimpegKBB#2026!  (CHANGE IMMEDIATELY AFTER FIRST LOGIN)
-- ============================================================
INSERT INTO users (id, username, email, password_hash, nama_lengkap, role, unit_kerja_id, pegawai_id, is_active, must_change_password, created_at, updated_at) VALUES
  ('user-superadmin', 'superadmin', 'admin@dinkeskbb.go.id',
   'pbkdf2$100000$xOEQg4buJIKGsGsjO9cwnA==$WEDsrf40zSO2MGWySSoPZOUJLCiR3SB0boZGXFp8diE=',
   'Administrator Sistem', 'SUPER_ADMIN', NULL, NULL, 1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ============================================================
-- Parameter: Periode Kenaikan Pangkat nasional (umum: 1 April & 1 Oktober)
-- ============================================================
INSERT INTO parameter_periode_kp (id, nama_periode, bulan, tanggal, is_active, updated_at, updated_by) VALUES
  ('param-periode-april', 'Periode April', 4, 1, 1, '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('param-periode-oktober', 'Periode Oktober', 10, 1, 1, '2026-01-01T00:00:00.000Z', 'user-superadmin');

-- ============================================================
-- Parameter: Masa Kerja Minimum Reguler (default umum: 4 tahun = 48 bulan, berlaku semua golongan)
-- ============================================================
INSERT INTO parameter_masa_kerja_reguler (id, golongan_ruang, masa_kerja_minimum_bulan, keterangan, is_active, updated_at, updated_by) VALUES
  ('param-masa-kerja-default', NULL, 48, 'Default umum 4 tahun untuk seluruh golongan — validasi ke aturan BKN terbaru sebelum go-live.', 1, '2026-01-01T00:00:00.000Z', 'user-superadmin');

-- ============================================================
-- Parameter: Predikat SKP minimum (skala umum 1-5, "Baik" ke atas = memenuhi syarat)
-- ============================================================
INSERT INTO parameter_skp_minimum (id, predikat_minimum, urutan_peringkat, keterangan, is_active, updated_at, updated_by) VALUES
  ('param-skp-sangat-baik', 'Sangat Baik', 5, 'Memenuhi syarat kenaikan pangkat.', 1, '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('param-skp-baik', 'Baik', 4, 'Memenuhi syarat kenaikan pangkat (predikat minimum).', 1, '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('param-skp-cukup', 'Cukup', 3, 'Belum memenuhi syarat.', 0, '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('param-skp-kurang', 'Kurang', 2, 'Belum memenuhi syarat.', 0, '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('param-skp-sangat-kurang', 'Sangat Kurang', 1, 'Belum memenuhi syarat.', 0, '2026-01-01T00:00:00.000Z', 'user-superadmin');

-- ============================================================
-- Parameter umum lain
-- ============================================================
INSERT INTO parameter_umum (kode, nama, nilai, tipe_data, keterangan, updated_at, updated_by) VALUES
  ('reminder_h_minus_bulan', 'Reminder H-berapa bulan sebelum periode KP', '6,3', 'JSON', 'Daftar bulan sebelum periode KP untuk memicu notifikasi in-app (FR-5.1).', '2026-01-01T00:00:00.000Z', 'user-superadmin'),
  ('nama_instansi', 'Nama Instansi', 'Dinas Kesehatan Kabupaten Bandung Barat', 'STRING', 'Digunakan pada kop laporan cetak.', '2026-01-01T00:00:00.000Z', 'user-superadmin');
