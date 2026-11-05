/**
 * KARTU AURA: SERVER (Google Apps Script)
 * Menyimpan data di satu spreadsheet (dibuat sendiri oleh "pasang", atau spreadsheet tempat skrip ini menempel), dan melayani:
 *   - Kartu Pembeli   (aksi: kartu, setuju, hapus_data_saya)
 *   - Meja Stempel    (aksi admin & owner, pakai sesi dari PIN)
 *   - Pintu otomatis  (aksi otomatis_*, pakai kunci API; untuk n8n / Laura)
 * File ini digabung dengan inti.js menjadi apps-script/Code.gs oleh alat/bangun.js.
 */

var VERSI = '1.1.0';
var TAB = { PELANGGAN: 'Pelanggan', TRANSAKSI: 'Transaksi', ADMIN: 'Admin', PENGATURAN: 'Pengaturan', RINGKASAN: 'Ringkasan' };
var FMT_TEKS = '@';
var FMT_ANGKA = '0';
var FMT_WAKTU = 'dd/MM/yyyy HH:mm';
var PIN_AWAL = '123456';
var SESI_JAM = 12;
var MAKS_RIWAYAT = 20;

var KOLOM = {
  PELANGGAN: ['id', 'no_anggota', 'nama', 'wa', 'kode', 'token', 'kartu_ke', 'stempel', 'hadiah_siap', 'total_beli', 'total_hadiah', 'asal_awal', 'tgl_daftar', 'tgl_setuju', 'stempel_terakhir', 'status', 'riwayat', 'contoh'],
  TRANSAKSI: ['id', 'waktu', 'id_pelanggan', 'jenis', 'jumlah', 'nomor_pesanan', 'aroma', 'asal', 'catatan', 'admin', 'sumber', 'kartu_ke', 'saldo_setelah', 'hadiah_siap', 'id_permintaan', 'ref', 'contoh'],
  ADMIN: ['nama', 'peran', 'garam', 'hash_pin', 'status', 'wajib_ganti_pin', 'dibuat'],
  PENGATURAN: ['kunci', 'nilai', 'keterangan']
};
var JUDUL = {
  PELANGGAN: ['ID', 'No. anggota', 'Nama', 'WhatsApp', 'Kode kartu', 'Token kartu (rahasia)', 'Kartu ke-', 'Stempel saat ini', 'Hadiah siap', 'Total beli lewat WA', 'Total hadiah', 'Asal Stempel Awal', 'Tanggal daftar', 'Waktu persetujuan', 'Stempel terakhir', 'Status', 'Riwayat ringkas', 'Contoh'],
  TRANSAKSI: ['ID transaksi', 'Waktu', 'ID pelanggan', 'Jenis', 'Jumlah', 'Nomor pesanan', 'Aroma hadiah', 'Asal', 'Catatan', 'Admin', 'Sumber', 'Kartu ke-', 'Stempel setelahnya', 'Hadiah siap setelahnya', 'ID permintaan', 'Membatalkan transaksi', 'Contoh'],
  ADMIN: ['Nama', 'Peran', 'Garam', 'Hash PIN', 'Status', 'Wajib ganti PIN', 'Dibuat'],
  PENGATURAN: ['Kunci', 'Nilai', 'Keterangan']
};
var FORMAT = {
  PELANGGAN: [FMT_TEKS, FMT_ANGKA, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_ANGKA, FMT_ANGKA, FMT_ANGKA, FMT_ANGKA, FMT_ANGKA, FMT_TEKS, FMT_WAKTU, FMT_WAKTU, FMT_WAKTU, FMT_TEKS, FMT_TEKS, FMT_TEKS],
  TRANSAKSI: [FMT_TEKS, FMT_WAKTU, FMT_TEKS, FMT_TEKS, FMT_ANGKA, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_ANGKA, FMT_ANGKA, FMT_ANGKA, FMT_TEKS, FMT_TEKS, FMT_TEKS],
  ADMIN: [FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_WAKTU],
  PENGATURAN: [FMT_TEKS, FMT_TEKS, FMT_TEKS]
};

var PESAN_KARTU_TIDAK_ADA = 'Kartu tidak ditemukan. Minta link kartumu lagi ke admin lewat WhatsApp.';

/* =====================================================================
 * DIJALANKAN DARI EDITOR APPS SCRIPT
 * Ditaruh paling atas supaya mudah ditemukan di pilihan fungsi sebelah tombol Run.
 * Isinya ada di bagian PEMASANGAN dan TES di bawah.
 * ===================================================================== */

/** PASANG: jalankan sekali setelah menempel kode. Aman dijalankan ulang: hanya menambah yang belum ada, tidak menghapus data. */
function pasang() { return pasangSemua_(); }

/** TES: menjalankan alur lengkap pada satu pelanggan uji lalu menghapusnya lagi. Hasilnya tampil di Execution log. */
function ujiCepat() { return jalankanUji_(); }

/** LUPA PIN OWNER: PIN semua akun Owner yang aktif kembali ke PIN awal dan wajib diganti saat masuk. */
function resetPinOwner() { return kembalikanPinOwner_(); }

/* =====================================================================
 * PINTU MASUK
 * ===================================================================== */

// Membuka alamat /exec di browser menampilkan status ini. Yang sehat: "buku":true,"terpasang":true.
function doGet() {
  var ss = null;
  try { ss = buku_(); } catch (x) { ss = null; }
  return keluaran_({ ok: true, data: { layanan: 'Kartu Aura', versi: VERSI, buku: !!ss, terpasang: !!(ss && ss.getSheetByName(TAB.PELANGGAN)) } });
}

function doPost(e) {
  var hasil;
  try {
    var isi = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (isi.length > 20000) throw Inti.galat('TERLALU_BESAR', 'Permintaan terlalu besar.');
    var d;
    try { d = JSON.parse(isi); } catch (x) { throw Inti.galat('PERMINTAAN_SALAH', 'Permintaan tidak bisa dibaca.'); }
    if (!d || typeof d !== 'object') throw Inti.galat('PERMINTAAN_SALAH', 'Permintaan tidak bisa dibaca.');
    hasil = { ok: true, data: jalankan_(d) };
  } catch (err) {
    if (err && err.galatKartu) {
      hasil = { ok: false, kode: err.kode, pesan: err.message };
      if (err.data) hasil.data = err.data;
    } else {
      try { console.error('Kartu Aura: ' + (err && err.stack ? err.stack : err)); } catch (x) { /* abaikan */ }
      hasil = { ok: false, kode: 'GALAT', pesan: 'Ada gangguan di server. Coba lagi sebentar.', rinci: String(err && err.message ? err.message : err).slice(0, 300) };
    }
  }
  return keluaran_(hasil);
}

function keluaran_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jalankan_(d) {
  var aksi = Inti.teks(d.aksi, 40);
  if (Object.prototype.hasOwnProperty.call(AKSI_PUBLIK, aksi)) return AKSI_PUBLIK[aksi](d);
  if (Object.prototype.hasOwnProperty.call(AKSI_OTOMATIS, aksi)) {
    periksaKunciApi_(d);
    return AKSI_OTOMATIS[aksi](d);
  }
  var admin = null;
  if (Object.prototype.hasOwnProperty.call(AKSI_ADMIN, aksi)) {
    admin = bacaSesi_(d.sesi);
    if (admin.wajib_ganti_pin === 'ya' && aksi !== 'ganti_pin') throw Inti.galat('WAJIB_GANTI_PIN', 'Ganti PIN dulu sebelum mulai.');
    return AKSI_ADMIN[aksi](d, admin);
  }
  if (Object.prototype.hasOwnProperty.call(AKSI_OWNER, aksi)) {
    admin = bacaSesi_(d.sesi);
    if (admin.wajib_ganti_pin === 'ya') throw Inti.galat('WAJIB_GANTI_PIN', 'Ganti PIN dulu sebelum mulai.');
    if (admin.peran !== 'owner') throw Inti.galat('BUKAN_OWNER', 'Bagian ini hanya untuk Owner.');
    return AKSI_OWNER[aksi](d, admin);
  }
  throw Inti.galat('AKSI_TIDAK_DIKENAL', 'Permintaan tidak dikenal.');
}

/* =====================================================================
 * ALAT SPREADSHEET
 * ===================================================================== */

var BUKU_ = null;   // diingat selama satu permintaan
var NAMA_BUKU = 'Kartu Aura - Data';

/**
 * Spreadsheet tempat data disimpan. ID-nya dicatat "pasang" di Script Properties (ID_BUKU), jadi bisa dibuka
 * dari mana pun skrip dijalankan: editor, pemicu, maupun web app.
 * Skrip ini boleh berdiri sendiri (dibuat di script.google.com) atau menempel di sebuah Google Sheet.
 */
function buku_() {
  if (BUKU_) return BUKU_;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ID_BUKU'), ss = null, aktif = null;
  // Kosong kalau skrip berdiri sendiri. Terisi kalau skrip menempel di sebuah sheet dan dijalankan dari sheet itu.
  try { aktif = SpreadsheetApp.getActiveSpreadsheet(); } catch (x) { aktif = null; }
  if (id) {
    if (aktif && aktif.getId() === id) ss = aktif;
    else ss = bukaDenganId_(id);
    if (!ss) throw Inti.galat('BUKU_TIDAK_TERJANGKAU', 'Spreadsheet data sedang tidak bisa dibuka. Coba lagi sebentar. Kalau terus begini, lihat README bagian "Kalau ada masalah".');
  } else {
    if (!aktif) throw Inti.galat('BELUM_DIPASANG', 'Server belum dipasang. Jalankan fungsi "pasang" di Apps Script.');
    ss = aktif;
    try { props.setProperty('ID_BUKU', ss.getId()); } catch (w) { /* dicoba lagi lain kali */ }
  }
  BUKU_ = ss;
  return ss;
}

// Membuka spreadsheet lewat ID-nya. Gangguan sesaat di layanan Google dicoba sekali lagi.
function bukaDenganId_(id) {
  for (var i = 0; i < 2; i++) {
    try { return SpreadsheetApp.openById(id); } catch (x) {
      if (i === 0) { try { Utilities.sleep(400); } catch (y) { /* lanjut saja */ } }
      else { try { console.error('Kartu Aura: spreadsheet ' + id + ' tidak bisa dibuka: ' + (x && x.message ? x.message : x)); } catch (z) { /* abaikan */ } }
    }
  }
  return null;
}

function tab_(nama) {
  var s = buku_().getSheetByName(nama);
  if (!s) throw Inti.galat('BELUM_DIPASANG', 'Tab "' + nama + '" belum ada. Jalankan fungsi "pasang" di Apps Script.');
  return s;
}

// Teks yang diawali = + - @ ' diberi apostrof supaya tidak dianggap rumus oleh Sheets.
function amanSel_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /^[=+\-@']/.test(v)) return "'" + v;
  return v;
}

// Kebalikan amanSel_. Biasanya Sheets sendiri yang membuang apostrof pengaman; kalau ternyata tersimpan apa adanya,
// teks tetap kembali seperti aslinya.
function bersihSel_(v) {
  return typeof v === 'string' && /^'[=+\-@']/.test(v) ? v.slice(1) : v;
}

function pastikanBaris_(sheet, baris) {
  var maks = sheet.getMaxRows();
  if (baris > maks) sheet.insertRowsAfter(maks, Math.max(200, baris - maks));
}

function bacaSemua_(sheet, kolom) {
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  var v = sheet.getRange(2, 1, n, kolom.length).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var o = { _baris: i + 2 };
    for (var j = 0; j < kolom.length; j++) o[kolom[j]] = bersihSel_(v[i][j]);
    out.push(o);
  }
  return out;
}

function bacaKolom_(sheet, indeks) {
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  var v = sheet.getRange(2, indeks, n, 1).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) out.push(bersihSel_(v[i][0]));
  return out;
}

// Nomor baris (mulai 2) tempat kolom ke-indeks berisi nilai; 0 kalau tidak ada.
function cariBaris_(sheet, indeks, nilai) {
  var kolom = bacaKolom_(sheet, indeks), cari = String(nilai);
  for (var i = 0; i < kolom.length; i++) if (String(kolom[i]) === cari) return i + 2;
  return 0;
}

function bacaBaris_(sheet, baris, kolom) {
  var v = sheet.getRange(baris, 1, 1, kolom.length).getValues()[0];
  var o = { _baris: baris };
  for (var j = 0; j < kolom.length; j++) o[kolom[j]] = bersihSel_(v[j]);
  return o;
}

function tulisBaris_(sheet, baris, kolom, format, obj) {
  pastikanBaris_(sheet, baris);
  var nilai = [];
  for (var j = 0; j < kolom.length; j++) nilai.push(amanSel_(obj[kolom[j]]));
  var r = sheet.getRange(baris, 1, 1, kolom.length);
  r.setNumberFormats([format]);
  r.setValues([nilai]);
}

// Menulis baris pelanggan. Letak barisnya dicek lagi dulu: kalau tab Pelanggan sempat diurutkan atau disisipi
// baris oleh orang saat permintaan berjalan, barisnya dicari ulang menurut ID supaya tulisan tidak jatuh ke pelanggan lain.
function tulisPelanggan_(p) {
  var sh = tab_(TAB.PELANGGAN), cocok = false;
  if (p._baris >= 2 && p._baris <= sh.getMaxRows()) cocok = String(bersihSel_(sh.getRange(p._baris, 1).getValue())) === String(p.id);
  if (!cocok) {
    var baris = cariBaris_(sh, 1, String(p.id));
    if (!baris) throw Inti.galat('SIBUK', 'Data pelanggan berpindah saat disimpan. Coba lagi sebentar.');
    p._baris = baris;
  }
  tulisBaris_(sh, p._baris, KOLOM.PELANGGAN, FORMAT.PELANGGAN, p);
}

function tambahBaris_(sheet, kolom, format, obj) {
  var baris = Math.max(2, sheet.getLastRow() + 1);
  tulisBaris_(sheet, baris, kolom, format, obj);
  return baris;
}

function tulisBanyak_(sheet, barisAwal, kolom, format, daftar) {
  if (!daftar.length) return;
  pastikanBaris_(sheet, barisAwal + daftar.length - 1);
  var nilai = [], fmt = [];
  for (var i = 0; i < daftar.length; i++) {
    var b = [];
    for (var j = 0; j < kolom.length; j++) b.push(amanSel_(daftar[i][kolom[j]]));
    nilai.push(b);
    fmt.push(format);
  }
  var r = sheet.getRange(barisAwal, 1, daftar.length, kolom.length);
  r.setNumberFormats(fmt);
  r.setValues(nilai);
}

