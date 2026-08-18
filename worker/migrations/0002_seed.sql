-- Reference / bootstrap data.
-- IMPORTANT: values marked "(contoh - perlu validasi)" are generic defaults taken from
-- common ASN practice as described in the PRD. They MUST be reviewed and corrected by
-- bagian Kepegawaian Dinkes KBB against the latest BKN/PANRB regulation before go-live.
-- They are stored as data (parameter_aturan / golongan_masa_kerja_minimum /
-- jenjang_jabatan_fungsional), never hardcoded in application code, so they can be
-- edited from Pengaturan Parameter Aturan without a code change.

INSERT INTO roles (code, name, description) VALUES
  ('super_admin', 'Super Admin', 'Admin sistem/IT - kelola seluruh data, user, dan parameter aturan'),
  ('admin_kepegawaian', 'Admin Kepegawaian', 'Staf sub-bagian kepegawaian - CRUD data pegawai, dokumen, usulan kenaikan pangkat'),
  ('kepala_bidang', 'Kepala Bidang/Kasubbag', 'Atasan langsung - lihat & verifikasi data pegawai di unitnya'),
  ('kepala_dinas', 'Kepala Dinas/Pimpinan', 'Lihat dashboard & laporan ringkasan, tanpa input data'),
  ('pegawai', 'Pegawai', 'Self-service - lihat data diri & status kenaikan pangkat sendiri');

INSERT INTO unit_kerja (kode, nama, jenis, alamat) VALUES
  ('DINKES-KBB', 'Dinas Kesehatan Kabupaten Bandung Barat', 'dinas_induk', 'Kompleks Perkantoran Pemkab Bandung Barat, Ngamprah');

INSERT INTO unit_kerja (kode, nama, jenis, parent_id) VALUES
  ('BID-YANKES', 'Bidang Pelayanan Kesehatan', 'bidang', 1),
  ('BID-P2P', 'Bidang Pencegahan dan Pengendalian Penyakit', 'bidang', 1),
  ('BID-KESMAS', 'Bidang Kesehatan Masyarakat', 'bidang', 1),
  ('BID-SDK', 'Bidang Sumber Daya Kesehatan', 'bidang', 1),
  ('SEKRETARIAT', 'Sekretariat', 'bidang', 1);

INSERT INTO unit_kerja (kode, nama, jenis, parent_id) VALUES
  ('PKM-LEMBANG', 'UPTD Puskesmas Lembang', 'puskesmas', 1),
  ('PKM-PADALARANG', 'UPTD Puskesmas Padalarang', 'puskesmas', 1),
  ('PKM-CISARUA', 'UPTD Puskesmas Cisarua', 'puskesmas', 1),
  ('PKM-CILILIN', 'UPTD Puskesmas Cililin', 'puskesmas', 1),
  ('PKM-BATUJAJAR', 'UPTD Puskesmas Batujajar', 'puskesmas', 1),
  ('PKM-NGAMPRAH', 'UPTD Puskesmas Ngamprah', 'puskesmas', 1),
  ('LABKESDA', 'UPTD Laboratorium Kesehatan Daerah', 'uptd', 1);

-- Default Super Admin account. Username: superadmin / Password: Admin#DinkesKBB2026
-- CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN (must_change_password = 1).
INSERT INTO users (username, email, password_hash, full_name, role_id, unit_kerja_id, is_active, must_change_password) VALUES
  ('superadmin', 'admin@dinkeskbb.local',
   'pbkdf2$100000$Y0WMdRNbZ6PNRytNjAH66A==$S/5pcKCH5UtCVxRPlI/yw1WA2xgmCglwlVzVIvL48lE=',
   'Administrator Sistem', 1, 1, 1, 1);

-- ==========================================================================
-- Business rule parameters (BR-1, BR-2, BR-4, FR-4.x, FR-5.x) - configurable
-- ==========================================================================

INSERT INTO parameter_aturan (kategori, kunci, nilai, deskripsi) VALUES
  ('periode_kenaikan_pangkat', 'periode_tahunan', '[{"bulan":4,"tanggal":1,"label":"1 April"},{"bulan":10,"tanggal":1,"label":"1 Oktober"}]',
   'Tanggal periode kenaikan pangkat ASN dalam setahun (contoh - perlu validasi: umum dikenal 1 April & 1 Oktober, BR-1)'),
  ('masa_kerja', 'masa_kerja_minimum_reguler_bulan', '48',
   'Masa kerja minimum default dalam pangkat terakhir untuk kenaikan pangkat reguler, dalam bulan (contoh - perlu validasi: umum dikenal 4 tahun, BR-2). Dapat dioverride per golongan pada tabel golongan_masa_kerja_minimum.'),
  ('skp', 'predikat_skp_minimum', '"Baik"',
   'Predikat SKP/prestasi kerja minimum yang disyaratkan untuk kenaikan pangkat (contoh - perlu validasi, BR-4). Diisi manual oleh admin selama data SKP belum terintegrasi penuh.'),
  ('reminder', 'h_minus_bulan', '[6,3]',
   'Daftar ambang H- (dalam bulan) sebelum periode kenaikan pangkat untuk memicu notifikasi in-app ke Admin Kepegawaian (FR-5.1).'),
  ('proyeksi', 'rentang_default_bulan', '6',
   'Rentang proyeksi default (dalam bulan) yang ditampilkan pada halaman Daftar Kenaikan Pangkat (FR-4.4).');

