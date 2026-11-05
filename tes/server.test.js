// Tes alur penuh lewat doPost — memakai Code.gs yang sama dengan yang ditempel ke Apps Script,
// dijalankan di atas tiruan layanan Google (src/tiruan-gas.js). Jalankan: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { muatServer } = require('../alat/muat-server.js');
const buatTiruanGas = require('../src/tiruan-gas.js');

const MENIT = 60 * 1000, JAM = 60 * MENIT, HARI = 24 * JAM;

// Seluruh tes dijalankan dua kali (lihat alat/tes.js): sebagai skrip yang berdiri sendiri, yaitu cara pasang utama,
// lalu sebagai skrip yang menempel di sebuah Google Sheet. Tes yang khusus satu cara menyebut caranya sendiri.
const BERDIRI = process.env.KA_SKRIP !== 'menempel';
const serverBaru = (opsi = {}) => muatServer({ diam: true, ...opsi, tiruan: { berdiriSendiri: BERDIRI, ...(opsi.tiruan || {}) } });

// Server baru yang sudah dipasang, Owner sudah ganti PIN, plus satu admin biasa.
function siap(opsi = {}) {
  const s = serverBaru({ waktu: '2026-11-05T03:00:00Z', ...opsi });
  s.ctx.pasang();
  const awal = s.minta('masuk', { nama: 'Owner', pin: '123456' });
  const owner = s.minta('ganti_pin', { sesi: awal.sesi, pin_lama: '123456', pin_baru: '482915' });
  s.owner = owner.sesi;
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { url_kartu: 'https://apb.example/kartu/', wa_admin: '0811-1111-2222' } });
  s.minta('admin_tambah', { sesi: s.owner, nama: 'Mira', peran: 'admin', pin: '730164' });
  const a1 = s.minta('masuk', { nama: 'Mira', pin: '730164' });
  s.admin = s.minta('ganti_pin', { sesi: a1.sesi, pin_lama: '730164', pin_baru: '905317' }).sesi;
  let urut = 0;
  s.idp = () => 'req-' + (++urut) + '-' + Math.random().toString(36).slice(2);
  s.daftar = (nama, wa) => s.minta('daftar', { sesi: s.admin, nama, wa, id_permintaan: s.idp() }).pelanggan;
  s.stempel = (id, lain = {}) => s.minta('stempel', { sesi: s.admin, id, id_permintaan: s.idp(), konfirmasi: true, ...lain });
  s.token = (id) => {
    const baris = s.lembar('Pelanggan').find((r) => r[0] === id);
    return baris[5];
  };
  return s;
}

const galat = (kode) => (e) => { assert.equal(e.kode, kode, e.message); return true; };

test('tiruan kripto cocok dengan kripto Node', () => {
  const k = buatTiruanGas()._kripto;
  for (const teks of ['', 'abc', 'Kartu Aura — parfum', 'x'.repeat(200)]) {
    assert.equal(Buffer.from(k.sha256(k.utf8(teks))).toString('hex'), crypto.createHash('sha256').update(teks).digest('hex'));
    assert.equal(Buffer.from(k.hmacSha256(k.utf8('kunci-rahasia'), k.utf8(teks))).toString('hex'), crypto.createHmac('sha256', 'kunci-rahasia').update(teks).digest('hex'));
    assert.equal(k.base64(k.utf8(teks), false), Buffer.from(teks).toString('base64'));
  }
});

test('pasang: membuat tab, aman dijalankan ulang, Owner wajib ganti PIN', () => {
  const s = serverBaru();
  s.ctx.pasang();
  assert.deepEqual(s.gas._buku.getSheets().map((l) => l.getName()), ['Ringkasan', 'Pelanggan', 'Transaksi', 'Admin', 'Pengaturan']);
  const sebelum = s.lembar('Pengaturan').length;
  s.ctx.pasang();
  assert.equal(s.lembar('Pengaturan').length, sebelum, 'pengaturan tidak digandakan');
  assert.equal(s.lembar('Admin').length, 2, 'admin tidak digandakan');
  assert.equal(s.gas.ScriptApp.getProjectTriggers().length, BERDIRI ? 2 : 1, 'pemicu tidak digandakan');
  assert.equal(s.gas._buku.getSpreadsheetTimeZone(), 'Asia/Jakarta');

  const m = s.minta('masuk', { nama: 'owner', pin: '123456' });
  assert.equal(m.wajib_ganti_pin, true);
  assert.throws(() => s.minta('info', { sesi: m.sesi }), galat('WAJIB_GANTI_PIN'));
  assert.throws(() => s.minta('ganti_pin', { sesi: m.sesi, pin_lama: '123456', pin_baru: '111111' }), galat('PIN_TIDAK_SAH'));
  const baru = s.minta('ganti_pin', { sesi: m.sesi, pin_lama: '123456', pin_baru: '482915' });
  assert.equal(s.minta('info', { sesi: baru.sesi }).admin.peran, 'owner');
  assert.throws(() => s.minta('info', { sesi: m.sesi }), galat('SESI_HABIS'), 'sesi lama mati setelah PIN diganti');
  // PIN tidak pernah tersimpan polos
  assert.ok(!JSON.stringify(s.lembar('Admin')).includes('482915'));
});

test('masuk: terkunci 15 menit setelah 5 kali PIN salah', () => {
  const s = siap();
  for (let i = 0; i < 4; i++) assert.throws(() => s.minta('masuk', { nama: 'Mira', pin: '000000' }), galat('PIN_SALAH'));
  assert.throws(() => s.minta('masuk', { nama: 'Mira', pin: '000000' }), galat('TERKUNCI'));
  assert.throws(() => s.minta('masuk', { nama: 'Mira', pin: '905317' }), galat('TERKUNCI'), 'PIN benar pun ditolak selama terkunci');
  s.maju(16 * MENIT);
  assert.equal(s.minta('masuk', { nama: 'Mira', pin: '905317' }).nama, 'Mira');
});

test('sesi habis setelah 12 jam; admin biasa tidak bisa masuk bagian Owner', () => {
  const s = siap();
  assert.throws(() => s.minta('ringkasan', { sesi: s.admin }), galat('BUKAN_OWNER'));
  assert.throws(() => s.minta('pengaturan_baca', { sesi: s.admin }), galat('BUKAN_OWNER'));
  assert.throws(() => s.minta('cari', { sesi: 'palsu:palsu', q: '' }), galat('SESI_HABIS'));
  assert.throws(() => s.minta('cari', { q: '' }), galat('SESI_HABIS'));
  const palsu = s.admin.replace('admin', 'owner'); // mengutak-atik isi sesi
  assert.throws(() => s.minta('ringkasan', { sesi: palsu }), galat('SESI_HABIS'));
  s.maju(11 * JAM);
  assert.ok(s.minta('cari', { sesi: s.admin, q: '' }));
  s.maju(2 * JAM);
  assert.throws(() => s.minta('cari', { sesi: s.admin, q: '' }), galat('SESI_HABIS'));
});

test('admin dinonaktifkan atau PIN di-reset: sesinya langsung mati', () => {
  const s = siap();
  s.minta('admin_ubah', { sesi: s.owner, nama: 'Mira', status: 'nonaktif' });
  assert.throws(() => s.minta('cari', { sesi: s.admin, q: '' }), galat('SESI_HABIS'));
  assert.throws(() => s.minta('masuk', { nama: 'Mira', pin: '905317' }), galat('PIN_SALAH'));
  s.minta('admin_ubah', { sesi: s.owner, nama: 'Mira', status: 'aktif' });
  s.minta('admin_reset_pin', { sesi: s.owner, nama: 'Mira', pin: '246813' });
  assert.throws(() => s.minta('cari', { sesi: s.admin, q: '' }), galat('SESI_HABIS'));
  assert.equal(s.minta('masuk', { nama: 'Mira', pin: '246813' }).wajib_ganti_pin, true);
  assert.throws(() => s.minta('admin_ubah', { sesi: s.owner, nama: 'Owner', status: 'nonaktif' }), galat('TIDAK_BOLEH'));
  assert.throws(() => s.minta('admin_tambah', { sesi: s.owner, nama: 'mira', pin: '135790' }), galat('ADMIN_SUDAH_ADA'));
});

