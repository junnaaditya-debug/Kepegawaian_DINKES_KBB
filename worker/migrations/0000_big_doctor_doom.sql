CREATE TABLE `angka_kredit` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`nomor_pak` text NOT NULL,
	`tanggal_pak` text NOT NULL,
	`periode_penilaian_awal` text NOT NULL,
	`periode_penilaian_akhir` text NOT NULL,
	`angka_kredit_kumulatif` real NOT NULL,
	`unsur_utama` real,
	`unsur_pengembangan_profesi` real,
	`unsur_penunjang` real,
	`dokumen_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `angka_kredit_pegawai_idx` ON `angka_kredit` (`pegawai_id`);--> statement-breakpoint
CREATE TABLE `dokumen` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text,
	`jenis_dokumen` text NOT NULL,
	`nama_file` text NOT NULL,
	`nama_asli` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`ukuran` integer NOT NULL,
	`versi` integer DEFAULT 1 NOT NULL,
	`dokumen_induk_id` text,
	`uploaded_by_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dokumen_pegawai_idx` ON `dokumen` (`pegawai_id`);--> statement-breakpoint
CREATE TABLE `jenis_jabatan_fungsional` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`rumpun` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jenis_jabatan_fungsional_nama_idx` ON `jenis_jabatan_fungsional` (`nama`);--> statement-breakpoint
CREATE TABLE `log_aktivitas` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`aksi` text NOT NULL,
	`entitas` text NOT NULL,
	`entitas_id` text,
	`deskripsi` text,
	`data_sebelum` text,
	`data_sesudah` text,
	`ip_address` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `log_entitas_idx` ON `log_aktivitas` (`entitas`,`entitas_id`);--> statement-breakpoint
CREATE INDEX `log_user_idx` ON `log_aktivitas` (`user_id`);--> statement-breakpoint
CREATE INDEX `log_created_at_idx` ON `log_aktivitas` (`created_at`);--> statement-breakpoint
CREATE TABLE `nilai_skp` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`tahun` integer NOT NULL,
	`predikat` text NOT NULL,
	`nilai_angka` real,
	`keterangan` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nilai_skp_pegawai_tahun_idx` ON `nilai_skp` (`pegawai_id`,`tahun`);--> statement-breakpoint
CREATE TABLE `notifikasi` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`judul` text NOT NULL,
	`pesan` text NOT NULL,
	`jenis` text NOT NULL,
	`link` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifikasi_user_read_idx` ON `notifikasi` (`user_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `parameter_aturan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`masa_kerja_minimum_tahun` integer DEFAULT 4 NOT NULL,
	`predikat_skp_minimum` text DEFAULT 'BAIK' NOT NULL,
	`reminder_bulan_sebelum_1` integer DEFAULT 6 NOT NULL,
	`reminder_bulan_sebelum_2` integer DEFAULT 3 NOT NULL,
	`wajib_validasi_skp` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `parameter_jenjang_angka_kredit` (
	`id` text PRIMARY KEY NOT NULL,
	`jenis_jabatan_fungsional_id` text NOT NULL,
	`jenjang` text NOT NULL,
	`golongan_ruang` text NOT NULL,
	`angka_kredit_minimum` real NOT NULL,
	`urutan` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jenjang_ak_jenis_jenjang_idx` ON `parameter_jenjang_angka_kredit` (`jenis_jabatan_fungsional_id`,`jenjang`);--> statement-breakpoint
CREATE TABLE `pegawai` (
	`id` text PRIMARY KEY NOT NULL,
	`nip` text NOT NULL,
	`nip_lama` text,
	`nama` text NOT NULL,
	`gelar_depan` text,
	`gelar_belakang` text,
	`tempat_lahir` text,
	`tanggal_lahir` text,
	`jenis_kelamin` text NOT NULL,
	`alamat` text,
	`no_hp` text,
	`email` text,
	`foto_url` text,
	`agama` text,
	`status_kepegawaian` text NOT NULL,
	`tmt_cpns` text,
	`tmt_pns` text,
	`status_aktif` text DEFAULT 'AKTIF' NOT NULL,
	`tanggal_non_aktif` text,
	`keterangan_non_aktif` text,
	`unit_kerja_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pegawai_nip_idx` ON `pegawai` (`nip`);--> statement-breakpoint
CREATE INDEX `pegawai_nama_idx` ON `pegawai` (`nama`);--> statement-breakpoint
CREATE INDEX `pegawai_status_aktif_idx` ON `pegawai` (`status_aktif`);--> statement-breakpoint
CREATE TABLE `periode_kenaikan_pangkat` (
	`id` text PRIMARY KEY NOT NULL,
	`bulan` integer NOT NULL,
	`tanggal` integer NOT NULL,
	`label` text NOT NULL,
	`aktif` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `riwayat_jabatan` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`jenis_jabatan` text NOT NULL,
	`nama_jabatan` text NOT NULL,
	`jenjang_jabatan` text,
	`unit_kerja_id` text,
	`tmt_jabatan` text NOT NULL,
	`tgl_selesai` text,
	`is_aktif` integer DEFAULT true NOT NULL,
	`nomor_sk` text,
	`tanggal_sk` text,
	`dokumen_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `riwayat_jabatan_pegawai_aktif_idx` ON `riwayat_jabatan` (`pegawai_id`,`is_aktif`);--> statement-breakpoint
CREATE TABLE `riwayat_pangkat_golongan` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`golongan_ruang` text NOT NULL,
	`nama_pangkat` text NOT NULL,
	`tmt` text NOT NULL,
	`nomor_sk` text,
	`tanggal_sk` text,
	`pejabat_penetap` text,
	`is_aktif` integer DEFAULT true NOT NULL,
	`dokumen_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `riwayat_pangkat_pegawai_aktif_idx` ON `riwayat_pangkat_golongan` (`pegawai_id`,`is_aktif`);--> statement-breakpoint
CREATE TABLE `riwayat_pendidikan` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`jenjang` text NOT NULL,
	`jurusan` text,
	`nama_institusi` text,
	`tahun_lulus` integer,
	`nomor_ijazah` text,
	`dokumen_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status_usulan_kenaikan_pangkat` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`periode_tahun` integer NOT NULL,
	`periode_bulan` integer NOT NULL,
	`jenis_kenaikan` text NOT NULL,
	`status` text DEFAULT 'BELUM_DIPROSES' NOT NULL,
	`catatan` text,
	`updated_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_usulan_unique_idx` ON `status_usulan_kenaikan_pangkat` (`pegawai_id`,`periode_tahun`,`periode_bulan`,`jenis_kenaikan`);--> statement-breakpoint
CREATE INDEX `status_usulan_periode_idx` ON `status_usulan_kenaikan_pangkat` (`periode_tahun`,`periode_bulan`);--> statement-breakpoint
CREATE TABLE `unit_kerja` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`jenis` text NOT NULL,
	`alamat` text,
	`parent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`nama` text NOT NULL,
	`role` text NOT NULL,
	`unit_kerja_id` text,
	`pegawai_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_idx` ON `user` (`username`);