-- Masa kerja minimum & progresi golongan/ruang reguler (contoh - perlu validasi, BR-2)
INSERT INTO golongan_masa_kerja_minimum (golongan_ruang, masa_kerja_minimum_bulan, golongan_ruang_berikutnya) VALUES
  ('I/a', 48, 'I/b'), ('I/b', 48, 'I/c'), ('I/c', 48, 'I/d'), ('I/d', 48, 'II/a'),
  ('II/a', 48, 'II/b'), ('II/b', 48, 'II/c'), ('II/c', 48, 'II/d'), ('II/d', 48, 'III/a'),
  ('III/a', 48, 'III/b'), ('III/b', 48, 'III/c'), ('III/c', 48, 'III/d'), ('III/d', 48, 'IV/a'),
  ('IV/a', 48, 'IV/b'), ('IV/b', 48, 'IV/c'), ('IV/c', 48, 'IV/d'), ('IV/d', 48, 'IV/e'),
  ('IV/e', 48, NULL);

-- ==========================================================================
-- Jabatan fungsional kesehatan & jenjang + ambang angka kredit (FR-3.2, BR-3)
-- Nilai angka_kredit_kumulatif_minimal adalah CONTOH generik dan HARUS divalidasi.
-- ==========================================================================

INSERT INTO jenis_jabatan_fungsional (kode, nama, rumpun) VALUES
  ('DOKTER', 'Dokter', 'Kesehatan'),
  ('DOKTER_GIGI', 'Dokter Gigi', 'Kesehatan'),
  ('PERAWAT', 'Perawat', 'Kesehatan'),
  ('BIDAN', 'Bidan', 'Kesehatan'),
  ('APOTEKER', 'Apoteker', 'Kesehatan'),
  ('TTK', 'Tenaga Teknis Kefarmasian', 'Kesehatan'),
  ('EPIDEMIOLOG', 'Epidemiolog Kesehatan', 'Kesehatan'),
  ('SANITARIAN', 'Sanitarian', 'Kesehatan'),
  ('NUTRISIONIS', 'Nutrisionis', 'Kesehatan'),
  ('PEREKAM_MEDIS', 'Perekam Medis', 'Kesehatan'),
  ('PRANATA_LABKES', 'Pranata Laboratorium Kesehatan', 'Kesehatan'),
  ('PKM', 'Penyuluh Kesehatan Masyarakat', 'Kesehatan'),
  ('FISIOTERAPIS', 'Fisioterapis', 'Kesehatan'),
  ('ADMINKES', 'Administrator Kesehatan', 'Kesehatan');

-- Jalur Ahli (jenjang: Ahli Pertama, Ahli Muda, Ahli Madya, Ahli Utama)
INSERT INTO jenjang_jabatan_fungsional (jenis_jabatan_fungsional_id, kode, nama, urutan, golongan_ruang_minimal, angka_kredit_kumulatif_minimal)
SELECT j.id, v.kode, v.nama, v.urutan, v.golongan, v.ak
FROM jenis_jabatan_fungsional j
JOIN (
  SELECT 'AHLI_PERTAMA' kode, 'Ahli Pertama' nama, 1 urutan, 'III/a' golongan, 100.0 ak
  UNION ALL SELECT 'AHLI_MUDA', 'Ahli Muda', 2, 'III/c', 200.0
  UNION ALL SELECT 'AHLI_MADYA', 'Ahli Madya', 3, 'IV/a', 400.0
  UNION ALL SELECT 'AHLI_UTAMA', 'Ahli Utama', 4, 'IV/d', 850.0
) v
WHERE j.kode IN ('DOKTER','DOKTER_GIGI','APOTEKER','EPIDEMIOLOG','SANITARIAN','NUTRISIONIS','PEREKAM_MEDIS','PRANATA_LABKES','PKM','FISIOTERAPIS','ADMINKES','PERAWAT','BIDAN');

-- Jalur Terampil (jenjang: Pemula, Terampil, Mahir, Penyelia) - untuk profesi yang punya jalur ini
INSERT INTO jenjang_jabatan_fungsional (jenis_jabatan_fungsional_id, kode, nama, urutan, golongan_ruang_minimal, angka_kredit_kumulatif_minimal)
SELECT j.id, v.kode, v.nama, v.urutan, v.golongan, v.ak
FROM jenis_jabatan_fungsional j
JOIN (
  SELECT 'PEMULA' kode, 'Pemula' nama, 1 urutan, 'II/a' golongan, 25.0 ak
  UNION ALL SELECT 'TERAMPIL', 'Terampil', 2, 'II/b', 40.0
  UNION ALL SELECT 'MAHIR', 'Mahir', 3, 'II/c', 60.0
  UNION ALL SELECT 'PENYELIA', 'Penyelia', 4, 'III/a', 100.0
) v
WHERE j.kode IN ('PERAWAT','BIDAN','SANITARIAN','NUTRISIONIS','PEREKAM_MEDIS','PRANATA_LABKES','TTK');