test('daftar pelanggan: nomor dinormalkan dan tetap teks, tidak dobel', () => {
  const s = siap();
  const p = s.daftar('rina maharani', '0812-3456-7890');
  assert.equal(p.nama, 'Rina Maharani');
  assert.equal(p.wa, '6281234567890');
  assert.equal(p.wa_tampil, '0812-3456-7890');
  assert.equal(p.no_anggota, '0001');
  assert.match(p.kode, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.match(p.tautan, /^https:\/\/apb\.example\/kartu\/#[A-Za-z0-9]{22}$/);
  assert.equal(p.angkatan_pertama, true);
  const baris = s.lembar('Pelanggan')[1];
  assert.equal(typeof baris[3], 'string', 'nomor WhatsApp harus teks di spreadsheet');
  assert.equal(baris[3], '6281234567890');

  const lagi = s.minta('daftar', { sesi: s.admin, nama: 'Rina', wa: '+62 812 3456 7890', id_permintaan: s.idp() });
  assert.equal(lagi.sudah_ada, true);
  assert.equal(lagi.pelanggan.id, p.id);
  assert.equal(s.lembar('Pelanggan').length, 2);
  assert.throws(() => s.minta('daftar', { sesi: s.admin, nama: 'X', wa: '0812-3456-7891' }), galat('NAMA_KOSONG'));
  assert.throws(() => s.minta('daftar', { sesi: s.admin, nama: 'Budi', wa: '12345' }), galat('WA_TIDAK_SAH'));

  const pesan = s.minta('daftar', { sesi: s.admin, nama: 'Dimas Pratama', wa: '081299990000', id_permintaan: s.idp() });
  assert.equal(pesan.baru, true);
  assert.match(pesan.pesan, /Halo Kak Dimas, ini kartu stempel Parfum Aura punya Kakak:\nhttps:\/\/apb\.example\/kartu\/#/);
  assert.match(pesan.pesan, /5 stempel = 1 Parfum Aura gratis\./);
});

test('teks berbahaya (rumus, angka, tanggal) tersimpan apa adanya sebagai teks', () => {
  const s = siap();
  const p = s.daftar('=HYPERLINK("http://jahat","klik")', '081200000001');
  assert.equal(p.nama, '=HYPERLINK("http://jahat","klik")');
  const h = s.stempel(p.id, { nomor_pesanan: '000123', catatan: '12-05' });
  const t = s.minta('pelanggan', { sesi: s.admin, id: p.id }).transaksi[0];
  assert.equal(t.nomor_pesanan, '000123');
  assert.equal(t.catatan, '12-05');
  assert.equal(h.pelanggan.stempel, 1);
  const q = s.daftar('+62 Plus', '081200000002');
  assert.equal(q.nama, '+62 Plus');
  const r = s.daftar('TRUE', '081200000003');
  assert.equal(s.minta('cari', { sesi: s.admin, q: 'true' }).hasil[0].id, r.id);
});

test('alur utama: stempel awal, 4 stempel, kartu penuh, hadiah, kartu berikutnya', () => {
  const s = siap();
  const p = s.daftar('Rina Maharani', '081234567890');
  const a = s.minta('stempel_awal', { sesi: s.admin, id: p.id, asal: 'TikTok Shop', id_permintaan: s.idp() });
  assert.equal(a.pelanggan.stempel, 1);
  assert.equal(a.pelanggan.boleh_stempel_awal, false);
  assert.match(a.pesan, /Stempel pertama sudah masuk, Kak Rina\..*Tinggal 4 lagi untuk 1 Parfum Aura gratis\./s);
  assert.throws(() => s.minta('stempel_awal', { sesi: s.admin, id: p.id, asal: 'Shopee', id_permintaan: s.idp() }), galat('SUDAH_STEMPEL_AWAL'));

  let h;
  for (let i = 2; i <= 4; i++) {
    h = s.stempel(p.id, { nomor_pesanan: 'ORD-' + i });
    assert.equal(h.pelanggan.stempel, i);
    assert.equal(h.kartu_penuh, false);
    assert.match(h.pesan, new RegExp('Stempel ke-' + i + ' sudah masuk, Kak Rina\\. Tinggal ' + (5 - i) + ' lagi'));
  }
  h = s.stempel(p.id, { nomor_pesanan: 'ORD-5' });
  assert.equal(h.kartu_penuh, true);
  assert.deepEqual({ s: h.pelanggan.stempel, siap: h.pelanggan.hadiah_siap, ke: h.pelanggan.kartu_ke }, { s: 0, siap: 1, ke: 2 });
  assert.deepEqual({ penuh: h.pelanggan.kartu.penuh, isi: h.pelanggan.kartu.isi, ke: h.pelanggan.kartu.kartu_ke }, { penuh: true, isi: 5, ke: 1 });
  assert.match(h.pesan, /Kartu Kakak sudah penuh, Kak Rina\. 1 Parfum Aura gratis ikut di paket pesanan ini ya\./);
  assert.match(h.pesan_tunda, /kabari kami aroma pilihannya/);

  const g = s.minta('hadiah', { sesi: s.admin, id: p.id, aroma: 'Senja', baru_penuh: true, id_permintaan: s.idp() });
  assert.deepEqual({ siap: g.pelanggan.hadiah_siap, total: g.pelanggan.total_hadiah, ke: g.pelanggan.kartu_ke, isi: g.pelanggan.kartu.isi }, { siap: 0, total: 1, ke: 2, isi: 0 });
  assert.match(g.pesan, /Kartu Kakak sudah penuh/);
  assert.throws(() => s.minta('hadiah', { sesi: s.admin, id: p.id, aroma: 'Senja', id_permintaan: s.idp() }), galat('BELUM_ADA_HADIAH'));

  const b = s.stempel(p.id, { nomor_pesanan: 'ORD-6' });
  assert.deepEqual({ s: b.pelanggan.stempel, ke: b.pelanggan.kartu_ke, beli: b.pelanggan.total_beli }, { s: 1, ke: 2, beli: 5 });

  const jenis = s.lembar('Transaksi').slice(1).map((r) => r[3]);
  assert.deepEqual(jenis, ['DAFTAR', 'STEMPEL_AWAL', 'STEMPEL', 'STEMPEL', 'STEMPEL', 'STEMPEL', 'HADIAH', 'STEMPEL']);
});

test('hadiah ditunda lalu diberikan belakangan', () => {
  const s = siap();
  const p = s.daftar('Dimas', '081200000010');
  for (let i = 1; i <= 5; i++) s.stempel(p.id);
  const t = s.minta('hadiah_tunda', { sesi: s.admin, id: p.id, catatan: 'stok aroma kosong', id_permintaan: s.idp() });
  assert.equal(t.pelanggan.hadiah_siap, 1);
  assert.match(t.pesan, /sudah jadi hak Kakak/);
  const lanjut = s.stempel(p.id);
  assert.deepEqual({ s: lanjut.pelanggan.stempel, siap: lanjut.pelanggan.hadiah_siap, penuh: lanjut.pelanggan.kartu.penuh, berikut: lanjut.pelanggan.kartu.berikutnya }, { s: 1, siap: 1, penuh: true, berikut: { kartu_ke: 2, isi: 1 } });
  const g = s.minta('hadiah', { sesi: s.admin, id: p.id, aroma: 'Embun', id_permintaan: s.idp() });
  assert.match(g.pesan, /Hadiah Kakak \(1 Parfum Aura gratis\) kami kirim bersama paket ini/);
  assert.deepEqual({ siap: g.pelanggan.hadiah_siap, isi: g.pelanggan.kartu.isi, ke: g.pelanggan.kartu.kartu_ke }, { siap: 0, isi: 1, ke: 2 });
  assert.throws(() => s.minta('hadiah_tunda', { sesi: s.admin, id: p.id, id_permintaan: s.idp() }), galat('BELUM_ADA_HADIAH'));
});

test('pencegah stempel ganda: nomor pesanan sama, dan jeda 10 menit tanpa nomor', () => {
  const s = siap();
  const p = s.daftar('Siti', '081200000020'), q = s.daftar('Bayu', '081200000021');
  s.minta('stempel', { sesi: s.admin, id: p.id, nomor_pesanan: 'ORD-77', id_permintaan: s.idp() });
  assert.throws(() => s.minta('stempel', { sesi: s.admin, id: p.id, nomor_pesanan: 'ORD-77', id_permintaan: s.idp() }), galat('PESANAN_GANDA'));
  assert.throws(() => s.minta('stempel', { sesi: s.admin, id: q.id, nomor_pesanan: 'ORD-77', id_permintaan: s.idp() }), galat('PESANAN_GANDA'), 'juga untuk pelanggan lain');

  assert.throws(() => s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: s.idp() }), (e) => e.kode === 'BUTUH_KONFIRMASI' && e.data.menit === 0);
  assert.equal(s.minta('stempel', { sesi: s.admin, id: p.id, konfirmasi: true, id_permintaan: s.idp() }).pelanggan.stempel, 2);
  s.maju(11 * MENIT);
  assert.equal(s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: s.idp() }).pelanggan.stempel, 3);
  // Stempel Awal lalu langsung stempel pembelian pertama: tidak perlu konfirmasi
  s.minta('stempel_awal', { sesi: s.admin, id: q.id, asal: 'Shopee', id_permintaan: s.idp() });
  assert.equal(s.minta('stempel', { sesi: s.admin, id: q.id, id_permintaan: s.idp() }).pelanggan.stempel, 2);
});

