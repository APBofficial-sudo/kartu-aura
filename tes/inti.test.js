// Tes aturan inti. Jalankan: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const Inti = require('../src/inti.js');

const ATUR = Inti.lengkapiPengaturan({});
const BOTOL = Inti.lengkapiPengaturan({ aturan_stempel: 'botol' });

test('normalisasi nomor WhatsApp', () => {
  const sama = '6281234567890';
  for (const s of ['081234567890', '0812-3456-7890', '0812 3456 7890', '+62 812-3456-7890', '6281234567890', '81234567890', '+62 0812 3456 7890', '(0812) 3456.7890']) {
    assert.equal(Inti.normalWa(s), sama, s);
  }
  assert.equal(Inti.normalWa('+60 12-345 6789'), '60123456789');
  for (const s of ['', '   ', 'abc', '12345', '0212345678', '60123456789', '0812', null, undefined]) {
    assert.equal(Inti.normalWa(s), null, String(s));
  }
  assert.equal(Inti.tampilWa(sama), '0812-3456-7890');
  assert.equal(Inti.samarWa(sama), '0812••••7890');
  assert.ok(!Inti.samarWa(sama).includes('3456'));
});

test('kode kartu: bentuk XXXX-XXXX tanpa 0/O/1/I', () => {
  const kode = Inti.buatKode([0, 31, 32, 255, 7, 8, 9, 200]);
  assert.match(kode, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(Inti.normalKode('7kqm 2xwp'), '7KQM-2XWP');
  assert.equal(Inti.normalKode('7KQM-2XW0'), null); // ada angka 0
  assert.equal(Inti.normalKode('081234567890'), null);
});

test('Stempel Awal hanya sekali', () => {
  let k = Inti.keadaanKosong();
  k = Inti.stempelAwal(k, 'TikTok Shop', ATUR).keadaan;
  assert.equal(k.stempel, 1);
  assert.equal(k.asal_awal, 'TikTok Shop');
  assert.equal(k.total_beli, 0, 'Stempel Awal bukan pembelian lewat WhatsApp');
  assert.throws(() => Inti.stempelAwal(k, 'Shopee', ATUR), (e) => e.kode === 'SUDAH_STEMPEL_AWAL');
  assert.throws(() => Inti.stempelAwal(Inti.keadaanKosong(), 'Tokopedia', ATUR), (e) => e.kode === 'ASAL_TIDAK_SAH');
});

test('stempel ke-5 menghasilkan hadiah, kartu berikutnya mulai dari 0', () => {
  let k = Inti.stempelAwal(Inti.keadaanKosong(), 'Shopee', ATUR).keadaan;
  let r;
  for (let i = 0; i < 3; i++) { r = Inti.stempelBeli(k, 1, ATUR); k = r.keadaan; assert.equal(r.hadiah_baru, 0); }
  assert.equal(k.stempel, 4);
  r = Inti.stempelBeli(k, 1, ATUR); k = r.keadaan;
  assert.equal(r.hadiah_baru, 1);
  assert.deepEqual({ s: k.stempel, h: k.hadiah_siap, ke: k.kartu_ke, beli: k.total_beli }, { s: 0, h: 1, ke: 2, beli: 4 });

  // Selama hadiah belum diberikan, kartu yang tampil adalah kartu penuh.
  let v = Inti.tampilanKartu(k, ATUR);
  assert.deepEqual({ penuh: v.penuh, isi: v.isi, ke: v.kartu_ke }, { penuh: true, isi: 5, ke: 1 });

  k = Inti.beriHadiah(k).keadaan;
  assert.deepEqual({ h: k.hadiah_siap, total: k.total_hadiah }, { h: 0, total: 1 });
  v = Inti.tampilanKartu(k, ATUR);
  assert.deepEqual({ penuh: v.penuh, isi: v.isi, ke: v.kartu_ke, sisa: v.sisa }, { penuh: false, isi: 0, ke: 2, sisa: 5 });
  assert.throws(() => Inti.beriHadiah(k), (e) => e.kode === 'BELUM_ADA_HADIAH');
});

test('hadiah ditunda: stempel berikutnya masuk ke kartu baru, hadiah tetap menunggu', () => {
  let k = Inti.keadaanKosong();
  for (let i = 0; i < 5; i++) k = Inti.stempelBeli(k, 1, ATUR).keadaan;
  assert.equal(k.hadiah_siap, 1);
  k = Inti.stempelBeli(k, 1, ATUR).keadaan; // pesanan berikutnya sebelum hadiah diberikan
  assert.deepEqual({ s: k.stempel, h: k.hadiah_siap, ke: k.kartu_ke }, { s: 1, h: 1, ke: 2 });
  const v = Inti.tampilanKartu(k, ATUR);
  assert.equal(v.penuh, true);
  assert.deepEqual(v.berikutnya, { kartu_ke: 2, isi: 1 });
});

test('aturan per pesanan: jumlah selalu 1 walau diminta lebih', () => {
  const r = Inti.stempelBeli(Inti.keadaanKosong(), 4, ATUR);
  assert.equal(r.jumlah, 1);
  assert.equal(r.keadaan.stempel, 1);
});

test('aturan per botol: sisa stempel dibawa ke kartu berikutnya', () => {
  let k = Inti.keadaanKosong();
  k = Inti.stempelBeli(k, 4, BOTOL).keadaan;
  const r = Inti.stempelBeli(k, 3, BOTOL); k = r.keadaan;
  assert.equal(r.hadiah_baru, 1);
  assert.deepEqual({ s: k.stempel, h: k.hadiah_siap, ke: k.kartu_ke, beli: k.total_beli }, { s: 2, h: 1, ke: 2, beli: 2 });
  const besar = Inti.stempelBeli(Inti.keadaanKosong(), 12, BOTOL);
  assert.deepEqual({ s: besar.keadaan.stempel, h: besar.keadaan.hadiah_siap, baru: besar.hadiah_baru }, { s: 2, h: 2, baru: 2 });
  assert.throws(() => Inti.stempelBeli(Inti.keadaanKosong(), 13, BOTOL), (e) => e.kode === 'JUMLAH_TIDAK_SAH');
});

test('pembatalan stempel biasa', () => {
  let k = Inti.keadaanKosong();
  k = Inti.stempelBeli(k, 1, ATUR).keadaan;
  k = Inti.stempelBeli(k, 1, ATUR).keadaan;
  k = Inti.batalkan(k, { jenis: 'STEMPEL', jumlah: 1 }, ATUR).keadaan;
  assert.deepEqual({ s: k.stempel, beli: k.total_beli }, { s: 1, beli: 1 });
});

test('pembatalan Stempel Awal membuka lagi hak Stempel Awal', () => {
  let k = Inti.stempelAwal(Inti.keadaanKosong(), 'Lainnya', ATUR).keadaan;
  k = Inti.batalkan(k, { jenis: 'STEMPEL_AWAL', jumlah: 1 }, ATUR).keadaan;
  assert.deepEqual({ s: k.stempel, asal: k.asal_awal }, { s: 0, asal: '' });
  assert.doesNotThrow(() => Inti.stempelAwal(k, 'Shopee', ATUR));
});

test('membatalkan stempel yang memenuhkan kartu: hadiah yang belum diberikan ditarik lagi', () => {
  let k = Inti.keadaanKosong();
  for (let i = 0; i < 5; i++) k = Inti.stempelBeli(k, 1, ATUR).keadaan;
  const r = Inti.batalkan(k, { jenis: 'STEMPEL', jumlah: 1 }, ATUR);
  assert.equal(r.hadiah_ditarik, 1);
  assert.deepEqual({ s: r.keadaan.stempel, h: r.keadaan.hadiah_siap, ke: r.keadaan.kartu_ke }, { s: 4, h: 0, ke: 1 });
});

test('membatalkan stempel yang hadiahnya sudah diberikan ditolak', () => {
  let k = Inti.keadaanKosong();
  for (let i = 0; i < 5; i++) k = Inti.stempelBeli(k, 1, ATUR).keadaan;
  k = Inti.beriHadiah(k).keadaan;
  assert.throws(() => Inti.batalkan(k, { jenis: 'STEMPEL', jumlah: 1 }, ATUR), (e) => e.kode === 'HADIAH_SUDAH_DIBERIKAN');
});

test('pembatalan per botol melewati batas kartu', () => {
  let k = Inti.stempelBeli(Inti.keadaanKosong(), 4, BOTOL).keadaan;
  k = Inti.stempelBeli(k, 3, BOTOL).keadaan; // 7 -> hadiah 1, sisa 2
  k = Inti.batalkan(k, { jenis: 'STEMPEL', jumlah: 3 }, BOTOL).keadaan;
  assert.deepEqual({ s: k.stempel, h: k.hadiah_siap, ke: k.kartu_ke, beli: k.total_beli }, { s: 4, h: 0, ke: 1, beli: 1 });
});

test('penyesuaian manual', () => {
  let k = Inti.keadaanKosong();
  k = Inti.sesuaikan(k, 2, ATUR).keadaan;
  assert.equal(k.stempel, 2);
  assert.equal(k.total_beli, 0, 'penyesuaian bukan pembelian');
  k = Inti.sesuaikan(k, -1, ATUR).keadaan;
  assert.equal(k.stempel, 1);
  assert.throws(() => Inti.sesuaikan(k, -2, ATUR), (e) => e.kode === 'STEMPEL_KURANG');
  assert.throws(() => Inti.sesuaikan(k, 0, ATUR), (e) => e.kode === 'JUMLAH_TIDAK_SAH');
});

test('target diturunkan: stempel berlebih berubah jadi hadiah', () => {
  const k = { kartu_ke: 1, stempel: 4, hadiah_siap: 0, total_beli: 4, total_hadiah: 0, asal_awal: '' };
  const r = Inti.rapikanSetelahGantiTarget(k, Inti.lengkapiPengaturan({ target_stempel: 3 }));
  assert.deepEqual({ s: r.keadaan.stempel, h: r.keadaan.hadiah_siap, ke: r.keadaan.kartu_ke, baru: r.hadiah_baru }, { s: 1, h: 1, ke: 2, baru: 1 });
});

test('masa berlaku stempel', () => {
  const k = { kartu_ke: 1, stempel: 3, hadiah_siap: 0, total_beli: 3, total_hadiah: 0, asal_awal: '' };
  const terakhir = new Date('2026-01-31T03:00:00Z');
  const tanpa = Inti.lengkapiPengaturan({ masa_berlaku_bulan: 0 });
  const enam = Inti.lengkapiPengaturan({ masa_berlaku_bulan: 6 });
  assert.equal(Inti.sudahHangus(k, terakhir, new Date('2030-01-01T00:00:00Z'), tanpa), false);
  assert.equal(Inti.sudahHangus(k, terakhir, new Date('2026-07-30T00:00:00Z'), enam), false);
  assert.equal(Inti.sudahHangus(k, terakhir, new Date('2026-08-01T00:00:00Z'), enam), true);
  assert.equal(Inti.sudahHangus({ ...k, stempel: 0 }, terakhir, new Date('2030-01-01T00:00:00Z'), enam), false);
  // 31 Jan + 1 bulan = akhir Februari (bukan meloncat ke Maret)
  assert.equal(Inti.tanggalWib(Inti.tambahBulan(new Date('2026-01-31T03:00:00Z'), 1)), '2026-02-28');
});

test('waktu WIB tidak bergantung zona waktu mesin', () => {
  const d = new Date('2026-11-05T18:30:00Z'); // 6 Nov 01.30 WIB
  assert.equal(Inti.tanggalWib(d), '2026-11-06');
  assert.equal(Inti.teksTanggal(d), '6 November 2026');
  assert.equal(Inti.teksWaktu(d), '6 Nov 2026 01.30 WIB');
  assert.equal(Inti.awalHariWib(d).toISOString(), '2026-11-05T17:00:00.000Z');
  // 6 Nov 2026 hari Jumat -> Senin 2 Nov 00.00 WIB
  assert.equal(Inti.awalMingguWib(d).toISOString(), '2026-11-01T17:00:00.000Z');
});

test('templat pesan', () => {
  const p = { nama: 'Rina Maharani', kode: '7KQM-2XWP' };
  const k = { kartu_ke: 1, stempel: 3, hadiah_siap: 0, total_beli: 2, total_hadiah: 0, asal_awal: 'Shopee' };
  const pesan = Inti.susunPesan('stempel', ATUR, p, k, 'https://contoh.id/kartu/#abc');
  assert.match(pesan, /Stempel ke-3 sudah masuk, Kak Rina\. Tinggal 2 lagi untuk 1 Parfum Aura gratis\./);
  assert.match(pesan, /https:\/\/contoh\.id\/kartu\/#abc/);
  assert.equal(Inti.isiTemplat('{a} {tidak_ada}', { a: 1 }), '1 {tidak_ada}');
  assert.match(Inti.susunPesan('stempel', ATUR, p, k, ''), /link kartu belum diatur/);
});

test('pengaturan: nilai bawaan dan pemeriksaan', () => {
  assert.equal(ATUR.target_stempel, 5);
  assert.equal(ATUR.aturan_stempel, 'pesanan');
  assert.equal(Inti.lengkapiPengaturan({ target_stempel: 99 }).target_stempel, 12);
  assert.equal(Inti.lengkapiPengaturan({ wa_admin: '0812-3456-7890' }).wa_admin, '6281234567890');
  assert.throws(() => Inti.periksaPerubahanPengaturan({ target_stempel: 1 }), (e) => e.kode === 'PENGATURAN_SALAH');
  assert.throws(() => Inti.periksaPerubahanPengaturan({ wa_admin: '12345' }), (e) => e.kode === 'PENGATURAN_SALAH');
  assert.throws(() => Inti.periksaPerubahanPengaturan({ url_kartu: 'javascript:alert(1)' }), (e) => e.kode === 'PENGATURAN_SALAH');
  assert.deepEqual(Inti.periksaPerubahanPengaturan({ target_stempel: '6', kunci_asing: 'x', url_kartu: 'https://a.b/kartu/#token' }), { target_stempel: 6, url_kartu: 'https://a.b/kartu/' });
  assert.deepEqual(Inti.daftarAroma({ daftar_aroma: 'Senja\n Embun |Rimba\n\n' }), ['Senja', 'Embun', 'Rimba']);
});

test('ringkasan', () => {
  const kini = new Date('2026-11-05T09:00:00Z');
  const hari = (n) => new Date(kini.getTime() - n * Inti.HARI);
  const pelanggan = [
    { id: 'P0001', nama: 'Ayu', wa: '6281111111111', kode: 'AAAA-AAAA', stempel: 4, hadiah_siap: 0, total_beli: 3, total_hadiah: 0, asal_awal: 'TikTok Shop', tgl_daftar: hari(40), stempel_terakhir: hari(2), status: 'aktif' },
    { id: 'P0002', nama: 'Budi', wa: '6282222222222', kode: 'BBBB-BBBB', stempel: 1, hadiah_siap: 0, total_beli: 0, total_hadiah: 0, asal_awal: 'TikTok Shop', tgl_daftar: hari(3), stempel_terakhir: null, status: 'aktif' },
    { id: 'P0003', nama: 'Citra', wa: '6283333333333', kode: 'CCCC-CCCC', stempel: 0, hadiah_siap: 1, total_beli: 5, total_hadiah: 0, asal_awal: '', tgl_daftar: hari(100), stempel_terakhir: hari(90), status: 'aktif' },
    { id: 'P0004', nama: '(dihapus)', wa: '', kode: 'DDDD-DDDD', stempel: 0, hadiah_siap: 0, total_beli: 1, total_hadiah: 0, asal_awal: 'Shopee', tgl_daftar: hari(5), stempel_terakhir: hari(5), status: 'dihapus' }
  ];
  const transaksi = [
    { id: 'T1', waktu: hari(2), id_pelanggan: 'P0001', jenis: 'STEMPEL', jumlah: 1 },
    { id: 'T2', waktu: hari(10), id_pelanggan: 'P0001', jenis: 'STEMPEL', jumlah: 1 },
    { id: 'T3', waktu: hari(1), id_pelanggan: 'P0001', jenis: 'STEMPEL', jumlah: 1 },
    { id: 'T4', waktu: hari(1), id_pelanggan: 'P0001', jenis: 'BATAL', jumlah: 1, ref: 'T3' },
    { id: 'T5', waktu: hari(90), id_pelanggan: 'P0003', jenis: 'STEMPEL', jumlah: 1 },
    { id: 'T6', waktu: hari(95), id_pelanggan: 'P0003', jenis: 'HADIAH', jumlah: 1 }
  ];
  const r = Inti.hitungRingkasan(pelanggan, transaksi, ATUR, kini);
  assert.equal(r.pemegang_kartu, 3);
  assert.equal(r.kartu_baru_7, 1);
  assert.equal(r.kartu_baru_30, 1);
  assert.equal(r.stempel_beli_7, 1, 'stempel yang dibatalkan tidak dihitung');
  assert.equal(r.stempel_beli_30, 2);
  assert.equal(r.pembeli_wa, 2);
  assert.equal(r.pembeli_ulang, 2);
  assert.equal(r.hadiah_keluar, 1);
  assert.equal(r.hadiah_tunda, 1);
  assert.deepEqual(r.tinggal_satu.map((x) => x.nama), ['Ayu']);
  assert.deepEqual(r.lama_tidak_beli.map((x) => x.nama), ['Citra']);
  assert.deepEqual(r.asal['TikTok Shop'], { jumlah: 2, lanjut_beli: 1 });
  assert.deepEqual(r.asal['Shopee'], { jumlah: 0, lanjut_beli: 0 });
  assert.equal(r.mingguan.length, 12);
  assert.equal(r.mingguan[11].mulai, '2026-11-02');
  assert.equal(r.mingguan.reduce((a, b) => a + b.stempel, 0), 2, 'T5 di luar 12 minggu terakhir');
});
