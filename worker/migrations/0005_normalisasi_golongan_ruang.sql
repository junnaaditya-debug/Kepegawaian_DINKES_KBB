-- Data pegawai hasil impor massal (DATA_BASE_PNS_DINKES_J_1.xlsx) tersimpan dengan
-- golongan/ruang huruf besar (mis. 'III/D'), sementara konvensi aplikasi (dropdown form,
-- tabel golongan_masa_kerja_minimum) memakai huruf kecil (mis. 'III/d'). Ini membuat
-- filter "Golongan" pada Data Pegawai dan deteksi kenaikan pangkat reguler gagal
-- mencocokkan data pegawai tersebut. Normalisasi ke huruf kecil di kedua tabel sumber.

UPDATE pegawai SET golongan_ruang_aktif = CASE golongan_ruang_aktif
  WHEN 'I/A' THEN 'I/a' WHEN 'I/B' THEN 'I/b' WHEN 'I/C' THEN 'I/c' WHEN 'I/D' THEN 'I/d'
  WHEN 'II/A' THEN 'II/a' WHEN 'II/B' THEN 'II/b' WHEN 'II/C' THEN 'II/c' WHEN 'II/D' THEN 'II/d'
  WHEN 'III/A' THEN 'III/a' WHEN 'III/B' THEN 'III/b' WHEN 'III/C' THEN 'III/c' WHEN 'III/D' THEN 'III/d'
  WHEN 'IV/A' THEN 'IV/a' WHEN 'IV/B' THEN 'IV/b' WHEN 'IV/C' THEN 'IV/c' WHEN 'IV/D' THEN 'IV/d' WHEN 'IV/E' THEN 'IV/e'
  ELSE golongan_ruang_aktif
END
WHERE golongan_ruang_aktif IS NOT NULL;

UPDATE riwayat_pangkat_golongan SET golongan_ruang = CASE golongan_ruang
  WHEN 'I/A' THEN 'I/a' WHEN 'I/B' THEN 'I/b' WHEN 'I/C' THEN 'I/c' WHEN 'I/D' THEN 'I/d'
  WHEN 'II/A' THEN 'II/a' WHEN 'II/B' THEN 'II/b' WHEN 'II/C' THEN 'II/c' WHEN 'II/D' THEN 'II/d'
  WHEN 'III/A' THEN 'III/a' WHEN 'III/B' THEN 'III/b' WHEN 'III/C' THEN 'III/c' WHEN 'III/D' THEN 'III/d'
  WHEN 'IV/A' THEN 'IV/a' WHEN 'IV/B' THEN 'IV/b' WHEN 'IV/C' THEN 'IV/c' WHEN 'IV/D' THEN 'IV/d' WHEN 'IV/E' THEN 'IV/e'
  ELSE golongan_ruang
END;