test('permintaan yang terkirim dua kali tidak menghasilkan stempel ganda', () => {
  const s = siap();
  const p = s.daftar('Putri', '081200000030');
  const idp = 'sama-persis-1';
  const a = s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: idp });
  const b = s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: idp });
  assert.equal(a.transaksi, b.transaksi);
  assert.equal(b.pelanggan.stempel, 1);
  // Cache hilang (mis. sudah lewat 6 jam): tetap tidak dobel karena dicek di buku transaksi.
  Object.keys(s.gas._cache).forEach((k) => delete s.gas._cache[k]);
  const c = s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: idp });
  assert.equal(c.ulang, true);
  assert.equal(c.pelanggan.stempel, 1);
  assert.equal(s.lembar('Transaksi').filter((r) => r[3] === 'STEMPEL').length, 1);
  // Pendaftaran ganda
  const d1 = s.minta('daftar', { sesi: s.admin, nama: 'Agus', wa: '081200000031', id_permintaan: 'daftar-1' });
  const d2 = s.minta('daftar', { sesi: s.admin, nama: 'Agus', wa: '081200000031', id_permintaan: 'daftar-1' });
  assert.equal(d1.pelanggan.id, d2.pelanggan.id);
  assert.equal(s.lembar('Pelanggan').length, 3);
});

test('batal: wajib alasan, tercatat (bukan dihapus), nomor pesanan bisa dipakai lagi', () => {
  const s = siap();
  const p = s.daftar('Dewi', '081200000040');
  assert.throws(() => s.minta('batal', { sesi: s.admin, id: p.id, alasan: 'salah orang', id_permintaan: s.idp() }), galat('TIDAK_ADA_STEMPEL'));
  s.stempel(p.id, { nomor_pesanan: 'ORD-A' });
  s.maju(JAM);
  s.stempel(p.id, { nomor_pesanan: 'ORD-B' });
  assert.throws(() => s.minta('batal', { sesi: s.admin, id: p.id, alasan: '', id_permintaan: s.idp() }), galat('ALASAN_KOSONG'));
  const b = s.minta('batal', { sesi: s.admin, id: p.id, alasan: 'pesanan dibatalkan pembeli', id_permintaan: s.idp() });
  assert.deepEqual({ s: b.pelanggan.stempel, beli: b.pelanggan.total_beli }, { s: 1, beli: 1 });
  const trx = s.minta('pelanggan', { sesi: s.admin, id: p.id }).transaksi;
  assert.deepEqual(trx.map((t) => t.jenis), ['BATAL', 'STEMPEL', 'STEMPEL', 'DAFTAR']);
  assert.equal(trx[1].batal, true, 'stempel ORD-B ditandai batal');
  assert.equal(trx[2].batal, false);
  assert.equal(trx[0].catatan, 'pesanan dibatalkan pembeli');
  // stempel terakhir mundur ke stempel ORD-A
  assert.equal(b.pelanggan.stempel_terakhir, trx[2].waktu);
  // ORD-B boleh distempel lagi
  assert.equal(s.stempel(p.id, { nomor_pesanan: 'ORD-B' }).pelanggan.stempel, 2);
});

test('batal stempel yang memenuhkan kartu; ditolak kalau hadiahnya sudah diberikan', () => {
  const s = siap();
  const p = s.daftar('Rizky', '081200000050');
  for (let i = 1; i <= 5; i++) s.stempel(p.id);
  const b = s.minta('batal', { sesi: s.admin, id: p.id, alasan: 'salah stempel', id_permintaan: s.idp() });
  assert.deepEqual({ s: b.pelanggan.stempel, siap: b.pelanggan.hadiah_siap, ke: b.pelanggan.kartu_ke, ditarik: b.hadiah_ditarik }, { s: 4, siap: 0, ke: 1, ditarik: 1 });
  s.stempel(p.id);
  s.minta('hadiah', { sesi: s.admin, id: p.id, aroma: 'Rimba', id_permintaan: s.idp() });
  assert.throws(() => s.minta('batal', { sesi: s.admin, id: p.id, alasan: 'coba batalkan', id_permintaan: s.idp() }), galat('HADIAH_SUDAH_DIBERIKAN'));
});

test('penyesuaian manual dan ubah nama', () => {
  const s = siap();
  const p = s.daftar('Nabila', '081200000060');
  assert.throws(() => s.minta('penyesuaian', { sesi: s.admin, id: p.id, delta: 2, alasan: '', id_permintaan: s.idp() }), galat('ALASAN_KOSONG'));
  const a = s.minta('penyesuaian', { sesi: s.admin, id: p.id, delta: 2, alasan: 'pindahan dari kartu kertas', id_permintaan: s.idp() });
  assert.deepEqual({ s: a.pelanggan.stempel, beli: a.pelanggan.total_beli }, { s: 2, beli: 0 });
  assert.throws(() => s.minta('penyesuaian', { sesi: s.admin, id: p.id, delta: -3, alasan: 'koreksi', id_permintaan: s.idp() }), galat('STEMPEL_KURANG'));
  const n = s.minta('ubah_nama', { sesi: s.admin, id: p.id, nama: 'nabila zahra' });
  assert.equal(n.pelanggan.nama, 'Nabila Zahra');
});

test('kartu pembeli: persetujuan dulu, tidak pernah memuat nomor utuh, ikut berubah setelah stempel', () => {
  const s = siap();
  const p = s.daftar('Rina Maharani', '081234567890');
  const token = s.token(p.id);
  assert.throws(() => s.minta('kartu', { t: 'tidak-ada' }), galat('KARTU_TIDAK_ADA'));
  assert.throws(() => s.minta('kartu', { t: 'A'.repeat(22) }), galat('KARTU_TIDAK_ADA'));
  assert.throws(() => s.minta('kartu', {}), galat('KARTU_TIDAK_ADA'));

  const awal = s.minta('kartu', { t: token });
  assert.equal(awal.butuh_persetujuan, true);
  assert.equal(awal.nama_depan, 'Rina');
  assert.equal(awal.kode, undefined, 'isi kartu belum dikirim sebelum setuju');
  assert.equal(awal.riwayat, undefined);

  const k = s.minta('setuju', { t: token });
  assert.equal(k.butuh_persetujuan, false);
  assert.equal(k.nama, 'Rina Maharani');
  assert.equal(k.no_anggota, '0001');
  assert.equal(k.wa_samar, '0812••••7890');
  assert.equal(k.wa_admin, '6281111112222');
  assert.deepEqual({ isi: k.kartu.isi, target: k.kartu.target, sisa: k.kartu.sisa }, { isi: 0, target: 5, sisa: 5 });
  const mentah = JSON.stringify(k);
  assert.ok(!mentah.includes('6281234567890') && !mentah.includes('081234567890'), 'nomor utuh tidak boleh ada di kartu');
  assert.ok(!mentah.includes(token), 'token tidak perlu dikirim balik');
  assert.equal(s.lembar('Transaksi').filter((r) => r[3] === 'PERSETUJUAN').length, 1);
  s.minta('setuju', { t: token });
  assert.equal(s.lembar('Transaksi').filter((r) => r[3] === 'PERSETUJUAN').length, 1, 'persetujuan dicatat sekali');

  s.minta('stempel_awal', { sesi: s.admin, id: p.id, asal: 'TikTok Shop', id_permintaan: s.idp() });
  const sesudah = s.minta('kartu', { t: token });
  assert.equal(sesudah.kartu.isi, 1, 'kartu langsung ikut berubah (cache dikosongkan)');
  assert.notEqual(sesudah.sidik, k.sidik);
  assert.deepEqual(sesudah.riwayat.map((x) => x.j), ['STEMPEL_AWAL', 'DAFTAR']);
  assert.equal(sesudah.riwayat[0].s, 1);
  assert.equal(sesudah.riwayat[0].i, undefined, 'ID transaksi tidak dikirim ke pembeli');
});

test('kartu pembeli: saat penuh menampilkan kartu penuh sampai hadiah diberikan', () => {
  const s = siap();
  const p = s.daftar('Bayu', '081200000070');
  const token = s.token(p.id);
  s.minta('setuju', { t: token });
  for (let i = 1; i <= 5; i++) s.stempel(p.id);
  let k = s.minta('kartu', { t: token });
  assert.deepEqual({ penuh: k.kartu.penuh, isi: k.kartu.isi, ke: k.kartu.kartu_ke, siap: k.kartu.hadiah_siap }, { penuh: true, isi: 5, ke: 1, siap: 1 });
  assert.equal(k.riwayat[0].s, 5);
  s.minta('hadiah', { sesi: s.admin, id: p.id, aroma: 'Purnama', id_permintaan: s.idp() });
  k = s.minta('kartu', { t: token });
  assert.deepEqual({ penuh: k.kartu.penuh, isi: k.kartu.isi, ke: k.kartu.kartu_ke, total: k.total_hadiah }, { penuh: false, isi: 0, ke: 2, total: 1 });
  assert.deepEqual({ j: k.riwayat[0].j, a: k.riwayat[0].a, k: k.riwayat[0].k }, { j: 'HADIAH', a: 'Purnama', k: 1 });
});