var DALAM_KUNCI_ = false;
var CACHE_TUNDA_ = [];

/**
 * Menjalankan fn sambil memegang kunci skrip, supaya dua permintaan tidak menulis bersamaan.
 * Apps Script menahan tulisan ke sheet sampai akhir proses. Karena itu tulisan dipaksa tersimpan (flush)
 * SEBELUM kunci dilepas; kalau tidak, permintaan berikutnya bisa membaca keadaan lama.
 * Cache yang perlu dibuang (lihat buangCache_) baru dibuang setelah tulisan tersimpan.
 */
function denganKunci_(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(25000)) throw Inti.galat('SIBUK', 'Server sedang ramai. Coba lagi sebentar.');
  DALAM_KUNCI_ = true;
  try {
    var hasil = fn();
    SpreadsheetApp.flush();   // galat di sini berarti tulisan gagal, jadi permintaannya dianggap gagal
    return hasil;
  } finally {
    try { SpreadsheetApp.flush(); } catch (x) { /* sudah dilaporkan di atas */ }
    try { if (CACHE_TUNDA_.length) cache_().removeAll(CACHE_TUNDA_); } catch (y) { /* cache hanya penolong */ }
    CACHE_TUNDA_ = [];
    DALAM_KUNCI_ = false;
    kunci.releaseLock();
  }
}

// Membuang satu simpanan cache. Di dalam kunci, pembuangannya ditunda sampai tulisan benar-benar tersimpan,
// supaya permintaan lain tidak sempat mengisi cache lagi dengan keadaan lama.
function buangCache_(k) {
  if (DALAM_KUNCI_) CACHE_TUNDA_.push(k); else cache_().remove(k);
}

function cache_() { return CacheService.getScriptCache(); }

function iso_(v) {
  var d = Inti.keTanggal(v);
  return d ? d.toISOString() : null;
}

/* =====================================================================
 * RAHASIA, PIN, SESI
 * ===================================================================== */

function byteKeAngka_(b) { return (b + 256) % 256; }

function acak_(panjang) {
  var s = '';
  while (s.length < panjang) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + '|' + Utilities.getUuid() + '|' + new Date().getTime());
    s += Utilities.base64EncodeWebSafe(b).replace(/[^A-Za-z0-9]/g, '');
  }
  return s.slice(0, panjang);
}

function byteAcak_() {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + '|' + Utilities.getUuid());
  var out = [];
  for (var i = 0; i < b.length; i++) out.push(byteKeAngka_(b[i]));
  return out;
}

function rahasia_(nama) {
  var p = PropertiesService.getScriptProperties(), v = p.getProperty(nama);
  if (!v) { v = acak_(40); p.setProperty(nama, v); }
  return v;
}

function hashPin_(garam, pin) {
  return 'h' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(garam) + ':' + String(pin), rahasia_('RAHASIA_PIN')));
}

function samaTeks_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var beda = 0;
  for (var i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

function daftarAdmin_() {
  var c = cache_(), s = c.get('admin');
  if (s) { try { return JSON.parse(s); } catch (x) { /* baca ulang */ } }
  var baris = bacaSemua_(tab_(TAB.ADMIN), KOLOM.ADMIN), out = [];
  for (var i = 0; i < baris.length; i++) {
    var b = baris[i];
    if (!Inti.teks(b.nama)) continue;
    out.push({
      _baris: b._baris, nama: Inti.teks(b.nama, 40), peran: Inti.teks(b.peran, 10) === 'owner' ? 'owner' : 'admin',
      garam: String(b.garam), hash_pin: String(b.hash_pin), status: Inti.teks(b.status, 10) === 'aktif' ? 'aktif' : 'nonaktif',
      wajib_ganti_pin: Inti.teks(b.wajib_ganti_pin, 5) === 'ya' ? 'ya' : 'tidak', dibuat: iso_(b.dibuat)
    });
  }
  c.put('admin', JSON.stringify(out), 120);
  return out;
}

function cariAdmin_(nama) {
  var semua = daftarAdmin_(), cari = Inti.teks(nama, 40).toLowerCase();
  for (var i = 0; i < semua.length; i++) if (semua[i].nama.toLowerCase() === cari) return semua[i];
  return null;
}

function buatSesi_(admin) {
  var muatan = { n: admin.nama, p: admin.peran, e: new Date().getTime() + SESI_JAM * 3600 * 1000, v: String(admin.hash_pin).slice(0, 10) };
  var badan = encodeURIComponent(JSON.stringify(muatan));
  var ttd = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(badan, rahasia_('RAHASIA_SESI')));
  return badan + ':' + ttd;
}

function bacaSesi_(sesi) {
  var tolak = Inti.galat('SESI_HABIS', 'Sesi sudah habis. Masuk lagi dengan PIN.');
  var s = String(sesi || ''), pisah = s.lastIndexOf(':');
  if (pisah < 1 || s.length > 1200) throw tolak;
  var badan = s.slice(0, pisah), ttd = s.slice(pisah + 1);
  var benar = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(badan, rahasia_('RAHASIA_SESI')));
  if (!samaTeks_(ttd, benar)) throw tolak;
  var m;
  try { m = JSON.parse(decodeURIComponent(badan)); } catch (x) { throw tolak; }
  if (!m || !(m.e > new Date().getTime())) throw tolak;
  var admin = cariAdmin_(m.n);
  if (!admin || admin.status !== 'aktif') throw tolak;
  if (String(admin.hash_pin).slice(0, 10) !== m.v) throw tolak; // PIN sudah diganti/di-reset
  return admin;
}

function periksaPin_(pin) {
  var p = String(pin || '');
  if (!/^\d{6}$/.test(p)) throw Inti.galat('PIN_TIDAK_SAH', 'PIN harus 6 angka.');
  return p;
}

function periksaPinBaru_(pin) {
  var p = periksaPin_(pin);
  if (p === PIN_AWAL || /^(\d)\1{5}$/.test(p) || p === '654321' || p === '012345') throw Inti.galat('PIN_TIDAK_SAH', 'PIN terlalu mudah ditebak. Pakai 6 angka lain.');
  return p;
}

function aksiDaftarAdmin_() {
  var out = [];
  daftarAdmin_().forEach(function (a) { if (a.status === 'aktif') out.push(a.nama); });
  var atur = pengaturan_();
  return { admin: out, program: atur.nama_program, versi: VERSI };
}

function aksiMasuk_(d) {
  var nama = Inti.teks(d.nama, 40), pin = String(d.pin || '');
  var c = cache_(), kunciNama = nama.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
  if (c.get('kunci:' + kunciNama)) throw Inti.galat('TERKUNCI', 'Terlalu banyak PIN salah. Coba lagi 15 menit lagi.');
  var admin = cariAdmin_(nama);
  var benar = !!admin && admin.status === 'aktif' && /^\d{6}$/.test(pin) && samaTeks_(hashPin_(admin.garam, pin), admin.hash_pin);
  if (!benar) {
    if (!admin) throw Inti.galat('PIN_SALAH', 'Nama atau PIN salah.');
    var n = (Number(c.get('gagal:' + kunciNama)) || 0) + 1;
    if (n >= 5) {
      c.put('kunci:' + kunciNama, '1', 900);
      c.remove('gagal:' + kunciNama);
      throw Inti.galat('TERKUNCI', 'Terlalu banyak PIN salah. Coba lagi 15 menit lagi.');
    }
    c.put('gagal:' + kunciNama, String(n), 900);
    throw Inti.galat('PIN_SALAH', 'Nama atau PIN salah. Sisa percobaan: ' + (5 - n) + '.');
  }
  c.remove('gagal:' + kunciNama);
  return { sesi: buatSesi_(admin), nama: admin.nama, peran: admin.peran, wajib_ganti_pin: admin.wajib_ganti_pin === 'ya' };
}

function aksiGantiPin_(d, admin) {
  var lama = String(d.pin_lama || '');
  if (!samaTeks_(hashPin_(admin.garam, lama), admin.hash_pin)) throw Inti.galat('PIN_SALAH', 'PIN lama salah.');
  var baru = periksaPinBaru_(d.pin_baru);
  if (baru === lama) throw Inti.galat('PIN_TIDAK_SAH', 'PIN baru harus berbeda dari PIN lama.');
  return denganKunci_(function () {
    var a = aturPinAdmin_(admin.nama, baru, 'tidak');
    return { sesi: buatSesi_(a), nama: a.nama, peran: a.peran, wajib_ganti_pin: false };
  });
}

function aturPinAdmin_(nama, pin, wajibGanti) {
  var sh = tab_(TAB.ADMIN);
  cache_().remove('admin');
  var a = cariAdmin_(nama);
  if (!a) throw Inti.galat('ADMIN_TIDAK_ADA', 'Admin tidak ditemukan.');
  var garam = acak_(16);
  var baris = bacaBaris_(sh, a._baris, KOLOM.ADMIN);
  baris.garam = garam;
  baris.hash_pin = hashPin_(garam, pin);
  baris.wajib_ganti_pin = wajibGanti;
  tulisBaris_(sh, a._baris, KOLOM.ADMIN, FORMAT.ADMIN, baris);
  cache_().remove('admin');
  return cariAdmin_(nama);
}

/* =====================================================================
 * PENGATURAN
 * ===================================================================== */

function pengaturan_() {
  var c = cache_(), s = c.get('atur');
  if (s) { try { return JSON.parse(s); } catch (x) { /* baca ulang */ } }
  var baris = bacaSemua_(tab_(TAB.PENGATURAN), KOLOM.PENGATURAN), m = {};
  for (var i = 0; i < baris.length; i++) { var k = Inti.teks(baris[i].kunci, 40); if (k) m[k] = baris[i].nilai; }
  var a = Inti.lengkapiPengaturan(m);
  c.put('atur', JSON.stringify(a), 120);
  return a;
}

function simpanPengaturan_(ubah) {
  var sh = tab_(TAB.PENGATURAN);
  var baris = bacaSemua_(sh, KOLOM.PENGATURAN), letak = {};
  for (var i = 0; i < baris.length; i++) letak[Inti.teks(baris[i].kunci, 40)] = baris[i]._baris;
  Object.keys(ubah).forEach(function (k) {
    var obj = { kunci: k, nilai: String(ubah[k]), keterangan: Inti.KETERANGAN_PENGATURAN[k] || '' };
    if (letak[k]) tulisBaris_(sh, letak[k], KOLOM.PENGATURAN, FORMAT.PENGATURAN, obj);
    else letak[k] = tambahBaris_(sh, KOLOM.PENGATURAN, FORMAT.PENGATURAN, obj);
  });
  cache_().remove('atur');
  return pengaturan_();
}

function aksiInfo_(d, admin) {
  var a = pengaturan_();
  return {
    versi: VERSI, admin: { nama: admin.nama, peran: admin.peran },
    program: a.nama_program, sebutan: a.sebutan, target: Inti.target(a), hadiah: a.teks_hadiah, aturan: a.aturan_stempel,
    program_aktif: a.program_aktif === 'ya', url_kartu: a.url_kartu, wa_admin: a.wa_admin,
    aroma: Inti.daftarAroma(a), asal: Inti.ASAL, jeda_menit: a.jeda_konfirmasi_menit, masa_berlaku_bulan: a.masa_berlaku_bulan
  };
}

function aksiPengaturanBaca_() {
  var a = pengaturan_(), admin = [];
  daftarAdmin_().forEach(function (x) { admin.push({ nama: x.nama, peran: x.peran, status: x.status, wajib_ganti_pin: x.wajib_ganti_pin === 'ya', dibuat: x.dibuat }); });
  var url = '', urlBuku = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (x) { url = ''; }
  try { urlBuku = buku_().getUrl() || ''; } catch (y) { urlBuku = ''; }
  return { pengaturan: a, keterangan: Inti.KETERANGAN_PENGATURAN, admin: admin, kunci_api: rahasia_('KUNCI_API'), url_api: url, url_buku: urlBuku, versi: VERSI };
}

function aksiPengaturanSimpan_(d, admin) {
  var ubah = Inti.periksaPerubahanPengaturan(d.ubah);
  if (!Object.keys(ubah).length) throw Inti.galat('PENGATURAN_SALAH', 'Tidak ada yang diubah.');
  return denganKunci_(function () {
    var lama = pengaturan_();
    var baru = simpanPengaturan_(ubah);
    var dirapikan = 0;
    if (Inti.target(baru) < Inti.target(lama)) dirapikan = rapikanSemuaSetelahGantiTarget_(baru, lama, admin);
    cache_().remove('ringkasan');
    return { pengaturan: baru, dirapikan: dirapikan };
  });
}

function rapikanSemuaSetelahGantiTarget_(baru, lama, admin) {
  var sh = tab_(TAB.PELANGGAN), semua = bacaSemua_(sh, KOLOM.PELANGGAN), t = Inti.target(baru), n = 0, kini = new Date();
  for (var i = 0; i < semua.length; i++) {
    var p = semua[i];
    if (Inti.teks(p.status) !== 'aktif' || Inti.bulat(p.stempel, 0) < t) continue;
    var r = Inti.rapikanSetelahGantiTarget(keadaan_(p), baru);
    catat_(p, r.keadaan, {
      jenis: Inti.JENIS.PENYESUAIAN, jumlah: 0, catatan: 'Jumlah stempel per hadiah diubah dari ' + Inti.target(lama) + ' ke ' + t,
      admin: admin.nama, sumber: 'manual'
    }, baru, kini);
    n += 1;
  }
  return n;
}

function periksaKunciApi_(d) {
  var a = pengaturan_();
  if (a.otomatis_aktif !== 'ya') throw Inti.galat('OTOMATIS_MATI', 'Pintu otomatis belum dinyalakan di Pengaturan.');
  if (!d.kunci || !samaTeks_(String(d.kunci), rahasia_('KUNCI_API'))) throw Inti.galat('KUNCI_SALAH', 'Kunci API salah.');
}

function aksiKunciApiBaru_() {
  var p = PropertiesService.getScriptProperties();
  p.deleteProperty('KUNCI_API');
  return { kunci_api: rahasia_('KUNCI_API') };
}

/* =====================================================================
 * PELANGGAN: baca, bentuk, catat
 * ===================================================================== */

function keadaan_(p) {
  return Inti.salin({ kartu_ke: p.kartu_ke, stempel: p.stempel, hadiah_siap: p.hadiah_siap, total_beli: p.total_beli, total_hadiah: p.total_hadiah, asal_awal: p.asal_awal });
}

