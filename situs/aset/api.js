/* KARTU AURA — penghubung ke server (Apps Script), dipakai Kartu Pembeli dan Meja Stempel */
window.KA = window.KA || {};

(function () {
  'use strict';

  var BATAS_WAKTU = 30000;

  function galat(kode, pesan, data) {
    var e = new Error(pesan);
    e.kode = kode;
    e.data = data || null;
    return e;
  }

  function alamat() {
    var a = (KA.config && KA.config.api) || '';
    return a || '/api';
  }

  /**
   * Memanggil server. Mengembalikan Promise berisi data, atau menolak dengan Error (ada .kode dan .message).
   * Kode 'JARINGAN' berarti permintaan tidak sampai (sinyal, waktu habis).
   * opsi.batas: batas tunggu dalam milidetik, untuk pekerjaan yang memang lama (bawaan 30 detik).
   */
  KA.api = function (aksi, data, opsi) {
    var badan = { aksi: aksi };
    Object.keys(data || {}).forEach(function (k) { badan[k] = data[k]; });
    var url = alamat();

    // Mode demo: tidak ada server sungguhan. Halaman demo menyediakan window.KA_DEMO.panggil(),
    // yang meneruskan permintaan ke server tiruan di halaman induknya.
    if (url === 'demo') {
      return new Promise(function (selesai, tolak) {
        if (!window.KA_DEMO) { tolak(galat('JARINGAN', 'Server demo tidak ada.')); return; }
        Promise.resolve(window.KA_DEMO.panggil(badan)).then(function (j) {
          if (j && j.ok) selesai(j.data); else tolak(galat((j && j.kode) || 'GALAT', (j && j.pesan) || 'Ada gangguan.', j && j.data));
        }, function () { tolak(galat('JARINGAN', 'Server demo tidak bisa dihubungi.')); });
      });
    }

    var pengendali = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var waktu = setTimeout(function () { if (pengendali) pengendali.abort(); }, (opsi && opsi.batas) || BATAS_WAKTU);
    // text/plain supaya browser tidak mengirim "preflight" yang tidak dilayani Apps Script.
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(badan),
      redirect: 'follow',
      signal: pengendali ? pengendali.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw galat('JARINGAN', 'Server tidak menjawab (' + r.status + ').');
      return r.text();
    }).then(function (teks) {
      var j;
      try { j = JSON.parse(teks); } catch (x) { throw galat('JARINGAN', 'Jawaban server tidak terbaca.'); }
      if (!j || !j.ok) throw galat((j && j.kode) || 'GALAT', (j && j.pesan) || 'Ada gangguan di server.', j && j.data);
      return j.data;
    }, function (x) {
      if (x && x.kode) throw x;
      throw galat('JARINGAN', 'Tidak tersambung. Periksa sinyal lalu coba lagi.');
    }).then(function (d) { clearTimeout(waktu); return d; }, function (e) { clearTimeout(waktu); throw e; });
  };

  KA.idPermintaan = function () {
    var s = '';
    try {
      var a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    } catch (x) {
      s = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    }
    return 'r' + Date.now().toString(36) + s;
  };

  /* ---------- alat kecil bersama ---------- */

  // Membuat elemen: KA.el('div', { class: 'x', onclick: fn }, [anak...])
  KA.el = function (tag, atribut, anak) {
    var ns = tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'g' || tag === 'rect' || tag === 'line' || tag === 'text';
    var e = ns ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    Object.keys(atribut || {}).forEach(function (k) {
      var v = atribut[k];
      if (v === null || v === undefined || v === false) return;
      if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'teks') e.textContent = v;
      else if (k === 'html') e.innerHTML = v; // hanya untuk markup buatan sendiri, bukan data pengguna
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    (anak || []).forEach(function (a) {
      if (a === null || a === undefined || a === false) return;
      e.appendChild(typeof a === 'string' || typeof a === 'number' ? document.createTextNode(String(a)) : a);
    });
    return e;
  };

  KA.aman = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // Semua waktu ditampilkan dalam WIB (UTC+7), apa pun zona waktu HP-nya.
  function wib(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var x = new Date(d.getTime() + 7 * 3600 * 1000);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), H: x.getUTCHours(), M: x.getUTCMinutes() };
  }
  function dua(n) { return (n < 10 ? '0' : '') + n; }

  KA.tanggal = function (iso) { var b = wib(iso); return b ? b.d + ' ' + BULAN[b.m] + ' ' + b.y : ''; };
  KA.tanggalPendek = function (iso) { var b = wib(iso); return b ? b.d + ' ' + BULAN_PENDEK[b.m] + ' ' + b.y : ''; };
  KA.hariBulan = function (iso) { var b = wib(iso); return b ? b.d + ' ' + BULAN_PENDEK[b.m] : ''; };
  KA.jam = function (iso) { var b = wib(iso); return b ? dua(b.H) + '.' + dua(b.M) : ''; };
  KA.waktu = function (iso) { var b = wib(iso); return b ? b.d + ' ' + BULAN_PENDEK[b.m] + ' ' + b.y + ', ' + dua(b.H) + '.' + dua(b.M) : ''; };
  // Seperti KA.waktu, tetapi tahunnya disembunyikan kalau masih tahun ini: "5 Nov, 17.16".
  KA.waktuRingkas = function (iso) {
    var b = wib(iso), kini = wib(new Date().toISOString());
    if (!b) return '';
    return b.d + ' ' + BULAN_PENDEK[b.m] + (b.y === kini.y ? '' : ' ' + b.y) + ', ' + dua(b.H) + '.' + dua(b.M);
  };
  KA.berapaLama = function (iso) {
    var d = new Date(iso).getTime();
    if (isNaN(d)) return '';
    var menit = Math.round((Date.now() - d) / 60000);
    if (menit < 1) return 'baru saja';
    if (menit < 60) return menit + ' menit lalu';
    var jam = Math.round(menit / 60);
    if (jam < 24) return jam + ' jam lalu';
    var hari = Math.round(jam / 24);
    if (hari < 31) return hari + ' hari lalu';
    return KA.tanggalPendek(iso);
  };

  KA.tautanWa = function (nomor, teks) {
    return 'https://wa.me/' + encodeURIComponent(String(nomor || '').replace(/\D/g, '')) + (teks ? '?text=' + encodeURIComponent(teks) : '');
  };

  KA.salin = function (teks) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(teks).catch(function () { return salinLama(teks); });
    }
    return salinLama(teks);
  };
  function salinLama(teks) {
    return new Promise(function (selesai, tolak) {
      try {
        var t = document.createElement('textarea');
        t.value = teks; t.setAttribute('readonly', '');
        t.style.position = 'fixed'; t.style.top = '-1000px'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); t.setSelectionRange(0, teks.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(t);
        if (ok) selesai(); else tolak(new Error('tidak bisa menyalin'));
      } catch (x) { tolak(x); }
    });
  }

  var kabarEl = null, kabarWaktu = null;
  KA.kabar = function (teks, galatKah) {
    if (!kabarEl) { kabarEl = KA.el('div', { class: 'kabar', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(KA.el('div', { class: 'kabar-wadah' }, [kabarEl])); }
    kabarEl.textContent = teks;
    kabarEl.className = 'kabar' + (galatKah ? ' kabar--galat' : '');
    void kabarEl.offsetWidth; // paksa hitung ulang supaya animasinya jalan
    kabarEl.classList.add('tampil');
    clearTimeout(kabarWaktu);
    kabarWaktu = setTimeout(function () { kabarEl.classList.remove('tampil'); }, galatKah ? 4200 : 2600);
  };

  /**
   * Lembar dari bawah. isi: elemen. Mengembalikan { tutup }.
   * opsi.tetap = true → tidak bisa ditutup dengan mengetuk luar (untuk persetujuan).
   */
  KA.lembar = function (isi, opsi) {
    opsi = opsi || {};
    var sebelum = document.activeElement;
    var lembar = KA.el('div', { class: 'lembar', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' }, [isi]);
    var tirai = KA.el('div', { class: 'tirai' }, [lembar]);
    function tutup() {
      tirai.classList.remove('buka');
      document.removeEventListener('keydown', tombol);
      setTimeout(function () { if (tirai.parentNode) tirai.parentNode.removeChild(tirai); }, 220);
      if (sebelum && sebelum.focus) { try { sebelum.focus(); } catch (x) { /* abaikan */ } }
      if (opsi.saatTutup) opsi.saatTutup();
    }
    function tombol(e) {
      if (e.key === 'Escape' && !opsi.tetap) tutup();
      if (e.key === 'Tab') {
        var f = lembar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var awal = f[0], akhir = f[f.length - 1];
        if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus(); }
        else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus(); }
      }
    }
    tirai.addEventListener('click', function (e) { if (e.target === tirai && !opsi.tetap) tutup(); });
    document.addEventListener('keydown', tombol);
    document.body.appendChild(tirai);
    void tirai.offsetWidth;
    tirai.classList.add('buka');
    // Fokus dipindah saat itu juga (bukan lewat jeda), supaya ketikan pertama tidak pernah jatuh ke isian yang salah
    // dan papan ketik HP langsung muncul.
    var pertama = lembar.querySelector('[data-fokus]') || lembar;
    try { pertama.focus({ preventScroll: true }); } catch (x) { try { pertama.focus(); } catch (y) { /* abaikan */ } }
    return { tutup: tutup, elemen: lembar };
  };

  // Simpanan di HP: boleh gagal (mode privat), jadi selalu dibungkus.
  KA.simpan = {
    baca: function (k) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (x) { return null; } },
    tulis: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) { /* abaikan */ } },
    hapus: function (k) { try { localStorage.removeItem(k); } catch (x) { /* abaikan */ } }
  };
})();