test('hapus data oleh pembeli: identitas hilang, link mati, transaksi tetap ada tanpa nama', () => {
  const s = siap();
  const p = s.daftar('Agus Setiawan', '081200000080');
  const token = s.token(p.id);
  s.minta('setuju', { t: token });
  s.stempel(p.id);
  assert.equal(s.minta('hapus_data_saya', { t: token }).dihapus, true);
  assert.throws(() => s.minta('kartu', { t: token }), galat('KARTU_TIDAK_ADA'));
  assert.throws(() => s.minta('stempel', { sesi: s.admin, id: p.id, id_permintaan: s.idp() }), galat('PELANGGAN_TIDAK_ADA'));
  const baris = s.lembar('Pelanggan').find((r) => r[0] === p.id);
  assert.deepEqual({ nama: baris[2], wa: baris[3], token: baris[5], status: baris[15], riwayat: baris[16] }, { nama: '(dihapus)', wa: '', token: '', status: 'dihapus', riwayat: '' });
  assert.ok(!JSON.stringify(s.lembar('Pelanggan')).includes('Agus'));
  assert.ok(!JSON.stringify(s.lembar('Transaksi')).includes('81200000080'));
  assert.equal(s.lembar('Transaksi').filter((r) => r[2] === p.id).length, 4, 'DAFTAR, PERSETUJUAN, STEMPEL, HAPUS_DATA tetap tercatat');
  assert.equal(s.minta('cari', { sesi: s.admin, q: 'agus' }).hasil.length, 0);
  // Nomor yang sama boleh daftar lagi sebagai kartu baru
  const baru = s.daftar('Agus Setiawan', '081200000080');
  assert.notEqual(baru.id, p.id);
  // Hapus oleh admin butuh ketik HAPUS
  assert.throws(() => s.minta('hapus_pelanggan', { sesi: s.admin, id: baru.id, id_permintaan: s.idp() }), galat('BUTUH_KONFIRMASI'));
  assert.equal(s.minta('hapus_pelanggan', { sesi: s.admin, id: baru.id, konfirmasi: 'HAPUS', id_permintaan: s.idp() }).dihapus, true);
});

test('cari: nomor (berbagai bentuk), kode kartu, nama', () => {
  const s = siap();
  const a = s.daftar('Rina Maharani', '081234567890'), b = s.daftar('Rina Wulandari', '081298765432'), c = s.daftar('Dimas', '+60123456789');
  const cari = (q) => s.minta('cari', { sesi: s.admin, q });
  assert.deepEqual(cari('0812 3456 7890').hasil.map((x) => x.id), [a.id]);
  assert.deepEqual(cari('+6281234567890').hasil.map((x) => x.id), [a.id]);
  assert.deepEqual(cari('7890').hasil.map((x) => x.id), [a.id], 'sebagian nomor');
  assert.deepEqual(cari(b.kode.toLowerCase().replace('-', ' ')).hasil.map((x) => x.id), [b.id]);
  assert.deepEqual(cari('rina').hasil.map((x) => x.id).sort(), [a.id, b.id].sort());
  assert.deepEqual(cari('+60123456789').hasil.map((x) => x.id), [c.id]);
  const kosong = cari('0813-0000-9999');
  assert.equal(kosong.hasil.length, 0);
  assert.equal(kosong.wa_normal, '6281300009999', 'nomor sah yang belum terdaftar bisa langsung dibuatkan kartu');
  assert.equal(cari('').terbaru, true);
  assert.equal(cari('').hasil[0].id, c.id);
});

test('pengaturan: simpan, jeda program, target diturunkan, per botol', () => {
  const s = siap();
  const p = s.daftar('Intan', '081200000090');
  for (let i = 1; i <= 4; i++) s.stempel(p.id);
  assert.throws(() => s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { target_stempel: 1 } }), galat('PENGATURAN_SALAH'));
  assert.throws(() => s.minta('pengaturan_simpan', { sesi: s.admin, ubah: { target_stempel: 3 } }), galat('BUKAN_OWNER'));

  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { program_aktif: 'tidak' } });
  assert.throws(() => s.stempel(p.id), galat('PROGRAM_JEDA'));
  assert.equal(s.minta('kartu', { t: s.token(p.id) }).aktif, false);
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { program_aktif: 'ya' } });

  const r = s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { target_stempel: 3, teks_hadiah: '1 Parfum Aura 30 ml gratis' } });
  assert.equal(r.dirapikan, 1);
  const d = s.minta('pelanggan', { sesi: s.admin, id: p.id });
  assert.deepEqual({ s: d.pelanggan.stempel, siap: d.pelanggan.hadiah_siap, ke: d.pelanggan.kartu_ke }, { s: 1, siap: 1, ke: 2 });
  assert.match(d.transaksi[0].catatan, /diubah dari 5 ke 3/);
  assert.equal(s.minta('info', { sesi: s.admin }).target, 3);

  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { aturan_stempel: 'botol', target_stempel: 5 } });
  const q = s.daftar('Yoga', '081200000091');
  const h = s.stempel(q.id, { jumlah: 7, nomor_pesanan: 'ORD-BOTOL' });
  assert.deepEqual({ s: h.pelanggan.stempel, siap: h.pelanggan.hadiah_siap, beli: h.pelanggan.total_beli, penuh: h.kartu_penuh }, { s: 2, siap: 1, beli: 1, penuh: true });

  const baca = s.minta('pengaturan_baca', { sesi: s.owner });
  assert.equal(baca.pengaturan.teks_hadiah, '1 Parfum Aura 30 ml gratis');
  assert.match(baca.kunci_api, /^[A-Za-z0-9]{40}$/);
  assert.deepEqual(baca.admin.map((a) => a.nama), ['Owner', 'Mira']);
});

test('masa berlaku stempel: hangus tercatat lewat tugas harian', () => {
  const s = siap();
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { masa_berlaku_bulan: 3 } });
  const p = s.daftar('Melati', '081200000100');
  const token = s.token(p.id);
  s.minta('setuju', { t: token });
  s.stempel(p.id); s.maju(JAM); s.stempel(p.id);
  s.maju(80 * HARI);
  assert.equal(s.minta('kartu', { t: token }).kartu.isi, 2);
  s.maju(20 * HARI);
  const k = s.minta('kartu', { t: token });
  assert.deepEqual({ isi: k.kartu.isi, hangus: k.hangus }, { isi: 0, hangus: true });
  s.ctx.tugasHarian();
  const sesi = s.minta('masuk', { nama: 'Mira', pin: '905317' }).sesi;
  const d = s.minta('pelanggan', { sesi, id: p.id });
  assert.equal(d.pelanggan.stempel, 0);
  assert.deepEqual({ j: d.transaksi[0].jenis, n: d.transaksi[0].jumlah, admin: d.transaksi[0].admin }, { j: 'PENYESUAIAN', n: -2, admin: 'sistem' });
  assert.match(d.transaksi[0].catatan, /Hangus: 3 bulan/);
});

test('pintu otomatis (n8n/Laura): mati secara bawaan, butuh kunci, aman dipanggil ulang', () => {
  const s = siap();
  const kunci = s.minta('pengaturan_baca', { sesi: s.owner }).kunci_api;
  assert.throws(() => s.minta('otomatis_stempel', { kunci, wa: '081255550001', nama: 'Hendra', nomor_pesanan: 'ORD-9001' }), galat('OTOMATIS_MATI'));
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { otomatis_aktif: 'ya' } });
  assert.throws(() => s.minta('otomatis_stempel', { kunci: 'salah', wa: '081255550001', nomor_pesanan: 'ORD-9001' }), galat('KUNCI_SALAH'));
  assert.throws(() => s.minta('otomatis_stempel', { wa: '081255550001', nomor_pesanan: 'ORD-9001' }), galat('KUNCI_SALAH'));
  assert.throws(() => s.minta('otomatis_stempel', { kunci, wa: '081255550001' }), galat('NOMOR_PESANAN_KOSONG'));

  assert.equal(s.minta('otomatis_kartu', { kunci, wa: '081255550001' }).ada, false);
  const a = s.minta('otomatis_stempel', { kunci, wa: '0812-5555-0001', nama: 'hendra wijaya', nomor_pesanan: 'ORD-9001' });
  assert.deepEqual({ baru: a.baru, sudah: a.sudah, stempel: a.stempel, sisa: a.sisa, nama: a.nama }, { baru: true, sudah: false, stempel: 1, sisa: 4, nama: 'Hendra Wijaya' });
  assert.match(a.pesan, /Stempel ke-1 sudah masuk, Kak Hendra/);
  assert.match(a.tautan, /^https:\/\/apb\.example\/kartu\/#/);
  const b = s.minta('otomatis_stempel', { kunci, wa: '081255550001', nama: 'Hendra', nomor_pesanan: 'ORD-9001' });
  assert.deepEqual({ sudah: b.sudah, stempel: b.stempel }, { sudah: true, stempel: 1 });
  const c = s.minta('otomatis_stempel_awal', { kunci, wa: '081255550001', asal: 'TikTok Shop' });
  assert.deepEqual({ sudah: c.sudah, stempel: c.stempel }, { sudah: false, stempel: 2 });
  assert.equal(s.minta('otomatis_stempel_awal', { kunci, wa: '081255550001', asal: 'TikTok Shop' }).sudah, true);
  for (let i = 2; i <= 4; i++) s.minta('otomatis_stempel', { kunci, wa: '081255550001', nomor_pesanan: 'ORD-900' + i });
  const k = s.minta('otomatis_kartu', { kunci, wa: '081255550001' });
  assert.deepEqual({ ada: k.ada, penuh: k.kartu_penuh, siap: k.hadiah_siap, stempel: k.stempel }, { ada: true, penuh: true, siap: 1, stempel: 5 });
  const t = s.lembar('Transaksi').filter((r) => r[3] === 'STEMPEL');
  assert.ok(t.every((r) => r[10] === 'otomatis' && r[9] === 'laura'));
  s.minta('kunci_api_baru', { sesi: s.owner });
  assert.throws(() => s.minta('otomatis_kartu', { kunci, wa: '081255550001' }), galat('KUNCI_SALAH'));
});