function riwayat_(p) {
  var s = String(p.riwayat || '');
  if (!s) return [];
  try { var r = JSON.parse(s); return Object.prototype.toString.call(r) === '[object Array]' ? r : []; } catch (x) { return []; }
}

function pelangganDariId_(id) {
  var sh = tab_(TAB.PELANGGAN), baris = cariBaris_(sh, 1, Inti.teks(id, 20));
  if (!baris) throw Inti.galat('PELANGGAN_TIDAK_ADA', 'Pelanggan tidak ditemukan.');
  var p = bacaBaris_(sh, baris, KOLOM.PELANGGAN);
  if (String(p.id) !== Inti.teks(id, 20)) throw Inti.galat('SIBUK', 'Server sedang ramai. Coba lagi sebentar.');
  if (Inti.teks(p.status) !== 'aktif') throw Inti.galat('PELANGGAN_TIDAK_ADA', 'Data pelanggan ini sudah dihapus.');
  return p;
}

function pelangganDariWa_(wa) {
  var sh = tab_(TAB.PELANGGAN), kolomWa = bacaKolom_(sh, 4), kolomStatus = bacaKolom_(sh, 16);
  for (var i = kolomWa.length - 1; i >= 0; i--) {
    if (String(kolomWa[i]) === wa && String(kolomStatus[i]) === 'aktif') {
      var p = bacaBaris_(sh, i + 2, KOLOM.PELANGGAN);
      if (String(p.wa) !== wa || Inti.teks(p.status) !== 'aktif') throw Inti.galat('SIBUK', 'Server sedang ramai. Coba lagi sebentar.');
      return p;
    }
  }
  return null;
}

// Bentuk pelanggan untuk Meja Stempel.
function tampilPelanggan_(p, atur) {
  var k = keadaan_(p), no = Inti.bulat(p.no_anggota, 0);
  return {
    id: String(p.id), no_anggota: Inti.nomorAnggota(no), nama: String(p.nama), wa: String(p.wa), wa_tampil: Inti.tampilWa(p.wa),
    kode: String(p.kode), kartu_ke: k.kartu_ke, stempel: k.stempel, hadiah_siap: k.hadiah_siap, total_beli: k.total_beli, total_hadiah: k.total_hadiah,
    asal_awal: k.asal_awal, boleh_stempel_awal: !k.asal_awal,
    tgl_daftar: iso_(p.tgl_daftar), tgl_setuju: iso_(p.tgl_setuju), stempel_terakhir: iso_(p.stempel_terakhir),
    kartu: Inti.tampilanKartu(k, atur), tautan: Inti.tautanKartu(atur, String(p.token)),
    angkatan_pertama: atur.angkatan_pertama > 0 && no > 0 && no <= atur.angkatan_pertama,
    hangus: Inti.sudahHangus(k, p.stempel_terakhir, new Date(), atur),
    contoh: !!Inti.teks(p.contoh)
  };
}

// Bentuk kartu untuk pembeli. Tidak pernah memuat nomor WhatsApp utuh.
function muatanKartu_(p, atur) {
  var dasar = { program: atur.nama_program, sebutan: atur.sebutan, hadiah: atur.teks_hadiah, target: Inti.target(atur), aktif: atur.program_aktif === 'ya', wa_admin: atur.wa_admin };
  if (!Inti.keTanggal(p.tgl_setuju)) {
    dasar.butuh_persetujuan = true;
    dasar.nama_depan = Inti.namaDepan(p.nama);
    return dasar;
  }
  var k = keadaan_(p), no = Inti.bulat(p.no_anggota, 0), kini = new Date();
  var hangus = Inti.sudahHangus(k, p.stempel_terakhir, kini, atur);
  if (hangus) k.stempel = 0;
  var riw = riwayat_(p), tampil = [];
  for (var i = riw.length - 1; i >= 0; i--) {
    var x = riw[i];
    if (x.j === Inti.JENIS.PERSETUJUAN) continue;
    tampil.push({ w: x.w, j: x.j, n: x.n, s: x.s, k: x.k, a: x.a || '', b: x.b ? 1 : 0 });
  }
  dasar.butuh_persetujuan = false;
  dasar.nama = String(p.nama);
  dasar.no_anggota = Inti.nomorAnggota(no);
  dasar.angkatan_pertama = atur.angkatan_pertama > 0 && no > 0 && no <= atur.angkatan_pertama;
  dasar.kode = String(p.kode);
  dasar.wa_samar = Inti.samarWa(p.wa);
  dasar.anggota_sejak = iso_(p.tgl_daftar);
  dasar.kartu = Inti.tampilanKartu(k, atur);
  dasar.total_hadiah = k.total_hadiah;
  dasar.hangus = hangus;
  dasar.aturan = atur.aturan_stempel;
  dasar.masa_berlaku_bulan = atur.masa_berlaku_bulan;
  dasar.riwayat = tampil;
  dasar.sidik = [k.kartu_ke, k.stempel, k.hadiah_siap, k.total_hadiah].join('.');
  return dasar;
}

function idTransaksi_(kini) {
  return 'T' + kini.getTime().toString(36).toUpperCase() + '-' + acak_(5).toUpperCase();
}

/**
 * Mencatat satu transaksi lalu memperbarui baris pelanggan.
 * Urutannya sengaja: buku transaksi dulu, baru baris pelanggan. Buku transaksi adalah sumber kebenaran.
 * p: baris pelanggan (objek dari bacaBaris_), kBaru: keadaan setelah transaksi, t: isi transaksi.
 */
function catat_(p, kBaru, t, atur, kini, ubahLain) {
  // Waktu transaksi satu pelanggan selalu maju minimal 1 detik dari transaksi sebelumnya. Dengan begitu urutan
  // transaksinya bisa dipastikan dari waktunya saja, tidak bergantung pada letak baris di sheet (lihat periksaSaldo_).
  var sebelumnya = riwayat_(p);
  if (sebelumnya.length) {
    var wAkhir = Inti.keTanggal(sebelumnya[sebelumnya.length - 1].w);
    if (wAkhir && kini.getTime() < wAkhir.getTime() + 1000) kini = new Date(wAkhir.getTime() + 1000);
  }
  var trx = {
    id: idTransaksi_(kini), waktu: kini, id_pelanggan: String(p.id), jenis: t.jenis, jumlah: Inti.bulat(t.jumlah, 0),
    nomor_pesanan: Inti.teks(t.nomor_pesanan, 60), aroma: Inti.teks(t.aroma, 40), asal: Inti.teks(t.asal, 30), catatan: Inti.teks(t.catatan, 200),
    admin: Inti.teks(t.admin, 40), sumber: Inti.teks(t.sumber, 12) || 'manual',
    kartu_ke: kBaru.kartu_ke, saldo_setelah: kBaru.stempel, hadiah_siap: kBaru.hadiah_siap,
    id_permintaan: Inti.teks(t.id_permintaan, 60), ref: Inti.teks(t.ref, 40), contoh: Inti.teks(p.contoh, 10)
  };
  tambahBaris_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI, FORMAT.TRANSAKSI, trx);

  var kLama = keadaan_(p);
  p.kartu_ke = kBaru.kartu_ke; p.stempel = kBaru.stempel; p.hadiah_siap = kBaru.hadiah_siap;
  p.total_beli = kBaru.total_beli; p.total_hadiah = kBaru.total_hadiah; p.asal_awal = kBaru.asal_awal;

  // Riwayat ringkas untuk kartu pembeli (20 kejadian terakhir).
  var riw = riwayat_(p);
  var kejadian = { i: trx.id, w: kini.toISOString(), j: trx.jenis, n: trx.jumlah };
  if (trx.jenis === Inti.JENIS.STEMPEL || trx.jenis === Inti.JENIS.STEMPEL_AWAL) {
    var penuh = kBaru.kartu_ke > kLama.kartu_ke;
    kejadian.k = kLama.kartu_ke;
    kejadian.s = penuh ? Inti.target(atur) : kBaru.stempel;
    p.stempel_terakhir = kini;
  } else {
    kejadian.k = kBaru.kartu_ke;
  }
  if (trx.jenis === Inti.JENIS.HADIAH) { kejadian.a = trx.aroma; kejadian.k = Math.max(1, kBaru.kartu_ke - kBaru.hadiah_siap - 1); }
  if (trx.jenis === Inti.JENIS.BATAL && trx.ref) {
    for (var i = riw.length - 1; i >= 0; i--) if (riw[i].i === trx.ref) { riw[i].b = 1; break; }
    // Stempel terakhir mundur ke stempel sebelumnya yang masih berlaku.
    var sebelum = '';
    for (var j = riw.length - 1; j >= 0; j--) {
      if ((riw[j].j === Inti.JENIS.STEMPEL || riw[j].j === Inti.JENIS.STEMPEL_AWAL) && !riw[j].b) { sebelum = Inti.keTanggal(riw[j].w) || ''; break; }
    }
    p.stempel_terakhir = sebelum;
  }
  riw.push(kejadian);
  if (riw.length > MAKS_RIWAYAT) riw = riw.slice(riw.length - MAKS_RIWAYAT);
  p.riwayat = JSON.stringify(riw);
  if (ubahLain) Object.keys(ubahLain).forEach(function (kunci) { p[kunci] = ubahLain[kunci]; });

  tulisPelanggan_(p);
  if (p.token) buangCache_('kartu:' + p.token);
  buangCache_('ringkasan');
  return trx;
}

/* ---------- permintaan ganda ---------- */

function hasilTersimpan_(idp) {
  if (!idp) return null;
  var s = cache_().get('req:' + idp);
  if (!s) return null;
  try { return JSON.parse(s); } catch (x) { return null; }
}

function simpanHasil_(idp, hasil) {
  if (!idp) return;
  try { cache_().put('req:' + idp, JSON.stringify(hasil), 900); } catch (x) { /* terlalu besar untuk cache: abaikan */ }
}

// Mencari id_permintaan di 400 transaksi terakhir (jaga-jaga kalau cache sudah hilang).
function permintaanSudahAda_(idp) {
  var sh = tab_(TAB.TRANSAKSI), akhir = sh.getLastRow();
  if (akhir < 2) return null;
  var awal = Math.max(2, akhir - 399), n = akhir - awal + 1;
  var v = sh.getRange(awal, 1, n, KOLOM.TRANSAKSI.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][14]) === idp) return { id: String(v[i][0]), id_pelanggan: String(v[i][2]) };
  return null;
}

/**
 * Pembungkus semua aksi yang menulis: tahan permintaan ganda, kunci, lalu jalankan.
 * fn menerima (atur, kini) dan mengembalikan hasil.
 */
function tulis_(d, fn) {
  var idp = Inti.teks(d.id_permintaan, 60);
  var lama = hasilTersimpan_(idp);
  if (lama) return lama;
  var hasil = denganKunci_(function () {
    lama = hasilTersimpan_(idp);
    if (lama) return lama;
    var atur = pengaturan_();
    if (idp) {
      var ada = permintaanSudahAda_(idp);
      if (ada) {
        var p = pelangganDariId_(ada.id_pelanggan);
        return { ulang: true, pelanggan: tampilPelanggan_(p, atur), pesan: '', transaksi: ada.id };
      }
    }
    return fn(atur, new Date());
  });
  simpanHasil_(idp, hasil);   // setelah kunci dilepas: tulisannya sudah pasti tersimpan
  return hasil;
}

function wajibProgramAktif_(atur) {
  if (atur.program_aktif !== 'ya') throw Inti.galat('PROGRAM_JEDA', 'Program sedang dijeda. Stempel baru belum bisa ditambahkan.');
}

// Kalau masa berlaku diatur dan sudah lewat, stempel dihanguskan dulu (tercatat) sebelum aksi berikutnya.
function terapkanHangus_(p, atur, kini) {
  var k = keadaan_(p);
  if (!Inti.sudahHangus(k, p.stempel_terakhir, kini, atur)) return false;
  var r = Inti.kurang(k, k.stempel, atur);
  catat_(p, r.keadaan, { jenis: Inti.JENIS.PENYESUAIAN, jumlah: -k.stempel, catatan: 'Hangus: ' + atur.masa_berlaku_bulan + ' bulan tanpa stempel baru', admin: 'sistem', sumber: 'otomatis' }, atur, kini);
  return true;
}

/* =====================================================================
 * AKSI MEJA STEMPEL
 * ===================================================================== */

function aksiCari_(d) {
  var atur = pengaturan_(), q = Inti.teks(d.q, 60);
  var semua = bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN), aktif = [];
  for (var i = 0; i < semua.length; i++) if (Inti.teks(semua[i].status) === 'aktif') aktif.push(semua[i]);
  var hasil = [], waNormal = null;
  if (!q) {
    for (var a = aktif.length - 1; a >= 0 && hasil.length < 8; a--) hasil.push(tampilPelanggan_(aktif[a], atur));
    return { hasil: hasil, wa_normal: null, terbaru: true, jumlah_pelanggan: aktif.length };
  }
  var kode = Inti.normalKode(q);
  var digit = q.replace(/\D/g, '');
  var sepertiNomor = /^[+\d][\d\s().\-]*$/.test(q) && digit.length >= 4;
  if (sepertiNomor) {
    waNormal = Inti.normalWa(q);
    var cariDigit = digit;
    if (cariDigit.indexOf('08') === 0) cariDigit = '62' + cariDigit.slice(1); // "0812..." = awal nomor; selain itu dianggap potongan nomor
    for (var b = aktif.length - 1; b >= 0 && hasil.length < 20; b--) {
      var wa = String(aktif[b].wa);
      if (waNormal ? wa === waNormal : wa.indexOf(cariDigit) >= 0) hasil.push(tampilPelanggan_(aktif[b], atur));
    }
  }
  if (!hasil.length && kode) {
    for (var c = 0; c < aktif.length; c++) if (String(aktif[c].kode) === kode) { hasil.push(tampilPelanggan_(aktif[c], atur)); break; }
  }
  if (!hasil.length && !sepertiNomor) {
    var kecil = q.toLowerCase(), kodeSebagian = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (var e = aktif.length - 1; e >= 0 && hasil.length < 20; e--) {
      var cocokNama = String(aktif[e].nama).toLowerCase().indexOf(kecil) >= 0;
      var cocokKode = kodeSebagian.length >= 3 && String(aktif[e].kode).replace('-', '').indexOf(kodeSebagian) >= 0;
      if (cocokNama || cocokKode) hasil.push(tampilPelanggan_(aktif[e], atur));
    }
  }
  return { hasil: hasil, wa_normal: waNormal, wa_tampil: waNormal ? Inti.tampilWa(waNormal) : '', terbaru: false, jumlah_pelanggan: aktif.length };
}

