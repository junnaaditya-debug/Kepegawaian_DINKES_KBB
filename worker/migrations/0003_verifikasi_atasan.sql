-- Support for Kepala Bidang/Kasubbag "approve/verifikasi data" (Bagian 4 PRD).
ALTER TABLE status_usulan_kenaikan_pangkat ADD COLUMN diverifikasi_atasan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE status_usulan_kenaikan_pangkat ADD COLUMN diverifikasi_oleh INTEGER REFERENCES users(id);
ALTER TABLE status_usulan_kenaikan_pangkat ADD COLUMN diverifikasi_at TEXT;
ALTER TABLE status_usulan_kenaikan_pangkat ADD COLUMN catatan_verifikasi TEXT;
