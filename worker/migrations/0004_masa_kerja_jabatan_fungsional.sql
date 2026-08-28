-- Menambahkan parameter masa kerja minimum dalam jabatan (TMT terakhir) untuk
-- jalur kenaikan pangkat fungsional, sebelumnya jalur ini hanya menyaratkan
-- ambang angka kredit kumulatif tanpa mempertimbangkan lama menjabat.
INSERT OR IGNORE INTO parameter_aturan (kategori, kunci, nilai, deskripsi) VALUES
  ('masa_kerja', 'masa_kerja_minimum_jabatan_fungsional_bulan', '48',
   'Masa kerja minimum dalam jabatan/pangkat terakhir (TMT terakhir) untuk kenaikan jenjang jabatan fungsional, dalam bulan (4 tahun).');