function buatPelanggan_(nama, wa, atur, kini, adminNama, sumber, idp, contoh) {
  var sh = tab_(TAB.PELANGGAN);
  var nomor = bacaKolom_(sh, 2), maks = 0;
  for (var i = 0; i < nomor.length; i++) { var n = Inti.bulat(nomor[i], 0); if (n > maks) maks = n; }
  var kodeAda = {}, kolomKode = bacaKolom_(sh, 5);
  for (var j = 0; j < kolomKode.length; j++) kodeAda[String(kolomKode[j])] = true;
  var kode;
  do { kode = Inti.buatKode(byteAcak_()); } while (kodeAda[kode]);
  var no = maks + 1;
  var p = {
    id: 'P' + Inti.nomorAnggota(no), no_anggota: no, nama: nama, wa: wa, kode: kode, token: acak_(22),
    kartu_ke: 1, stempel: 0, hadiah_siap: 0, total_beli: 0, total_hadiah: 0, asal_awal: '',
    tgl_daftar: kini, tgl_setuju: '', stempel_terakhir: '', status: 'aktif', riwayat: '', contoh: Inti.teks(contoh, 10)
  };
  p._baris = tambahBaris_(sh, KOLOM.PELANGGAN, FORMAT.PELANGGAN, p);
  catat_(p, Inti.keadaanKosong(), { jenis: Inti.JENIS.DAFTAR, jumlah: 0, admin: adminNama, sumber: sumber, id_permintaan: idp }, atur, kini);
  return p;
}

function periksaNamaWa_(d) {
  var nama = Inti.rapikanNama(d.nama);
  if (nama.length < 2) throw Inti.galat('NAMA_KOSONG', 'Isi nama pelanggan dulu.');
  var wa = Inti.normalWa(d.wa);
  if (!wa) throw Inti.galat('WA_TIDAK_SAH', 'Nomor WhatsApp tidak sah. Contoh: 0812-3456-7890. Untuk nomor luar negeri, awali dengan +.');
  return { nama: nama, wa: wa };
}

function aksiDaftar_(d, admin) {
  var nw = periksaNamaWa_(d);
  return tulis_(d, function (atur, kini) {
    var ada = pelangganDariWa_(nw.wa);
    if (ada) return { sudah_ada: true, pelanggan: tampilPelanggan_(ada, atur), pesan: Inti.susunPesan('kartu_baru', atur, ada, keadaan_(ada), Inti.tautanKartu(atur, String(ada.token))) };
    var p = buatPelanggan_(nw.nama, nw.wa, atur, kini, admin.nama, 'manual', Inti.teks(d.id_permintaan, 60), '');
    return { baru: true, pelanggan: tampilPelanggan_(p, atur), pesan: Inti.susunPesan('kartu_baru', atur, p, keadaan_(p), Inti.tautanKartu(atur, String(p.token))) };
  });
}

// Apakah nomor pesanan ini sudah punya stempel yang masih berlaku?
function pesananSudahDistempel_(nomor) {
  var sh = tab_(TAB.TRANSAKSI), n = sh.getLastRow() - 1;
  if (n < 1) return null;
  var v = sh.getRange(2, 1, n, 6).getValues(), calon = [];
  for (var i = 0; i < v.length; i++) if (String(bersihSel_(v[i][5])) === nomor && String(v[i][3]) === Inti.JENIS.STEMPEL) calon.push({ id: String(v[i][0]), id_pelanggan: String(v[i][2]) });
  if (!calon.length) return null;
  var ref = bacaKolom_(sh, 16), batal = {};
  for (var j = 0; j < ref.length; j++) if (ref[j]) batal[String(ref[j])] = true;
  for (var k = 0; k < calon.length; k++) if (!batal[calon[k].id]) return calon[k];
  return null;
}

function hasilStempel_(p, r, trx, atur, macamPesan) {
  var k = keadaan_(p), macam = macamPesan;
  if (r.hadiah_baru > 0) macam = 'penuh';
  return {
    pelanggan: tampilPelanggan_(p, atur), transaksi: trx.id, hadiah_baru: r.hadiah_baru || 0, kartu_penuh: (r.hadiah_baru || 0) > 0,
    pesan: Inti.susunPesan(macam, atur, p, k, Inti.tautanKartu(atur, String(p.token))),
    pesan_tunda: r.hadiah_baru > 0 ? Inti.susunPesan('penuh_tunda', atur, p, k, Inti.tautanKartu(atur, String(p.token))) : ''
  };
}

function lakukanStempel_(p, d, atur, kini, adminNama, sumber) {
  wajibProgramAktif_(atur);
  terapkanHangus_(p, atur, kini);
  var nomor = Inti.teks(d.nomor_pesanan, 60);
  if (nomor) {
    var ganda = pesananSudahDistempel_(nomor);
    if (ganda) throw Inti.galat('PESANAN_GANDA', 'Nomor pesanan ' + nomor + ' sudah pernah distempel.', { id_pelanggan: ganda.id_pelanggan });
  } else if (!d.konfirmasi && atur.jeda_konfirmasi_menit > 0) {
    var riw = riwayat_(p);
    for (var i = riw.length - 1; i >= 0; i--) {
      if (riw[i].j === Inti.JENIS.STEMPEL && !riw[i].b) {
        var w = Inti.keTanggal(riw[i].w), menit = w ? Math.max(0, Math.floor((kini.getTime() - w.getTime()) / 60000)) : 99999;
        if (menit < atur.jeda_konfirmasi_menit) throw Inti.galat('BUTUH_KONFIRMASI', 'Pelanggan ini baru distempel ' + (menit < 1 ? 'kurang dari 1' : menit) + ' menit lalu. Stempel lagi?', { menit: menit });
        break;
      }
    }
  }
  var r = Inti.stempelBeli(keadaan_(p), d.jumlah, atur);
  var trx = catat_(p, r.keadaan, {
    jenis: Inti.JENIS.STEMPEL, jumlah: r.jumlah, nomor_pesanan: nomor, catatan: d.catatan, admin: adminNama, sumber: sumber, id_permintaan: d.id_permintaan
  }, atur, kini);
  return hasilStempel_(p, r, trx, atur, 'stempel');
}

function aksiStempel_(d, admin) {
  return tulis_(d, function (atur, kini) {
    return lakukanStempel_(pelangganDariId_(d.id), d, atur, kini, admin.nama, 'manual');
  });
}

function lakukanStempelAwal_(p, d, atur, kini, adminNama, sumber) {
  wajibProgramAktif_(atur);
  terapkanHangus_(p, atur, kini);
  var asal = Inti.teks(d.asal, 30);
  var r = Inti.stempelAwal(keadaan_(p), asal, atur);
  var trx = catat_(p, r.keadaan, { jenis: Inti.JENIS.STEMPEL_AWAL, jumlah: 1, asal: asal, catatan: d.catatan, admin: adminNama, sumber: sumber, id_permintaan: d.id_permintaan }, atur, kini);
  return hasilStempel_(p, r, trx, atur, 'stempel_awal');
}

function aksiStempelAwal_(d, admin) {
  return tulis_(d, function (atur, kini) {
    return lakukanStempelAwal_(pelangganDariId_(d.id), d, atur, kini, admin.nama, 'manual');
  });
}

function transaksiPelanggan_(idPelanggan) {
  var semua = bacaSemua_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI), milik = [], batal = {};
  for (var i = 0; i < semua.length; i++) {
    if (String(semua[i].id_pelanggan) !== String(idPelanggan)) continue;
    milik.push(semua[i]);
    if (String(semua[i].jenis) === Inti.JENIS.BATAL && semua[i].ref) batal[String(semua[i].ref)] = true;
  }
  for (var j = 0; j < milik.length; j++) {
    var w = Inti.keTanggal(milik[j].waktu);
    milik[j]._batal = !!batal[String(milik[j].id)];
    milik[j]._ms = w ? w.getTime() : 0;
    milik[j]._urut = j;
  }
  milik.sort(function (a, b) { return (a._ms - b._ms) || (a._urut - b._urut); });
  return milik;
}

function aksiBatal_(d, admin) {
  var alasan = Inti.teks(d.alasan, 200);
  if (alasan.length < 3) throw Inti.galat('ALASAN_KOSONG', 'Tulis alasan pembatalan dulu.');
  return tulis_(d, function (atur, kini) {
    var p = pelangganDariId_(d.id);
    var milik = transaksiPelanggan_(p.id), sasaran = null;
    for (var i = milik.length - 1; i >= 0; i--) {
      var j = String(milik[i].jenis);
      if ((j === Inti.JENIS.STEMPEL || j === Inti.JENIS.STEMPEL_AWAL) && !milik[i]._batal) { sasaran = milik[i]; break; }
    }
    if (!sasaran) throw Inti.galat('TIDAK_ADA_STEMPEL', 'Tidak ada stempel yang bisa dibatalkan.');
    var r = Inti.batalkan(keadaan_(p), { jenis: String(sasaran.jenis), jumlah: Inti.bulat(sasaran.jumlah, 1) }, atur);
    var trx = catat_(p, r.keadaan, {
      jenis: Inti.JENIS.BATAL, jumlah: Inti.bulat(sasaran.jumlah, 1), catatan: alasan, admin: admin.nama, sumber: 'manual',
      id_permintaan: d.id_permintaan, ref: String(sasaran.id), nomor_pesanan: ''
    }, atur, kini);
    return { pelanggan: tampilPelanggan_(p, atur), transaksi: trx.id, hadiah_ditarik: r.hadiah_ditarik, dibatalkan: { jenis: String(sasaran.jenis), waktu: iso_(sasaran.waktu) }, pesan: '' };
  });
}

function aksiHadiah_(d, admin) {
  var aroma = Inti.teks(d.aroma, 40);
  return tulis_(d, function (atur, kini) {
    var p = pelangganDariId_(d.id);
    var r = Inti.beriHadiah(keadaan_(p));
    var trx = catat_(p, r.keadaan, { jenis: Inti.JENIS.HADIAH, jumlah: 1, aroma: aroma, catatan: d.catatan, admin: admin.nama, sumber: 'manual', id_permintaan: d.id_permintaan }, atur, kini);
    var k = keadaan_(p), tautan = Inti.tautanKartu(atur, String(p.token));
    return {
      pelanggan: tampilPelanggan_(p, atur), transaksi: trx.id,
      pesan: Inti.susunPesan(d.baru_penuh ? 'penuh' : 'hadiah', atur, p, d.baru_penuh ? { kartu_ke: k.kartu_ke, stempel: 0, hadiah_siap: 1, total_beli: k.total_beli, total_hadiah: k.total_hadiah, asal_awal: k.asal_awal } : k, tautan)
    };
  });
}

function aksiHadiahTunda_(d, admin) {
  return tulis_(d, function (atur, kini) {
    var p = pelangganDariId_(d.id), k = keadaan_(p);
    if (k.hadiah_siap <= 0) throw Inti.galat('BELUM_ADA_HADIAH', 'Belum ada hadiah yang siap untuk pelanggan ini.');
    var trx = catat_(p, k, { jenis: Inti.JENIS.HADIAH_TUNDA, jumlah: 0, catatan: d.catatan || 'Hadiah ditunda', admin: admin.nama, sumber: 'manual', id_permintaan: d.id_permintaan }, atur, kini);
    return { pelanggan: tampilPelanggan_(p, atur), transaksi: trx.id, pesan: Inti.susunPesan('penuh_tunda', atur, p, k, Inti.tautanKartu(atur, String(p.token))) };
  });
}

function aksiPenyesuaian_(d, admin) {
  var alasan = Inti.teks(d.alasan, 200);
  if (alasan.length < 3) throw Inti.galat('ALASAN_KOSONG', 'Tulis alasan penyesuaian dulu.');
  return tulis_(d, function (atur, kini) {
    var p = pelangganDariId_(d.id);
    var r = Inti.sesuaikan(keadaan_(p), d.delta, atur);
    var trx = catat_(p, r.keadaan, { jenis: Inti.JENIS.PENYESUAIAN, jumlah: Inti.bulat(d.delta, 0), catatan: alasan, admin: admin.nama, sumber: 'manual', id_permintaan: d.id_permintaan }, atur, kini);
    return { pelanggan: tampilPelanggan_(p, atur), transaksi: trx.id, hadiah_baru: r.hadiah_baru || 0, pesan: '' };
  });
}

// Mengubah nama dan/atau nomor WhatsApp. Kartu, stempel, dan link-nya tetap sama.
// Penggantian nomor dicatat di buku transaksi dengan nomor yang disamarkan, supaya buku itu tidak menyimpan nomor utuh.
function aksiUbahPelanggan_(d, admin) {
  var gantiNama = d.nama !== undefined && d.nama !== null;
  var gantiWa = d.wa !== undefined && d.wa !== null && Inti.teks(d.wa, 40) !== '';
  if (!gantiNama && !gantiWa) throw Inti.galat('PERMINTAAN_SALAH', 'Tidak ada yang diubah.');
  var nama = gantiNama ? Inti.rapikanNama(d.nama) : '';
  if (gantiNama && nama.length < 2) throw Inti.galat('NAMA_KOSONG', 'Isi nama pelanggan dulu.');
  var wa = gantiWa ? Inti.normalWa(d.wa) : '';
  if (gantiWa && !wa) throw Inti.galat('WA_TIDAK_SAH', 'Nomor WhatsApp tidak sah. Contoh: 0812-3456-7890. Untuk nomor luar negeri, awali dengan +.');
  return denganKunci_(function () {
    var atur = pengaturan_(), p = pelangganDariId_(d.id);
    if (gantiNama) p.nama = nama;
    if (gantiWa && wa !== String(p.wa)) {
      var lain = pelangganDariWa_(wa);
      if (lain) throw Inti.galat('WA_SUDAH_DIPAKAI', 'Nomor itu sudah dipakai kartu atas nama ' + lain.nama + '.');
      catat_(p, keadaan_(p), {
        jenis: Inti.JENIS.PENYESUAIAN, jumlah: 0, catatan: 'Nomor WhatsApp diganti dari ' + Inti.samarWa(String(p.wa)) + ' ke ' + Inti.samarWa(wa),
        admin: admin.nama, sumber: 'manual'
      }, atur, new Date(), { wa: wa });
    } else {
      tulisPelanggan_(p);
      if (p.token) buangCache_('kartu:' + p.token);
    }
    return { pelanggan: tampilPelanggan_(p, atur) };
  });
}

