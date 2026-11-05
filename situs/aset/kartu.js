/* KARTU AURA — Kartu Pembeli */
(function () {
  'use strict';

  var el = KA.el;
  var akar = document.getElementById('akar');
  var KUNCI = 'ka:kartu';
  var KUNCI_PERNAH_BALIK = 'ka:pernah-balik';
  var gerakHemat = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var token = (KA.config && KA.config.token) || ambilToken();   // config.token hanya dipakai halaman demo
  var data = null;          // muatan kartu terakhir dari server
  var bagian = null;        // elemen-elemen kartu yang sudah dibangun
  var sedangAmbil = false, terakhirAmbil = 0, antrean = [];

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

  /* ---------- segel (emblem + benang + manik) ---------- */

  var SVG = 'http://www.w3.org/2000/svg';
  function s(tag, atribut, anak) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(atribut || {}).forEach(function (k) { e.setAttribute(k, atribut[k]); });
    (anak || []).forEach(function (a) { e.appendChild(a); });
    return e;
  }
  function henti(offset, warna, tembus) {
    var a = { offset: offset, 'stop-color': warna };
    if (tembus !== undefined) a['stop-opacity'] = tembus;
    return s('stop', a);
  }

  // Manik diletakkan di busur bawah, sepusat dengan lingkaran logo, dari kiri ke kanan.
  function letakManik(n) {
    var R = 540;
    var langkah = n > 1 ? Math.min(20, 86 / (n - 1)) : 0;
    var setengah = langkah * (n - 1) / 2;
    var jarak = n > 1 ? 2 * R * Math.sin(langkah * Math.PI / 360) : 200;
    var r = Math.max(18, Math.min(62, jarak / 2 - 9));
    var titik = [];
    for (var i = 0; i < n; i++) {
      var sudut = (90 + setengah - i * langkah) * Math.PI / 180;
      titik.push({ x: R * Math.cos(sudut), y: R * Math.sin(sudut) });
    }
    var a1 = (90 - setengah - 5) * Math.PI / 180, a2 = (90 + setengah + 5) * Math.PI / 180;
    var benang = 'M' + (R * Math.cos(a1)).toFixed(1) + ' ' + (R * Math.sin(a1)).toFixed(1) + 'A' + R + ' ' + R + ' 0 0 1 ' + (R * Math.cos(a2)).toFixed(1) + ' ' + (R * Math.sin(a2)).toFixed(1);
    return { titik: titik, r: r, benang: benang };
  }

  function buatSegel(n) {
    var L = KA.logo.emblem, letak = letakManik(n), r = letak.r;
    var svg = s('svg', { class: 'segel__gambar', viewBox: '-740 -548 1480 1184', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(s('defs', {}, [
      s('linearGradient', { id: 'ka-foil', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: String(L.w), y2: String(L.h) }, [
        henti('0', '#f6e3a1'), henti('0.28', '#d9b545'), henti('0.55', '#b58d1c'), henti('0.78', '#e9cd6e'), henti('1', '#c9a227')
      ]),
      s('radialGradient', { id: 'ka-manik', cx: '36%', cy: '30%', r: '78%' }, [
        henti('0', '#fff6cf'), henti('0.26', '#efd067'), henti('0.6', '#c9a227'), henti('1', '#6f540e')
      ]),
      s('radialGradient', { id: 'ka-pendar' }, [
        henti('0', '#f1d88a', '0.55'), henti('0.45', '#c9a227', '0.2'), henti('1', '#c9a227', '0')
      ])
    ]));
    svg.appendChild(s('g', { class: 'segel__emblem', transform: 'translate(' + (-L.cx) + ' ' + (-L.cy) + ')' }, [
      s('path', { d: L.d, fill: 'url(#ka-foil)', 'fill-rule': 'evenodd' })
    ]));
    svg.appendChild(s('path', { class: 'segel__benang', d: letak.benang }));
    var manik = [];
    for (var i = 0; i < n; i++) {
      var t = letak.titik[i], hadiah = i === n - 1;
      var g = s('g', { class: 'manik' + (hadiah ? ' manik--hadiah' : ''), transform: 'translate(' + t.x.toFixed(1) + ' ' + t.y.toFixed(1) + ')' }, [
        s('circle', { class: 'manik__pendar', r: (r * 2.1).toFixed(1), fill: 'url(#ka-pendar)' }),
        s('circle', { class: 'manik__slot', r: r.toFixed(1) }),
        s('g', { class: 'manik__isi' }, [
          s('circle', { r: r.toFixed(1), fill: 'url(#ka-manik)' }),
          s('ellipse', { cx: (-r * 0.3).toFixed(1), cy: (-r * 0.4).toFixed(1), rx: (r * 0.32).toFixed(1), ry: (r * 0.19).toFixed(1), fill: '#fff', opacity: '0.5', transform: 'rotate(-28 ' + (-r * 0.3).toFixed(1) + ' ' + (-r * 0.4).toFixed(1) + ')' })
        ]),
        s('circle', { class: 'manik__riak', r: r.toFixed(1) })
      ]);
      if (hadiah) {
        var a = r * 0.6, b = r * 0.13;
        g.appendChild(s('path', { class: 'manik__bintang', d: 'M0 ' + (-a) + 'C' + b + ' ' + (-b) + ' ' + b + ' ' + (-b) + ' ' + a + ' 0C' + b + ' ' + b + ' ' + b + ' ' + b + ' 0 ' + a + 'C' + (-b) + ' ' + b + ' ' + (-b) + ' ' + b + ' ' + (-a) + ' 0C' + (-b) + ' ' + (-b) + ' ' + (-b) + ' ' + (-b) + ' 0 ' + (-a) + 'Z' }));
      }
      svg.appendChild(g);
      manik.push(g);
    }
    return { svg: svg, manik: manik };
  }

  function lambangKecil() {
    var L = KA.logo.emblem;
    return s('svg', { class: 'layar__lambang', viewBox: '0 0 ' + L.w + ' ' + L.h, 'aria-hidden': 'true', focusable: 'false' }, [
      s('path', { d: L.d, fill: '#c9a227', 'fill-rule': 'evenodd' })
    ]);
  }

  function logoTeks() {
    var T = KA.logo.teks;
    return s('svg', { class: 'balik__logo', viewBox: '0 0 ' + T.w + ' ' + T.h, role: 'img', 'aria-label': 'PT Andri Putra Borneo' }, [
      s('path', { d: T.d, fill: '#c9a227', 'fill-rule': 'evenodd' })
    ]);
  }

  /* ---------- teks ---------- */

  function kalimatStatus(d) {
    var k = d.kartu;
    if (d.hangus) return { judul: 'Mulai dari 0 lagi', teks: 'Stempel sebelumnya hangus karena ' + d.masa_berlaku_bulan + ' bulan tanpa stempel baru. Stempel berikutnya memulai kartu baru.' };
    if (k.penuh) {
      var lanjut = k.berikutnya && k.berikutnya.isi > 0 ? ' Kartu berikutnya sudah terisi ' + k.berikutnya.isi + ' stempel.' : '';
      return { judul: 'Kartu penuh', teks: d.hadiah + ' sudah jadi hakmu. Sebut aroma pilihanmu ke admin.' + lanjut };
    }
    if (k.isi === 0) {
      if (d.total_hadiah > 0) return { judul: 'Kartu ke-' + k.kartu_ke + ' dimulai', teks: 'Hadiah kartu sebelumnya sudah kami kirim bersama pesananmu. ' + k.target + ' stempel lagi untuk ' + d.hadiah + ' berikutnya.' };
      return { judul: 'Belum ada stempel', teks: 'Stempel pertama masuk setelah pesanan parfum lewat WhatsApp lunas.' };
    }
    return { judul: k.isi + ' dari ' + k.target + ' stempel', teks: 'Tinggal ' + k.sisa + ' lagi untuk ' + d.hadiah + '.' };
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

  /* ---------- layar sederhana ---------- */

  function kosongkan() { while (akar.firstChild) akar.removeChild(akar.firstChild); bagian = null; }

  function tampilKerangka() {
    kosongkan();
    akar.appendChild(el('div', { class: 'kerangka', 'aria-busy': 'true' }, [
      el('div', { class: 'kerangka__kartu' }),
      el('p', { class: 'kerangka__teks', teks: 'Membuka kartumu…' })
    ]));
  }

  function tampilLayar(judul, paragraf, aksi) {
    kosongkan();
    document.body.style.setProperty('--aura-kuat', '0.35');
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
        el('p', { style: 'margin-top:16px', teks: 'Yang disimpan hanya nama, nomor WhatsApp, dan riwayat stempelmu. Data itu ada di catatan milik APB, dipakai untuk mencatat stempel dan mengabari soal kartu ini, dan tidak dijual atau dibagikan.' }),
        el('p', { teks: 'Kamu bisa minta datamu dihapus kapan saja lewat tombol di bawah. Kartumu ikut terhapus.' })
      ]),
      el('div', { class: 'lembar__aksi' }, [tutup, hapus])
    ]));
  }

  /* ---------- membangun kartu ---------- */

  function ikonWa() {
    return s('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [
      s('path', { d: 'M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z' }),
      s('path', { d: 'M9.3 8.7c-.2 1.5.6 3.2 1.9 4.5 1.3 1.3 3 2.1 4.5 1.9' })
    ]);
  }

  function bangun(d) {
    kosongkan();
    var k = d.kartu;
    var segel = buatSegel(k.target);

    var nama = el('div', { class: 'kartu__nama', teks: d.nama });
    if (d.nama.length > 26) nama.classList.add('panjang-sekali'); else if (d.nama.length > 16) nama.classList.add('panjang');

    var depan = el('span', { class: 'kartu__muka kartu__depan' }, [
      el('span', { class: 'kartu__kilau' }),
      el('span', { class: 'kartu__kepala' }, [
        el('span', { class: 'kartu__program', teks: d.program }),
        el('span', { class: 'kartu__nomor', teks: 'No. ' + d.no_anggota })
      ]),
      el('span', { class: 'segel' }, [
        el('span', { class: 'aura' }, [
          el('span', { class: 'aura__napas' }, [el('span', { class: 'aura__pendar' })]),
          el('span', { class: 'aura__sinar' })
        ]),
        segel.svg
      ]),
      el('span', { class: 'kartu__identitas' }, [
        nama,
        el('span', { class: 'kartu__sebutan', style: 'display:block', teks: d.sebutan + (d.angkatan_pertama ? ' angkatan pertama' : '') })
      ]),
      el('span', { class: 'kartu__kaki', teks: k.target + ' stempel = ' + d.hadiah })
    ]);

    var aturan = el('ul', { class: 'balik__aturan' });
    aturanProgram(d).slice(0, 3).forEach(function (t) { aturan.appendChild(el('li', { teks: t })); });
    var rinci = el('dl', { class: 'balik__rinci' }, [
      el('dt', { teks: 'Kode kartu' }), el('dd', { class: 'kode', teks: d.kode }),
      el('dt', { teks: 'Kartu ke' }), el('dd', { class: 'js-kartu-ke', teks: String(k.penuh && k.berikutnya ? k.berikutnya.kartu_ke : k.kartu_ke) }),
      el('dt', { teks: 'Anggota sejak' }), el('dd', { teks: KA.tanggalPendek(d.anggota_sejak) }),
      el('dt', { teks: 'WhatsApp' }), el('dd', { teks: d.wa_samar })
    ]);
    var belakang = el('span', { class: 'kartu__muka kartu__belakang', 'aria-hidden': 'true' }, [
      el('span', { class: 'balik__isi' }, [
        el('span', { class: 'kartu__program', teks: d.program }),
        el('span', { class: 'balik__hadiah', teks: k.target + ' stempel = ' + d.hadiah }),
        aturan, rinci, logoTeks()
      ])
    ]);

    var badan = el('button', { class: 'kartu__badan', type: 'button', 'aria-pressed': 'false' }, [depan, belakang]);
    var kartu = el('div', { class: 'kartu' }, [badan]);
    var tombolPutar = el('button', { class: 'tombol tombol--teks tombol--kecil', type: 'button', teks: 'Lihat balik kartu' });

    function putar() {
      var balik = !kartu.classList.contains('balik');
      kartu.classList.toggle('balik', balik);
      badan.setAttribute('aria-pressed', balik ? 'true' : 'false');
      depan.setAttribute('aria-hidden', balik ? 'true' : 'false');
      belakang.setAttribute('aria-hidden', balik ? 'false' : 'true');
      tombolPutar.textContent = balik ? 'Kembali ke depan' : 'Lihat balik kartu';
      KA.simpan.tulis(KUNCI_PERNAH_BALIK, 1);
    }
    badan.addEventListener('click', putar);
    tombolPutar.addEventListener('click', putar);

    var strip = el('div', { class: 'js-strip' });
    var judul = el('h1', { class: 'status__judul' });
    var teks = el('p', { class: 'status__teks' });
    var aksi = el('div', { class: 'aksi' });
    var riwayat = el('ul', { class: 'riwayat' });
    var bagianRiwayat = el('section', { class: 'bagian' }, [el('h2', { class: 'bagian__judul', teks: 'Riwayat' }), riwayat]);

    var cara = el('ol', { class: 'cara' });
    [
      ['Pesan parfum lewat WhatsApp.', ' Sebut kode kartumu supaya cepat dicek.'],
      ['Setelah pesanan lunas, admin menambah 1 stempel.', ' Kartu ini ikut berubah sendiri.'],
      ['Di stempel ke-' + k.target + ', ' + d.hadiah + ' ikut dikirim.', ' Kartu berikutnya langsung dimulai.']
    ].forEach(function (b) { cara.appendChild(el('li', {}, [el('strong', { teks: b[0] }), b[1]])); });

    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
    var kaki = el('footer', { class: 'kaki-hal' }, [
      el('p', { teks: ios ? 'Biar gampang dibuka lagi: ketuk tombol Bagikan, lalu pilih Tambahkan ke Layar Utama.' : 'Biar gampang dibuka lagi: buka menu browser, lalu pilih Tambahkan ke layar utama.' }),
      el('p', {}, [el('button', { class: 'tombol tombol--teks', type: 'button', teks: 'Syarat & privasi', onclick: bukaSyarat })])
    ]);

    akar.appendChild(strip);
    akar.appendChild(kartu);
    akar.appendChild(el('div', { class: 'putar' }, [tombolPutar]));
    akar.appendChild(el('div', { class: 'status', 'aria-live': 'polite' }, [judul, teks]));
    akar.appendChild(aksi);
    akar.appendChild(bagianRiwayat);
    akar.appendChild(el('section', { class: 'bagian' }, [el('h2', { class: 'bagian__judul', teks: 'Cara dapat stempel' }), cara]));
    akar.appendChild(kaki);

    bagian = { kartu: kartu, manik: segel.manik, judul: judul, teks: teks, aksi: aksi, riwayat: riwayat, bagianRiwayat: bagianRiwayat, strip: strip, target: k.target, kartuKe: rinci.querySelector('.js-kartu-ke') };
  }

  /* ---------- memperbarui tampilan ---------- */

  function aturAura(isi, target, penuh) {
    var a = penuh ? 1 : Math.max(0, Math.min(1, isi / target));
    document.body.style.setProperty('--aura-kuat', (0.3 + 0.7 * a).toFixed(3));
    document.body.style.setProperty('--aura-besar', (0.8 + 0.2 * a).toFixed(3));
    document.body.style.setProperty('--emblem-terang', (0.8 + 0.2 * a).toFixed(3));
  }

  function aturManik(isi, penuh) {
    for (var i = 0; i < bagian.manik.length; i++) {
      bagian.manik[i].classList.toggle('terisi', i < isi);
      bagian.manik[i].classList.remove('baru');
    }
    bagian.kartu.classList.toggle('penuh', !!penuh);
    aturAura(isi, bagian.target, penuh);
  }

  function aturStatus(d, animasi) {
    var st = kalimatStatus(d);
    if (bagian.judul.textContent !== st.judul) {
      bagian.judul.textContent = st.judul;
      if (animasi) { bagian.judul.classList.remove('ganti'); void bagian.judul.offsetWidth; bagian.judul.classList.add('ganti'); }
    }
    bagian.teks.textContent = st.teks;
  }

  function aturAksi(d) {
    var a = bagian.aksi;
    while (a.firstChild) a.removeChild(a.firstChild);
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
    while (ul.firstChild) ul.removeChild(ul.firstChild);
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
    while (st.firstChild) st.removeChild(st.firstChild);
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
    aturManik(d.kartu.isi, d.kartu.penuh);
    aturStatus(d, false);
    aturAksi(d);
    aturRiwayat(d);
    aturStrip(d);
    if (bagian.kartuKe) bagian.kartuKe.textContent = String(d.kartu.penuh && d.kartu.berikutnya ? d.kartu.berikutnya.kartu_ke : d.kartu.kartu_ke);
  }

  var sudahSentuh = false;
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (n) {
    window.addEventListener(n, function () { sudahSentuh = true; }, { passive: true });
  });
  // Getar hanya setelah layar pernah disentuh; sebelum itu browser menolaknya.
  function getar(pola) { try { if (sudahSentuh && navigator.vibrate) navigator.vibrate(pola); } catch (x) { /* abaikan */ } }

  // Menyalakan manik satu per satu dari `dari` sampai `sampai` (jumlah terisi). Mengembalikan lama animasi (ms).
  function nyalakan(dari, sampai, jeda, tandaiBaru) {
    var lama = 0;
    for (var i = dari; i < sampai; i++) {
      (function (indeks, tunda) {
        setTimeout(function () {
          if (!bagian || !bagian.manik[indeks]) return;
          bagian.manik[indeks].classList.add('terisi');
          if (tandaiBaru) { bagian.manik[indeks].classList.add('baru'); getar(24); }
          aturAura(indeks + 1, bagian.target, false);
        }, tunda);
      })(i, lama);
      lama += jeda;
    }
    return lama;
  }

  function rayakan() {
    if (gerakHemat) return;
    var wadah = el('div', { class: 'serpih', 'aria-hidden': 'true' });
    var warna = ['#c9a227', '#f1d88a', '#f3ead7', '#2f9c83', '#e3c35a'];
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

  /**
   * Berpindah dari keadaan lama ke baru dengan animasi yang sesuai:
   * stempel bertambah, kartu jadi penuh, atau kartu berikutnya dimulai.
   */
  function beralih(lama, baru) {
    var a = lama.kartu, b = baru.kartu;
    var samaKartu = a.kartu_ke === b.kartu_ke;

    if (samaKartu && b.isi > a.isi) {
      // Stempel bertambah di kartu yang sama (termasuk yang membuatnya penuh).
      var lamaAnim = nyalakan(a.isi, b.isi, 480, true);
      setTimeout(function () {
        if (!bagian) return;
        if (b.penuh) { bagian.kartu.classList.add('penuh'); aturAura(b.isi, b.target, true); rayakan(); getar([30, 60, 30, 60, 60]); KA.kabar('Kartu penuh!'); }
        else KA.kabar(b.isi - a.isi > 1 ? (b.isi - a.isi) + ' stempel masuk!' : 'Stempel masuk!');
        aturStatus(baru, true); aturAksi(baru); aturRiwayat(baru); aturStrip(baru);
      }, Math.max(380, lamaAnim - 60));
      return;
    }

    if (b.kartu_ke > a.kartu_ke && !a.penuh) {
      // Kartu lama jadi penuh dan hadiahnya sudah tercatat: penuhkan dulu, rayakan, lalu mulai kartu baru.
      var t1 = nyalakan(a.isi, a.target, 380, true);
      setTimeout(function () {
        if (!bagian) return;
        bagian.kartu.classList.add('penuh'); aturAura(a.target, a.target, true); rayakan(); getar([30, 60, 30, 60, 60]);
        bagian.judul.textContent = 'Kartu penuh'; bagian.teks.textContent = baru.hadiah + ' ikut di paketmu.';
        KA.kabar('Kartu penuh!');
      }, Math.max(380, t1 - 60));
      setTimeout(function () { if (bagian) tampilTanpaAnimasi(baru); if (bagian && b.isi > 0) { aturManik(0, false); nyalakan(0, b.isi, 300, false); } }, t1 + 3400);
      return;
    }

    tampilTanpaAnimasi(baru);
    if (b.kartu_ke > a.kartu_ke) KA.kabar('Kartu ke-' + b.kartu_ke + ' dimulai');
  }

  /* ---------- data masuk ---------- */

  function simpan(d) { KA.simpan.tulis(KUNCI, { token: token, data: d, waktu: Date.now() }); }

  function perluBangunUlang(lama, d) {
    return !lama || lama.nama !== d.nama || lama.hadiah !== d.hadiah || lama.program !== d.program || lama.sebutan !== d.sebutan ||
      lama.kartu.target !== d.kartu.target || lama.no_anggota !== d.no_anggota || lama.angkatan_pertama !== d.angkatan_pertama || lama.aturan !== d.aturan;
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
      // Pertama kali dibuka di HP ini: kartu masuk, lalu manik menyala berurutan.
      bagian.kartu.classList.add('masuk');
      aturManik(0, false);
      aturStatus(d, false); aturAksi(d); aturRiwayat(d); aturStrip(d);
      setTimeout(function () {
        if (!bagian || data !== d) return;
        var t = nyalakan(0, d.kartu.isi, 150, false);
        setTimeout(function () { if (bagian && data === d) aturManik(d.kartu.isi, d.kartu.penuh); }, t + 200);
      }, 520);
      setTimeout(function () { if (bagian && !KA.simpan.baca(KUNCI_PERNAH_BALIK)) KA.kabar('Ketuk kartu untuk melihat baliknya'); }, 2800);
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