test('ringkasan, daftar pelanggan, aktivitas, dan tab Ringkasan memakai angka yang sama', () => {
  const s = siap();
  const a = s.daftar('Ayu', '081200000201'), b = s.daftar('Budi', '081200000202'), c = s.daftar('Citra', '081200000203');
  s.minta('stempel_awal', { sesi: s.admin, id: a.id, asal: 'TikTok Shop', id_permintaan: s.idp() });
  s.minta('stempel_awal', { sesi: s.admin, id: b.id, asal: 'TikTok Shop', id_permintaan: s.idp() });
  for (let i = 0; i < 3; i++) { s.maju(JAM); s.stempel(a.id); }
  for (let i = 0; i < 5; i++) { s.maju(JAM); s.stempel(c.id); }
  s.maju(70 * HARI);
  const sesiOwner = s.minta('masuk', { nama: 'Owner', pin: '482915' }).sesi;
  const sesiAdmin = s.minta('masuk', { nama: 'Mira', pin: '905317' }).sesi;
  s.minta('stempel', { sesi: sesiAdmin, id: b.id, id_permintaan: s.idp() });
  s.minta('batal', { sesi: sesiAdmin, id: b.id, alasan: 'salah pelanggan', id_permintaan: s.idp() });

  const r = s.minta('ringkasan', { sesi: sesiOwner });
  assert.deepEqual({ pemegang: r.pemegang_kartu, baru7: r.kartu_baru_7, beli7: r.stempel_beli_7, total: r.stempel_beli_total, wa: r.pembeli_wa, ulang: r.pembeli_ulang, keluar: r.hadiah_keluar, tunda: r.hadiah_tunda },
    { pemegang: 3, baru7: 0, beli7: 0, total: 8, wa: 2, ulang: 2, keluar: 0, tunda: 1 });
  assert.deepEqual(r.tinggal_satu.map((x) => x.nama), ['Ayu']);
  assert.deepEqual(r.lama_tidak_beli.map((x) => x.nama).sort(), ['Ayu', 'Citra']);
  assert.deepEqual(r.asal['TikTok Shop'], { jumlah: 2, lanjut_beli: 1 });

  const d = s.minta('daftar_pelanggan', { sesi: sesiAdmin, saring: 'semua' });
  assert.deepEqual(d.hitung, { semua: 3, tinggal_satu: 1, hadiah_tunda: 1, lama_tidak_beli: 2, belum_beli: 1 });
  assert.deepEqual(s.minta('daftar_pelanggan', { sesi: sesiAdmin, saring: 'hadiah_tunda' }).baris.map((x) => x.nama), ['Citra']);
  assert.deepEqual(s.minta('daftar_pelanggan', { sesi: sesiAdmin, saring: 'semua', urut: 'nama' }).baris.map((x) => x.nama), ['Ayu', 'Budi', 'Citra']);
  assert.deepEqual(s.minta('daftar_pelanggan', { sesi: sesiAdmin, q: '0202' }).baris.map((x) => x.nama), ['Budi']);

  const akt = s.minta('aktivitas', { sesi: sesiAdmin });
  assert.equal(akt.baris[0].jenis, 'BATAL');
  assert.equal(akt.baris[0].nama, 'Budi');
  assert.equal(akt.baris[1].batal, true);
  assert.equal(akt.total, 3 + 2 + 8 + 1 + 1, 'DAFTAR×3, STEMPEL_AWAL×2, STEMPEL×9 (1 dibatalkan), BATAL×1');
  assert.equal(s.minta('aktivitas', { sesi: sesiAdmin, jenis: 'STEMPEL_AWAL' }).total, 2);
  assert.equal(s.minta('aktivitas', { sesi: sesiAdmin, dari: '2026-11-05', sampai: '2026-11-05' }).total, 5 + 8, 'hari pertama: 3 daftar, 2 stempel awal, 8 stempel');

  // Tab Ringkasan di spreadsheet
  s.ctx.tugasHarian();
  const tab = s.lembar('Ringkasan');
  const nilai = (label) => tab.find((row) => row[0] === label)[1];
  assert.equal(nilai('Pemegang kartu aktif'), 3);
  assert.equal(nilai('Pelanggan yang beli lewat WhatsApp 2 kali atau lebih'), 2);
  assert.equal(nilai('Hadiah yang masih ditunda'), 1);
  assert.equal(nilai('Pelanggan tinggal 1 stempel'), 1);
  assert.deepEqual(tab.find((row) => row[0] === 'TikTok Shop').slice(0, 3), ['TikTok Shop', 2, 1]);
  assert.equal(tab[1][4], 'Ayu', 'daftar "Tinggal 1 stempel" di kolom E');
  assert.equal(tab[1][5], '0812-0000-0201');
});

test('periksa saldo: baris pelanggan yang diubah tangan dikembalikan sesuai buku transaksi', () => {
  const s = siap();
  const p = s.daftar('Laras', '081200000300');
  s.stempel(p.id); s.maju(JAM); s.stempel(p.id);
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0);
  const lembar = s.gas._buku.getSheetByName('Pelanggan');
  lembar._nilai[1][7] = 4; // seseorang mengetik 4 di kolom "Stempel saat ini"
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 1);
  assert.equal(s.minta('pelanggan', { sesi: s.admin, id: p.id }).pelanggan.stempel, 2);
});

test('data contoh: 50 pelanggan bertanda CONTOH, konsisten, bisa dihapus tanpa menyentuh data asli', () => {
  const s = siap();
  const asli = s.daftar('Pelanggan Asli', '081200000400');
  s.stempel(asli.id);
  assert.equal(s.minta('isi_contoh', { sesi: s.owner }).ditambah, 50);
  assert.equal(s.lembar('Pelanggan').length, 1 + 1 + 50);
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0, 'saldo contoh cocok dengan buku transaksinya');
  const r = s.minta('ringkasan', { sesi: s.owner });
  assert.equal(r.pemegang_kartu, 51);
  assert.equal(r.ada_contoh, true);
  assert.ok(r.hadiah_keluar >= 1, 'ada kartu contoh yang sudah penuh');
  assert.ok(r.asal['TikTok Shop'].jumlah > r.asal['Shopee'].jumlah);
  assert.ok(r.mingguan.reduce((a, b) => a + b.stempel, 0) > 20);
  // urutan waktu buku transaksi tidak mundur per pelanggan
  const perPelanggan = {};
  for (const t of s.lembar('Transaksi').slice(1)) { (perPelanggan[t[2]] = perPelanggan[t[2]] || []).push(t[1].getTime()); }
  for (const w of Object.values(perPelanggan)) for (let i = 1; i < w.length; i++) assert.ok(w[i] >= w[i - 1]);
  assert.equal(s.minta('isi_contoh', { sesi: s.owner }).ditambah, 0, 'tidak menggandakan contoh');

  // kartu contoh bisa dibuka
  const contoh = s.lembar('Pelanggan').find((row) => row[17] === 'CONTOH' && row[13] !== '' && row[13] !== undefined);
  const kartu = s.minta('kartu', { t: contoh[5] });
  assert.equal(kartu.butuh_persetujuan, false);

  const hapus = s.minta('hapus_contoh', { sesi: s.owner });
  assert.ok(hapus.dihapus > 100);
  assert.equal(s.lembar('Pelanggan').length, 2);
  assert.deepEqual(s.lembar('Transaksi').slice(1).map((t) => t[3]), ['DAFTAR', 'STEMPEL']);
  assert.equal(s.minta('pelanggan', { sesi: s.admin, id: asli.id }).pelanggan.stempel, 1);
  assert.equal(s.minta('ringkasan', { sesi: s.owner }).ada_contoh, false);
});

test('ujiCepat (tes di spreadsheet sungguhan) lulus dan membersihkan barisnya', () => {
  const s = siap();
  const asli = s.daftar('Pelanggan Asli', '081200000500');
  const hasil = s.ctx.ujiCepat();
  assert.match(hasil, /SEMUA TES LULUS/, hasil);
  assert.ok(!/GAGAL/.test(hasil), hasil);
  assert.equal(s.lembar('Pelanggan').length, 2, 'baris uji dibersihkan');
  assert.equal(s.lembar('Transaksi').length, 2);
  assert.equal(s.minta('pelanggan', { sesi: s.admin, id: asli.id }).pelanggan.nama, 'Pelanggan Asli');
});