// Menghapus identitas pelanggan; transaksi tetap ada tanpa nama dan nomor.
function hapusIdentitas_(p, atur, kini, adminNama, sumber, idp) {
  var tokenLama = String(p.token || '');
  catat_(p, keadaan_(p), { jenis: Inti.JENIS.HAPUS_DATA, jumlah: 0, admin: adminNama, sumber: sumber, id_permintaan: idp }, atur, kini,
    { nama: '(dihapus)', wa: '', token: '', status: 'dihapus', riwayat: '', tgl_setuju: '' });
  if (tokenLama) buangCache_('kartu:' + tokenLama);
}

function aksiHapusPelanggan_(d, admin) {
  if (String(d.konfirmasi) !== 'HAPUS') throw Inti.galat('BUTUH_KONFIRMASI', 'Ketik HAPUS untuk menghapus data pelanggan ini.');
  return tulis_(d, function (atur, kini) {
    var p = pelangganDariId_(d.id);
    hapusIdentitas_(p, atur, kini, admin.nama, 'manual', d.id_permintaan);
    return { dihapus: true, id: String(p.id) };
  });
}

function bentukTransaksi_(t) {
  return {
    id: String(t.id), waktu: iso_(t.waktu), id_pelanggan: String(t.id_pelanggan), jenis: String(t.jenis), jumlah: Inti.bulat(t.jumlah, 0),
    nomor_pesanan: String(t.nomor_pesanan || ''), aroma: String(t.aroma || ''), asal: String(t.asal || ''), catatan: String(t.catatan || ''),
    admin: String(t.admin || ''), sumber: String(t.sumber || ''), kartu_ke: Inti.bulat(t.kartu_ke, 1), saldo_setelah: Inti.bulat(t.saldo_setelah, 0),
    hadiah_siap: Inti.bulat(t.hadiah_siap, 0), ref: String(t.ref || ''), batal: !!t._batal
  };
}

function aksiPelanggan_(d) {
  var atur = pengaturan_(), p = pelangganDariId_(d.id);
  var milik = transaksiPelanggan_(p.id), out = [];
  for (var i = milik.length - 1; i >= 0 && out.length < 200; i--) out.push(bentukTransaksi_(milik[i]));
  return { pelanggan: tampilPelanggan_(p, atur), transaksi: out, pesan: Inti.susunPesan('kartu_baru', atur, p, keadaan_(p), Inti.tautanKartu(atur, String(p.token))) };
}

function aksiDaftarPelanggan_(d) {
  var atur = pengaturan_(), t = Inti.target(atur), kini = new Date().getTime();
  var semua = bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN);
  var q = Inti.teks(d.q, 60).toLowerCase(), digit = q.replace(/\D/g, ''), saring = Inti.teks(d.saring, 20) || 'semua', urut = Inti.teks(d.urut, 20) || 'terbaru';
  if (['semua', 'tinggal_satu', 'hadiah_tunda', 'lama_tidak_beli', 'belum_beli'].indexOf(saring) < 0) saring = 'semua';
  if (digit.indexOf('08') === 0) digit = '62' + digit.slice(1);
  var batasLama = kini - atur.lama_tidak_beli_hari * Inti.HARI, lolos = [], hitung = { semua: 0, tinggal_satu: 0, hadiah_tunda: 0, lama_tidak_beli: 0, belum_beli: 0 };
  for (var i = 0; i < semua.length; i++) {
    var p = semua[i];
    if (Inti.teks(p.status) !== 'aktif') continue;
    var stempel = Inti.bulat(p.stempel, 0), siap = Inti.bulat(p.hadiah_siap, 0), beli = Inti.bulat(p.total_beli, 0), akhir = Inti.keTanggal(p.stempel_terakhir);
    var kelompok = {
      semua: true, tinggal_satu: siap === 0 && stempel === t - 1, hadiah_tunda: siap > 0,
      lama_tidak_beli: beli >= 1 && !!akhir && akhir.getTime() < batasLama, belum_beli: beli === 0
    };
    if (q) {
      var cocok = String(p.nama).toLowerCase().indexOf(q) >= 0 || String(p.kode).toLowerCase().indexOf(q) >= 0 || (digit.length >= 4 && String(p.wa).indexOf(digit) >= 0);
      if (!cocok) continue;
    }
    Object.keys(hitung).forEach(function (k) { if (kelompok[k]) hitung[k] += 1; });
    if (kelompok[saring]) lolos.push(p);
  }
  lolos.sort(function (a, b) {
    if (urut === 'nama') return String(a.nama).toLowerCase() < String(b.nama).toLowerCase() ? -1 : 1;
    if (urut === 'stempel') return (Inti.bulat(b.hadiah_siap, 0) * 100 + Inti.bulat(b.stempel, 0)) - (Inti.bulat(a.hadiah_siap, 0) * 100 + Inti.bulat(a.stempel, 0));
    if (urut === 'terakhir_beli') {
      var x = Inti.keTanggal(a.stempel_terakhir), y = Inti.keTanggal(b.stempel_terakhir);
      return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
    }
    return Inti.bulat(b.no_anggota, 0) - Inti.bulat(a.no_anggota, 0);
  });
  var per = 50, halaman = Math.max(1, Inti.bulat(d.halaman, 1)), awal = (halaman - 1) * per, out = [];
  for (var j = awal; j < lolos.length && j < awal + per; j++) out.push(tampilPelanggan_(lolos[j], atur));
  return { total: lolos.length, halaman: halaman, per: per, baris: out, hitung: hitung };
}

function aksiAktivitas_(d) {
  var semuaP = bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN), nama = {};
  for (var i = 0; i < semuaP.length; i++) nama[String(semuaP[i].id)] = { nama: String(semuaP[i].nama), kode: String(semuaP[i].kode) };
  var semua = bacaSemua_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI), batal = {};
  for (var b = 0; b < semua.length; b++) if (String(semua[b].jenis) === Inti.JENIS.BATAL && semua[b].ref) batal[String(semua[b].ref)] = true;
  var jenis = Inti.teks(d.jenis, 20), admin = Inti.teks(d.admin, 40).toLowerCase();
  var dari = d.dari ? Inti.keTanggal(String(d.dari) + 'T00:00:00+07:00') : null, sampai = d.sampai ? Inti.keTanggal(String(d.sampai) + 'T23:59:59+07:00') : null;
  var lolos = [], adminAda = {};
  for (var j = semua.length - 1; j >= 0; j--) {
    var t = semua[j], w = Inti.keTanggal(t.waktu);
    if (t.admin) adminAda[String(t.admin)] = true;
    if (jenis && String(t.jenis) !== jenis) continue;
    if (!jenis && String(t.jenis) === Inti.JENIS.PERSETUJUAN) continue;
    if (admin && String(t.admin).toLowerCase() !== admin) continue;
    if (dari && (!w || w.getTime() < dari.getTime())) continue;
    if (sampai && (!w || w.getTime() > sampai.getTime())) continue;
    t._batal = !!batal[String(t.id)];
    lolos.push(t);
  }
  var per = 50, halaman = Math.max(1, Inti.bulat(d.halaman, 1)), awal = (halaman - 1) * per, out = [];
  for (var k = awal; k < lolos.length && k < awal + per; k++) {
    var x = bentukTransaksi_(lolos[k]), n = nama[x.id_pelanggan] || { nama: '(tidak dikenal)', kode: '' };
    x.nama = n.nama; x.kode = n.kode;
    out.push(x);
  }
  return { total: lolos.length, halaman: halaman, per: per, baris: out, admin: Object.keys(adminAda).sort() };
}

/* =====================================================================
 * AKSI KARTU PEMBELI
 * ===================================================================== */

function tokenSah_(t) {
  var token = Inti.teks(t, 80);
  if (!/^[A-Za-z0-9]{16,64}$/.test(token)) throw Inti.galat('KARTU_TIDAK_ADA', PESAN_KARTU_TIDAK_ADA);
  return token;
}

function pelangganDariToken_(token) {
  var c = cache_();
  var sh = tab_(TAB.PELANGGAN), baris = cariBaris_(sh, 6, token);
  if (!baris) {
    var gagal = (Number(c.get('gagaltoken')) || 0) + 1;
    c.put('gagaltoken', String(gagal), 600);
    if (gagal > 200) Utilities.sleep(800);
    throw Inti.galat('KARTU_TIDAK_ADA', PESAN_KARTU_TIDAK_ADA);
  }
  var p = bacaBaris_(sh, baris, KOLOM.PELANGGAN);
  // Jangan pernah mengembalikan kartu orang lain: kalau barisnya bergeser di antara dua bacaan, minta coba lagi.
  if (String(p.token) !== token) throw Inti.galat('SIBUK', 'Server sedang ramai. Coba lagi sebentar.');
  if (Inti.teks(p.status) !== 'aktif') throw Inti.galat('KARTU_TIDAK_ADA', PESAN_KARTU_TIDAK_ADA);
  return p;
}

function aksiKartu_(d) {
  var token = tokenSah_(d.t), c = cache_(), hasil = null;
  var simpanan = c.get('kartu:' + token);
  if (simpanan) { try { hasil = JSON.parse(simpanan); } catch (x) { hasil = null; } }
  if (!hasil) {
    hasil = muatanKartu_(pelangganDariToken_(token), pengaturan_());   // token yang tidak dikenal berhenti di sini
    c.put('kartu:' + token, JSON.stringify(hasil), 30);
  }
  // Hitungan laju hanya dibuat untuk kartu yang memang ada, supaya token acak tidak memenuhi cache.
  var laju = (Number(c.get('laju:' + token)) || 0) + 1;
  c.put('laju:' + token, String(laju), 60);
  if (laju > 90) throw Inti.galat('TERLALU_SERING', 'Kartu dibuka terlalu sering. Coba lagi satu menit lagi.');
  return hasil;
}

function aksiSetuju_(d) {
  var token = tokenSah_(d.t);
  return denganKunci_(function () {
    var atur = pengaturan_(), p = pelangganDariToken_(token);
    if (!Inti.keTanggal(p.tgl_setuju)) {
      var kini = new Date();
      catat_(p, keadaan_(p), { jenis: Inti.JENIS.PERSETUJUAN, jumlah: 0, admin: 'pelanggan', sumber: 'pelanggan', catatan: 'Setuju nama dan nomor WhatsApp disimpan untuk mencatat stempel' }, atur, kini, { tgl_setuju: kini });
    }
    return muatanKartu_(p, atur);
  });
}

function aksiHapusDataSaya_(d) {
  var token = tokenSah_(d.t);
  return denganKunci_(function () {
    var atur = pengaturan_(), p = pelangganDariToken_(token);
    hapusIdentitas_(p, atur, new Date(), 'pelanggan', 'pelanggan', '');
    return { dihapus: true };
  });
}

/* =====================================================================
 * PINTU OTOMATIS (n8n / Laura): hanya mengembalikan teks, tidak pernah mengirim pesan.
 * ===================================================================== */

function cariAtauBuat_(d, atur, kini, boleBuat) {
  var wa = Inti.normalWa(d.wa);
  if (!wa) throw Inti.galat('WA_TIDAK_SAH', 'Nomor WhatsApp tidak sah.');
  var p = pelangganDariWa_(wa), baru = false;
  if (!p) {
    if (!boleBuat) return { p: null, baru: false, wa: wa };
    wajibProgramAktif_(atur);
    var nama = Inti.rapikanNama(d.nama) || 'Kakak';
    p = buatPelanggan_(nama, wa, atur, kini, Inti.teks(d.oleh, 40) || 'laura', 'otomatis', '', '');
    baru = true;
  }
  return { p: p, baru: baru, wa: wa };
}

function ringkasOtomatis_(p, atur, tambahan) {
  var k = keadaan_(p), v = Inti.tampilanKartu(k, atur);
  var out = {
    ada: true, id: String(p.id), nama: String(p.nama), kode: String(p.kode), stempel: v.isi, target: v.target, sisa: v.sisa,
    kartu_ke: v.kartu_ke, kartu_penuh: v.penuh, hadiah_siap: k.hadiah_siap, total_hadiah: k.total_hadiah, hadiah: atur.teks_hadiah,
    boleh_stempel_awal: !k.asal_awal, tautan: Inti.tautanKartu(atur, String(p.token))
  };
  if (tambahan) Object.keys(tambahan).forEach(function (kunci) { out[kunci] = tambahan[kunci]; });
  return out;
}

function otomatisKartu_(d) {
  var atur = pengaturan_();
  if (!d.buat) {
    var c = cariAtauBuat_(d, atur, new Date(), false);
    if (!c.p) return { ada: false, pesan: '' };
    return ringkasOtomatis_(c.p, atur, { pesan: Inti.susunPesan('kartu_baru', atur, c.p, keadaan_(c.p), Inti.tautanKartu(atur, String(c.p.token))) });
  }
  return denganKunci_(function () {
    var r = cariAtauBuat_(d, atur, new Date(), true);
    return ringkasOtomatis_(r.p, atur, { baru: r.baru, pesan: Inti.susunPesan('kartu_baru', atur, r.p, keadaan_(r.p), Inti.tautanKartu(atur, String(r.p.token))) });
  });
}

function otomatisStempel_(d) {
  var nomor = Inti.teks(d.nomor_pesanan, 60);
  if (!nomor) throw Inti.galat('NOMOR_PESANAN_KOSONG', 'nomor_pesanan wajib diisi untuk stempel otomatis.');
  return denganKunci_(function () {
    var atur = pengaturan_(), kini = new Date();
    var ganda = pesananSudahDistempel_(nomor);
    if (ganda) {
      // Aman dipanggil ulang: pesanan yang sama tidak menambah stempel lagi.
      var lama = pelangganDariId_(ganda.id_pelanggan);
      return ringkasOtomatis_(lama, atur, { sudah: true, pesan: '' });
    }
    var r = cariAtauBuat_(d, atur, kini, true);
    var h = lakukanStempel_(r.p, { nomor_pesanan: nomor, jumlah: d.jumlah, catatan: d.catatan, konfirmasi: true }, atur, kini, Inti.teks(d.oleh, 40) || 'laura', 'otomatis');
    return ringkasOtomatis_(r.p, atur, { sudah: false, baru: r.baru, hadiah_baru: h.hadiah_baru, kartu_penuh: h.kartu_penuh, pesan: h.kartu_penuh ? h.pesan_tunda : h.pesan, pesan_hadiah_ikut_paket: h.kartu_penuh ? h.pesan : '' });
  });
}

