/**
 * TIRUAN LAYANAN GOOGLE APPS SCRIPT
 * Meniru bagian SpreadsheetApp, LockService, CacheService, PropertiesService, Utilities,
 * ContentService, dan ScriptApp yang dipakai Code.gs — supaya Code.gs yang SAMA bisa dijalankan
 * di laptop (tes otomatis, server lokal) dan di browser (halaman demo).
 * Sengaja dibuat galak: hal yang di Google Sheets bisa merusak data (teks berubah jadi angka,
 * menulis di luar lembar, kunci bersarang) di sini langsung jadi galat.
 */
(function (akar, pabrik) {
  if (typeof module !== 'undefined' && module.exports) module.exports = pabrik();
  else akar.buatTiruanGas = pabrik();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- SHA-256 & HMAC (JS murni, sinkron) ---------- */

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8(s) {
    var out = [], str = String(s);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        var d = str.charCodeAt(++i), cp = 0x10000 + ((c & 0x3ff) << 10) + (d & 0x3ff);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function sha256(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var m = bytes.slice(), panjang = bytes.length * 8;
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    var atas = Math.floor(panjang / 4294967296), bawah = panjang >>> 0;
    m.push((atas >>> 24) & 255, (atas >>> 16) & 255, (atas >>> 8) & 255, atas & 255, (bawah >>> 24) & 255, (bawah >>> 16) & 255, (bawah >>> 8) & 255, bawah & 255);
    var w = new Array(64);
    for (var o = 0; o < m.length; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = ((m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3]) >>> 0;
      for (i = 16; i < 64; i++) {
        var a15 = w[i - 15], a2 = w[i - 2];
        var s0 = ((a15 >>> 7) | (a15 << 25)) ^ ((a15 >>> 18) | (a15 << 14)) ^ (a15 >>> 3);
        var s1 = ((a2 >>> 17) | (a2 << 15)) ^ ((a2 >>> 19) | (a2 << 13)) ^ (a2 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = [];
    for (var j = 0; j < 8; j++) out.push((h[j] >>> 24) & 255, (h[j] >>> 16) & 255, (h[j] >>> 8) & 255, h[j] & 255);
    return out;
  }

  function hmacSha256(kunci, pesan) {
    var k = kunci.length > 64 ? sha256(kunci) : kunci.slice();
    while (k.length < 64) k.push(0);
    var dalam = [], luar = [];
    for (var i = 0; i < 64; i++) { dalam.push(k[i] ^ 0x36); luar.push(k[i] ^ 0x5c); }
    return sha256(luar.concat(sha256(dalam.concat(pesan))));
  }

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes, amanWeb) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += B64.charAt(a >> 2) + B64.charAt(((a & 3) << 4) | (b >> 4));
      out += i + 1 < bytes.length ? B64.charAt(((b & 15) << 2) | (c >> 6)) : '=';
      out += i + 2 < bytes.length ? B64.charAt(c & 63) : '=';
    }
    return amanWeb ? out.replace(/\+/g, '-').replace(/\//g, '_') : out;
  }

  function keBertanda(bytes) { return bytes.map(function (b) { return b > 127 ? b - 256 : b; }); }
  function keTakBertanda(bytes) { return bytes.map(function (b) { return (b + 256) % 256; }); }
  function byteDari(v) {
    if (typeof v === 'string') return utf8(v);
    return keTakBertanda(Array.prototype.slice.call(v));
  }

  function adalahTanggal(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

  /* ---------- pabrik ---------- */

  return function buatTiruanGas(opsi) {
    opsi = opsi || {};
    var jam = opsi.jam || { now: function () { return Date.now(); } };
    var catatan = { log: [], peringatan: [], tidur: 0, flush: 0 };
    // Sakelar untuk meniru keadaan yang tidak bisa dibuktikan dari laptop:
    //  tanpaAktif       — getActiveSpreadsheet() kosong (kemungkinan terburuk saat dijalankan sebagai web app)
    //  izinPenuh        — skrip tidak lagi dibatasi @OnlyCurrentDoc, jadi openById boleh
    //  apostrofDisimpan — Sheets menyimpan apostrof pengaman apa adanya di sel berformat teks
    //  berdiriSendiri   — skrip dibuat di script.google.com, tidak menempel di sheet mana pun
    //  bukuHilang       — spreadsheet datanya terhapus atau tidak lagi bisa diakses
    var mode = {
      tanpaAktif: !!opsi.tanpaAktif, izinPenuh: opsi.izinPenuh !== false, apostrofDisimpan: !!opsi.apostrofDisimpan,
      berdiriSendiri: !!opsi.berdiriSendiri, bukuHilang: false
    };
    var bukuAda = !mode.berdiriSendiri;   // skrip yang berdiri sendiri belum punya spreadsheet sampai create() dipanggil
    catatan.dibuat = 0;
    // Apps Script menahan tulisan sampai flush. Tiruan ini menghitungnya, dan menolak kunci dilepas sebelum flush.
    var tertunda = 0;

    /* ----- lembar ----- */

    function Lembar(nama) {
      this._nama = nama;
      this._nilai = [];
      this._format = [];
      this._maksBaris = 1000;
      this._maksKolom = 26;
      this._proteksi = [];
      this._grafik = [];
      this._beku = 0;
    }

    function sel(l, b, k) { return l._nilai[b] && l._nilai[b][k] !== undefined ? l._nilai[b][k] : ''; }
    function fmt(l, b, k) { return l._format[b] && l._format[b][k] ? l._format[b][k] : ''; }

    // Meniru cara Sheets menafsirkan nilai yang "diketik" ke sel.
    function tafsir(l, b, k, v) {
      if (v === null || v === undefined) return '';
      if (adalahTanggal(v)) return new Date(v.getTime());
      if (typeof v === 'number' || typeof v === 'boolean') return v;
      if (typeof v !== 'string') throw new Error('TIRUAN: nilai sel harus teks/angka/tanggal, dapat ' + (typeof v));
      if (v.length > 50000) throw new Error('TIRUAN: isi sel melebihi 50.000 karakter');
      if (v.charAt(0) === "'") return mode.apostrofDisimpan && fmt(l, b, k) === '@' ? v : v.slice(1);
      if (v.charAt(0) === '=') throw new Error('TIRUAN: teks diawali "=" akan dianggap rumus oleh Sheets: ' + v.slice(0, 30));
      if (fmt(l, b, k) === '@') return v;
      var t = v.trim();
      if (t === '') return v;
      if (/^[+-]?(\d+([.,]\d+)?|[.,]\d+)(e[+-]?\d+)?%?$/i.test(t)) throw new Error('TIRUAN: teks "' + t.slice(0, 30) + '" ditulis ke sel yang bukan format teks; Sheets akan mengubahnya jadi angka (lembar ' + l._nama + ', kolom ' + (k + 1) + ')');
      if (/^(true|false)$/i.test(t)) throw new Error('TIRUAN: teks "' + t + '" akan diubah Sheets jadi nilai benar/salah (lembar ' + l._nama + ', kolom ' + (k + 1) + ')');
      if (/^\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,4})?$/.test(t)) throw new Error('TIRUAN: teks "' + t + '" akan diubah Sheets jadi tanggal (lembar ' + l._nama + ', kolom ' + (k + 1) + ')');
      return v;
    }

    function Rentang(l, baris, kolom, nBaris, nKolom) {
      if (!(baris >= 1) || !(kolom >= 1)) throw new Error('TIRUAN: baris/kolom rentang harus mulai dari 1 (dapat ' + baris + ',' + kolom + ')');
      if (!(nBaris >= 1)) throw new Error('The number of rows in the range must be at least 1.');
      if (!(nKolom >= 1)) throw new Error('The number of columns in the range must be at least 1.');
      if (baris + nBaris - 1 > l._maksBaris || kolom + nKolom - 1 > l._maksKolom) throw new Error('The coordinates of the range are outside the dimensions of the sheet. (lembar ' + l._nama + ', baris ' + (baris + nBaris - 1) + ' dari ' + l._maksBaris + ')');
      this._l = l; this._b = baris - 1; this._k = kolom - 1; this._nb = nBaris; this._nk = nKolom;
    }
    Rentang.prototype.getValues = function () {
      var out = [];
      for (var i = 0; i < this._nb; i++) {
        var r = [];
        for (var j = 0; j < this._nk; j++) { var v = sel(this._l, this._b + i, this._k + j); r.push(adalahTanggal(v) ? new Date(v.getTime()) : v); }
        out.push(r);
      }
      return out;
    };
    Rentang.prototype.getValue = function () { return this.getValues()[0][0]; };
    Rentang.prototype.setValues = function (v) {
      if (!v || v.length !== this._nb) throw new Error('The number of rows in the data does not match the number of rows in the range. The data has ' + (v ? v.length : 0) + ' but the range has ' + this._nb + '.');
      for (var i = 0; i < this._nb; i++) {
        if (!v[i] || v[i].length !== this._nk) throw new Error('The number of columns in the data does not match the number of columns in the range. The data has ' + (v[i] ? v[i].length : 0) + ' but the range has ' + this._nk + '.');
        var b = this._b + i;
        if (!this._l._nilai[b]) this._l._nilai[b] = [];
        for (var j = 0; j < this._nk; j++) this._l._nilai[b][this._k + j] = tafsir(this._l, b, this._k + j, v[i][j]);
      }
      tertunda += 1;
      return this;
    };
    Rentang.prototype.setValue = function (v) {
      var semua = [];
      for (var i = 0; i < this._nb; i++) { var r = []; for (var j = 0; j < this._nk; j++) r.push(v); semua.push(r); }
      return this.setValues(semua);
    };
    Rentang.prototype.setNumberFormats = function (f) {
      if (!f || f.length !== this._nb) throw new Error('TIRUAN: jumlah baris format tidak cocok dengan rentang');
      for (var i = 0; i < this._nb; i++) {
        if (!f[i] || f[i].length !== this._nk) throw new Error('TIRUAN: jumlah kolom format tidak cocok dengan rentang');
        var b = this._b + i;
        if (!this._l._format[b]) this._l._format[b] = [];
        for (var j = 0; j < this._nk; j++) this._l._format[b][this._k + j] = String(f[i][j]);
      }
      tertunda += 1;
      return this;
    };
    Rentang.prototype.setNumberFormat = function (f) {
      for (var i = 0; i < this._nb; i++) {
        var b = this._b + i;
        if (!this._l._format[b]) this._l._format[b] = [];
        for (var j = 0; j < this._nk; j++) this._l._format[b][this._k + j] = String(f);
      }
      return this;
    };
    Rentang.prototype.clearContent = function () {
      for (var i = 0; i < this._nb; i++) {
        var b = this._b + i;
        if (!this._l._nilai[b]) continue;
        for (var j = 0; j < this._nk; j++) this._l._nilai[b][this._k + j] = '';
      }
      tertunda += 1;
      return this;
    };
    Rentang.prototype.getRow = function () { return this._b + 1; };
    Rentang.prototype.getColumn = function () { return this._k + 1; };
    Rentang.prototype.getNumRows = function () { return this._nb; };
    Rentang.prototype.getNumColumns = function () { return this._nk; };
    ['setFontWeight', 'setBackground', 'setFontColor', 'setFontSize', 'setWrap', 'setHorizontalAlignment', 'setVerticalAlignment', 'setNote'].forEach(function (n) {
      Rentang.prototype[n] = function () { return this; };
    });

    Lembar.prototype.getName = function () { return this._nama; };
    Lembar.prototype.getLastRow = function () {
      for (var b = this._nilai.length - 1; b >= 0; b--) {
        var r = this._nilai[b];
        if (!r) continue;
        for (var k = 0; k < r.length; k++) if (r[k] !== '' && r[k] !== undefined && r[k] !== null) return b + 1;
      }
      return 0;
    };
    Lembar.prototype.getLastColumn = function () {
      var maks = 0;
      for (var b = 0; b < this._nilai.length; b++) {
        var r = this._nilai[b];
        if (!r) continue;
        for (var k = r.length - 1; k >= 0; k--) if (r[k] !== '' && r[k] !== undefined && r[k] !== null) { if (k + 1 > maks) maks = k + 1; break; }
      }
      return maks;
    };
    Lembar.prototype.getMaxRows = function () { return this._maksBaris; };
    Lembar.prototype.getMaxColumns = function () { return this._maksKolom; };
    Lembar.prototype.getRange = function (b, k, nb, nk) {
      if (typeof b !== 'number') throw new Error('TIRUAN: getRange hanya mendukung bentuk angka (baris, kolom, jumlahBaris, jumlahKolom)');
      return new Rentang(this, b, k, nb === undefined ? 1 : nb, nk === undefined ? 1 : nk);
    };
    Lembar.prototype.insertRowsAfter = function (setelah, jumlah) {
      if (!(setelah >= 1) || setelah > this._maksBaris) throw new Error('TIRUAN: insertRowsAfter di luar lembar');
      if (!(jumlah >= 1)) throw new Error('TIRUAN: jumlah baris harus minimal 1');
      if (setelah < this._nilai.length) {
        for (var i = 0; i < jumlah; i++) { this._nilai.splice(setelah, 0, undefined); this._format.splice(setelah, 0, undefined); }
      }
      this._maksBaris += jumlah;
      tertunda += 1;
      return this;
    };
    Lembar.prototype.deleteRows = function (posisi, jumlah) {
      if (!(posisi >= 1) || !(jumlah >= 1) || posisi + jumlah - 1 > this._maksBaris) throw new Error('Those rows are out of bounds.');
      if (this._maksBaris - jumlah < this._beku + 1) throw new Error('Sorry, it is not possible to delete all non-frozen rows.');
      this._nilai.splice(posisi - 1, jumlah);
      this._format.splice(posisi - 1, jumlah);
      this._maksBaris -= jumlah;
      tertunda += 1;
      return this;
    };
    Lembar.prototype.setFrozenRows = function (n) { this._beku = n; return this; };
    Lembar.prototype.setColumnWidth = function () { return this; };
    Lembar.prototype.getProtections = function () { return this._proteksi.slice(); };
    Lembar.prototype.protect = function () {
      var p = { setDescription: function () { return p; }, setWarningOnly: function () { return p; } };
      this._proteksi.push(p);
      return p;
    };
    Lembar.prototype.getCharts = function () { return this._grafik.slice(); };
    Lembar.prototype.newChart = function () {
      var b = {};
      ['setChartType', 'addRange', 'setNumHeaders', 'setPosition', 'setOption'].forEach(function (n) { b[n] = function () { return b; }; });
      b.build = function () { return { grafik: true }; };
      return b;
    };
    Lembar.prototype.insertChart = function (g) { this._grafik.push(g); return this; };

    /* ----- buku ----- */

    var buku = {
      _lembar: [], _zona: 'America/Los_Angeles',
      getSheetByName: function (n) { for (var i = 0; i < this._lembar.length; i++) if (this._lembar[i]._nama === n) return this._lembar[i]; return null; },
      insertSheet: function (n, indeks) {
        if (this.getSheetByName(n)) throw new Error('A sheet with the name "' + n + '" already exists.');
        var l = new Lembar(n);
        if (typeof indeks === 'number') this._lembar.splice(indeks, 0, l); else this._lembar.push(l);
        return l;
      },
      getSheets: function () { return this._lembar.slice(); },
      deleteSheet: function (l) { var i = this._lembar.indexOf(l); if (i >= 0) this._lembar.splice(i, 1); },
      setSpreadsheetTimeZone: function (z) { this._zona = z; },
      getSpreadsheetTimeZone: function () { return this._zona; },
      getId: function () { return 'buku-tiruan'; },
      getName: function () { return this._nama || 'Kartu Aura (tiruan)'; },
      getUrl: function () { return opsi.urlBuku !== undefined ? String(opsi.urlBuku) : 'https://docs.google.com/spreadsheets/d/buku-tiruan/edit'; }
    };
    buku._lembar.push(new Lembar(opsi.tabBawaan || 'Sheet1'));

    var SpreadsheetApp = {
      getActiveSpreadsheet: function () { return (mode.tanpaAktif || mode.berdiriSendiri || mode.bukuHilang) ? null : buku; },
      openById: function (id) {
        if (!mode.izinPenuh) throw new Error('You do not have permission to call SpreadsheetApp.openById. Required permissions: https://www.googleapis.com/auth/spreadsheets');
        if (!bukuAda || mode.bukuHilang || id !== buku.getId()) throw new Error('Document ' + id + ' is missing (perhaps it was deleted, or you don\'t have read access?)');
        return buku;
      },
      create: function (nama) {
        if (!mode.izinPenuh) throw new Error('You do not have permission to call SpreadsheetApp.create. Required permissions: https://www.googleapis.com/auth/spreadsheets');
        if (bukuAda) throw new Error('TIRUAN: create() dipanggil padahal spreadsheet sudah ada (tiruan ini hanya punya satu)');
        bukuAda = true; catatan.dibuat += 1; buku._nama = String(nama); tertunda += 1;
        return buku;
      },
      flush: function () { tertunda = 0; catatan.flush += 1; },
      getUi: function () {
        if (!opsi.ui) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        var menu = { addItem: function () { return menu; }, addSeparator: function () { return menu; }, addToUi: function () { } };
        return { createMenu: function () { return menu; }, alert: function (p) { catatan.log.push('ALERT: ' + p); } };
      },
      ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' }
    };

    /* ----- kunci, cache, properti ----- */

    var terkunci = false;
    var LockService = {
      getScriptLock: function () {
        return {
          tryLock: function () {
            if (terkunci) throw new Error('TIRUAN: kunci bersarang — fungsi yang sudah memegang kunci memanggil fungsi lain yang mengunci lagi');
            terkunci = true; return true;
          },
          waitLock: function () { this.tryLock(); },
          releaseLock: function () {
            if (tertunda > 0) throw new Error('TIRUAN: kunci dilepas padahal masih ada tulisan yang belum di-flush. Panggil SpreadsheetApp.flush() sebelum melepas kunci.');
            terkunci = false;
          },
          hasLock: function () { return terkunci; }
        };
      }
    };

    var simpananCache = {};
    var cache = {
      get: function (k) {
        var e = simpananCache[k];
        if (!e) return null;
        if (e.habis <= jam.now()) { delete simpananCache[k]; return null; }
        return e.nilai;
      },
      put: function (k, v, detik) {
        if (typeof k !== 'string' || k.length > 250) throw new Error('TIRUAN: kunci cache terlalu panjang');
        if (typeof v !== 'string') throw new Error('TIRUAN: nilai cache harus teks');
        if (v.length > 100000) throw new Error('Argument too large: value');
        var d = detik === undefined ? 600 : detik;
        if (d > 21600) throw new Error('TIRUAN: masa cache maksimal 21600 detik');
        simpananCache[k] = { nilai: v, habis: jam.now() + d * 1000 };
      },
      remove: function (k) { delete simpananCache[k]; },
      removeAll: function (ks) { for (var i = 0; i < ks.length; i++) delete simpananCache[ks[i]]; }
    };
    var CacheService = { getScriptCache: function () { return cache; } };

    var properti = {};
    var PropertiesService = {
      getScriptProperties: function () {
        return {
          getProperty: function (k) { return Object.prototype.hasOwnProperty.call(properti, k) ? properti[k] : null; },
          setProperty: function (k, v) { properti[k] = String(v); return this; },
          deleteProperty: function (k) { delete properti[k]; return this; },
          getProperties: function () { var o = {}; Object.keys(properti).forEach(function (k) { o[k] = properti[k]; }); return o; }
        };
      }
    };

    /* ----- utilitas ----- */

    function acakByte() {
      var out = [], i;
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var a = new Uint8Array(16); crypto.getRandomValues(a);
        for (i = 0; i < 16; i++) out.push(a[i]);
      } else {
        for (i = 0; i < 16; i++) out.push(Math.floor(Math.random() * 256));
      }
      return out;
    }

    var Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8', US_ASCII: 'US_ASCII' },
      getUuid: function () {
        var b = acakByte(), h = '';
        b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
        for (var i = 0; i < 16; i++) { h += (b[i] < 16 ? '0' : '') + b[i].toString(16); if (i === 3 || i === 5 || i === 7 || i === 9) h += '-'; }
        return h;
      },
      computeDigest: function (alg, nilai) {
        if (alg !== 'SHA_256') throw new Error('TIRUAN: hanya SHA_256 yang didukung');
        return keBertanda(sha256(byteDari(nilai)));
      },
      computeHmacSha256Signature: function (nilai, kunci) { return keBertanda(hmacSha256(byteDari(kunci), byteDari(nilai))); },
      base64Encode: function (v) { return base64(byteDari(v), false); },
      base64EncodeWebSafe: function (v) { return base64(byteDari(v), true); },
      sleep: function (ms) { catatan.tidur += ms; }
    };

    var ContentService = {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: function (s) {
        var o = { _isi: String(s), _mime: 'TEXT', setMimeType: function (m) { o._mime = m; return o; }, getContent: function () { return o._isi; } };
        return o;
      }
    };

    var pemicu = [];
    var ScriptApp = {
      getProjectTriggers: function () { return pemicu.slice(); },
      newTrigger: function (fungsi) {
        // Seperti aslinya: pemicu waktu dan pemicu spreadsheet punya pembuat sendiri-sendiri, tidak bisa dicampur.
        function buat(jenis) { var t = { _jenis: jenis, getHandlerFunction: function () { return fungsi; } }; pemicu.push(t); return t; }
        return {
          timeBased: function () {
            var w = { everyDays: function () { return w; }, everyHours: function () { return w; }, atHour: function () { return w; }, inTimezone: function () { return w; }, create: function () { return buat('waktu'); } };
            return w;
          },
          forSpreadsheet: function (ss) {
            if (!mode.izinPenuh) throw new Error('You do not have permission to call ScriptApp.newTrigger(...).forSpreadsheet. Required permissions: https://www.googleapis.com/auth/spreadsheets');
            if (!ss || (ss !== buku && ss !== buku.getId())) throw new Error('TIRUAN: forSpreadsheet() harus diberi spreadsheet atau ID-nya');
            var acara = '';
            var p = { onOpen: function () { acara = 'buka'; return p; }, onEdit: function () { acara = 'sunting'; return p; }, onChange: function () { acara = 'ubah'; return p; }, create: function () { if (!acara) throw new Error('TIRUAN: pemicu spreadsheet dibuat tanpa memilih acaranya'); return buat(acara); } };
            return p;
          }
        };
      },
      deleteTrigger: function (t) { var i = pemicu.indexOf(t); if (i >= 0) pemicu.splice(i, 1); },
      getService: function () { return { getUrl: function () { return opsi.urlApi || ''; } }; }
    };

    var Logger = { log: function (p) { catatan.log.push(String(p)); } };
    var Charts = { ChartType: { COLUMN: 'COLUMN', LINE: 'LINE', BAR: 'BAR' } };

    /* ----- simpan / muat keadaan (untuk server lokal & demo) ----- */

    function ambilKeadaan() {
      return JSON.stringify({
        zona: buku._zona,
        properti: properti,
        lembar: buku._lembar.map(function (l) {
          return {
            nama: l._nama, maksBaris: l._maksBaris, format: l._format,
            nilai: l._nilai.map(function (r) { return r ? r.map(function (v) { return adalahTanggal(v) ? { $tgl: v.getTime() } : (v === undefined ? '' : v); }) : null; })
          };
        })
      });
    }

    function muatKeadaan(teks) {
      var d = JSON.parse(teks);
      buku._zona = d.zona || buku._zona;
      Object.keys(properti).forEach(function (k) { delete properti[k]; });
      Object.keys(d.properti || {}).forEach(function (k) { properti[k] = d.properti[k]; });
      if (properti.ID_BUKU) bukuAda = true;   // keadaan lama sudah punya spreadsheet
      buku._lembar = (d.lembar || []).map(function (x) {
        var l = new Lembar(x.nama);
        l._maksBaris = x.maksBaris || 1000;
        l._format = x.format || [];
        l._nilai = (x.nilai || []).map(function (r) { return r ? r.map(function (v) { return v && typeof v === 'object' && v.$tgl !== undefined ? new Date(v.$tgl) : v; }) : undefined; });
        return l;
      });
      Object.keys(simpananCache).forEach(function (k) { delete simpananCache[k]; });
    }

    return {
      SpreadsheetApp: SpreadsheetApp, LockService: LockService, CacheService: CacheService, PropertiesService: PropertiesService,
      Utilities: Utilities, ContentService: ContentService, ScriptApp: ScriptApp, Logger: Logger, Charts: Charts,
      _buku: buku, _catatan: catatan, _cache: simpananCache, _properti: properti, _mode: mode,
      _ambilKeadaan: ambilKeadaan, _muatKeadaan: muatKeadaan,
      _kripto: { sha256: sha256, hmacSha256: hmacSha256, utf8: utf8, base64: base64 }
    };
  };
});