test('melewati 1.000 baris: lembar otomatis diperpanjang', () => {
  const s = siap();
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { otomatis_aktif: 'ya' } });
  const kunci = s.minta('pengaturan_baca', { sesi: s.owner }).kunci_api;
  for (let i = 0; i < 620; i++) s.minta('otomatis_stempel', { kunci, wa: '0813' + String(10000000 + i), nama: 'Pelanggan ' + i, nomor_pesanan: 'BANYAK-' + i });
  assert.equal(s.lembar('Pelanggan').length, 621);
  assert.equal(s.lembar('Transaksi').length, 1241);
  assert.ok(s.gas._buku.getSheetByName('Transaksi').getMaxRows() >= 1241);
  const akhir = s.minta('otomatis_kartu', { kunci, wa: '081310000619' });
  assert.deepEqual({ stempel: akhir.stempel, nama: akhir.nama }, { stempel: 1, nama: 'Pelanggan 619' });
  assert.equal(s.minta('cari', { sesi: s.admin, q: '081310000000' }).hasil[0].nama, 'Pelanggan 0');
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0);
});

test('permintaan aneh ditolak dengan rapi', () => {
  const s = siap();
  const mentah = (isi) => JSON.parse(s.ctx.doPost({ postData: { contents: isi } }).getContent());
  assert.equal(mentah('bukan json').kode, 'PERMINTAAN_SALAH');
  assert.equal(mentah('null').kode, 'PERMINTAAN_SALAH');
  assert.equal(mentah('{"aksi":"__proto__"}').kode, 'AKSI_TIDAK_DIKENAL');
  assert.equal(mentah('{"aksi":"constructor"}').kode, 'AKSI_TIDAK_DIKENAL');
  assert.equal(mentah(JSON.stringify({ aksi: 'kartu', t: 'x'.repeat(30000) })).kode, 'TERLALU_BESAR');
  assert.equal(JSON.parse(s.ctx.doPost(undefined).getContent()).kode, 'PERMINTAAN_SALAH');
  const tanpaTab = serverBaru();
  assert.equal(tanpaTab.panggil('daftar_admin').kode, 'BELUM_DIPASANG');
});

test('ubah nomor WhatsApp: kartu dan stempel tetap, tercatat tanpa nomor utuh, nomor yang sudah dipakai ditolak', () => {
  const s = siap();
  const a = s.daftar('Rina', '0812-3456-7890'), b = s.daftar('Dimas', '0813-0000-1111');
  s.stempel(a.id, { nomor_pesanan: 'ORD-1' });
  const tokenLama = s.token(a.id);
  assert.throws(() => s.minta('ubah_pelanggan', { sesi: s.admin, id: a.id, wa: '0813-0000-1111' }), galat('WA_SUDAH_DIPAKAI'));
  assert.throws(() => s.minta('ubah_pelanggan', { sesi: s.admin, id: a.id, wa: '123' }), galat('WA_TIDAK_SAH'));
  assert.throws(() => s.minta('ubah_pelanggan', { sesi: s.admin, id: a.id }), galat('PERMINTAAN_SALAH'));

  const r = s.minta('ubah_pelanggan', { sesi: s.admin, id: a.id, wa: '0857 9999 0000', nama: 'rina maharani' });
  assert.equal(r.pelanggan.wa, '6285799990000');
  assert.equal(r.pelanggan.nama, 'Rina Maharani');
  assert.equal(r.pelanggan.stempel, 1);
  assert.equal(s.token(a.id), tokenLama, 'link kartu tidak berubah');
  assert.equal(s.lembar('Pelanggan').find((x) => x[0] === a.id)[3], '6285799990000', 'nomor baru tersimpan sebagai teks');
  assert.equal(s.minta('cari', { sesi: s.admin, q: '0857 9999 0000' }).hasil[0].id, a.id);
  assert.equal(s.minta('cari', { sesi: s.admin, q: '0812-3456-7890' }).hasil.length, 0);

  // Buku transaksi mencatat penggantian, tetapi tidak pernah memuat nomor utuh.
  const trx = s.lembar('Transaksi'), akhir = trx[trx.length - 1];
  assert.equal(akhir[3], 'PENYESUAIAN');
  assert.match(String(akhir[8]), /0812••••7890 ke 0857••••0000/);
  assert.equal(akhir[9], 'Mira');
  assert.ok(!/81234567890|85799990000/.test(JSON.stringify(trx)));
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0, 'penggantian nomor tidak mengubah saldo');

  // Nomor yang sama dengan yang sekarang: tidak dicatat sebagai penggantian.
  const jumlahBaris = s.lembar('Transaksi').length;
  s.minta('ubah_pelanggan', { sesi: s.admin, id: a.id, wa: '0857-9999-0000' });
  assert.equal(s.lembar('Transaksi').length, jumlahBaris);

  // Aksi lama "ubah_nama" tetap berlaku.
  assert.equal(s.minta('ubah_nama', { sesi: s.admin, id: b.id, nama: 'dimas pratama' }).pelanggan.nama, 'Dimas Pratama');
  // Kartu pembeli ikut memakai nama baru dan nomor baru (disamarkan).
  s.minta('setuju', { t: tokenLama });
  const kartu = s.minta('kartu', { t: tokenLama });
  assert.equal(kartu.nama, 'Rina Maharani');
  assert.equal(kartu.wa_samar, '0857••••0000');
});

test('resetPinOwner: PIN Owner kembali ke PIN awal, wajib diganti, admin lain tidak tersentuh', () => {
  const s = siap();
  assert.match(s.ctx.resetPinOwner(), /Owner.*123456/);
  assert.throws(() => s.minta('info', { sesi: s.owner }), galat('SESI_HABIS'));
  const m = s.minta('masuk', { nama: 'Owner', pin: '123456' });
  assert.equal(m.wajib_ganti_pin, true);
  assert.equal(s.minta('info', { sesi: s.admin }).admin.nama, 'Mira');
});

test('tiruan: kunci tidak boleh dilepas sebelum tulisan di-flush (aturan Apps Script)', () => {
  const g = buatTiruanGas();
  const l = g._buku.insertSheet('X');
  const k = g.LockService.getScriptLock();
  k.tryLock(1000);
  l.getRange(1, 1).setValue('a');
  assert.throws(() => k.releaseLock(), /belum di-flush/);
  g.SpreadsheetApp.flush();
  k.releaseLock();
  assert.equal(k.hasLock(), false);
});

test('skrip berdiri sendiri: pasang membuat spreadsheet sendiri satu kali, lalu semuanya jalan tanpa sheet aktif', () => {
  const s = muatServer({ diam: true, waktu: '2026-11-05T03:00:00Z', tiruan: { berdiriSendiri: true } });
  const status = () => JSON.parse(s.jalankan('doGet').getContent()).data;

  // Sebelum "pasang": tidak ada spreadsheet, dan server mengatakannya dengan jelas.
  assert.deepEqual(status(), { layanan: 'Kartu Aura', versi: s.ctx.VERSI, buku: false, terpasang: false });
  assert.throws(() => s.minta('daftar_admin'), galat('BELUM_DIPASANG'));
  assert.equal(s.gas._catatan.dibuat, 0, 'permintaan dari luar tidak pernah membuat spreadsheet');

  const pesan = s.jalankan('pasang');
  assert.match(pesan, /Spreadsheet data baru dibuat/);
  assert.match(pesan, /Spreadsheet data: https:\/\/docs\.google\.com\/spreadsheets\/d\/buku-tiruan\/edit/);
  assert.match(pesan, /nama "Owner", PIN 123456/);
  assert.equal(s.gas._catatan.dibuat, 1);
  assert.equal(s.gas._buku.getName(), 'Kartu Aura - Data');
  assert.equal(s.gas._properti.ID_BUKU, 'buku-tiruan');
  assert.deepEqual(s.gas._buku.getSheets().map((l) => l.getName()), ['Ringkasan', 'Pelanggan', 'Transaksi', 'Admin', 'Pengaturan']);
  const pemicu = () => s.gas.ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction() + ':' + t._jenis).sort();
  assert.deepEqual(pemicu(), ['saatDibuka:buka', 'tugasHarian:waktu']);
  assert.deepEqual(status(), { layanan: 'Kartu Aura', versi: s.ctx.VERSI, buku: true, terpasang: true });

  // Dijalankan lagi: tidak membuat spreadsheet kedua, tidak menggandakan apa pun.
  const lagi = s.jalankan('pasang');
  assert.doesNotMatch(lagi, /baru dibuat/);
  assert.match(lagi, /Tab sudah lengkap/);
  assert.equal(s.gas._catatan.dibuat, 1);
  assert.deepEqual(pemicu(), ['saatDibuka:buka', 'tugasHarian:waktu']);
  assert.equal(s.lembar('Admin').length, 2);

  // Nomor WhatsApp bawaan adalah nomor Laura, dan sudah dalam bentuk yang dipakai tautan wa.me.
  const m = s.minta('masuk', { nama: 'Owner', pin: '123456' });
  const owner = s.minta('ganti_pin', { sesi: m.sesi, pin_lama: '123456', pin_baru: '482915' }).sesi;
  const atur = s.minta('pengaturan_baca', { sesi: owner });
  assert.equal(atur.pengaturan.wa_admin, '6285121812007');
  assert.equal(atur.url_buku, 'https://docs.google.com/spreadsheets/d/buku-tiruan/edit');
  assert.equal(s.lembar('Pengaturan').find((r) => r[0] === 'wa_admin')[1], '085121812007', 'di sheet tersimpan sebagai teks, angka nol depannya utuh');

  // Alur harian, tugas terjadwal, dan pemicu "saat dibuka" jalan tanpa sheet aktif.
  s.minta('pengaturan_simpan', { sesi: owner, ubah: { url_kartu: 'https://apb.example/kartu/' } });
  const p = s.minta('daftar', { sesi: owner, nama: 'Rina', wa: '0812-3456-7890', id_permintaan: 'a1' }).pelanggan;
  assert.equal(s.minta('stempel', { sesi: owner, id: p.id, nomor_pesanan: 'ORD-1', id_permintaan: 'a2' }).pelanggan.stempel, 1);
  const token = s.lembar('Pelanggan').find((r) => r[0] === p.id)[5];
  s.minta('setuju', { t: token });
  assert.equal(s.minta('kartu', { t: token }).wa_admin, '6285121812007');
  s.jalankan('tugasHarian');
  s.jalankan('saatDibuka');
  assert.match(s.jalankan('ujiCepat'), /SEMUA TES LULUS/);
  assert.equal(s.minta('pelanggan', { sesi: owner, id: p.id }).pelanggan.stempel, 1);

  // Lupa PIN Owner: dijalankan dari editor, sama seperti "pasang".
  assert.match(s.jalankan('resetPinOwner'), /dikembalikan ke 123456/);
  assert.throws(() => s.minta('info', { sesi: owner }), galat('SESI_HABIS'));
  assert.equal(s.minta('masuk', { nama: 'Owner', pin: '123456' }).wajib_ganti_pin, true);
});