function otomatisStempelAwal_(d) {
  return denganKunci_(function () {
    var atur = pengaturan_(), kini = new Date();
    var r = cariAtauBuat_(d, atur, kini, true);
    if (Inti.teks(r.p.asal_awal)) return ringkasOtomatis_(r.p, atur, { sudah: true, pesan: '' });
    var h = lakukanStempelAwal_(r.p, { asal: d.asal, catatan: d.catatan }, atur, kini, Inti.teks(d.oleh, 40) || 'laura', 'otomatis');
    return ringkasOtomatis_(r.p, atur, { sudah: false, baru: r.baru, pesan: h.pesan });
  });
}

/* =====================================================================
 * OWNER: ringkasan, admin, data contoh
 * ===================================================================== */

function dataRingkasan_() {
  var atur = pengaturan_();
  var p = bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN), t = bacaSemua_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI);
  var pel = [], trx = [];
  for (var i = 0; i < p.length; i++) {
    pel.push({
      id: String(p[i].id), nama: String(p[i].nama), wa: String(p[i].wa), kode: String(p[i].kode), no_anggota: p[i].no_anggota,
      stempel: p[i].stempel, hadiah_siap: p[i].hadiah_siap, total_beli: p[i].total_beli, total_hadiah: p[i].total_hadiah,
      asal_awal: Inti.teks(p[i].asal_awal), tgl_daftar: p[i].tgl_daftar, stempel_terakhir: p[i].stempel_terakhir, status: Inti.teks(p[i].status), contoh: !!Inti.teks(p[i].contoh)
    });
  }
  for (var j = 0; j < t.length; j++) trx.push({ id: String(t[j].id), waktu: t[j].waktu, id_pelanggan: String(t[j].id_pelanggan), jenis: String(t[j].jenis), jumlah: t[j].jumlah, ref: String(t[j].ref || ''), contoh: !!Inti.teks(t[j].contoh) });
  return Inti.hitungRingkasan(pel, trx, atur, new Date());
}

function aksiRingkasan_() {
  var c = cache_(), s = c.get('ringkasan');
  if (s) { try { return JSON.parse(s); } catch (x) { /* hitung ulang */ } }
  var r = dataRingkasan_();
  r.tinggal_satu = r.tinggal_satu.slice(0, 100);
  r.lama_tidak_beli = r.lama_tidak_beli.slice(0, 100);
  r.tinggal_satu.forEach(function (x) { x.wa_tampil = Inti.tampilWa(x.wa); });
  r.lama_tidak_beli.forEach(function (x) { x.wa_tampil = Inti.tampilWa(x.wa); });
  try { c.put('ringkasan', JSON.stringify(r), 60); } catch (y) { /* terlalu besar: tidak disimpan */ }
  return r;
}

function aksiAdminTambah_(d) {
  var nama = Inti.teks(d.nama, 30), peran = Inti.teks(d.peran, 10) === 'owner' ? 'owner' : 'admin';
  if (nama.length < 2) throw Inti.galat('NAMA_KOSONG', 'Isi nama admin dulu.');
  var pin = periksaPinBaru_(d.pin);
  return denganKunci_(function () {
    cache_().remove('admin');
    if (cariAdmin_(nama)) throw Inti.galat('ADMIN_SUDAH_ADA', 'Sudah ada admin dengan nama itu.');
    var garam = acak_(16);
    tambahBaris_(tab_(TAB.ADMIN), KOLOM.ADMIN, FORMAT.ADMIN, { nama: nama, peran: peran, garam: garam, hash_pin: hashPin_(garam, pin), status: 'aktif', wajib_ganti_pin: 'ya', dibuat: new Date() });
    cache_().remove('admin');
    return aksiPengaturanBaca_();
  });
}

function aksiAdminUbah_(d, saya) {
  var nama = Inti.teks(d.nama, 30);
  return denganKunci_(function () {
    cache_().remove('admin');
    var a = cariAdmin_(nama);
    if (!a) throw Inti.galat('ADMIN_TIDAK_ADA', 'Admin tidak ditemukan.');
    var sh = tab_(TAB.ADMIN), baris = bacaBaris_(sh, a._baris, KOLOM.ADMIN);
    var statusBaru = d.status === undefined ? a.status : (Inti.teks(d.status, 10) === 'aktif' ? 'aktif' : 'nonaktif');
    var peranBaru = d.peran === undefined ? a.peran : (Inti.teks(d.peran, 10) === 'owner' ? 'owner' : 'admin');
    if (a.nama.toLowerCase() === saya.nama.toLowerCase() && (statusBaru !== 'aktif' || peranBaru !== 'owner')) throw Inti.galat('TIDAK_BOLEH', 'Owner yang sedang masuk tidak bisa menonaktifkan atau menurunkan dirinya sendiri.');
    baris.status = statusBaru; baris.peran = peranBaru;
    tulisBaris_(sh, a._baris, KOLOM.ADMIN, FORMAT.ADMIN, baris);
    cache_().remove('admin');
    return aksiPengaturanBaca_();
  });
}

function aksiAdminResetPin_(d) {
  var nama = Inti.teks(d.nama, 30), pin = periksaPinBaru_(d.pin);
  return denganKunci_(function () {
    aturPinAdmin_(nama, pin, 'ya');
    cache_().remove('kunci:' + nama.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40));
    return aksiPengaturanBaca_();
  });
}

// Perawatan yang biasanya ada di menu spreadsheet, supaya Owner bisa menjalankannya dari Meja Stempel.
function aksiTesSistem_() { return { hasil: ujiCepat() }; }
function aksiPeriksaSaldo_() {
  var n = denganKunci_(periksaSaldo_);
  try { tulisRingkasan_(); } catch (x) { /* tampilan saja */ }
  return { diperbaiki: n };
}

function aksiIsiContoh_() { return { ditambah: isiDataContoh_() }; }
function aksiHapusContoh_() { return { dihapus: hapusDataContoh_() }; }

/* ---------- daftar aksi ---------- */

var AKSI_PUBLIK = { kartu: aksiKartu_, setuju: aksiSetuju_, hapus_data_saya: aksiHapusDataSaya_, masuk: aksiMasuk_, daftar_admin: aksiDaftarAdmin_ };
var AKSI_ADMIN = {
  info: aksiInfo_, ganti_pin: aksiGantiPin_, cari: aksiCari_, daftar: aksiDaftar_, stempel: aksiStempel_, stempel_awal: aksiStempelAwal_,
  batal: aksiBatal_, hadiah: aksiHadiah_, hadiah_tunda: aksiHadiahTunda_, penyesuaian: aksiPenyesuaian_, ubah_nama: aksiUbahPelanggan_, ubah_pelanggan: aksiUbahPelanggan_,
  hapus_pelanggan: aksiHapusPelanggan_, pelanggan: aksiPelanggan_, daftar_pelanggan: aksiDaftarPelanggan_, aktivitas: aksiAktivitas_
};
var AKSI_OWNER = {
  ringkasan: aksiRingkasan_, pengaturan_baca: aksiPengaturanBaca_, pengaturan_simpan: aksiPengaturanSimpan_,
  admin_tambah: aksiAdminTambah_, admin_ubah: aksiAdminUbah_, admin_reset_pin: aksiAdminResetPin_, kunci_api_baru: aksiKunciApiBaru_,
  isi_contoh: aksiIsiContoh_, hapus_contoh: aksiHapusContoh_, tes_sistem: aksiTesSistem_, periksa_saldo: aksiPeriksaSaldo_
};
var AKSI_OTOMATIS = { otomatis_kartu: otomatisKartu_, otomatis_stempel: otomatisStempel_, otomatis_stempel_awal: otomatisStempelAwal_ };

/* =====================================================================
 * PEMASANGAN & PERAWATAN (dijalankan dari Apps Script atau menu "Kartu Aura")
 * ===================================================================== */

function siapkanTab_(ss, nama, judul, format, lebar) {
  var sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  var kepala = sh.getRange(1, 1, 1, judul.length);
  kepala.setNumberFormat(FMT_TEKS);
  kepala.setValues([judul]);
  try {
    kepala.setFontWeight('bold').setBackground('#111111').setFontColor('#F3EAD7');
    sh.setFrozenRows(1);
    var baris = Math.max(1, sh.getMaxRows() - 1);
    for (var j = 0; j < format.length; j++) sh.getRange(2, j + 1, baris, 1).setNumberFormat(format[j]);
    if (lebar) for (var k = 0; k < lebar.length; k++) if (lebar[k]) sh.setColumnWidth(k + 1, lebar[k]);
  } catch (x) { /* tampilan saja; boleh gagal */ }
  return sh;
}

function lindungi_(sh, keterangan) {
  try {
    var ada = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (ada && ada.length) return;
    sh.protect().setDescription(keterangan).setWarningOnly(true);
  } catch (x) { /* tampilan saja; boleh gagal */ }
}

/**
 * Isi "pasang". Skrip yang berdiri sendiri membuat spreadsheet datanya di sini (sekali saja);
 * skrip yang menempel di sebuah sheet memakai sheet itu.
 */
function pasangSemua_() {
  var props = PropertiesService.getScriptProperties(), catatan = [], ss = null, menempel = false, baruDibuat = false;
  try { menempel = !!SpreadsheetApp.getActiveSpreadsheet(); } catch (x00) { menempel = false; }
  if (props.getProperty('ID_BUKU') || menempel) {
    // Sudah punya spreadsheet. Kalau sedang tidak terjangkau, berhenti di sini: jangan diam-diam membuat yang baru.
    ss = buku_();
  } else {
    // Skrip berdiri sendiri dan belum punya spreadsheet: buat sekarang di Google Drive akun ini.
    ss = SpreadsheetApp.create(NAMA_BUKU);
    props.setProperty('ID_BUKU', ss.getId());
    BUKU_ = ss;
    baruDibuat = true;
    catatan.push('Spreadsheet data baru dibuat di Google Drive dengan nama "' + NAMA_BUKU + '".');
  }
  try { ss.setSpreadsheetTimeZone('Asia/Jakarta'); } catch (x) { catatan.push('Zona waktu spreadsheet tidak bisa diatur otomatis; atur manual ke Jakarta.'); }

  var shP = siapkanTab_(ss, TAB.PELANGGAN, JUDUL.PELANGGAN, FORMAT.PELANGGAN, [70, 90, 190, 140, 110, 210, 70, 110, 90, 130, 100, 130, 140, 140, 140, 80, 300, 80]);
  var shT = siapkanTab_(ss, TAB.TRANSAKSI, JUDUL.TRANSAKSI, FORMAT.TRANSAKSI, [170, 140, 90, 130, 70, 150, 130, 110, 260, 110, 90, 70, 130, 150, 190, 170, 80]);
  var shA = siapkanTab_(ss, TAB.ADMIN, JUDUL.ADMIN, FORMAT.ADMIN, [160, 90, 160, 330, 90, 130, 140]);
  var shS = siapkanTab_(ss, TAB.PENGATURAN, JUDUL.PENGATURAN, FORMAT.PENGATURAN, [200, 420, 520]);
  var shR = ss.getSheetByName(TAB.RINGKASAN) || ss.insertSheet(TAB.RINGKASAN, 0);

  lindungi_(shP, 'Data pelanggan Kartu Aura. Ubah lewat Meja Stempel, bukan di sini.');
  lindungi_(shT, 'Buku transaksi Kartu Aura. Jangan diubah atau dihapus.');
  lindungi_(shA, 'Akun admin Kartu Aura. Kelola lewat Meja Stempel > Pengaturan.');
  lindungi_(shR, 'Ringkasan ditulis otomatis.');

  // Pengaturan: tambahkan kunci yang belum ada.
  var ada = {}, baris = bacaSemua_(shS, KOLOM.PENGATURAN);
  for (var i = 0; i < baris.length; i++) ada[Inti.teks(baris[i].kunci, 40)] = true;
  var baru = [];
  Object.keys(Inti.PENGATURAN_BAWAAN).forEach(function (k) {
    if (!ada[k]) baru.push({ kunci: k, nilai: String(Inti.PENGATURAN_BAWAAN[k]), keterangan: Inti.KETERANGAN_PENGATURAN[k] || '' });
  });
  if (baru.length) tulisBanyak_(shS, Math.max(2, shS.getLastRow() + 1), KOLOM.PENGATURAN, FORMAT.PENGATURAN, baru);
  try { shS.getRange(2, 2, Math.max(1, shS.getMaxRows() - 1), 2).setWrap(true); } catch (x2) { /* tampilan saja */ }
  cache_().remove('atur');

  // Akun Owner pertama.
  cache_().remove('admin');
  if (!daftarAdmin_().length) {
    var garam = acak_(16);
    tambahBaris_(shA, KOLOM.ADMIN, FORMAT.ADMIN, { nama: 'Owner', peran: 'owner', garam: garam, hash_pin: hashPin_(garam, PIN_AWAL), status: 'aktif', wajib_ganti_pin: 'ya', dibuat: new Date() });
    cache_().remove('admin');
    catatan.push('Akun pertama: nama "Owner", PIN ' + PIN_AWAL + '. PIN wajib diganti saat pertama masuk.');
  }

  rahasia_('RAHASIA_SESI'); rahasia_('RAHASIA_PIN'); rahasia_('KUNCI_API');

  // Tugas harian (perbarui ringkasan, periksa saldo, hanguskan stempel kalau diatur).
  // Untuk skrip yang berdiri sendiri, ditambah pemicu yang memperbarui tab Ringkasan setiap spreadsheet dibuka
  // (skrip yang menempel di sheet sudah punya onOpen).
  var sudah = false, sudahBuka = false;
  try {
    var pemicu = ScriptApp.getProjectTriggers();
    for (var t = 0; t < pemicu.length; t++) {
      if (pemicu[t].getHandlerFunction() === 'tugasHarian') sudah = true;
      if (pemicu[t].getHandlerFunction() === 'saatDibuka') sudahBuka = true;
    }
    if (!sudah) ScriptApp.newTrigger('tugasHarian').timeBased().everyDays(1).atHour(1).inTimezone('Asia/Jakarta').create();
  } catch (x3) { catatan.push('Tugas harian belum terpasang (' + x3.message + '). Jalankan "pasang" sekali lagi dan izinkan semua yang diminta.'); }
  try {
    if (!menempel && !sudahBuka) ScriptApp.newTrigger('saatDibuka').forSpreadsheet(ss.getId()).onOpen().create();
  } catch (x6) { catatan.push('Pembaruan tab Ringkasan saat spreadsheet dibuka belum terpasang (' + x6.message + '). Jalankan "pasang" sekali lagi dan izinkan semua yang diminta.'); }

  // Buang tab bawaan yang kosong. Di spreadsheet yang baru saja dibuat skrip ini, satu-satunya tab lain adalah tab bawaan,
  // apa pun namanya. Di spreadsheet milik orang, hanya tab kosong bernama bawaan yang dibuang.
  try {
    var milik = {}; Object.keys(TAB).forEach(function (k) { milik[TAB[k]] = true; });
    var lembar = ss.getSheets();
    for (var s = 0; s < lembar.length; s++) {
      var nm = lembar[s].getName();
      if (milik[nm] || lembar[s].getLastRow() !== 0 || ss.getSheets().length <= 1) continue;
      if (baruDibuat || nm === 'Sheet1' || nm === 'Sheet 1' || nm === 'Lembar1' || nm === 'Lembar 1') ss.deleteSheet(lembar[s]);
    }
  } catch (x4) { /* tidak penting */ }

  tulisRingkasan_();
  SpreadsheetApp.flush();
  var alamat = '';
  try { alamat = ss.getUrl() || ''; } catch (x7) { alamat = ''; }
  // Satu hal per baris, supaya enak dibaca di Execution log.
  var baris = ['Kartu Aura terpasang (versi ' + VERSI + ').'].concat(catatan.length ? catatan : ['Tab sudah lengkap.']);
  if (alamat) baris.push('Spreadsheet data: ' + alamat);
  baris.push('Kalau belum: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
  var pesan = baris.join('\n');
  try { Logger.log(pesan); } catch (x5) { /* abaikan */ }
  return pesan;
}

/** Dipasang oleh "pasang" untuk skrip yang berdiri sendiri: memperbarui tab Ringkasan setiap spreadsheet dibuka. */
function saatDibuka() {
  try { tulisRingkasan_(); } catch (x) { /* tampilan saja */ }
}

/** Isi "resetPinOwner". */
function kembalikanPinOwner_() {
  var pesan = denganKunci_(function () {
    cache_().remove('admin');
    var semua = daftarAdmin_(), nama = [];
    for (var i = 0; i < semua.length; i++) {
      if (semua[i].peran !== 'owner' || semua[i].status !== 'aktif') continue;
      aturPinAdmin_(semua[i].nama, PIN_AWAL, 'ya');
      var kunci = semua[i].nama.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
      cache_().remove('kunci:' + kunci);
      cache_().remove('gagal:' + kunci);
      nama.push(semua[i].nama);
    }
    return nama.length
      ? 'PIN ' + nama.join(', ') + ' dikembalikan ke ' + PIN_AWAL + ' dan wajib diganti saat masuk.'
      : 'Tidak ada akun Owner yang aktif. Di tab Admin, isi kolom Status salah satu Owner dengan "aktif", lalu jalankan lagi.';
  });
  try { Logger.log(pesan); } catch (x) { /* abaikan */ }
  return pesan;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Kartu Aura')
      .addItem('Perbarui ringkasan', 'menuPerbaruiRingkasan')
      .addItem('Periksa saldo stempel', 'menuPeriksaSaldo')
      .addSeparator()
      .addItem('Isi data contoh', 'menuIsiContoh')
      .addItem('Hapus data contoh', 'menuHapusContoh')
      .addSeparator()
      .addItem('Pasang / lengkapi tab', 'menuPasang')
      .addItem('Tes sistem', 'menuTes')
      .addToUi();
  } catch (x) { /* dibuka tanpa antarmuka */ }
  try { if (buku_().getSheetByName(TAB.PELANGGAN)) tulisRingkasan_(); } catch (y) { /* biarkan */ }
}

