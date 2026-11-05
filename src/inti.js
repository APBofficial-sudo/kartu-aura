/**
 * KARTU AURA: INTI
 * Aturan stempel sebagai fungsi murni. Tidak memakai layanan Google sama sekali,
 * jadi bisa dites di laptop (lihat folder tes/). File ini digabung ke apps-script/Code.gs
 * oleh alat/bangun.js. Jangan mengedit Code.gs langsung.
 */
var Inti = (function () {
  'use strict';

  var JENIS = {
    DAFTAR: 'DAFTAR',
    PERSETUJUAN: 'PERSETUJUAN',
    STEMPEL_AWAL: 'STEMPEL_AWAL',
    STEMPEL: 'STEMPEL',
    BATAL: 'BATAL',
    HADIAH: 'HADIAH',
    HADIAH_TUNDA: 'HADIAH_TUNDA',
    PENYESUAIAN: 'PENYESUAIAN',
    HAPUS_DATA: 'HAPUS_DATA'
  };
  var ASAL = ['TikTok Shop', 'Shopee', 'Lainnya'];
  // Tanpa 0/O/1/I supaya kode gampang dibaca dan disebut.
  var ABJAD_KODE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  var TARGET_MIN = 2, TARGET_MAKS = 12;
  var WIB = 7 * 3600 * 1000;
  var HARI = 24 * 3600 * 1000;
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  /* ---------- galat ---------- */

  function galat(kode, pesan, data) {
    var e = new Error(pesan);
    e.kode = kode;
    e.data = data || null;
    e.galatKartu = true;
    return e;
  }

  /* ---------- teks & nomor ---------- */

  function teks(v, maks) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (maks && s.length > maks) s = s.slice(0, maks);
    return s;
  }

  // Teks banyak baris (templat pesan): baris baru dipertahankan.
  function teksPanjang(v, maks) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim();
    if (maks && s.length > maks) s = s.slice(0, maks);
    return s;
  }

  function bilangan(v, bawaan) {
    var n = Number(v);
    return isFinite(n) ? n : (bawaan === undefined ? 0 : bawaan);
  }

  function bulat(v, bawaan) {
    var n = Math.round(bilangan(v, NaN));
    return isFinite(n) ? n : (bawaan === undefined ? 0 : bawaan);
  }

  /**
   * Menormalkan nomor WhatsApp ke bentuk 62xxxxxxxxxx.
   * Menerima 08..., 8..., 62..., +62..., dengan spasi/strip/titik/kurung.
   * Nomor luar negeri harus diawali tanda +. Mengembalikan null kalau tidak sah.
   */
  function normalWa(masukan) {
    if (masukan === null || masukan === undefined) return null;
    var s = String(masukan).trim();
    if (!s) return null;
    var plus = s.charAt(0) === '+';
    var d = s.replace(/\D/g, '');
    if (!d) return null;
    if (!plus) {
      if (d.indexOf('62') === 0) { /* sudah benar */ }
      else if (d.charAt(0) === '0') d = '62' + d.slice(1);
      else if (d.charAt(0) === '8') d = '62' + d;
      else return null;
    }
    if (d.indexOf('620') === 0) d = '62' + d.slice(3); // "+62 0812..." sering ditulis begitu
    if (d.indexOf('62') === 0) {
      if (d.charAt(2) !== '8') return null;
      if (d.length < 11 || d.length > 15) return null;
      return d;
    }
    if (d.length < 8 || d.length > 15) return null;
    return d;
  }

  // 6281234567890 -> 0812-3456-7890 (untuk admin)
  function tampilWa(wa) {
    if (!wa) return '';
    var s = String(wa);
    if (s.indexOf('62') === 0) {
      var l = '0' + s.slice(2);
      return l.slice(0, 4) + '-' + l.slice(4, 8) + (l.length > 8 ? '-' + l.slice(8) : '');
    }
    return '+' + s;
  }

  // 6281234567890 -> 0812****7890, dengan titik tebal sebagai pengganti bintang (untuk kartu pembeli; tidak pernah utuh).
  // Huruf di luar ASCII ditulis sebagai \uXXXX supaya file ini tetap benar walau disalin lewat editor yang salah membaca UTF-8.
  var TITIK4 = '\u2022\u2022\u2022\u2022';
  function samarWa(wa) {
    if (!wa) return '';
    var s = String(wa);
    if (s.indexOf('62') === 0) {
      var l = '0' + s.slice(2);
      return l.slice(0, 4) + TITIK4 + l.slice(-4);
    }
    return '+' + s.slice(0, 3) + TITIK4 + s.slice(-3);
  }

  function rapikanNama(v) {
    var s = teks(v, 60);
    if (!s) return '';
    // Huruf besar di awal kata kalau semuanya huruf kecil / semuanya huruf besar.
    if (s === s.toLowerCase() || s === s.toUpperCase()) {
      s = s.toLowerCase().replace(/(^|[\s\-'.])([a-z\u00e0-\u00ff])/g, function (_, a, b) { return a + b.toUpperCase(); });
    }
    return s;
  }

  function namaDepan(nama) {
    var s = teks(nama, 60);
    return s.split(' ')[0] || s;
  }

  function nomorAnggota(n) {
    var s = String(bulat(n, 0));
    while (s.length < 4) s = '0' + s;
    return s;
  }

  /** Membuat kode kartu XXXX-XXXX dari deretan bilangan acak 0..255 (minimal 8). */
  function buatKode(bytes) {
    var out = '';
    for (var i = 0; i < 8; i++) out += ABJAD_KODE.charAt(bytes[i] % 32);
    return out.slice(0, 4) + '-' + out.slice(4);
  }

  /** Merapikan masukan kode kartu: "7kqm 2xwp" -> "7KQM-2XWP"; null kalau bentuknya bukan kode. */
  function normalKode(v) {
    var s = teks(v, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== 8) return null;
    for (var i = 0; i < 8; i++) if (ABJAD_KODE.indexOf(s.charAt(i)) < 0) return null;
    return s.slice(0, 4) + '-' + s.slice(4);
  }

  function isiTemplat(tpl, nilai) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (semua, kunci) {
      return Object.prototype.hasOwnProperty.call(nilai, kunci) ? String(nilai[kunci]) : semua;
    });
  }

  /* ---------- waktu (WIB tetap UTC+7, tanpa bergantung zona waktu mesin) ---------- */

  function keTanggal(v) {
    if (v === null || v === undefined || v === '') return null;
    if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function bagianWib(d) {
    var x = new Date(d.getTime() + WIB);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), H: x.getUTCHours(), M: x.getUTCMinutes(), hari: x.getUTCDay() };
  }

  function dua(n) { return (n < 10 ? '0' : '') + n; }

  function tanggalWib(d) {
    var b = bagianWib(d);
    return b.y + '-' + dua(b.m) + '-' + dua(b.d);
  }

  function awalHariWib(d) {
    var b = bagianWib(d);
    return new Date(Date.UTC(b.y, b.m - 1, b.d) - WIB);
  }

  // Senin 00.00 WIB dari minggu tempat d berada.
  function awalMingguWib(d) {
    var awal = awalHariWib(d);
    var hari = bagianWib(d).hari; // 0 = Minggu
    var mundur = (hari + 6) % 7;
    return new Date(awal.getTime() - mundur * HARI);
  }

  function tambahBulan(d, n) {
    var b = bagianWib(d);
    var bulanBaru = b.m - 1 + n;
    var y = b.y + Math.floor(bulanBaru / 12);
    var m = ((bulanBaru % 12) + 12) % 12;
    var hariTerakhir = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var hari = Math.min(b.d, hariTerakhir);
    return new Date(Date.UTC(y, m, hari, b.H, b.M) - WIB);
  }

  function teksTanggal(d) {
    var b = bagianWib(d);
    return b.d + ' ' + BULAN[b.m - 1] + ' ' + b.y;
  }

  function teksWaktu(d) {
    var b = bagianWib(d);
    return b.d + ' ' + BULAN_PENDEK[b.m - 1] + ' ' + b.y + ' ' + dua(b.H) + '.' + dua(b.M) + ' WIB';
  }

  /* ---------- keadaan kartu ---------- */

  function keadaanKosong() {
    return { kartu_ke: 1, stempel: 0, hadiah_siap: 0, total_beli: 0, total_hadiah: 0, asal_awal: '' };
  }

  function salin(k) {
    return {
      kartu_ke: Math.max(1, bulat(k.kartu_ke, 1)),
      stempel: Math.max(0, bulat(k.stempel, 0)),
      hadiah_siap: Math.max(0, bulat(k.hadiah_siap, 0)),
      total_beli: Math.max(0, bulat(k.total_beli, 0)),
      total_hadiah: Math.max(0, bulat(k.total_hadiah, 0)),
      asal_awal: teks(k.asal_awal, 30)
    };
  }

  function target(atur) {
    var t = bulat(atur && atur.target_stempel, 5);
    if (t < TARGET_MIN) t = TARGET_MIN;
    if (t > TARGET_MAKS) t = TARGET_MAKS;
    return t;
  }

  // Menambah n stempel. Setiap kali kartu penuh: hadiah siap +1 dan kartu berikutnya dimulai.
  function tambah(k, n, atur) {
    var t = target(atur), h = salin(k), baru = 0;
    h.stempel += n;
    while (h.stempel >= t) { h.stempel -= t; h.hadiah_siap += 1; h.kartu_ke += 1; baru += 1; }
    return { keadaan: h, hadiah_baru: baru };
  }

  // Mengurangi n stempel. Kalau stempel itu sudah menghasilkan hadiah yang BELUM diberikan,
  // hadiahnya ditarik kembali. Kalau hadiahnya sudah diberikan, ditolak.
  function kurang(k, n, atur) {
    var t = target(atur), h = salin(k), ditarik = 0;
    var sisa = h.stempel - n;
    while (sisa < 0) {
      if (h.kartu_ke <= 1) throw galat('STEMPEL_KURANG', 'Stempel di kartu ini tidak cukup untuk dikurangi.');
      if (h.hadiah_siap <= 0) throw galat('HADIAH_SUDAH_DIBERIKAN', 'Stempel ini sudah menghasilkan hadiah yang sudah diberikan, jadi tidak bisa dibatalkan. Pakai Penyesuaian kalau memang perlu dikoreksi.');
      sisa += t; h.hadiah_siap -= 1; h.kartu_ke -= 1; ditarik += 1;
    }
    h.stempel = sisa;
    return { keadaan: h, hadiah_ditarik: ditarik };
  }

  function stempelAwal(k, asal, atur) {
    if (teks(k.asal_awal)) throw galat('SUDAH_STEMPEL_AWAL', 'Pelanggan ini sudah pernah mendapat Stempel Awal.');
    if (ASAL.indexOf(asal) < 0) throw galat('ASAL_TIDAK_SAH', 'Pilih asal pembelian: TikTok Shop, Shopee, atau Lainnya.');
    var r = tambah(k, 1, atur);
    r.keadaan.asal_awal = asal;
    return r;
  }

  function jumlahStempelSah(n, atur) {
    var j = bulat(n, 1);
    if (!(atur && atur.aturan_stempel === 'botol')) return 1; // per pesanan: selalu 1
    if (j < 1 || j > 12) throw galat('JUMLAH_TIDAK_SAH', 'Jumlah stempel harus 1 sampai 12.');
    return j;
  }

  function stempelBeli(k, n, atur) {
    var j = jumlahStempelSah(n, atur);
    var r = tambah(k, j, atur);
    r.keadaan.total_beli += 1;
    r.jumlah = j;
    return r;
  }

  // trx = transaksi yang dibatalkan: { jenis, jumlah }
  function batalkan(k, trx, atur) {
    if (!trx || (trx.jenis !== JENIS.STEMPEL && trx.jenis !== JENIS.STEMPEL_AWAL)) throw galat('TIDAK_ADA_STEMPEL', 'Tidak ada stempel yang bisa dibatalkan.');
    var r = kurang(k, Math.max(1, bulat(trx.jumlah, 1)), atur);
    if (trx.jenis === JENIS.STEMPEL) r.keadaan.total_beli = Math.max(0, r.keadaan.total_beli - 1);
    if (trx.jenis === JENIS.STEMPEL_AWAL) r.keadaan.asal_awal = '';
    return r;
  }

  function beriHadiah(k) {
    var h = salin(k);
    if (h.hadiah_siap <= 0) throw galat('BELUM_ADA_HADIAH', 'Belum ada hadiah yang siap untuk pelanggan ini.');
    h.hadiah_siap -= 1;
    h.total_hadiah += 1;
    return { keadaan: h };
  }

  function sesuaikan(k, delta, atur) {
    var d = bulat(delta, 0);
    if (!d || Math.abs(d) > 36) throw galat('JUMLAH_TIDAK_SAH', 'Isi jumlah penyesuaian, misalnya 1 atau -1.');
    return d > 0 ? tambah(k, d, atur) : kurang(k, -d, atur);
  }

  // Kalau target diturunkan saat pelanggan sudah punya stempel sebanyak/melebihi target baru.
  function rapikanSetelahGantiTarget(k, atur) {
    return tambah(k, 0, atur);
  }

  /** Apa yang ditampilkan di kartu pembeli. */
  function tampilanKartu(k, atur) {
    var t = target(atur), h = salin(k);
    if (h.hadiah_siap > 0) {
      return {
        penuh: true, isi: t, target: t, sisa: 0,
        kartu_ke: Math.max(1, h.kartu_ke - h.hadiah_siap),
        hadiah_siap: h.hadiah_siap,
        berikutnya: { kartu_ke: h.kartu_ke, isi: Math.min(h.stempel, t) }
      };
    }
    var isi = Math.min(h.stempel, t);
    return { penuh: isi >= t, isi: isi, target: t, sisa: t - isi, kartu_ke: h.kartu_ke, hadiah_siap: 0, berikutnya: null };
  }

  /** Stempel hangus kalau masa berlaku diatur (>0 bulan) dan sudah selama itu tidak ada stempel baru. */
  function sudahHangus(k, stempelTerakhir, sekarang, atur) {
    var bulan = bulat(atur && atur.masa_berlaku_bulan, 0);
    if (bulan <= 0) return false;
    if (bulat(k.stempel, 0) <= 0) return false;
    var terakhir = keTanggal(stempelTerakhir);
    if (!terakhir) return false;
    return tambahBulan(terakhir, bulan).getTime() < sekarang.getTime();
  }

  /* ---------- pengaturan ---------- */

  var PENGATURAN_BAWAAN = {
    nama_program: 'Kartu Aura',
    sebutan: 'Auraborn',
    target_stempel: 5,
    teks_hadiah: '1 Parfum Aura gratis',
    aturan_stempel: 'pesanan',
    masa_berlaku_bulan: 0,
    angkatan_pertama: 500,
    wa_admin: '085121812007',   // nomor WhatsApp Laura (penerima pesanan); bisa diganti di Pengaturan
    url_kartu: '',
    program_aktif: 'ya',
    otomatis_aktif: 'tidak',
    jeda_konfirmasi_menit: 10,
    lama_tidak_beli_hari: 60,
    daftar_aroma: '',
    tpl_kartu_baru: 'Halo Kak {nama}, ini kartu stempel Parfum Aura punya Kakak:\n{link}\n\nTiap beli parfum lewat WhatsApp dapat 1 stempel. {target} stempel = {hadiah}.',
    tpl_stempel_awal: 'Stempel pertama sudah masuk, Kak {nama}. Itu untuk parfum yang sudah Kakak beli sebelumnya. Tinggal {sisa} lagi untuk {hadiah}.\n\nKartunya: {link}',
    tpl_stempel: 'Stempel ke-{stempel} sudah masuk, Kak {nama}. Tinggal {sisa} lagi untuk {hadiah}.\n\nKartunya: {link}',
    tpl_penuh: 'Kartu Kakak sudah penuh, Kak {nama}. {hadiah} ikut di paket pesanan ini ya.\n\nKartu berikutnya langsung dimulai: {link}',
    tpl_penuh_tunda: 'Kartu Kakak sudah penuh, Kak {nama}. {hadiah} sudah jadi hak Kakak, tinggal kabari kami aroma pilihannya ya.\n\nKartunya: {link}',
    tpl_hadiah: 'Hadiah Kakak ({hadiah}) kami kirim bersama paket ini ya, Kak {nama}.\n\nKartunya: {link}'
  };

  var KETERANGAN_PENGATURAN = {
    nama_program: 'Nama program yang tampil di kartu',
    sebutan: 'Sebutan pemegang kartu',
    target_stempel: 'Jumlah stempel untuk 1 hadiah (2-12)',
    teks_hadiah: 'Teks hadiah, mis. "1 Parfum Aura gratis"',
    aturan_stempel: 'pesanan = 1 stempel per pesanan; botol = 1 stempel per botol',
    masa_berlaku_bulan: 'Stempel hangus kalau sekian bulan tidak ada stempel baru. 0 = tidak hangus',
    angkatan_pertama: 'Sekian anggota pertama diberi tanda Angkatan Pertama. 0 = mati',
    wa_admin: 'Nomor WhatsApp tujuan tombol "Pesan lagi" di kartu (nomor Laura)',
    url_kartu: 'Alamat halaman kartu (terisi otomatis saat Owner pertama masuk Meja Stempel)',
    program_aktif: 'ya / tidak. "tidak" = stempel baru dihentikan sementara',
    otomatis_aktif: 'ya / tidak. Pintu stempel otomatis untuk n8n/Laura',
    jeda_konfirmasi_menit: 'Minta konfirmasi kalau pelanggan yang sama distempel lagi dalam sekian menit',
    lama_tidak_beli_hari: 'Batas hari untuk daftar "Lama tidak beli"',
    daftar_aroma: 'Pilihan aroma hadiah untuk admin, satu per baris. Tidak pernah tampil ke pembeli',
    tpl_kartu_baru: 'Pesan saat kartu baru dibuat',
    tpl_stempel_awal: 'Pesan saat Stempel Awal diberikan',
    tpl_stempel: 'Pesan saat stempel pembelian masuk',
    tpl_penuh: 'Pesan saat kartu penuh dan hadiah ikut paket',
    tpl_penuh_tunda: 'Pesan saat kartu penuh tapi hadiah ditunda',
    tpl_hadiah: 'Pesan saat hadiah yang ditunda akhirnya dikirim'
  };

  function yaTidak(v, bawaan) {
    var s = teks(v, 10).toLowerCase();
    if (s === 'ya' || s === 'true' || s === '1' || s === 'aktif') return 'ya';
    if (s === 'tidak' || s === 'false' || s === '0' || s === 'mati') return 'tidak';
    return bawaan;
  }

  /** Mengisi yang kosong dengan nilai bawaan dan merapikan tipe. Dipakai saat MEMBACA pengaturan. */
  function lengkapiPengaturan(mentah) {
    var m = mentah || {}, b = PENGATURAN_BAWAAN, a = {};
    function ada(k) { return Object.prototype.hasOwnProperty.call(m, k) && m[k] !== '' && m[k] !== null && m[k] !== undefined; }
    a.nama_program = ada('nama_program') ? teks(m.nama_program, 40) : b.nama_program;
    a.sebutan = ada('sebutan') ? teks(m.sebutan, 30) : b.sebutan;
    a.target_stempel = Math.min(TARGET_MAKS, Math.max(TARGET_MIN, bulat(ada('target_stempel') ? m.target_stempel : b.target_stempel, b.target_stempel)));
    a.teks_hadiah = ada('teks_hadiah') ? teks(m.teks_hadiah, 60) : b.teks_hadiah;
    a.aturan_stempel = teks(m.aturan_stempel, 10).toLowerCase() === 'botol' ? 'botol' : 'pesanan';
    a.masa_berlaku_bulan = Math.min(60, Math.max(0, bulat(m.masa_berlaku_bulan, 0)));
    a.angkatan_pertama = Math.min(1000000, Math.max(0, bulat(ada('angkatan_pertama') ? m.angkatan_pertama : b.angkatan_pertama, b.angkatan_pertama)));
    a.wa_admin = normalWa(m.wa_admin) || '';
    a.url_kartu = teks(m.url_kartu, 300);
    a.program_aktif = yaTidak(m.program_aktif, 'ya');
    a.otomatis_aktif = yaTidak(m.otomatis_aktif, 'tidak');
    a.jeda_konfirmasi_menit = Math.min(1440, Math.max(0, bulat(ada('jeda_konfirmasi_menit') ? m.jeda_konfirmasi_menit : b.jeda_konfirmasi_menit, b.jeda_konfirmasi_menit)));
    a.lama_tidak_beli_hari = Math.min(730, Math.max(7, bulat(ada('lama_tidak_beli_hari') ? m.lama_tidak_beli_hari : b.lama_tidak_beli_hari, b.lama_tidak_beli_hari)));
    a.daftar_aroma = teksPanjang(m.daftar_aroma, 2000);
    ['tpl_kartu_baru', 'tpl_stempel_awal', 'tpl_stempel', 'tpl_penuh', 'tpl_penuh_tunda', 'tpl_hadiah'].forEach(function (k) {
      a[k] = ada(k) ? teksPanjang(m[k], 700) : b[k];
    });
    return a;
  }

  /** Memeriksa perubahan pengaturan dari Owner. Mengembalikan hanya kunci yang sah; melempar galat kalau ada yang salah. */
  function periksaPerubahanPengaturan(ubah) {
    var u = ubah || {}, hasil = {};
    function ada(k) { return Object.prototype.hasOwnProperty.call(u, k) && u[k] !== null && u[k] !== undefined; }
    if (ada('nama_program')) { hasil.nama_program = teks(u.nama_program, 40); if (!hasil.nama_program) throw galat('PENGATURAN_SALAH', 'Nama program tidak boleh kosong.'); }
    if (ada('sebutan')) { hasil.sebutan = teks(u.sebutan, 30); if (!hasil.sebutan) throw galat('PENGATURAN_SALAH', 'Sebutan pemegang kartu tidak boleh kosong.'); }
    if (ada('target_stempel')) {
      var t = bulat(u.target_stempel, NaN);
      if (!(t >= TARGET_MIN && t <= TARGET_MAKS)) throw galat('PENGATURAN_SALAH', 'Jumlah stempel harus ' + TARGET_MIN + ' sampai ' + TARGET_MAKS + '.');
      hasil.target_stempel = t;
    }
    if (ada('teks_hadiah')) { hasil.teks_hadiah = teks(u.teks_hadiah, 60); if (!hasil.teks_hadiah) throw galat('PENGATURAN_SALAH', 'Teks hadiah tidak boleh kosong.'); }
    if (ada('aturan_stempel')) {
      var a = teks(u.aturan_stempel, 10).toLowerCase();
      if (a !== 'pesanan' && a !== 'botol') throw galat('PENGATURAN_SALAH', 'Aturan stempel harus "pesanan" atau "botol".');
      hasil.aturan_stempel = a;
    }
    if (ada('masa_berlaku_bulan')) {
      var mb = bulat(u.masa_berlaku_bulan, NaN);
      if (!(mb >= 0 && mb <= 60)) throw galat('PENGATURAN_SALAH', 'Masa berlaku harus 0 sampai 60 bulan.');
      hasil.masa_berlaku_bulan = mb;
    }
    if (ada('angkatan_pertama')) {
      var ap = bulat(u.angkatan_pertama, NaN);
      if (!(ap >= 0 && ap <= 1000000)) throw galat('PENGATURAN_SALAH', 'Jumlah Angkatan Pertama tidak sah.');
      hasil.angkatan_pertama = ap;
    }
    if (ada('wa_admin')) {
      var w = teks(u.wa_admin, 30);
      if (w) { var n = normalWa(w); if (!n) throw galat('PENGATURAN_SALAH', 'Nomor WhatsApp admin tidak sah. Contoh: 0812-3456-7890.'); hasil.wa_admin = n; }
      else hasil.wa_admin = '';
    }
    if (ada('url_kartu')) {
      var url = teks(u.url_kartu, 300);
      if (url && !/^https?:\/\/[^\s]+$/i.test(url)) throw galat('PENGATURAN_SALAH', 'Alamat halaman kartu harus diawali https://');
      hasil.url_kartu = url.replace(/[#?].*$/, '');
    }
    if (ada('program_aktif')) hasil.program_aktif = yaTidak(u.program_aktif, 'ya');
    if (ada('otomatis_aktif')) hasil.otomatis_aktif = yaTidak(u.otomatis_aktif, 'tidak');
    if (ada('jeda_konfirmasi_menit')) {
      var j = bulat(u.jeda_konfirmasi_menit, NaN);
      if (!(j >= 0 && j <= 1440)) throw galat('PENGATURAN_SALAH', 'Jeda konfirmasi harus 0 sampai 1440 menit.');
      hasil.jeda_konfirmasi_menit = j;
    }
    if (ada('lama_tidak_beli_hari')) {
      var l = bulat(u.lama_tidak_beli_hari, NaN);
      if (!(l >= 7 && l <= 730)) throw galat('PENGATURAN_SALAH', 'Batas "lama tidak beli" harus 7 sampai 730 hari.');
      hasil.lama_tidak_beli_hari = l;
    }
    if (ada('daftar_aroma')) hasil.daftar_aroma = teksPanjang(u.daftar_aroma, 2000);
    ['tpl_kartu_baru', 'tpl_stempel_awal', 'tpl_stempel', 'tpl_penuh', 'tpl_penuh_tunda', 'tpl_hadiah'].forEach(function (k) {
      if (ada(k)) { hasil[k] = teksPanjang(u[k], 700); if (!hasil[k]) throw galat('PENGATURAN_SALAH', 'Templat pesan tidak boleh kosong.'); }
    });
    return hasil;
  }

  function daftarAroma(atur) {
    return String((atur && atur.daftar_aroma) || '').split(/[\n|]+/).map(function (s) { return teks(s, 40); }).filter(function (s) { return !!s; });
  }

  function tautanKartu(atur, token) {
    var dasar = teks(atur && atur.url_kartu, 300);
    if (!dasar || !token) return '';
    return dasar + '#' + token;
  }

  /**
   * Menyusun pesan siap kirim.
   * macam: 'kartu_baru' | 'stempel_awal' | 'stempel' | 'penuh' | 'penuh_tunda' | 'hadiah'
   */
  function susunPesan(macam, atur, pelanggan, k, tautan) {
    var tpl = atur['tpl_' + macam] || PENGATURAN_BAWAAN['tpl_' + macam] || '';
    var t = target(atur), v = tampilanKartu(k, atur);
    return isiTemplat(tpl, {
      nama: namaDepan(pelanggan.nama),
      nama_lengkap: pelanggan.nama,
      stempel: v.isi,
      sisa: v.sisa,
      target: t,
      hadiah: atur.teks_hadiah,
      program: atur.nama_program,
      kode: pelanggan.kode || '',
      link: tautan || '(link kartu belum diatur)'
    });
  }

  /* ---------- ringkasan ---------- */

  /**
   * pelanggan: [{ id, nama, wa, kode, no_anggota, stempel, hadiah_siap, total_beli, total_hadiah, asal_awal, tgl_daftar, stempel_terakhir, status, contoh }]
   * transaksi: [{ id, waktu, id_pelanggan, jenis, jumlah, ref, contoh }]
   */
  function hitungRingkasan(pelanggan, transaksi, atur, sekarang) {
    var t = target(atur);
    var kini = sekarang.getTime();
    var batas7 = kini - 7 * HARI, batas30 = kini - 30 * HARI;
    var batasLama = kini - bulat(atur.lama_tidak_beli_hari, 60) * HARI;
    var r = {
      dibuat: sekarang.toISOString(),
      target: t,
      pemegang_kartu: 0, kartu_baru_7: 0, kartu_baru_30: 0,
      stempel_beli_7: 0, stempel_beli_30: 0, stempel_beli_total: 0,
      pembeli_wa: 0, pembeli_ulang: 0,
      hadiah_keluar: 0, hadiah_tunda: 0,
      tinggal_satu: [], lama_tidak_beli: [],
      asal: {}, mingguan: [],
      ada_contoh: false
    };
    ASAL.forEach(function (a) { r.asal[a] = { jumlah: 0, lanjut_beli: 0 }; });

    var dibatalkan = {};
    transaksi.forEach(function (x) { if (x.jenis === JENIS.BATAL && x.ref) dibatalkan[x.ref] = true; if (x.contoh) r.ada_contoh = true; });

    // 12 minggu terakhir, Senin sebagai awal minggu
    var mingguIni = awalMingguWib(sekarang).getTime();
    var petaMinggu = {};
    for (var i = 11; i >= 0; i--) {
      var mulai = mingguIni - i * 7 * HARI;
      var baris = { mulai: tanggalWib(new Date(mulai)), stempel: 0, kartu_baru: 0 };
      petaMinggu[mulai] = baris;
      r.mingguan.push(baris);
    }
    function barisMinggu(d) {
      var m = awalMingguWib(d).getTime();
      return petaMinggu[m] || null;
    }

    pelanggan.forEach(function (p) {
      if (p.contoh) r.ada_contoh = true;
      var daftar = keTanggal(p.tgl_daftar);
      if (daftar && p.status !== 'dihapus') {
        var w = daftar.getTime();
        if (w >= batas7) r.kartu_baru_7 += 1;
        if (w >= batas30) r.kartu_baru_30 += 1;
        var bm = barisMinggu(daftar);
        if (bm) bm.kartu_baru += 1;
      }
      if (p.status !== 'aktif') return;
      r.pemegang_kartu += 1;
      var beli = bulat(p.total_beli, 0);
      if (beli >= 1) r.pembeli_wa += 1;
      if (beli >= 2) r.pembeli_ulang += 1;
      r.hadiah_tunda += Math.max(0, bulat(p.hadiah_siap, 0));
      if (p.asal_awal && r.asal[p.asal_awal]) {
        r.asal[p.asal_awal].jumlah += 1;
        if (beli >= 1) r.asal[p.asal_awal].lanjut_beli += 1;
      }
      var ringkas = { id: p.id, nama: p.nama, wa: p.wa, kode: p.kode, stempel: bulat(p.stempel, 0) };
      if (bulat(p.hadiah_siap, 0) === 0 && bulat(p.stempel, 0) === t - 1) r.tinggal_satu.push(ringkas);
      var terakhir = keTanggal(p.stempel_terakhir);
      if (beli >= 1 && terakhir && terakhir.getTime() < batasLama) {
        ringkas = { id: p.id, nama: p.nama, wa: p.wa, kode: p.kode, stempel: bulat(p.stempel, 0), terakhir: terakhir.toISOString() };
        r.lama_tidak_beli.push(ringkas);
      }
    });

    transaksi.forEach(function (x) {
      var w = keTanggal(x.waktu);
      if (x.jenis === JENIS.HADIAH) r.hadiah_keluar += 1;
      if (x.jenis !== JENIS.STEMPEL || dibatalkan[x.id] || !w) return;
      r.stempel_beli_total += 1;
      if (w.getTime() >= batas7) r.stempel_beli_7 += 1;
      if (w.getTime() >= batas30) r.stempel_beli_30 += 1;
      var bm = barisMinggu(w);
      if (bm) bm.stempel += 1;
    });

    r.lama_tidak_beli.sort(function (a, b) { return a.terakhir < b.terakhir ? -1 : 1; });
    r.tinggal_satu.sort(function (a, b) { return a.nama < b.nama ? -1 : 1; });
    r.jumlah_tinggal_satu = r.tinggal_satu.length;
    r.jumlah_lama_tidak_beli = r.lama_tidak_beli.length;
    return r;
  }

  return {
    JENIS: JENIS, ASAL: ASAL, ABJAD_KODE: ABJAD_KODE, TARGET_MIN: TARGET_MIN, TARGET_MAKS: TARGET_MAKS, HARI: HARI,
    PENGATURAN_BAWAAN: PENGATURAN_BAWAAN, KETERANGAN_PENGATURAN: KETERANGAN_PENGATURAN,
    galat: galat, teks: teks, teksPanjang: teksPanjang, bilangan: bilangan, bulat: bulat,
    normalWa: normalWa, tampilWa: tampilWa, samarWa: samarWa, rapikanNama: rapikanNama, namaDepan: namaDepan,
    nomorAnggota: nomorAnggota, buatKode: buatKode, normalKode: normalKode, isiTemplat: isiTemplat,
    keTanggal: keTanggal, bagianWib: bagianWib, tanggalWib: tanggalWib, awalHariWib: awalHariWib, awalMingguWib: awalMingguWib,
    tambahBulan: tambahBulan, teksTanggal: teksTanggal, teksWaktu: teksWaktu,
    keadaanKosong: keadaanKosong, salin: salin, target: target, tambah: tambah, kurang: kurang,
    stempelAwal: stempelAwal, stempelBeli: stempelBeli, batalkan: batalkan, beriHadiah: beriHadiah, sesuaikan: sesuaikan,
    rapikanSetelahGantiTarget: rapikanSetelahGantiTarget, tampilanKartu: tampilanKartu, sudahHangus: sudahHangus,
    lengkapiPengaturan: lengkapiPengaturan, periksaPerubahanPengaturan: periksaPerubahanPengaturan,
    daftarAroma: daftarAroma, tautanKartu: tautanKartu, susunPesan: susunPesan,
    hitungRingkasan: hitungRingkasan
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Inti;