test('tab bawaan yang kosong dibuang: apa pun namanya di spreadsheet buatan sendiri, hanya yang bernama bawaan di sheet milik orang', () => {
  const tab = (s) => s.gas._buku.getSheets().map((l) => l.getName());
  const lima = ['Ringkasan', 'Pelanggan', 'Transaksi', 'Admin', 'Pengaturan'];

  const a = muatServer({ diam: true, tiruan: { berdiriSendiri: true, tabBawaan: 'Hoja 1' } });
  a.ctx.pasang();
  assert.deepEqual(tab(a), lima);

  // Menempel di sheet milik orang: tab lain tidak disentuh, walau kosong.
  const b = muatServer({ diam: true, tiruan: { berdiriSendiri: false, tabBawaan: 'Catatan Owner' } });
  b.ctx.pasang();
  assert.deepEqual(tab(b), ['Ringkasan', 'Catatan Owner', 'Pelanggan', 'Transaksi', 'Admin', 'Pengaturan']);

  // Tab bawaan yang sudah diisi orang tidak dibuang.
  const c = muatServer({ diam: true, tiruan: { berdiriSendiri: false } });
  c.gas._buku.getSheetByName('Sheet1').getRange(1, 1).setValue('catatan');
  c.ctx.pasang();
  assert.ok(tab(c).includes('Sheet1'));
});

test('skrip berdiri sendiri: spreadsheet tidak bisa dibuka → pesan jelas, dan "pasang" tidak diam-diam membuat yang baru', () => {
  const s = siap({ tiruan: { berdiriSendiri: true } });
  const status = () => JSON.parse(s.jalankan('doGet').getContent()).data;
  const a = s.daftar('Rina', '0812-3456-7890');
  s.stempel(a.id, { nomor_pesanan: 'ORD-1' });

  s.gas._mode.bukuHilang = true; s.ctx.BUKU_ = null;
  s.maju(3 * MENIT);   // biarkan simpanan cache habis, supaya server benar-benar harus membuka sheet
  assert.throws(() => s.minta('daftar_admin'), galat('BUKU_TIDAK_TERJANGKAU'));
  assert.deepEqual(status(), { layanan: 'Kartu Aura', versi: s.ctx.VERSI, buku: false, terpasang: false });
  assert.throws(() => s.jalankan('pasang'), galat('BUKU_TIDAK_TERJANGKAU'));
  assert.equal(s.gas._catatan.dibuat, 1, 'tidak ada spreadsheet kedua');
  assert.ok(s.gas._catatan.tidur >= 400, 'gangguan sesaat dicoba sekali lagi dulu');

  // Begitu bisa dibuka lagi, datanya masih di sana.
  s.gas._mode.bukuHilang = false; s.ctx.BUKU_ = null;
  assert.equal(status().terpasang, true);
  assert.equal(s.minta('pelanggan', { sesi: s.admin, id: a.id }).pelanggan.stempel, 1);
});

test('skrip menempel di sheet (cara lama): tidak membuat spreadsheet, tetap jalan di web app dan di onOpen', () => {
  const s = siap({ tiruan: { berdiriSendiri: false } });
  const status = () => JSON.parse(s.jalankan('doGet').getContent()).data;
  assert.equal(s.gas._catatan.dibuat, 0);
  assert.equal(s.gas._properti.ID_BUKU, 'buku-tiruan');
  assert.deepEqual(s.gas.ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction()), ['tugasHarian'], 'onOpen bawaan sudah cukup, tidak perlu pemicu tambahan');

  // Di web app, getActiveSpreadsheet() bisa kosong. Sekarang tidak masalah: dibuka lewat ID yang disimpan "pasang".
  s.gas._mode.tanpaAktif = true; s.ctx.BUKU_ = null;
  s.maju(3 * MENIT);
  assert.deepEqual(s.minta('daftar_admin').admin, ['Owner', 'Mira']);
  assert.deepEqual(status(), { layanan: 'Kartu Aura', versi: s.ctx.VERSI, buku: true, terpasang: true });
  const a = s.daftar('Rina', '0812-3456-7890');
  assert.equal(s.stempel(a.id, { nomor_pesanan: 'ORD-1' }).pelanggan.stempel, 1);

  // onOpen berjalan dengan izin terbatas: openById ditolak, tetapi sheet tempat skrip menempel tetap boleh.
  s.gas._mode.tanpaAktif = false; s.gas._mode.izinPenuh = false; s.ctx.BUKU_ = null;
  const tidur = s.gas._catatan.tidur;
  s.jalankan('onOpen');
  assert.equal(s.ctx.buku_(), s.gas._buku);
  assert.equal(s.gas._catatan.tidur, tidur, 'tidak perlu mencoba openById sama sekali');

  // Dua-duanya tertutup (izin terbatas dan tanpa sheet aktif): pesannya jelas, tidak ada yang rusak.
  s.gas._mode.tanpaAktif = true; s.ctx.BUKU_ = null;
  s.maju(3 * MENIT);
  assert.throws(() => s.minta('daftar_admin'), galat('BUKU_TIDAK_TERJANGKAU'));
  assert.equal(status().buku, false);
});

test('perawatan dari Meja Stempel (pengganti menu spreadsheet): tes sistem dan periksa saldo, khusus Owner', () => {
  const s = siap({ tiruan: { berdiriSendiri: true } });
  const a = s.daftar('Rina', '0812-3456-7890');
  s.stempel(a.id, { nomor_pesanan: 'ORD-1' });
  assert.throws(() => s.minta('tes_sistem', { sesi: s.admin }), galat('BUKAN_OWNER'));
  assert.throws(() => s.minta('periksa_saldo', { sesi: s.admin }), galat('BUKAN_OWNER'));

  const barisT = s.lembar('Transaksi').length, barisP = s.lembar('Pelanggan').length;
  const tes = s.minta('tes_sistem', { sesi: s.owner });
  assert.match(tes.hasil, /SEMUA TES LULUS/);
  assert.doesNotMatch(tes.hasil, /GAGAL|BERHENTI/);
  assert.equal(s.lembar('Transaksi').length, barisT, 'baris uji dibersihkan');
  assert.equal(s.lembar('Pelanggan').length, barisP);

  assert.equal(s.minta('periksa_saldo', { sesi: s.owner }).diperbaiki, 0);
  // Seseorang mengubah angka stempel langsung di sheet.
  const l = s.gas._buku.getSheetByName('Pelanggan');
  const baris = l._nilai.findIndex((r) => r && r[0] === a.id);
  l._nilai[baris][s.ctx.KOLOM.PELANGGAN.indexOf('stempel')] = 4;
  s.maju(3 * MENIT);
  assert.equal(s.minta('periksa_saldo', { sesi: s.owner }).diperbaiki, 1);
  assert.equal(s.minta('pelanggan', { sesi: s.admin, id: a.id }).pelanggan.stempel, 1);
});