function beriTahu_(pesan) {
  try { SpreadsheetApp.getUi().alert(pesan); } catch (x) { try { Logger.log(pesan); } catch (y) { /* abaikan */ } }
}

function menuPasang() { beriTahu_(pasang()); }
function menuPerbaruiRingkasan() { tulisRingkasan_(); beriTahu_('Ringkasan sudah diperbarui.'); }
function menuPeriksaSaldo() { var n = denganKunci_(periksaSaldo_); beriTahu_(n ? n + ' baris pelanggan diperbaiki supaya cocok dengan buku transaksi.' : 'Semua saldo cocok dengan buku transaksi.'); }
function menuIsiContoh() { beriTahu_(isiDataContoh_() + ' pelanggan contoh ditambahkan. Semuanya bertanda CONTOH dan bisa dihapus lewat menu.'); }
function menuHapusContoh() { beriTahu_(hapusDataContoh_() + ' baris contoh dihapus.'); }
function menuTes() { beriTahu_(ujiCepat()); }

/** Dijalankan otomatis sekali sehari. */
function tugasHarian() {
  denganKunci_(function () {
    var atur = pengaturan_(), kini = new Date();
    if (atur.masa_berlaku_bulan > 0) {
      var semua = bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN);
      for (var i = 0; i < semua.length; i++) if (Inti.teks(semua[i].status) === 'aktif') terapkanHangus_(semua[i], atur, kini);
    }
    periksaSaldo_();
  });
  tulisRingkasan_();
}

/**
 * Mencocokkan baris pelanggan dengan buku transaksi (sumber kebenaran).
 * Mengembalikan jumlah baris yang diperbaiki.
 */
function periksaSaldo_() {
  var shP = tab_(TAB.PELANGGAN), semuaP = bacaSemua_(shP, KOLOM.PELANGGAN), semuaT = bacaSemua_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI);
  var batal = {}, jenisTrx = {}, per = {};
  for (var i = 0; i < semuaT.length; i++) {
    var t = semuaT[i];
    jenisTrx[String(t.id)] = String(t.jenis);
    if (String(t.jenis) === Inti.JENIS.BATAL && t.ref) batal[String(t.ref)] = true;
  }
  for (var j = 0; j < semuaT.length; j++) {
    var x = semuaT[j], id = String(x.id_pelanggan);
    if (!per[id]) per[id] = { beli: 0, hadiah: 0, asal: '', akhir: null };
    var o = per[id], jn = String(x.jenis);
    if (jn === Inti.JENIS.STEMPEL && !batal[String(x.id)]) o.beli += 1;
    if (jn === Inti.JENIS.STEMPEL_AWAL && !batal[String(x.id)]) o.asal = String(x.asal || '');
    if (jn === Inti.JENIS.HADIAH) o.hadiah += 1;
    // Setiap baris transaksi mencatat keadaan kartu sesudahnya; transaksi yang paling akhir WAKTUNYA adalah keadaan terkini.
    // Sengaja tidak bergantung pada letak baris, supaya tetap benar walau tab ini pernah diurutkan orang.
    var wx = Inti.keTanggal(x.waktu), ms = wx ? wx.getTime() : 0;
    if (!o.akhir || ms >= o.ms) {
      o.ms = ms;
      o.akhir = { kartu_ke: Inti.bulat(x.kartu_ke, 1), stempel: Inti.bulat(x.saldo_setelah, 0), hadiah_siap: Inti.bulat(x.hadiah_siap, 0) };
    }
  }
  var diperbaiki = 0;
  for (var k = 0; k < semuaP.length; k++) {
    var p = semuaP[k], d = per[String(p.id)];
    if (!d || !d.akhir) continue;
    var beda = Inti.bulat(p.kartu_ke, 1) !== d.akhir.kartu_ke || Inti.bulat(p.stempel, 0) !== d.akhir.stempel || Inti.bulat(p.hadiah_siap, 0) !== d.akhir.hadiah_siap ||
      Inti.bulat(p.total_beli, 0) !== d.beli || Inti.bulat(p.total_hadiah, 0) !== d.hadiah || Inti.teks(p.asal_awal) !== d.asal;
    if (!beda) continue;
    p.kartu_ke = d.akhir.kartu_ke; p.stempel = d.akhir.stempel; p.hadiah_siap = d.akhir.hadiah_siap; p.total_beli = d.beli; p.total_hadiah = d.hadiah; p.asal_awal = d.asal;
    tulisPelanggan_(p);
    if (p.token) buangCache_('kartu:' + p.token);
    diperbaiki += 1;
  }
  if (diperbaiki) buangCache_('ringkasan');
  return diperbaiki;
}

/* ---------- tab Ringkasan ---------- */

function tulisBlok_(sh, baris, kolom, nilai, format) {
  if (!nilai.length) return;
  pastikanBaris_(sh, baris + nilai.length - 1);
  var aman = [], fmt = [];
  for (var i = 0; i < nilai.length; i++) {
    var b = [], f = [];
    for (var j = 0; j < nilai[i].length; j++) { b.push(amanSel_(nilai[i][j])); f.push(format ? format[j] : (typeof nilai[i][j] === 'number' ? FMT_ANGKA : FMT_TEKS)); }
    aman.push(b); fmt.push(f);
  }
  var r = sh.getRange(baris, kolom, nilai.length, nilai[0].length);
  r.setNumberFormats(fmt);
  r.setValues(aman);
}

function tulisRingkasan_() {
  var ss = buku_(), sh = ss.getSheetByName(TAB.RINGKASAN);
  if (!sh) return;
  var r = dataRingkasan_(), atur = pengaturan_(), kini = new Date();
  var akhir = Math.max(sh.getLastRow(), 60), lebar = 12;
  pastikanBaris_(sh, akhir);
  sh.getRange(1, 1, akhir, lebar).clearContent();

  tulisBlok_(sh, 1, 1, [['Ringkasan ' + atur.nama_program, 'Diperbarui ' + Inti.teksWaktu(kini)]]);
  var kpi = [
    ['Pemegang kartu aktif', r.pemegang_kartu],
    ['Kartu baru, 7 hari terakhir', r.kartu_baru_7],
    ['Kartu baru, 30 hari terakhir', r.kartu_baru_30],
    ['Pembelian lewat WhatsApp, 7 hari terakhir', r.stempel_beli_7],
    ['Pembelian lewat WhatsApp, 30 hari terakhir', r.stempel_beli_30],
    ['Pelanggan yang sudah beli lewat WhatsApp', r.pembeli_wa],
    ['Pelanggan yang beli lewat WhatsApp 2 kali atau lebih', r.pembeli_ulang],
    ['Hadiah yang sudah keluar', r.hadiah_keluar],
    ['Hadiah yang masih ditunda', r.hadiah_tunda],
    ['Pelanggan tinggal 1 stempel', r.jumlah_tinggal_satu],
    ['Pelanggan lama tidak beli (' + atur.lama_tidak_beli_hari + '+ hari)', r.jumlah_lama_tidak_beli]
  ];
  tulisBlok_(sh, 3, 1, kpi);
  if (r.ada_contoh) tulisBlok_(sh, 3 + kpi.length, 1, [['Catatan: masih ada data CONTOH. Hapus lewat menu Kartu Aura > Hapus data contoh sebelum dipakai sungguhan.', '']]);

  var barisAsal = 17;
  var asal = [['Asal Stempel Awal', 'Jumlah pelanggan', 'Lanjut beli lewat WhatsApp']];
  Inti.ASAL.forEach(function (a) { asal.push([a, r.asal[a].jumlah, r.asal[a].lanjut_beli]); });
  tulisBlok_(sh, barisAsal, 1, asal);

  var barisMinggu = 23;
  var minggu = [['Minggu mulai (Senin)', 'Pembelian lewat WhatsApp', 'Kartu baru']];
  r.mingguan.forEach(function (m) { minggu.push([m.mulai, m.stempel, m.kartu_baru]); });
  tulisBlok_(sh, barisMinggu, 1, minggu, [FMT_TEKS, FMT_ANGKA, FMT_ANGKA]);

  var satu = [['Tinggal 1 stempel', 'WhatsApp', 'Kode kartu']];
  r.tinggal_satu.slice(0, 200).forEach(function (x) { satu.push([x.nama, Inti.tampilWa(x.wa), x.kode]); });
  tulisBlok_(sh, 1, 5, satu, [FMT_TEKS, FMT_TEKS, FMT_TEKS]);

  var lama = [['Lama tidak beli', 'WhatsApp', 'Kode kartu', 'Stempel terakhir']];
  r.lama_tidak_beli.slice(0, 200).forEach(function (x) { lama.push([x.nama, Inti.tampilWa(x.wa), x.kode, Inti.teksTanggal(new Date(x.terakhir))]); });
  tulisBlok_(sh, 1, 9, lama, [FMT_TEKS, FMT_TEKS, FMT_TEKS, FMT_TEKS]);

  try {
    sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    sh.getRange(barisAsal, 1, 1, 3).setFontWeight('bold');
    sh.getRange(barisMinggu, 1, 1, 3).setFontWeight('bold');
    sh.getRange(1, 5, 1, 3).setFontWeight('bold');
    sh.getRange(1, 9, 1, 4).setFontWeight('bold');
    sh.setColumnWidth(1, 360); sh.setColumnWidth(2, 190); sh.setColumnWidth(3, 190); sh.setColumnWidth(4, 30);
    sh.setColumnWidth(5, 200); sh.setColumnWidth(6, 140); sh.setColumnWidth(7, 110); sh.setColumnWidth(8, 30);
    sh.setColumnWidth(9, 200); sh.setColumnWidth(10, 140); sh.setColumnWidth(11, 110); sh.setColumnWidth(12, 150);
    if (!sh.getCharts().length) {
      var grafik = sh.newChart().setChartType(Charts.ChartType.COLUMN)
        .addRange(sh.getRange(barisMinggu, 1, 13, 2))
        .setNumHeaders(1)
        .setPosition(barisMinggu + 15, 1, 0, 0)
        .setOption('title', 'Pembelian lewat WhatsApp per minggu')
        .setOption('legend', { position: 'none' })
        .setOption('colors', ['#C9A227'])
        .build();
      sh.insertChart(grafik);
    }
  } catch (x) { /* tampilan saja; boleh gagal */ }
}

/* ---------- data contoh ---------- */

