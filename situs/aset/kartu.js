/* KARTU AURA — Kartu Pembeli */
(function () {
  'use strict';

  var el = KA.el;
  var akar = document.getElementById('akar');
  var KUNCI = 'ka:kartu';
  var gerakHemat = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var token = (KA.config && KA.config.token) || ambilToken();   // config.token hanya dipakai halaman demo
  var data = null;          // muatan kartu terakhir dari server
  var bagian = null;        // elemen-elemen kartu yang sudah dibangun
  var sedangAmbil = false, terakhirAmbil = 0;

  /* ---------- token ---------- */

  function ambilToken() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) { var m = /[?&]t=([A-Za-z0-9]+)/.exec(location.search); if (m) h = m[1]; }
    h = h.replace(/[^A-Za-z0-9]/g, '');
    var simpanan = KA.simpan.baca(KUNCI);
    if (!h && simpanan && simpanan.token) {
      // Dibuka tanpa link (mis. dari layar utama): pakai kartu yang terakhir dibuka di HP ini.
      h = simpanan.token;
      try { history.replaceState(null, '', location.pathname + location.search + '#' + h); } catch (x) { /* abaikan */ }
    }
    return h;
  }

  /* ---------- gambar: segel lilin, ornamen, botol, lambang ---------- */

  var SVG = 'http://www.w3.org/2000/svg';
  var nId = 0;
  function idBaru() { nId += 1; return 'ka' + nId; }

  // Bentuk lilin yang meleleh (tepi bergelombang) dan garis tipis di dalamnya.
  var LILIN_LUAR = 'M114.35 60C114.87 63.75 112.5 68.04 110.85 71.61C109.2 75.17 105.97 77.79 104.45 81.41C102.94 85.03 104.04 90.43 101.78 93.32C99.52 96.2 94.37 97.07 90.88 98.72C87.38 100.36 84.23 102.14 80.81 103.2C77.38 104.27 73.77 104.48 70.3 105.12C66.83 105.77 63.68 105.98 60 107.07C56.32 108.16 51.78 112.1 48.21 111.66C44.64 111.22 41.92 106.42 38.6 104.44C35.28 102.46 31.75 101.57 28.27 99.78C24.8 97.99 20.2 96.6 17.74 93.7C15.29 90.8 14.79 86.1 13.54 82.38C12.28 78.65 10.09 75.09 10.22 71.36C10.36 67.63 13.83 63.67 14.35 60C14.87 56.33 13.35 53.02 13.36 49.35C13.36 45.69 12.65 41.08 14.36 38.02C16.06 34.96 21.24 33.88 23.6 30.97C25.96 28.06 26.22 23.51 28.53 20.53C30.83 17.56 34.16 15.26 37.42 13.11C40.67 10.95 44.28 8.63 48.05 7.63C51.81 6.62 56.26 5.98 60 7.07C63.74 8.16 66.8 12.96 70.46 14.17C74.13 15.38 78.63 13.1 81.99 14.34C85.35 15.58 88.3 18.76 90.62 21.6C92.95 24.43 93.76 28.45 95.93 31.35C98.09 34.25 101.67 36.03 103.63 38.99C105.6 41.95 105.93 45.61 107.72 49.11C109.5 52.61 113.83 56.25 114.35 60Z';
  var LILIN_DALAM = 'M110.85 60C111.37 63.49 109.03 67.51 107.44 70.83C105.84 74.14 102.7 76.5 101.3 79.89C99.9 83.27 101.15 88.45 99.04 91.14C96.94 93.82 91.99 94.5 88.69 95.98C85.4 97.47 82.48 99.09 79.29 100.05C76.09 101 72.73 101.12 69.52 101.71C66.31 102.3 63.42 102.48 60 103.57C56.58 104.66 52.3 108.63 48.99 108.25C45.67 107.87 43.21 103.15 40.12 101.28C37.03 99.42 33.73 98.67 30.46 97.05C27.18 95.42 22.77 94.22 20.48 91.52C18.18 88.82 17.83 84.35 16.69 80.86C15.55 77.37 13.44 74.06 13.64 70.58C13.83 67.11 17.33 63.41 17.85 60C18.37 56.59 16.82 53.54 16.77 50.13C16.71 46.72 15.92 42.37 17.51 39.54C19.11 36.71 24.13 35.86 26.33 33.15C28.53 30.44 28.61 26.09 30.71 23.27C32.81 20.46 35.92 18.3 38.94 16.26C41.95 14.22 45.31 11.99 48.83 11.04C52.34 10.09 56.52 9.48 60 10.57C63.48 11.66 66.27 16.43 69.68 17.58C73.09 18.73 77.34 16.37 80.47 17.49C83.6 18.62 86.32 21.66 88.44 24.34C90.56 27.01 91.18 30.84 93.19 33.53C95.2 36.23 98.63 37.78 100.48 40.51C102.33 43.23 102.58 46.64 104.3 49.89C106.03 53.14 110.33 56.51 110.85 60Z';
  var LILIN = {
    merah: { atas: '#c2414a', tengah: '#8e1b24', bawah: '#571017', sumurAtas: '#9e2630', sumurBawah: '#74131c', cincinTerang: '#ffc4b4', cincinTerangTembus: 0.3, cincinGelap: '#3e070d', lambangTerang: '#ffc9b8', lambangTerangTembus: 0.3, lambangGelap: '#45080f', kilap: '#ffd9cc', kilapTembus: 0.35, bintik: '#f2d49a', bintikTembus: 0.55 },
    emas: { atas: '#f7e3a8', tengah: '#d6af62', bawah: '#9a7535', sumurAtas: '#e2c27d', sumurBawah: '#b48c45', cincinTerang: '#fff6da', cincinTerangTembus: 0.5, cincinGelap: '#6e5020', lambangTerang: '#fff8e1', lambangTerangTembus: 0.55, lambangGelap: '#6a4c1c', kilap: '#fffbea', kilapTembus: 0.55, bintik: '#fff4cf', bintikTembus: 0.7 }
  };

  // Segel lilin dengan lambang APB tercetak di tengahnya. warna: 'merah' (stempel) atau 'emas' (hadiah).
  function segelSvg(warna) {
    var w = LILIN[warna] || LILIN.merah, L = KA.logo.emblem, id = idBaru();
    var skala = 72 / L.w;
    var letak = 'translate(60 60) scale(' + skala.toFixed(5) + ') translate(' + (-L.cx) + ' ' + (-L.cy) + ')';
    var tebal = (0.75 / skala).toFixed(1);
    function lambang(warnaIsi, tembus) {
      return '<path transform="' + letak + '" d="' + L.d + '" fill="' + warnaIsi + '" fill-opacity="' + tembus + '" fill-rule="evenodd" stroke="' + warnaIsi + '" stroke-opacity="' + tembus + '" stroke-width="' + tebal + '" stroke-linejoin="round"/>';
    }
    return '<svg xmlns="' + SVG + '" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="' + id + 'a" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="' + w.atas + '"/><stop offset="0.55" stop-color="' + w.tengah + '"/><stop offset="1" stop-color="' + w.bawah + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'b" cx="55%" cy="60%" r="65%"><stop offset="0" stop-color="' + w.sumurAtas + '"/><stop offset="1" stop-color="' + w.sumurBawah + '"/></radialGradient></defs>' +
      '<path d="' + LILIN_LUAR + '" fill="url(#' + id + 'a)"/>' +
      '<path d="' + LILIN_DALAM + '" fill="none" stroke="' + w.cincinTerang + '" stroke-opacity="0.18" stroke-width="1"/>' +
      '<circle cx="60" cy="60" r="37.5" fill="none" stroke="' + w.cincinTerang + '" stroke-opacity="' + w.cincinTerangTembus + '" stroke-width="1.6"/>' +
      '<circle cx="60" cy="60" r="36" fill="url(#' + id + 'b)"/>' +
      '<circle cx="60" cy="60" r="35" fill="none" stroke="' + w.cincinGelap + '" stroke-opacity="0.55" stroke-width="2"/>' +
      '<g transform="translate(0.7 0.9)">' + lambang(w.lambangTerang, w.lambangTerangTembus) + '</g>' +
      lambang(w.lambangGelap, 1) +
      '<path d="M26 46A36 36 0 0 1 46 25" fill="none" stroke="' + w.kilap + '" stroke-opacity="' + w.kilapTembus + '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<g fill="' + w.bintik + '" fill-opacity="' + w.bintikTembus + '"><circle cx="101.35" cy="75.05" r="1"/><circle cx="70.61" cy="99.6" r="0.8"/><circle cx="30.43" cy="95.24" r="1.1"/><circle cx="20.53" cy="45.64" r="0.7"/><circle cx="40.98" cy="19.22" r="1"/><circle cx="80" cy="25.36" r="0.8"/><circle cx="103.23" cy="44.27" r="0.9"/></g>' +
      '</svg>';
  }

  // Garis hias emas dengan dua lengkung dan wajik di tengah.
  function ornamenSvg() {
    var id = idBaru();
    return '<svg xmlns="' + SVG + '" class="kartu__ornamen" viewBox="0 0 300 14" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="' + id + 'k" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#d4af6a" stop-opacity="0"/><stop offset="1" stop-color="#d4af6a" stop-opacity="0.7"/></linearGradient>' +
      '<linearGradient id="' + id + 'n" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#d4af6a" stop-opacity="0.7"/><stop offset="1" stop-color="#d4af6a" stop-opacity="0"/></linearGradient></defs>' +
      '<rect x="0" y="6.5" width="121" height="1" fill="url(#' + id + 'k)"/><rect x="179" y="6.5" width="121" height="1" fill="url(#' + id + 'n)"/>' +
      '<g fill="none" stroke="#d4af6a" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M124 7C128 7 130 3.5 133.5 3.5C136.5 3.5 137.5 6.5 135.5 8C134 9.2 132 8 132.8 6.6"/>' +
      '<path d="M176 7C172 7 170 3.5 166.5 3.5C163.5 3.5 162.5 6.5 164.5 8C166 9.2 168 8 167.2 6.6"/>' +
      '<path d="M150 2L155 7L150 12L145 7Z"/></g>' +
      '<circle cx="150" cy="7" r="1.3" fill="#d4af6a"/><circle cx="141" cy="7" r="1" fill="#d4af6a"/><circle cx="159" cy="7" r="1" fill="#d4af6a"/></svg>';
  }

  function botolSvg() {
    return '<svg xmlns="' + SVG + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="none" stroke="#e9c987" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="12.5" y="3.5" width="7" height="4.5" rx="1"/><rect x="14" y="8" width="4" height="3"/><rect x="7.5" y="11" width="17" height="17.5" rx="5"/><path d="M16 16.5L18.5 19L16 21.5L13.5 19Z"/></g></svg>';
  }

  function s(tag, atribut, anak) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(atribut || {}).forEach(function (k) { e.setAttribute(k, atribut[k]); });
    (anak || []).forEach(function (a) { e.appendChild(a); });
    return e;
  }

  function lambangKecil(kelas) {
    var L = KA.logo.emblem;
    return s('svg', { class: kelas || 'layar__lambang', viewBox: '0 0 ' + L.w + ' ' + L.h, 'aria-hidden': 'true', focusable: 'false' }, [
      s('path', { d: L.d, fill: '#d4af6a', 'fill-rule': 'evenodd' })
    ]);
  }

  function logoTeks() {
    var T = KA.logo.teks;
    return s('svg', { class: 'kaki-hal__logo', viewBox: '0 0 ' + T.w + ' ' + T.h, role: 'img', 'aria-label': 'PT Andri Putra Borneo' }, [
      s('path', { d: T.d, fill: '#d4af6a', 'fill-rule': 'evenodd' })
    ]);
  }

  function ikonWa() {
    return s('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [
      s('path', { d: 'M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z' }),
      s('path', { d: 'M9.3 8.7c-.2 1.5.6 3.2 1.9 4.5 1.3 1.3 3 2.1 4.5 1.9' })
    ]);
  }

  /* ---------- teks ---------- */

  var ANGKA = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
  function kata(n) { return n >= 1 && n <= 9 ? ANGKA[n] : String(n); }

  // Kalimat status di dalam kartu: bagian tebal (emas) + lanjutannya.
  function kalimatStatus(d) {
    var k = d.kartu;
    if (d.hangus) return { kuat: 'Mulai dari 0 lagi.', teks: 'Stempel sebelumnya hangus karena ' + d.masa_berlaku_bulan + ' bulan tanpa stempel baru. Stempel berikutnya memulai kartu baru.' };
    if (k.penuh) {
      var lanjut = k.berikutnya && k.berikutnya.isi > 0 ? ' Kartu berikutnya sudah terisi ' + k.berikutnya.isi + ' stempel.' : '';
      return { kuat: 'Hadiahmu siap.', teks: d.hadiah + ' sudah jadi hakmu. Sebut aroma pilihanmu ke admin.' + lanjut };
    }
    if (k.isi === 0) {
      if (d.total_hadiah > 0) return { kuat: 'Kartu ke-' + k.kartu_ke + ' dimulai.', teks: 'Hadiah kartu sebelumnya sudah kami kirim bersama pesananmu. ' + k.target + ' stempel lagi untuk ' + d.hadiah + ' berikutnya.' };
      return { kuat: 'Belum ada stempel.', teks: 'Stempel pertama masuk setelah pesanan parfum lewat WhatsApp lunas.' };
    }
    return { kuat: kata(k.sisa) + ' stempel lagi,', teks: d.hadiah + ' untukmu.' };
  }

  function teksRiwayat(x, d) {
    var J = x.j, n = Number(x.n) || 0;
    if (J === 'STEMPEL_AWAL') return { utama: 'Stempel awal', kecil: 'Untuk parfum yang sudah kamu beli sebelumnya' };
    if (J === 'STEMPEL') {
      var penuh = Number(x.s) >= d.target;
      if (n > 1) return { utama: n + ' stempel pembelian', kecil: penuh ? 'Kartu ke-' + x.k + ' penuh' : '' };
      return { utama: 'Stempel ke-' + x.s, kecil: penuh ? 'Kartu ke-' + x.k + ' penuh' : '' };
    }
    if (J === 'HADIAH') return { utama: 'Hadiah dikirim', kecil: d.hadiah + (x.a ? ', aroma ' + x.a : ''), kelas: 'hadiah' };
    if (J === 'HADIAH_TUNDA') return { utama: 'Hadiah menunggu aroma pilihanmu', kecil: '' };
    if (J === 'BATAL') return { utama: 'Stempel dibatalkan', kecil: '' };
    if (J === 'PENYESUAIAN') return { utama: n < 0 ? 'Stempel dikurangi ' + (-n) : (n > 0 ? 'Stempel ditambah ' + n : 'Kartu disesuaikan'), kecil: '' };
    if (J === 'DAFTAR') return { utama: 'Kartu dibuat', kecil: '' };
    return null;
  }

  function aturanProgram(d) {
    var a = [];
    a.push(d.aturan === 'botol' ? '1 stempel untuk tiap botol parfum yang dibeli lewat WhatsApp dan sudah dibayar.' : '1 stempel untuk tiap pesanan parfum lewat WhatsApp yang sudah dibayar.');
    a.push(d.target + ' stempel = ' + d.hadiah + ', dikirim bersama pesanan yang memenuhkan kartu.');
    a.push('Parfum yang sudah kamu beli sebelumnya di tempat lain dihitung 1 stempel awal, satu kali.');
    if (d.masa_berlaku_bulan > 0) a.push('Stempel hangus kalau ' + d.masa_berlaku_bulan + ' bulan tidak ada stempel baru.');
    return a;
  }

  function bulanTahun(iso) { return KA.tanggalPendek(iso).replace(/^\d+\s+/, ''); }

  function teksSub(d) {
    var k = d.kartu;
    var bagianTeks = ['No. ' + d.no_anggota];
    if (d.angkatan_pertama) bagianTeks.push('Angkatan pertama');
    bagianTeks.push((d.angkatan_pertama ? 'Sejak ' : 'Anggota sejak ') + bulanTahun(d.anggota_sejak));
    if (k.kartu_ke > 1) bagianTeks.push('Kartu ke-' + k.kartu_ke);
    return bagianTeks.join(' · ');
  }

  /* ---------- layar sederhana ---------- */

  function kosongkan(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function kosongkanHalaman() { kosongkan(akar); bagian = null; document.body.classList.remove('penuh'); }

  function tampilKerangka() {
    kosongkanHalaman();
    akar.appendChild(el('div', { class: 'kerangka', 'aria-busy': 'true' }, [
      el('div', { class: 'kerangka__kartu' }),
      el('p', { class: 'kerangka__teks', teks: 'Membuka kartumu…' })
    ]));
  }

  function tampilLayar(judul, paragraf, aksi) {
    kosongkanHalaman();
    var teks = el('div', { class: 'layar__teks' });
    (paragraf || []).forEach(function (p) { teks.appendChild(el('p', { teks: p })); });
    akar.appendChild(el('section', { class: 'layar' }, [
      lambangKecil(),
      el('h1', { class: 'layar__judul', teks: judul }),
      teks,
      aksi && aksi.length ? el('div', { class: 'layar__aksi' }, aksi) : null
    ]));
  }

  function tombolCobaLagi() {
    return el('button', { class: 'tombol tombol--emas', type: 'button', teks: 'Coba lagi', onclick: function () { tampilKerangka(); ambil(); } });
  }

  function tampilPersetujuan(d) {
    var setuju = el('button', { class: 'tombol tombol--emas', type: 'button', teks: 'Setuju, buka kartuku' });
    var tolak = el('button', { class: 'tombol tombol--teks', type: 'button', teks: 'Tidak, hapus data saya' });
    setuju.addEventListener('click', function () {
      setuju.disabled = true; setuju.textContent = 'Membuka…';
      KA.api('setuju', { t: token }).then(terima, function (e) {
        setuju.disabled = false; setuju.textContent = 'Setuju, buka kartuku';
        KA.kabar(e.message, true);
      });
    });
    tolak.addEventListener('click', function () { tanyaHapus(); });
    tampilLayar('Halo, ' + (d.nama_depan || 'Kak') + '.', [
      d.program + ' menyimpan nama dan nomor WhatsApp-mu untuk mencatat stempel.',
      'Tidak dipakai untuk hal lain, dan tidak dijual atau dibagikan.'
    ], [setuju, tolak]);
  }

  function tanyaHapus() {
    var lembar;
    var ya = el('button', { class: 'tombol tombol--bahaya tombol--penuh', type: 'button', teks: 'Ya, hapus data saya' });
    var batal = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', 'data-fokus': true, teks: 'Batal' });
    batal.addEventListener('click', function () { lembar.tutup(); });
    ya.addEventListener('click', function () {
      ya.disabled = true; ya.textContent = 'Menghapus…';
      KA.api('hapus_data_saya', { t: token }).then(function () {
        lembar.tutup();
        KA.simpan.hapus(KUNCI);
        data = null;
        tampilLayar('Datamu sudah dihapus', ['Nama, nomor WhatsApp, dan kartumu sudah tidak tersimpan. Kalau suatu saat mau punya kartu lagi, chat admin.'], []);
      }, function (e) {
        ya.disabled = false; ya.textContent = 'Ya, hapus data saya';
        KA.kabar(e.message, true);
      });
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Hapus data?' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Nama, nomor WhatsApp, dan kartumu dihapus. Stempel yang sudah terkumpul ikut hilang dan tidak bisa dikembalikan.' })]),
      el('div', { class: 'lembar__aksi' }, [batal, ya])
    ]));
  }

  function bukaSyarat() {
    var d = data, lembar;
    var daftar = el('ul', { class: 'cara', style: 'list-style:disc' });
    aturanProgram(d).forEach(function (t) { daftar.appendChild(el('li', { teks: t })); });
    var hapus = el('button', { class: 'tombol tombol--bahaya tombol--penuh', type: 'button', teks: 'Hapus data saya' });
    var tutup = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', 'data-fokus': true, teks: 'Tutup' });
    tutup.addEventListener('click', function () { lembar.tutup(); });
    hapus.addEventListener('click', function () { lembar.tutup(); setTimeout(tanyaHapus, 240); });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Syarat & privasi' }),
      el('div', { class: 'lembar__isi' }, [
        daftar,
        el('p', { style: 'margin-top:16px', teks: 'Yang disimpan hanya nama, nomor WhatsApp' + (d.wa_samar ? ' (' + d.wa_samar + ')' : '') + ', dan riwayat stempelmu. Data itu ada di catatan milik APB, dipakai untuk mencatat stempel dan mengabari soal kartu ini, dan tidak dijual atau dibagikan.' }),
        el('p', { teks: 'Kamu bisa minta datamu dihapus kapan saja lewat tombol di bawah. Kartumu ikut terhapus.' })
      ]),
      el('div', { class: 'lembar__aksi' }, [tutup, hapus])
    ]));
  }

  /* ---------- membangun kartu ---------- */

  function buatSlot(indeks, target) {
    var gratis = indeks === target;
    var bulat = el('div', { class: 'slot__bulat' });
    var slot = el('li', { class: 'slot' + (gratis ? ' slot--gratis' : '') }, [
      bulat,
      el('span', { class: 'slot__label', teks: gratis ? 'Gratis' : 'Stempel ' + (indeks + 1) })
    ]);
    return { elemen: slot, bulat: bulat, keadaan: '', gratis: gratis };
  }

  function bangun(d) {
    kosongkanHalaman();
    var k = d.kartu;

    var nama = el('span', { class: 'kartu__nama', teks: d.nama });
    if (d.nama.length > 28) nama.classList.add('panjang-sekali'); else if (d.nama.length > 20) nama.classList.add('panjang');

    var slot = [];
    var grid = el('ul', { class: 'slot-grid', 'aria-label': 'Stempel' });
    for (var i = 0; i <= k.target; i++) { var sl = buatSlot(i, k.target); slot.push(sl); grid.appendChild(sl.elemen); }

    var status = el('p', { class: 'kartu__status', 'aria-live': 'polite' });
    var kilau = el('span', { class: 'kartu__kilau', 'aria-hidden': 'true' });
    var sub = el('span', { class: 'kartu__sub' });

    var tombolKode = el('button', { class: 'kartu__kode-tombol', type: 'button', 'aria-label': 'Salin kode kartu ' + d.kode }, [lambangKecil('kartu__kode-lambang')]);
    tombolKode.addEventListener('click', function () {
      KA.salin(d.kode).then(function () { KA.kabar('Kode kartu disalin'); }, function () { KA.kabar('Kode kartumu: ' + d.kode); });
    });

    var kartu = el('section', { class: 'kartu', 'aria-label': d.program }, [
      el('span', { class: 'kartu__cap', 'aria-hidden': 'true', html: segelSvg('emas') }),
      kilau,
      el('div', { class: 'kartu__baris' }, [
        el('span', { class: 'kartu__program', teks: d.program }),
        d.sebutan ? el('span', { class: 'kartu__pil', teks: d.sebutan }) : null
      ]),
      el('span', { html: ornamenSvg() }).firstChild,
      el('div', { class: 'kartu__identitas' }, [nama, sub]),
      grid,
      status,
      el('div', { class: 'kartu__kode' }, [
        tombolKode,
        el('div', { class: 'kartu__kode-teks' }, [
          el('span', { class: 'kartu__kode-nilai', teks: d.kode }),
          el('span', { class: 'kartu__kode-ket', teks: 'Kode kartumu. Sebut saat pesan lewat WhatsApp supaya cepat dicek.' })
        ])
      ])
    ]);
    kartu.addEventListener('animationend', function (e) {
      if (e.target !== kartu) return;
      if (e.animationName === 'masuk') kartu.classList.remove('masuk');
      if (e.animationName === 'hentak') kartu.classList.remove('hentak');
    });
    kilau.addEventListener('animationend', function () { kilau.classList.remove('sapu'); });

    var strip = el('div', { class: 'js-strip' });
    var aksi = el('div', { class: 'aksi' });
    var riwayat = el('ul', { class: 'riwayat' });
    var bagianRiwayat = el('section', { class: 'bagian' }, [el('h2', { class: 'bagian__judul', teks: 'Riwayat' }), riwayat]);

    var cara = el('ol', { class: 'cara' });
    [
      ['Pesan parfum lewat WhatsApp.', ' Sebut kode kartumu supaya cepat dicek.'],
      ['Setelah pesanan lunas, 1 stempel masuk.', ' Kartu ini ikut berubah sendiri.'],
      ['Di stempel ke-' + k.target + ', ' + d.hadiah + ' ikut dikirim.', ' Kartu berikutnya langsung dimulai.']
    ].forEach(function (b) { cara.appendChild(el('li', {}, [el('strong', { teks: b[0] }), b[1]])); });

    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
    var kaki = el('footer', { class: 'kaki-hal' }, [
      el('p', { teks: ios ? 'Biar gampang dibuka lagi: ketuk tombol Bagikan, lalu pilih Tambahkan ke Layar Utama.' : 'Biar gampang dibuka lagi: buka menu browser, lalu pilih Tambahkan ke layar utama.' }),
      el('p', {}, [el('button', { class: 'tombol tombol--teks', type: 'button', teks: 'Syarat & privasi', onclick: bukaSyarat })]),
      logoTeks()
    ]);

    akar.appendChild(strip);
    akar.appendChild(el('header', { class: 'kepala' }, [
      el('span', { class: 'kepala__atas', teks: 'Kartu Member' }),
      el('h1', { class: 'kepala__judul', teks: 'Parfum Aura' })
    ]));
    akar.appendChild(kartu);
    akar.appendChild(aksi);
    akar.appendChild(el('p', { class: 'catatan', teks: 'Stempel masuk sendiri setelah pesanan WhatsApp-mu lunas.' }));
    akar.appendChild(bagianRiwayat);
    akar.appendChild(el('section', { class: 'bagian' }, [el('h2', { class: 'bagian__judul', teks: 'Cara dapat stempel' }), cara]));
    akar.appendChild(kaki);

    bagian = { kartu: kartu, kilau: kilau, slot: slot, target: k.target, status: status, sub: sub, aksi: aksi, riwayat: riwayat, bagianRiwayat: bagianRiwayat, strip: strip };
  }

  /* ---------- slot: isi dan animasinya ---------- */

  var WARNA_PERCIK = ['', 'merah', '', 'merah', '', 'merah', '', 'merah'];

  /**
   * Mengatur satu slot. keadaan: 'kosong' | 'merah' | 'emas' | 'gratis' | 'siap'.
   * anim: 'muncul' (membesar pelan) | 'jatuh' (segel dijatuhkan, dengan cipratan) | kosong.
   */
  function aturSlot(indeks, keadaan, anim) {
    var sl = bagian.slot[indeks];
    if (!sl) return;
    if (sl.keadaan === keadaan && !anim) return;
    sl.keadaan = keadaan;
    kosongkan(sl.bulat);
    if (keadaan === 'kosong') { sl.bulat.appendChild(el('span', { class: 'slot__kosong' })); return; }
    if (keadaan === 'gratis' || keadaan === 'siap') {
      sl.bulat.appendChild(el('span', { class: 'slot__gratis' + (keadaan === 'siap' ? ' siap' : ''), html: botolSvg() }));
      return;
    }
    var segel = el('span', { class: 'slot__segel' + (anim && !gerakHemat ? ' ' + anim : ''), html: segelSvg(keadaan) });
    var sementara = [];
    if (anim === 'jatuh' && !gerakHemat) {
      sementara.push(el('span', { class: 'cipratan' }));
      sl.bulat.appendChild(sementara[0]);
    }
    sl.bulat.appendChild(segel);
    if (anim === 'jatuh' && !gerakHemat) {
      for (var i = 1; i <= 8; i++) { var p = el('i', { class: 'percik p' + i + (WARNA_PERCIK[i - 1] ? ' merah' : '') }); sementara.push(p); sl.bulat.appendChild(p); }
    }
    if (anim) {
      setTimeout(function () {
        segel.classList.remove(anim);
        sementara.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      }, anim === 'jatuh' ? 1700 : 700);
    }
  }

  // Menata seluruh slot sesuai jumlah stempel, tanpa animasi.
  function aturSemuaSlot(isi, penuh) {
    for (var i = 0; i < bagian.target; i++) aturSlot(i, i < isi ? 'merah' : 'kosong');
    aturSlot(bagian.target, penuh ? 'siap' : 'gratis');
    bagian.kartu.classList.toggle('penuh', !!penuh);
    document.body.classList.toggle('penuh', !!penuh);
  }

  var sudahSentuh = false;
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (n) {
    window.addEventListener(n, function () { sudahSentuh = true; }, { passive: true });
  });
  // Getar hanya setelah layar pernah disentuh; sebelum itu browser menolaknya.
  function getar(pola) { try { if (sudahSentuh && navigator.vibrate) navigator.vibrate(pola); } catch (x) { /* abaikan */ } }

  // Kartu bergoyang dan kilau menyapu saat segel mendarat.
  function hentakKartu() {
    if (gerakHemat || !bagian) return;
    var k = bagian.kartu, kil = bagian.kilau;
    k.classList.remove('hentak'); kil.classList.remove('sapu');
    void k.offsetWidth;
    k.classList.add('hentak'); kil.classList.add('sapu');
  }

  // Menjatuhkan segel ke slot `dari` sampai sebelum `sampai`, satu per satu. Mengembalikan lama animasi (ms).
  function jatuhkan(dari, sampai, warna, jeda) {
    var n = Math.max(0, sampai - dari);
    for (var i = dari; i < sampai; i++) {
      (function (indeks, tunda) {
        setTimeout(function () {
          if (!bagian) return;
          aturSlot(indeks, warna, 'jatuh');
          hentakKartu();
          setTimeout(function () { getar(35); }, 740);
        }, tunda);
      })(i, (i - dari) * jeda);
    }
    return n ? (n - 1) * jeda + 1100 : 0;
  }

  // Segel yang sudah ada muncul berurutan (saat kartu pertama kali dibuka di HP ini).
  function munculkan(sampai, jeda) {
    for (var i = 0; i < sampai; i++) {
      (function (indeks, tunda) { setTimeout(function () { if (bagian) aturSlot(indeks, 'merah', gerakHemat ? '' : 'muncul'); }, tunda); })(i, i * jeda);
    }
    return sampai ? (sampai - 1) * jeda + 500 : 0;
  }

  /* ---------- memperbarui tampilan ---------- */

  function tulisStatus(kuat, teks, animasi) {
    var st = bagian.status;
    if (st.firstChild && st.firstChild.textContent === kuat && st.lastChild.textContent === ' ' + teks) return;
    kosongkan(st);
    st.appendChild(el('strong', { teks: kuat }));
    st.appendChild(document.createTextNode(' ' + teks));
    if (animasi && !gerakHemat) { st.classList.remove('ganti'); void st.offsetWidth; st.classList.add('ganti'); }
  }

  function aturStatus(d, animasi) {
    var st = kalimatStatus(d);
    tulisStatus(st.kuat, st.teks, animasi);
    bagian.sub.textContent = teksSub(d);
  }

  function aturAksi(d) {
    var a = bagian.aksi;
    kosongkan(a);
    if (!d.wa_admin) return;
    var pesan = d.kartu.penuh
      ? 'Halo, kartu ' + d.program + ' saya sudah penuh. Saya mau pilih aroma hadiahnya.\nKode kartu: ' + d.kode
      : 'Halo, saya mau pesan Parfum Aura lagi.\nKode kartu: ' + d.kode;
    var utama = el('a', { class: 'tombol tombol--emas', href: KA.tautanWa(d.wa_admin, pesan), target: '_blank', rel: 'noopener' }, [ikonWa(), d.kartu.penuh ? 'Pilih aroma hadiah lewat WhatsApp' : 'Pesan lagi lewat WhatsApp']);
    var tanya = el('a', { class: 'tombol tombol--teks', href: KA.tautanWa(d.wa_admin, 'Halo, saya mau tanya soal ' + d.program + '.\nKode kartu: ' + d.kode), target: '_blank', rel: 'noopener', teks: 'Tanya admin' });
    a.appendChild(utama);
    a.appendChild(tanya);
  }

  function aturRiwayat(d) {
    var ul = bagian.riwayat, ada = 0;
    kosongkan(ul);
    (d.riwayat || []).forEach(function (x) {
      var t = teksRiwayat(x, d);
      if (!t) return;
      ada += 1;
      var ket = el('div', { class: 'riwayat__ket' }, [el('span', { teks: t.utama })]);
      if (x.b) ket.appendChild(el('small', { teks: 'Dibatalkan' }));
      else if (t.kecil) ket.appendChild(el('small', { teks: t.kecil }));
      ul.appendChild(el('li', { class: (x.b ? 'batal ' : '') + (t.kelas || '') }, [el('div', { class: 'riwayat__tgl', teks: KA.hariBulan(x.w) }), ket]));
    });
    bagian.bagianRiwayat.hidden = ada === 0;
  }

  function aturStrip(d, pesanSinyal) {
    var st = bagian.strip;
    kosongkan(st);
    if (pesanSinyal) {
      st.appendChild(el('div', { class: 'strip', role: 'status' }, [
        el('span', { teks: pesanSinyal }),
        el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Coba lagi', onclick: function () { ambil(); } })
      ]));
    } else if (d && d.aktif === false) {
      st.appendChild(el('div', { class: 'strip strip--jeda', role: 'status' }, [el('span', { teks: 'Program sedang dijeda. Stempelmu tetap tersimpan.' })]));
    }
  }

  function tampilTanpaAnimasi(d) {
    aturSemuaSlot(d.kartu.isi, d.kartu.penuh);
    aturStatus(d, false);
    aturAksi(d);
    aturRiwayat(d);
    aturStrip(d);
  }

  function rayakan() {
    if (gerakHemat) return;
    var wadah = el('div', { class: 'serpih', 'aria-hidden': 'true' });
    var warna = ['#d4af6a', '#e9c987', '#f3ebdd', '#c2414a', '#f7e3a8'];
    for (var i = 0; i < 44; i++) {
      var f = document.createElement('i');
      f.style.left = (Math.random() * 100) + '%';
      f.style.background = warna[i % warna.length];
      f.style.setProperty('--tunda', (Math.random() * 0.5).toFixed(2) + 's');
      f.style.setProperty('--lama', (1.7 + Math.random() * 1.3).toFixed(2) + 's');
      f.style.setProperty('--geser', Math.round((Math.random() - 0.5) * 160) + 'px');
      f.style.setProperty('--putar', Math.round(360 + Math.random() * 720) + 'deg');
      if (i % 3 === 0) { f.style.width = '6px'; f.style.height = '6px'; f.style.borderRadius = '50%'; }
      wadah.appendChild(f);
    }
    document.body.appendChild(wadah);
    setTimeout(function () { if (wadah.parentNode) wadah.parentNode.removeChild(wadah); }, 3600);
  }

  // Segel emas jatuh ke slot Gratis (hadiah sudah dikirim), dirayakan, lalu kartu berikutnya ditampilkan.
  function hadiahDikirim(baru) {
    var d = baru;
    aturSlot(bagian.target, 'emas', 'jatuh');
    hentakKartu();
    bagian.kartu.classList.add('penuh'); document.body.classList.add('penuh');
    tulisStatus('Hadiah dikirim.', d.hadiah + ' ikut di paketmu.', true);
    aturAksi(d); aturRiwayat(d); aturStrip(d);
    setTimeout(function () { getar([30, 60, 30, 60, 60]); if (bagian) { rayakan(); KA.kabar('Hadiah dikirim!'); } }, 760);
    setTimeout(function () {
      if (!bagian || data !== d) return;
      var b = d.kartu;
      if (b.penuh) tampilTanpaAnimasi(d);
      else {
        // Kartu berikutnya: mulai kosong, lalu stempel yang sudah ada muncul berurutan.
        aturSemuaSlot(0, false);
        aturStatus(d, true); aturAksi(d); aturRiwayat(d); aturStrip(d);
        munculkan(b.isi, 110);
      }
      KA.kabar('Kartu ke-' + b.kartu_ke + ' dimulai');
    }, 4000);
  }

  /**
   * Berpindah dari keadaan lama ke baru dengan animasi yang sesuai:
   * stempel bertambah, kartu jadi penuh, atau hadiah dikirim dan kartu berikutnya dimulai.
   */
  function beralih(lama, baru) {
    var a = lama.kartu, b = baru.kartu;
    var samaKartu = a.kartu_ke === b.kartu_ke;

    if (samaKartu && b.isi > a.isi) {
      // Stempel bertambah di kartu yang sama (termasuk yang membuatnya penuh).
      var lamaAnim = jatuhkan(a.isi, b.isi, 'merah', 560);
      setTimeout(function () {
        if (!bagian || data !== baru) return;
        if (b.penuh) { aturSemuaSlot(b.isi, true); rayakan(); getar([30, 60, 30, 60, 60]); KA.kabar('Kartu penuh!'); }
        else KA.kabar(b.isi - a.isi > 1 ? (b.isi - a.isi) + ' stempel masuk!' : 'Stempel masuk!');
        aturStatus(baru, true); aturAksi(baru); aturRiwayat(baru); aturStrip(baru);
      }, Math.max(400, lamaAnim - 150));
      return;
    }

    if (b.kartu_ke > a.kartu_ke) {
      // Hadiah kartu lama sudah dikirim. Kalau kartu lama belum terlihat penuh, penuhkan dulu.
      var t1 = a.penuh ? 0 : jatuhkan(a.isi, a.target, 'merah', 560);
      setTimeout(function () { if (bagian && data === baru) hadiahDikirim(baru); }, t1 ? t1 - 100 : 0);
      return;
    }

    tampilTanpaAnimasi(baru);
  }

  /* ---------- data masuk ---------- */

  function simpan(d) { KA.simpan.tulis(KUNCI, { token: token, data: d, waktu: Date.now() }); }

  function perluBangunUlang(lama, d) {
    return !lama || lama.nama !== d.nama || lama.hadiah !== d.hadiah || lama.program !== d.program || lama.sebutan !== d.sebutan ||
      lama.kartu.target !== d.kartu.target || lama.no_anggota !== d.no_anggota || lama.angkatan_pertama !== d.angkatan_pertama || lama.aturan !== d.aturan || lama.kode !== d.kode;
  }

  function terima(d) {
    if (d.butuh_persetujuan) { data = null; KA.simpan.tulis(KUNCI, { token: token, data: null, waktu: Date.now() }); tampilPersetujuan(d); return; }
    var lama = data;
    data = d;
    simpan(d);
    document.title = d.program;

    if (!bagian) {
      bangun(d);
      if (lama) { tampilTanpaAnimasi(d); return; }
      // Pertama kali dibuka di HP ini: kartu masuk, lalu segel-segelnya muncul berurutan.
      if (!gerakHemat) bagian.kartu.classList.add('masuk');
      aturSemuaSlot(0, false);
      aturStatus(d, false); aturAksi(d); aturRiwayat(d); aturStrip(d);
      setTimeout(function () {
        if (!bagian || data !== d) return;
        var t = munculkan(d.kartu.isi, 110);
        setTimeout(function () { if (bagian && data === d) aturSemuaSlot(d.kartu.isi, d.kartu.penuh); }, t + 100);
      }, 520);
      return;
    }
    if (perluBangunUlang(lama, d)) { bangun(d); tampilTanpaAnimasi(d); return; }
    if (lama.sidik !== d.sidik) beralih(lama, d);
    else tampilTanpaAnimasi(d);
  }

  function gagal(e) {
    if (e.kode === 'KARTU_TIDAK_ADA') {
      KA.simpan.hapus(KUNCI); data = null;
      tampilLayar('Kartu tidak ditemukan', ['Link ini sudah tidak berlaku. Minta link kartumu lagi ke admin lewat WhatsApp.'], []);
      return;
    }
    if (bagian && data) {
      aturStrip(data, e.kode === 'JARINGAN' ? 'Sinyal lemah. Ini data terakhir di HP-mu.' : 'Kartu belum bisa diperbarui. Ini data terakhir di HP-mu.');
      return;
    }
    if (e.kode === 'JARINGAN') { tampilLayar('Belum tersambung', ['Kartumu belum bisa dibuka. Periksa sinyal, lalu coba lagi.'], [tombolCobaLagi()]); return; }
    if (e.kode === 'TERLALU_SERING') { tampilLayar('Sebentar ya', [e.message], [tombolCobaLagi()]); return; }
    tampilLayar('Kartu belum bisa dibuka', ['Ada gangguan di sisi kami. Coba lagi beberapa saat lagi.'], [tombolCobaLagi()]);
  }

  function ambil() {
    if (sedangAmbil) return;
    sedangAmbil = true;
    KA.api('kartu', { t: token }).then(function (d) {
      sedangAmbil = false; terakhirAmbil = Date.now(); terima(d);
    }, function (e) {
      sedangAmbil = false; gagal(e);
    });
  }

  /* ---------- mulai ---------- */

  function mulai() {
    if (!token) {
      tampilLayar('Buka dari link kartumu', ['Kartu ini dibuka lewat link yang dikirim admin di WhatsApp. Cari pesan itu di chat-mu, lalu ketuk linknya.'], []);
      return;
    }
    var simpanan = KA.simpan.baca(KUNCI);
    if (simpanan && simpanan.token === token && simpanan.data && simpanan.data.kartu) {
      // Tampilkan dulu data terakhir di HP, lalu perbarui dari server (perubahan dianimasikan oleh terima()).
      data = simpanan.data;
      bangun(data);
      tampilTanpaAnimasi(data);
    } else {
      tampilKerangka();
    }
    ambil();
  }

  // Segarkan saat halaman kembali dibuka (mis. setelah admin mengabari stempel masuk).
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && token && bagian && Date.now() - terakhirAmbil > 20000) ambil();
  });
  window.addEventListener('online', function () { if (token && bagian) ambil(); });
  window.addEventListener('hashchange', function () { location.reload(); });
  // Dipakai halaman demo untuk menyuruh kartu memeriksa perubahan saat itu juga.
  window.addEventListener('message', function (e) { if (e.data && e.data.jenis === 'ka-segarkan' && token) ambil(); });

  mulai();
})();