test('tab Transaksi diurutkan orang: saldo tidak rusak, batal tetap mengenai stempel yang terakhir', () => {
  const s = siap();
  const a = s.daftar('Rina', '0812-3456-7890');
  s.minta('stempel_awal', { sesi: s.admin, id: a.id, asal: 'TikTok Shop', id_permintaan: s.idp() });
  s.maju(JAM); s.stempel(a.id, { nomor_pesanan: 'ORD-1' });
  s.maju(JAM); const kedua = s.stempel(a.id, { nomor_pesanan: 'ORD-2' });
  const b = s.daftar('Dimas', '0813-0000-1111');
  s.maju(JAM); s.stempel(b.id, { nomor_pesanan: 'ORD-3' });

  // Seseorang mengurutkan tab Transaksi "terbaru di atas".
  const l = s.gas._buku.getSheetByName('Transaksi');
  const isi = l._nilai.slice(1).filter((r) => r && r[0] !== '' && r[0] !== undefined);
  l._nilai = [l._nilai[0]].concat(isi.slice().reverse());

  s.ctx.tugasHarian();   // pemeriksaan saldo harian
  const lihat = (id) => s.minta('pelanggan', { sesi: s.admin, id });
  assert.equal(lihat(a.id).pelanggan.stempel, 3);
  assert.equal(lihat(a.id).pelanggan.asal_awal, 'TikTok Shop');
  assert.equal(lihat(b.id).pelanggan.stempel, 1);
  assert.deepEqual(lihat(a.id).transaksi.map((t) => t.jenis), ['STEMPEL', 'STEMPEL', 'STEMPEL_AWAL', 'DAFTAR'], 'riwayat tetap urut waktu, terbaru dulu');

  const batal = s.minta('batal', { sesi: s.admin, id: a.id, alasan: 'uji urutan', id_permintaan: s.idp() });
  assert.equal(batal.pelanggan.stempel, 2);
  const barisBatal = lihat(a.id).transaksi.find((t) => t.jenis === 'BATAL');
  assert.equal(barisBatal.ref, kedua.transaksi, 'yang dibatalkan ORD-2, bukan stempel awal');
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0);

  // Kartu yang dibuat dan distempel dalam satu permintaan (jalur otomatis): dua barisnya tetap berbeda waktu,
  // jadi urutannya tetap pasti walau tab diurutkan menurut kolom lain.
  s.minta('pengaturan_simpan', { sesi: s.owner, ubah: { otomatis_aktif: 'ya' } });
  const kunci = s.minta('pengaturan_baca', { sesi: s.owner }).kunci_api;
  const o = s.minta('otomatis_stempel', { kunci, wa: '0857-1111-2222', nama: 'Sari', nomor_pesanan: 'ORD-9' });
  const dua = s.lembar('Transaksi').filter((r) => r[2] === o.id);
  assert.deepEqual(dua.map((r) => r[3]), ['DAFTAR', 'STEMPEL']);
  assert.ok(dua[1][1].getTime() - dua[0][1].getTime() >= 1000, 'selisih waktu minimal 1 detik');
  const semua = l._nilai.slice(1).filter((r) => r && r[0] !== '' && r[0] !== undefined);
  l._nilai = [l._nilai[0]].concat(semua.slice().sort((x, y) => (x[3] < y[3] ? 1 : x[3] > y[3] ? -1 : 0)));   // menurut Jenis, Z ke A
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0, 'saldo tetap benar');
  assert.equal(lihat(o.id).pelanggan.stempel, 1);
});

test('hapus data contoh dan baris tes: hanya baris bertanda yang dihapus, data asli di sela-selanya utuh', () => {
  const s = siap();
  const a = s.daftar('Rina', '0812-3456-7890');
  s.stempel(a.id, { nomor_pesanan: 'ORD-1' });
  assert.equal(s.minta('isi_contoh', { sesi: s.owner }).ditambah, 50);
  s.maju(MENIT);
  const b = s.daftar('Dimas', '0813-0000-1111');
  s.stempel(b.id, { nomor_pesanan: 'ORD-2' });
  assert.match(s.ctx.ujiCepat(), /SEMUA TES LULUS/);   // menambah baris bertanda TES di tengah, lalu menghapusnya
  s.maju(MENIT);
  s.stempel(a.id, { nomor_pesanan: 'ORD-3' });

  const asliP = s.lembar('Pelanggan').slice(1).filter((r) => r[17] === '');
  const asliT = s.lembar('Transaksi').slice(1).filter((r) => r[16] === '');
  assert.equal(asliP.length, 2);
  const tokenContoh = s.lembar('Pelanggan').slice(1).find((r) => r[17] === 'CONTOH')[5];
  const barisMaks = s.gas._buku.getSheetByName('Transaksi').getMaxRows();

  const dihapus = s.minta('hapus_contoh', { sesi: s.owner }).dihapus;
  assert.ok(dihapus > 100, 'jumlah baris contoh yang dihapus: ' + dihapus);
  assert.deepEqual(s.lembar('Pelanggan').slice(1), asliP);
  assert.deepEqual(s.lembar('Transaksi').slice(1), asliT);
  assert.ok(s.gas._buku.getSheetByName('Transaksi').getMaxRows() < barisMaks, 'barisnya benar-benar dihapus, bukan dikosongkan');
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0);
  assert.throws(() => s.minta('kartu', { t: tokenContoh }), galat('KARTU_TIDAK_ADA'));
  assert.equal(s.stempel(b.id, { nomor_pesanan: 'ORD-4' }).pelanggan.stempel, 2, 'baris pelanggan asli masih di tempat yang benar');
  assert.equal(s.minta('hapus_contoh', { sesi: s.owner }).dihapus, 0);
});

test('nama dan token acak tidak menambah isi cache', () => {
  const s = siap();
  s.minta('daftar_admin');
  const jumlah = () => Object.keys(s.gas._cache).length;
  const awal = jumlah();
  for (let i = 0; i < 30; i++) assert.throws(() => s.minta('masuk', { nama: 'orang' + i, pin: '111111' }), galat('PIN_SALAH'));
  for (let i = 0; i < 30; i++) assert.throws(() => s.minta('kartu', { t: 'TokenAcak' + String(i).padStart(3, '0') + 'abcdefghij' }), galat('KARTU_TIDAK_ADA'));
  assert.ok(jumlah() <= awal + 1, 'isi cache bertambah ' + (jumlah() - awal));   // satu penghitung bersama untuk token salah
});

test('kalau Sheets menyimpan apostrof pengaman apa adanya: PIN, nama, dan nomor pesanan tetap cocok', () => {
  const s = siap({ tiruan: { apostrofDisimpan: true } });
  const a = s.daftar('-Rina', '0812-3456-7890');
  assert.equal(s.lembar('Pelanggan')[1][2], "'-Rina", 'keadaan yang ditiru: apostrofnya ikut tersimpan');
  assert.equal(s.minta('cari', { sesi: s.admin, q: '-rina' }).hasil[0].nama, '-Rina');
  s.stempel(a.id, { nomor_pesanan: '-A=1' });
  assert.throws(() => s.stempel(a.id, { nomor_pesanan: '-A=1' }), galat('PESANAN_GANDA'));
  assert.match(s.ctx.ujiCepat(), /SEMUA TES LULUS/);
  s.maju(3 * MENIT);   // cache admin habis: hash PIN dibaca lagi dari sheet
  assert.equal(s.minta('masuk', { nama: 'Mira', pin: '905317' }).peran, 'admin');
  for (const baris of s.lembar('Admin').slice(1)) assert.match(String(baris[3]), /^h[A-Za-z0-9_=-]+$/, 'hash PIN tidak pernah diawali tanda yang perlu diamankan');
});

test('tab Pelanggan diurutkan orang saat permintaan berjalan: tulisan tetap jatuh ke pelanggan yang benar', () => {
  const s = siap();
  const a = s.daftar('Rina', '0812-3456-7890'), b = s.daftar('Dimas', '0813-0000-1111'), c = s.daftar('Sari', '0857-1111-2222');
  const p = s.ctx.pelangganDariId_(a.id);          // server sudah membaca baris Rina...
  const l = s.gas._buku.getSheetByName('Pelanggan');
  const isi = l._nilai.slice(1).filter((r) => r && r[0] !== '' && r[0] !== undefined);
  l._nilai = [l._nilai[0]].concat(isi.slice().reverse());   // ...lalu seseorang mengurutkan tab itu
  p.nama = 'Rina Baru';
  s.ctx.tulisPelanggan_(p);
  s.gas.SpreadsheetApp.flush();
  const nama = Object.fromEntries(s.lembar('Pelanggan').slice(1).map((r) => [r[0], r[2]]));
  assert.deepEqual(nama, { [a.id]: 'Rina Baru', [b.id]: 'Dimas', [c.id]: 'Sari' });
  // alur biasa tetap benar setelah diurutkan
  assert.equal(s.stempel(b.id, { nomor_pesanan: 'ORD-1' }).pelanggan.nama, 'Dimas');
  assert.equal(s.stempel(a.id, { nomor_pesanan: 'ORD-2' }).pelanggan.nama, 'Rina Baru');
  assert.equal(s.ctx.denganKunci_(s.ctx.periksaSaldo_), 0);
});