function acakBerbenih_(benih) {
  var s = benih >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var NAMA_CONTOH = ['Rina Maharani', 'Dimas Pratama', 'Siti Aisyah', 'Bayu Saputra', 'Putri Ananda', 'Agus Setiawan', 'Dewi Lestari', 'Rizky Ramadhan', 'Nabila Zahra', 'Fajar Nugroho',
  'Intan Permata', 'Yoga Aditya', 'Melati Kusuma', 'Hendra Wijaya', 'Ayu Wulandari', 'Reza Firmansyah', 'Laras Anggraini', 'Ilham Maulana', 'Citra Kirana', 'Andi Kurniawan',
  'Maya Sari', 'Taufik Hidayat', 'Nadia Rahma', 'Eko Prasetyo', 'Salsa Bila', 'Galih Permana', 'Tika Amelia', 'Arif Budiman', 'Wulan Sari', 'Doni Irawan',
  'Fitri Handayani', 'Yusuf Hakim', 'Anisa Putri', 'Rangga Mahesa', 'Linda Marlina', 'Bagas Wicaksono', 'Sekar Arum', 'Haikal Akbar', 'Vina Oktaviani', 'Joko Susilo',
  'Kirana Dewi', 'Fauzan Azhar', 'Mega Puspita', 'Irfan Syahputra', 'Tari Rahayu', 'Aldi Febrian', 'Sinta Nuraini', 'Wahyu Santoso', 'Gita Savitri', 'Robby Darmawan'];
var AROMA_CONTOH = ['Senja', 'Embun', 'Rimba', 'Purnama'];

// Kejadian untuk riwayat ringkas di baris pelanggan contoh.
function kejadianContoh_(p, t, kSebelum, kSesudah, atur) {
  var e = { i: t.id, w: t.waktu.toISOString(), j: t.jenis, n: t.jumlah, k: kSesudah.kartu_ke };
  if (t.jenis === Inti.JENIS.STEMPEL || t.jenis === Inti.JENIS.STEMPEL_AWAL) {
    e.k = kSebelum.kartu_ke;
    e.s = kSesudah.kartu_ke > kSebelum.kartu_ke ? Inti.target(atur) : kSesudah.stempel;
    p.stempel_terakhir = t.waktu;
  }
  if (t.jenis === Inti.JENIS.HADIAH) { e.a = t.aroma; e.k = Math.max(1, kSesudah.kartu_ke - kSesudah.hadiah_siap - 1); }
  return e;
}

/** Menambah 50 pelanggan contoh dengan riwayat 60 hari. Semua baris bertanda CONTOH. */
function isiDataContoh_() {
  return denganKunci_(function () {
    var atur = pengaturan_(), acak = acakBerbenih_(20261105), kini = new Date().getTime();
    var shP = tab_(TAB.PELANGGAN), shT = tab_(TAB.TRANSAKSI);
    var nomor = bacaKolom_(shP, 2), maks = 0, kodeAda = {}, kolomKode = bacaKolom_(shP, 5), waAda = {}, kolomWa = bacaKolom_(shP, 4);
    for (var i = 0; i < nomor.length; i++) maks = Math.max(maks, Inti.bulat(nomor[i], 0));
    for (var j = 0; j < kolomKode.length; j++) kodeAda[String(kolomKode[j])] = true;
    for (var w = 0; w < kolomWa.length; w++) waAda[String(kolomWa[w])] = true;
    var pelanggan = [], transaksi = [], urut = 0;

    function trx(p, k, waktu, jenis, isi) {
      urut += 1;
      var t = {
        id: 'TC' + waktu.getTime().toString(36).toUpperCase() + '-' + urut, waktu: waktu, id_pelanggan: p.id, jenis: jenis, jumlah: isi.jumlah || 0, nomor_pesanan: isi.nomor || '',
        aroma: isi.aroma || '', asal: isi.asal || '', catatan: isi.catatan || '', admin: isi.admin || 'Contoh', sumber: isi.sumber || 'manual',
        kartu_ke: k.kartu_ke, saldo_setelah: k.stempel, hadiah_siap: k.hadiah_siap, id_permintaan: '', ref: '', contoh: 'CONTOH', _urut: urut
      };
      transaksi.push(t);
      return t;
    }

    for (var n = 0; n < NAMA_CONTOH.length; n++) {
      var wa = '62800' + ('00000000' + (n + 1)).slice(-8);
      if (waAda[wa]) continue;
      var no = maks + pelanggan.length + 1, kode;
      do { var bt = []; for (var b = 0; b < 8; b++) bt.push(Math.floor(acak() * 256)); kode = Inti.buatKode(bt); } while (kodeAda[kode]);
      kodeAda[kode] = true;
      var mulaiHari = 3 + Math.floor(acak() * 57);
      var waktu = new Date(kini - mulaiHari * Inti.HARI - Math.floor(acak() * 8 * 3600000));
      var p = {
        id: 'P' + Inti.nomorAnggota(no), no_anggota: no, nama: NAMA_CONTOH[n], wa: wa, kode: kode, token: acak_(22), kartu_ke: 1, stempel: 0, hadiah_siap: 0, total_beli: 0, total_hadiah: 0,
        asal_awal: '', tgl_daftar: waktu, tgl_setuju: '', stempel_terakhir: '', status: 'aktif', riwayat: '', contoh: 'CONTOH'
      };
      var k = Inti.keadaanKosong(), lama = k, riw = [];
      riw.push(kejadianContoh_(p, trx(p, k, waktu, Inti.JENIS.DAFTAR, {}), k, k, atur));
      if (acak() < 0.85) {
        waktu = new Date(waktu.getTime() + 60000 + Math.floor(acak() * 3600000));
        p.tgl_setuju = waktu;
        trx(p, k, waktu, Inti.JENIS.PERSETUJUAN, { admin: 'pelanggan', sumber: 'pelanggan' });
      }
      if (acak() < 0.7) {
        var asal = acak() < 0.72 ? 'TikTok Shop' : (acak() < 0.6 ? 'Shopee' : 'Lainnya');
        waktu = new Date(waktu.getTime() + 120000);
        lama = k;
        k = Inti.stempelAwal(lama, asal, atur).keadaan;
        riw.push(kejadianContoh_(p, trx(p, k, waktu, Inti.JENIS.STEMPEL_AWAL, { jumlah: 1, asal: asal }), lama, k, atur));
      }
      var beli = acak() < 0.3 ? 0 : (1 + Math.floor(acak() * acak() * 7));
      for (var s = 0; s < beli; s++) {
        var maju = Math.floor((mulaiHari * Inti.HARI / (beli + 1)) * (0.6 + acak() * 0.8));
        // Selalu maju minimal 1 menit, dan tidak melewati 1 jam yang lalu.
        waktu = new Date(Math.max(waktu.getTime() + 60000, Math.min(kini - 3600000, waktu.getTime() + Math.max(3600000, maju))));
        lama = k;
        var r = Inti.stempelBeli(lama, 1, atur);
        k = r.keadaan;
        riw.push(kejadianContoh_(p, trx(p, k, waktu, Inti.JENIS.STEMPEL, { jumlah: 1, nomor: 'CONTOH-' + (1000 + urut) }), lama, k, atur));
        if (r.hadiah_baru > 0 && acak() < 0.8) {
          lama = k;
          k = Inti.beriHadiah(lama).keadaan;
          waktu = new Date(waktu.getTime() + 60000);
          riw.push(kejadianContoh_(p, trx(p, k, waktu, Inti.JENIS.HADIAH, { jumlah: 1, aroma: AROMA_CONTOH[Math.floor(acak() * AROMA_CONTOH.length)] }), lama, k, atur));
        }
      }
      p.kartu_ke = k.kartu_ke; p.stempel = k.stempel; p.hadiah_siap = k.hadiah_siap; p.total_beli = k.total_beli; p.total_hadiah = k.total_hadiah; p.asal_awal = k.asal_awal;
      p.riwayat = JSON.stringify(riw.slice(-MAKS_RIWAYAT));
      pelanggan.push(p);
    }
    transaksi.sort(function (x, y) { return (x.waktu.getTime() - y.waktu.getTime()) || (x._urut - y._urut); });
    tulisBanyak_(shP, Math.max(2, shP.getLastRow() + 1), KOLOM.PELANGGAN, FORMAT.PELANGGAN, pelanggan);
    tulisBanyak_(shT, Math.max(2, shT.getLastRow() + 1), KOLOM.TRANSAKSI, FORMAT.TRANSAKSI, transaksi);
    cache_().remove('ringkasan');
    try { tulisRingkasan_(); } catch (x) { /* biarkan */ }
    return pelanggan.length;
  });
}

// Menghapus baris yang kolom "contoh"-nya berisi tanda tertentu. Hanya baris itu yang disentuh:
// lembar tidak pernah dikosongkan lalu ditulis ulang, jadi data lain aman walau proses terputus di tengah.
function buangBarisBertanda_(sh, kolom, tanda) {
  var tandaKolom = bacaKolom_(sh, kolom.indexOf('contoh') + 1), buang = 0, i = tandaKolom.length - 1;
  while (i >= 0) {   // dari bawah, per kelompok baris yang berurutan, supaya nomor baris di atasnya tidak bergeser
    if (Inti.teks(tandaKolom[i]) !== tanda) { i -= 1; continue; }
    var akhir = i;
    while (i >= 0 && Inti.teks(tandaKolom[i]) === tanda) i -= 1;
    var jumlah = akhir - i;
    if (sh.getMaxRows() - jumlah < 2) sh.insertRowsAfter(sh.getMaxRows(), 2);   // Sheets menolak menghapus semua baris
    sh.deleteRows(i + 3, jumlah);
    buang += jumlah;
  }
  return buang;
}

function hapusBertanda_(tanda) {
  return denganKunci_(function () {
    var token = [];
    bacaSemua_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN).forEach(function (p) { if (Inti.teks(p.contoh) === tanda && p.token) token.push(String(p.token)); });
    var n = buangBarisBertanda_(tab_(TAB.TRANSAKSI), KOLOM.TRANSAKSI, tanda) + buangBarisBertanda_(tab_(TAB.PELANGGAN), KOLOM.PELANGGAN, tanda);
    for (var t = 0; t < token.length; t++) buangCache_('kartu:' + token[t]);
    buangCache_('ringkasan');
    try { tulisRingkasan_(); } catch (x) { /* biarkan */ }
    return n;
  });
}

/** Menghapus semua baris bertanda CONTOH. Data sungguhan tidak disentuh. */
function hapusDataContoh_() { return hapusBertanda_('CONTOH'); }

/* ---------- tes cepat di spreadsheet sungguhan ---------- */

/**
 * Isi "ujiCepat": menjalankan alur lengkap pada satu pelanggan uji (bertanda TES) lalu menghapusnya lagi.
 * Dipakai untuk memastikan pemasangan di Google benar. Hasilnya berupa teks.
 */
function jalankanUji_() {
  var langkah = [], atur = pengaturan_(), wa = '6280099990001';
  function cek(nama, syarat) { langkah.push((syarat ? 'OK    ' : 'GAGAL ') + nama); if (!syarat) throw new Error('Tes gagal di langkah: ' + nama); }
  var admin = { nama: 'Tes', peran: 'owner' };
  try {
    hapusBertanda_('TES');
    var nw = periksaNamaWa_({ nama: 'tes kartu aura', wa: '0800-9999-0001' });
    cek('nama dan nomor dirapikan', nw.nama === 'Tes Kartu Aura' && nw.wa === wa);
    var p0 = denganKunci_(function () { return buatPelanggan_(nw.nama, nw.wa, atur, new Date(), 'Tes', 'manual', '', 'TES'); });
    var id = String(p0.id);
    cek('nomor WhatsApp tersimpan sebagai teks', String(pelangganDariId_(id).wa) === wa);
    var aneh = aksiUbahPelanggan_({ id: id, nama: '-Tes =1+1' }, admin);
    cek('nama yang diawali tanda - tersimpan apa adanya', aneh.pelanggan.nama === '-Tes =1+1' && String(pelangganDariId_(id).nama) === '-Tes =1+1');
    var a = aksiStempelAwal_({ id: id, asal: 'TikTok Shop' }, admin);
    cek('stempel awal', a.pelanggan.stempel === 1 && a.pelanggan.asal_awal === 'TikTok Shop');
    var t = Inti.target(atur), h = null, nomorTes = '-TES=' + new Date().getTime();
    for (var i = 1; i < t; i++) h = aksiStempel_({ id: id, nomor_pesanan: nomorTes + '-' + i }, admin);
    var ganda = false;
    try { aksiStempel_({ id: id, nomor_pesanan: nomorTes + '-1' }, admin); } catch (eg) { ganda = eg.kode === 'PESANAN_GANDA'; }
    cek('nomor pesanan yang diawali tanda - dikenali lagi, tidak distempel dua kali', ganda);
    cek('kartu penuh setelah ' + t + ' stempel', h.kartu_penuh === true && h.pelanggan.hadiah_siap === 1 && h.pelanggan.kartu_ke === 2 && h.pelanggan.stempel === 0);
    var g = aksiHadiah_({ id: id, aroma: 'Tes' }, admin);
    cek('hadiah diberikan', g.pelanggan.hadiah_siap === 0 && g.pelanggan.total_hadiah === 1);
    var s = aksiStempel_({ id: id, konfirmasi: true }, admin);
    cek('stempel di kartu berikutnya', s.pelanggan.kartu_ke === 2 && s.pelanggan.stempel === 1);
    var b = aksiBatal_({ id: id, alasan: 'tes pembatalan' }, admin);
    cek('batal stempel terakhir', b.pelanggan.stempel === 0);
    var token = String(pelangganDariId_(id).token);
    var k1 = aksiKartu_({ t: token });
    cek('kartu meminta persetujuan dulu', k1.butuh_persetujuan === true && !k1.kode);
    var k2 = aksiSetuju_({ t: token });
    cek('kartu tampil setelah setuju', k2.butuh_persetujuan === false && k2.kartu.isi === 0 && k2.kartu.kartu_ke === 2 && k2.wa_samar.indexOf('9999') < 0);
    cek('waktu tersimpan sebagai tanggal', !!Inti.keTanggal(pelangganDariId_(id).tgl_setuju));
    cek('saldo cocok dengan buku transaksi', denganKunci_(periksaSaldo_) === 0);
    var x = aksiHapusDataSaya_({ t: token });
    cek('hapus data pelanggan', x.dihapus === true);
    var hilang = false;
    try { aksiKartu_({ t: token }); } catch (e1) { hilang = e1.kode === 'KARTU_TIDAK_ADA'; }
    cek('link kartu mati setelah data dihapus', hilang);
    hapusBertanda_('TES');
    langkah.push('SEMUA TES LULUS. Baris uji sudah dibersihkan.');
  } catch (err) {
    langkah.push('BERHENTI: ' + (err && err.message ? err.message : err));
    try { hapusBertanda_('TES'); } catch (e2) { /* biarkan */ }
  }
  var teksHasil = langkah.join('\n');
  try { Logger.log(teksHasil); } catch (e3) { /* abaikan */ }
  return teksHasil;
}
