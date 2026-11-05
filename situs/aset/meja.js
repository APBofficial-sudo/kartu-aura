/* KARTU AURA — Meja Stempel (admin & owner) */
(function () {
  'use strict';

  var el = KA.el;
  var akar = document.getElementById('akar');
  var KUNCI_SESI = 'ka:meja';
  var KUNCI_NAMA = 'ka:meja-nama';
  var sesi = (KA.config && KA.config.sesi) || KA.simpan.baca(KUNCI_SESI);   // { sesi, nama, peran }; config.sesi hanya dipakai halaman demo
  var info = null;                         // jawaban aksi "info"
  var tabAktif = 'stempel';
  var wadah = null;                        // tempat isi tab

  var LABEL_JENIS = {
    DAFTAR: 'Kartu dibuat', PERSETUJUAN: 'Persetujuan data', STEMPEL_AWAL: 'Stempel awal', STEMPEL: 'Stempel pembelian', BATAL: 'Stempel dibatalkan',
    HADIAH: 'Hadiah diberikan', HADIAH_TUNDA: 'Hadiah ditunda', PENYESUAIAN: 'Penyesuaian', HAPUS_DATA: 'Data dihapus'
  };

  /* ---------- alat ---------- */

  function kosongkan(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  function api(aksi, data, opsi) {
    var d = {};
    Object.keys(data || {}).forEach(function (k) { d[k] = data[k]; });
    d.sesi = sesi ? sesi.sesi : '';
    return KA.api(aksi, d, opsi).then(null, function (e) {
      if (e.kode === 'SESI_HABIS') { keluar('Sesi sudah habis. Masuk lagi dengan PIN.'); }
      throw e;
    });
  }

  // Aksi yang menulis. Kalau gagal karena sinyal, hasilnya tidak diketahui: bisa saja sudah tercatat di server.
  // Karena itu percobaan ulang untuk hal yang sama memakai id permintaan yang SAMA, sehingga server
  // mengembalikan hasil yang pertama dan tidak mencatat dua kali.
  var idGantung = {};
  function tulis(aksi, data) {
    var kunci = aksi + '|' + JSON.stringify(data);
    var idp = idGantung[kunci] || KA.idPermintaan();
    var badan = { id_permintaan: idp };
    Object.keys(data).forEach(function (k) { badan[k] = data[k]; });
    return api(aksi, badan).then(function (d) { delete idGantung[kunci]; return d; }, function (e) {
      if (e.kode === 'JARINGAN') idGantung[kunci] = idp; else delete idGantung[kunci];
      throw e;
    });
  }

  function keluar(pesan) {
    sesi = null; info = null;
    KA.simpan.hapus(KUNCI_SESI);
    layarMasuk(typeof pesan === 'string' ? pesan : '');
  }

  function svg(d, lain) {
    var a = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
    Object.keys(lain || {}).forEach(function (k) { a[k] = lain[k]; });
    var e = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); });
    d.forEach(function (jalur) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', jalur); e.appendChild(p); });
    return e;
  }

  function emblem() {
    var L = KA.logo.emblem, e = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    e.setAttribute('viewBox', '0 0 ' + L.w + ' ' + L.h); e.setAttribute('aria-hidden', 'true'); e.setAttribute('focusable', 'false');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', L.d); p.setAttribute('fill', '#c9a227'); p.setAttribute('fill-rule', 'evenodd');
    e.appendChild(p);
    return e;
  }

  // <label> + kotak isian + teks bantuan
  function isian(label, kotak, bantuan) {
    var id = kotak.id || ('f' + Math.random().toString(36).slice(2, 9));
    kotak.id = id;
    return el('div', { class: 'isian' }, [
      el('label', { class: 'isian__label', for: id, teks: label }),
      kotak,
      bantuan ? el('p', { class: 'isian__bantuan', teks: bantuan }) : null
    ]);
  }
  function kotak(atribut) { var a = { class: 'isian__kotak' }; Object.keys(atribut || {}).forEach(function (k) { a[k] = atribut[k]; }); return el('input', a); }
  function kotakPanjang(nilai, atribut) { var a = { class: 'isian__kotak' }; Object.keys(atribut || {}).forEach(function (k) { a[k] = atribut[k]; }); var t = el('textarea', a); t.value = nilai || ''; return t; }

  function titik(isi, target, besar) {
    var w = el('span', { class: 'titik' + (besar ? ' titik--besar' : ''), role: 'img', 'aria-label': isi + ' dari ' + target + ' stempel' });
    for (var i = 0; i < target; i++) w.appendChild(el('i', { class: i < isi ? 'isi' : '' }));
    return w;
  }

  // Menjalankan aksi sambil mengunci tombol supaya tidak terkirim dua kali.
  function sambilSibuk(tombol, teksSibuk, janji) {
    var asal = tombol.textContent;
    tombol.disabled = true; tombol.textContent = teksSibuk;
    function pulih() { tombol.disabled = false; tombol.textContent = asal; }
    return janji.then(function (d) { pulih(); return d; }, function (e) { pulih(); throw e; });
  }

  function tunjukGalat(e) { if (e.kode !== 'SESI_HABIS') KA.kabar(e.message, true); }

  /* =====================================================================
   * MASUK
   * ===================================================================== */

  function layarMasuk(pesan) {
    kosongkan(akar);
    document.title = 'Meja Stempel';
    var pilih = el('select', { class: 'isian__kotak', required: true }, [el('option', { value: '', teks: 'Memuat nama…' })]);
    var pin = kotak({ class: 'isian__kotak pin', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'current-password', placeholder: '••••••', required: true });
    var galat = el('p', { class: 'masuk__galat galat-teks', role: 'alert', teks: pesan || '' });
    var tombol = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'submit', teks: 'Masuk' });
    var judul = el('h1', { class: 'masuk__judul', teks: 'Meja Stempel' });
    var sub = el('p', { class: 'masuk__sub', teks: 'Kartu Aura' });

    var form = el('form', { novalidate: true }, [isian('Nama', pilih), isian('PIN 6 angka', pin), tombol, galat]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      galat.textContent = '';
      if (!pilih.value) { galat.textContent = 'Pilih nama dulu.'; return; }
      if (!/^\d{6}$/.test(pin.value)) { galat.textContent = 'PIN harus 6 angka.'; pin.focus(); return; }
      var pinDipakai = pin.value;
      sambilSibuk(tombol, 'Memeriksa…', KA.api('masuk', { nama: pilih.value, pin: pinDipakai })).then(function (d) {
        KA.simpan.tulis(KUNCI_NAMA, d.nama);
        sesi = { sesi: d.sesi, nama: d.nama, peran: d.peran };
        if (d.wajib_ganti_pin) { layarGantiPin(pinDipakai); return; }
        KA.simpan.tulis(KUNCI_SESI, sesi);
        layarUtama();
      }, function (e) { galat.textContent = e.message; pin.value = ''; pin.focus(); });
    });

    akar.appendChild(el('main', { class: 'masuk' }, [el('div', { class: 'masuk__kotak' }, [
      el('div', { class: 'masuk__lambang' }, [emblem()]), judul, sub, form
    ])]));

    KA.api('daftar_admin').then(function (d) {
      kosongkan(pilih);
      sub.textContent = d.program;
      var terakhir = KA.simpan.baca(KUNCI_NAMA);
      if (d.admin.length !== 1) pilih.appendChild(el('option', { value: '', teks: 'Pilih nama' }));
      d.admin.forEach(function (n) { var o = el('option', { value: n, teks: n }); if (n === terakhir) o.selected = true; pilih.appendChild(o); });
      if (pilih.value) pin.focus();
    }, function (e) {
      kosongkan(pilih); pilih.appendChild(el('option', { value: '', teks: 'Tidak bisa memuat nama' }));
      if (e.kode === 'BELUM_DIPASANG') galat.textContent = 'Server belum dipasang. Jalankan fungsi "pasang" di Apps Script.';
      else if (e.kode === 'JARINGAN') galat.textContent = 'Server tidak bisa dihubungi. Periksa sambungan, atau alamat server di aset/config.js.';
      else galat.textContent = e.message;
    });
  }

  function layarGantiPin(pinLama) {
    kosongkan(akar);
    var baru = kotak({ class: 'isian__kotak pin', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'new-password', placeholder: '••••••' });
    var ulang = kotak({ class: 'isian__kotak pin', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'new-password', placeholder: '••••••' });
    var galat = el('p', { class: 'masuk__galat galat-teks', role: 'alert' });
    var tombol = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'submit', teks: 'Simpan PIN baru' });
    var form = el('form', { novalidate: true }, [isian('PIN baru (6 angka)', baru), isian('Ketik sekali lagi', ulang), tombol, galat]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      galat.textContent = '';
      if (!/^\d{6}$/.test(baru.value)) { galat.textContent = 'PIN harus 6 angka.'; return; }
      if (baru.value !== ulang.value) { galat.textContent = 'Dua PIN itu belum sama.'; return; }
      sambilSibuk(tombol, 'Menyimpan…', KA.api('ganti_pin', { sesi: sesi.sesi, pin_lama: pinLama, pin_baru: baru.value })).then(function (d) {
        sesi = { sesi: d.sesi, nama: d.nama, peran: d.peran };
        KA.simpan.tulis(KUNCI_SESI, sesi);
        layarUtama();
      }, function (e) { galat.textContent = e.message; });
    });
    akar.appendChild(el('main', { class: 'masuk' }, [el('div', { class: 'masuk__kotak' }, [
      el('h1', { class: 'masuk__judul', teks: 'Buat PIN baru' }),
      el('p', { class: 'masuk__sub', teks: 'Halo, ' + sesi.nama + '. PIN awal harus diganti dulu. Pilih 6 angka yang hanya kamu yang tahu.' }),
      form
    ])]));
    baru.focus();
  }

  /* =====================================================================
   * KERANGKA UTAMA
   * ===================================================================== */

  var IKON = {
    stempel: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12.2l2.7 2.7L16 9.6'],
    pelanggan: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20c.4-3.4 3-5.5 6.5-5.5s6.1 2.1 6.5 5.5', 'M16 4.2a3.5 3.5 0 0 1 0 6.6', 'M18 14.8c2 .6 3.2 2.3 3.5 5.2'],
    aktivitas: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
    ringkasan: ['M5 20V11', 'M12 20V4', 'M19 20v-6'],
    pengaturan: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M16 5v4', 'M10 15v4']
  };

  function layarUtama() {
    kosongkan(akar);
    document.title = 'Meja Stempel';
    akar.appendChild(el('div', { class: 'muat', teks: 'Membuka Meja Stempel…' }));
    api('info').then(function (d) {
      info = d;
      // Pertama kali Owner masuk: isi alamat halaman kartu otomatis dari alamat Meja ini.
      if (!info.url_kartu && sesi.peran === 'owner' && /^https?:$/.test(location.protocol)) {
        var alamat = new URL('../kartu/', location.href).href;
        api('pengaturan_simpan', { ubah: { url_kartu: alamat } }).then(function () { info.url_kartu = alamat; }, function () { /* biarkan; bisa diisi manual */ });
      }
      bangunKerangka();
    }, function (e) {
      if (e.kode === 'SESI_HABIS') return;
      if (e.kode === 'WAJIB_GANTI_PIN') { keluar('PIN awal harus diganti. Masuk lagi untuk membuat PIN baru.'); return; }
      kosongkan(akar);
      akar.appendChild(el('main', { class: 'masuk' }, [el('div', { class: 'masuk__kotak' }, [
        el('h1', { class: 'masuk__judul', teks: 'Belum tersambung' }),
        el('p', { class: 'masuk__sub', teks: e.message }),
        el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Coba lagi', onclick: layarUtama }),
        el('button', { class: 'tombol tombol--teks tombol--penuh', type: 'button', teks: 'Keluar', onclick: function () { keluar(); } })
      ])]));
    });
  }

  function bangunKerangka() {
    kosongkan(akar);
    var daftarTab = [['stempel', 'Stempel'], ['pelanggan', 'Pelanggan'], ['aktivitas', 'Aktivitas']];
    if (sesi.peran === 'owner') { daftarTab.push(['ringkasan', 'Ringkasan']); daftarTab.push(['pengaturan', 'Pengaturan']); }
    var nav = el('nav', { class: 'meja__nav', 'aria-label': 'Bagian Meja Stempel' });
    daftarTab.forEach(function (t) {
      nav.appendChild(el('button', { type: 'button', 'data-tab': t[0], onclick: function () { bukaTab(t[0]); } }, [svg(IKON[t[0]]), t[1]]));
    });
    wadah = el('main', { class: 'meja__isi' });
    akar.appendChild(el('header', { class: 'meja__kepala' }, [
      el('div', { class: 'meja__merek' }, [emblem(), el('span', { class: 'meja__judul', teks: 'Meja Stempel' })]),
      nav,
      el('div', { class: 'meja__siapa' }, [
        el('strong', { teks: sesi.nama }),
        el('button', { class: 'tombol tombol--teks tombol--kecil', type: 'button', teks: 'Keluar', onclick: function () { keluar(); } })
      ])
    ]));
    akar.appendChild(wadah);
    bukaTab(daftarTab.some(function (t) { return t[0] === tabAktif; }) ? tabAktif : 'stempel');
  }

  function bukaTab(nama) {
    tabAktif = nama;
    var tombol = akar.querySelectorAll('.meja__nav button');
    for (var i = 0; i < tombol.length; i++) {
      if (tombol[i].getAttribute('data-tab') === nama) tombol[i].setAttribute('aria-current', 'page'); else tombol[i].removeAttribute('aria-current');
    }
    kosongkan(wadah);
    window.scrollTo(0, 0);
    TAB[nama]();
  }

  /* =====================================================================
   * TAB STEMPEL
   * ===================================================================== */

  var st = { q: '', urut: 0, hasil: [], terbaru: true, waNormal: null, waTampil: '', jumlahPelanggan: 0, terpilih: null, trx: null, pesan: '', pesanKartu: '', jumlah: 1 };
  var ui = {};

  function tabStempel() {
    var masukan = kotak({ type: 'search', inputmode: 'search', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Nomor WA, kode kartu, atau nama', 'aria-label': 'Cari pelanggan dengan nomor WhatsApp, kode kartu, atau nama', enterkeyhint: 'search' });
    masukan.value = st.q;
    var tunda = null;
    masukan.addEventListener('input', function () {
      clearTimeout(tunda);
      var q = masukan.value;
      // Di HP daftar hasil tersembunyi selama satu pelanggan dibuka; mengetik berarti mencari orang lain.
      if (st.terpilih && window.innerWidth < 900) { st.terpilih = null; st.trx = null; st.pesan = ''; gambarPanel(); }
      tunda = setTimeout(function () { cari(q); }, 320);
    });
    masukan.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault(); clearTimeout(tunda);
      if (st.q === masukan.value && st.hasil.length === 1 && !st.terbaru) pilih(st.hasil[0]); else cari(masukan.value, true);
    });
    ui.masukan = masukan;
    ui.hasil = el('div', { 'aria-live': 'polite' });
    ui.panel = el('div');
    var kiri = el('div', {}, [
      el('div', { class: 'cari' }, [svg(['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-3.8-3.8']), masukan]),
      ui.hasil
    ]);
    wadah.appendChild(el('h1', { class: 'tak-tampak', teks: 'Stempel cepat' }));
    wadah.appendChild(el('div', { class: 'dua-kolom' }, [kiri, ui.panel]));
    gambarPanel();
    if (st.hasil.length || st.q) gambarHasil(); else ui.hasil.appendChild(el('div', { class: 'muat', teks: 'Memuat pelanggan…' }));
    cari(st.q);
    if (!st.terpilih && window.innerWidth >= 900) masukan.focus();
  }

  function cari(q, pilihKalauSatu) {
    st.q = q;
    var nomor = ++st.urut;
    api('cari', { q: q }).then(function (d) {
      if (nomor !== st.urut || tabAktif !== 'stempel') return;
      st.hasil = d.hasil; st.terbaru = !!d.terbaru; st.waNormal = d.wa_normal; st.waTampil = d.wa_tampil || ''; st.jumlahPelanggan = d.jumlah_pelanggan;
      gambarHasil();
      if (pilihKalauSatu && d.hasil.length === 1 && !d.terbaru) pilih(d.hasil[0]);
    }, function (e) {
      if (nomor !== st.urut || tabAktif !== 'stempel' || e.kode === 'SESI_HABIS') return;
      kosongkan(ui.hasil);
      ui.hasil.appendChild(el('p', { class: 'kosong galat-teks', teks: e.message }));
    });
  }

  function barisPelanggan(p, saatPilih, tambahan, tandaiTerpilih) {
    var kanan = el('span', { class: 'baris__kanan' }, [titik(p.kartu.isi, p.kartu.target)]);
    if (p.hadiah_siap > 0) kanan.appendChild(el('div', {}, [el('span', { class: 'lencana lencana--emas', teks: 'Hadiah siap' })]));
    return el('li', {}, [el('button', { class: 'baris', type: 'button', 'aria-current': tandaiTerpilih && st.terpilih && st.terpilih.id === p.id ? 'true' : null, onclick: function () { saatPilih(p); } }, [
      el('span', { class: 'baris__utama' }, [
        el('span', { class: 'baris__nama' }, [p.nama, p.contoh ? ' ' : null, p.contoh ? el('span', { class: 'lencana', teks: 'Contoh' }) : null]),
        el('span', { class: 'baris__ket' }, [el('span', { teks: p.wa_tampil }), el('span', { teks: p.kode }), tambahan ? el('span', { teks: tambahan }) : null])
      ]),
      kanan
    ])]);
  }

  function gambarHasil() {
    if (!ui.hasil) return;
    kosongkan(ui.hasil);
    if (st.terpilih && window.innerWidth < 900) return; // di HP, daftar disembunyikan saat satu pelanggan sedang dibuka
    if (!st.hasil.length) {
      if (st.waNormal) { ui.hasil.appendChild(formKartuBaru()); return; }
      if (!st.q) { ui.hasil.appendChild(el('p', { class: 'kosong', teks: 'Belum ada pelanggan. Ketik nomor WhatsApp pembeli untuk membuat kartu pertama.' })); return; }
      ui.hasil.appendChild(el('p', { class: 'kosong', teks: /\d{4,}/.test(st.q) ? 'Nomor belum lengkap atau tidak ditemukan. Ketik nomor WhatsApp lengkapnya untuk membuat kartu baru.' : 'Tidak ketemu. Untuk membuat kartu baru, ketik nomor WhatsApp pembelinya.' }));
      return;
    }
    if (st.terbaru) ui.hasil.appendChild(el('p', { class: 'daftar__judul', teks: 'Kartu terbaru' }));
    var ul = el('ul', { class: 'daftar' });
    st.hasil.forEach(function (p) { ul.appendChild(barisPelanggan(p, pilih, '', true)); });
    ui.hasil.appendChild(ul);
  }

  function formKartuBaru() {
    var nama = kotak({ type: 'text', autocomplete: 'off', autocapitalize: 'words', maxlength: '60', placeholder: 'Nama pembeli' });
    var tombol = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'submit', teks: 'Buat kartu' });
    var wa = st.waNormal;
    var form = el('form', { class: 'papan belum', novalidate: true }, [
      el('p', {}, [el('strong', { teks: st.waTampil }), ' belum punya kartu.']),
      isian('Nama pembeli', nama),
      el('div', { style: 'margin-top:14px' }, [tombol])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (nama.value.trim().length < 2) { KA.kabar('Isi nama pembeli dulu.', true); nama.focus(); return; }
      sambilSibuk(tombol, 'Membuat…', tulis('daftar', { nama: nama.value, wa: wa })).then(function (d) {
        st.terpilih = d.pelanggan; st.trx = null; st.pesan = d.pesan; st.pesanKartu = d.pesan; st.jumlah = 1;
        KA.kabar(d.sudah_ada ? 'Nomor ini sudah punya kartu' : 'Kartu dibuat');
        gambarPanel(); gambarHasil(); muatRinci();
      }, tunjukGalat);
    });
    setTimeout(function () { try { nama.focus(); } catch (x) { /* abaikan */ } }, 30);
    return form;
  }

  function pilih(p) {
    st.terpilih = p; st.trx = null; st.pesan = ''; st.pesanKartu = ''; st.jumlah = 1;
    gambarPanel(); gambarHasil(); muatRinci();
    if (window.innerWidth < 900) window.scrollTo(0, 0);
  }

  function muatRinci() {
    var id = st.terpilih && st.terpilih.id;
    if (!id) return;
    api('pelanggan', { id: id }).then(function (d) {
      if (!st.terpilih || st.terpilih.id !== id) return;
      st.terpilih = d.pelanggan; st.trx = d.transaksi; st.pesanKartu = d.pesan;
      gambarPanel(true);
    }, function (e) {
      if (e.kode === 'PELANGGAN_TIDAK_ADA' && st.terpilih && st.terpilih.id === id) { st.terpilih = null; gambarPanel(); gambarHasil(); }
    });
  }

  function berikutnya() {
    st.terpilih = null; st.trx = null; st.pesan = ''; st.q = '';
    if (ui.masukan) ui.masukan.value = '';
    gambarPanel(); gambarHasil(); cari('');
    if (ui.masukan) ui.masukan.focus();
    window.scrollTo(0, 0);
  }

  function setelahAksi(d, kabar) {
    st.terpilih = d.pelanggan;
    if (d.pesan) st.pesan = d.pesan;
    if (kabar) KA.kabar(kabar);
    gambarPanel(); muatRinci();
  }

  function gambarPanel(pertahankan) {
    if (!ui.panel) return;
    var p = st.terpilih;
    var nomorLama = pertahankan && ui.nomorPesanan ? ui.nomorPesanan.value : '';
    var pesanLama = pertahankan && ui.kotakPesan ? ui.kotakPesan.value : null;
    kosongkan(ui.panel);
    ui.nomorPesanan = null; ui.kotakPesan = null;
    if (!p) {
      if (window.innerWidth >= 900) ui.panel.appendChild(el('div', { class: 'papan kosong' }, [el('p', { teks: 'Cari pembeli di sebelah kiri, lalu pilih namanya untuk menstempel.' })]));
      return;
    }
    var k = p.kartu, aturBotol = info.aturan === 'botol';

    var catatan = k.penuh ? 'Kartu ke-' + k.kartu_ke + ' penuh' + (k.berikutnya && k.berikutnya.isi ? ', kartu berikutnya sudah ' + k.berikutnya.isi + ' stempel' : '') : 'Kartu ke-' + k.kartu_ke + (k.sisa === 1 ? ', tinggal 1 stempel lagi' : '');
    var kartu = el('div', { class: 'orang__kartu' }, [
      titik(k.isi, k.target, true),
      el('div', { class: 'orang__hitung', teks: k.isi + ' dari ' + k.target + ' stempel' }),
      el('div', { class: 'orang__catatan', teks: catatan })
    ]);
    if (p.hadiah_siap > 0) kartu.appendChild(el('div', { class: 'orang__hadiah', teks: (p.hadiah_siap > 1 ? p.hadiah_siap + ' hadiah' : 'Hadiah') + ' belum diberikan: ' + info.hadiah }));
    if (p.hangus) kartu.appendChild(el('div', { class: 'orang__catatan', teks: 'Stempel di kartu ini sudah melewati masa berlaku dan akan dihanguskan saat stempel berikutnya.' }));

    var rinci = el('div', { class: 'orang__rinci' }, [
      el('button', { type: 'button', title: 'Salin nomor', teks: p.wa_tampil, onclick: function () { KA.salin(p.wa_tampil).then(function () { KA.kabar('Nomor disalin'); }); } }),
      el('span', { teks: 'Kode ' + p.kode }),
      el('span', { teks: 'No. ' + p.no_anggota }),
      p.asal_awal ? el('span', { teks: 'Awal dari ' + p.asal_awal }) : null
    ]);

    var kepala = el('div', { class: 'orang__kepala' }, [
      el('h2', { class: 'orang__nama', teks: p.nama }),
      el('span', { class: 'orang__lencana' }, [p.contoh ? el('span', { class: 'lencana', teks: 'Contoh' }) : null, !p.tgl_setuju ? el('span', { class: 'lencana', title: 'Pembeli belum membuka kartunya dan menyetujui penyimpanan data', teks: 'Belum buka kartu' }) : null])
    ]);

    /* --- tombol tindakan --- */
    var tindak = el('div', { class: 'tindak' });
    var nomor = kotak({ type: 'text', autocomplete: 'off', maxlength: '60', placeholder: 'Mis. ORD-20261105-1234' });
    nomor.value = nomorLama;
    ui.nomorPesanan = nomor;
    tindak.appendChild(isian('Nomor pesanan (boleh kosong)', nomor));
    if (aturBotol) {
      var pilihan = el('div', { class: 'jumlah', role: 'group', 'aria-label': 'Jumlah botol' });
      [1, 2, 3, 4, 5].forEach(function (n) {
        pilihan.appendChild(el('button', { type: 'button', 'aria-pressed': st.jumlah === n ? 'true' : 'false', teks: String(n), onclick: function () { st.jumlah = n; gambarPanel(true); } }));
      });
      tindak.appendChild(el('div', {}, [el('div', { class: 'isian__label', teks: 'Jumlah botol' }), pilihan]));
    }
    var tStempel = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: aturBotol && st.jumlah > 1 ? 'Stempel ' + st.jumlah + '×' : 'Stempel' });
    tStempel.addEventListener('click', function () { kirimStempel(tStempel, false); });
    if (!info.program_aktif) { tStempel.disabled = true; tStempel.textContent = 'Program sedang dijeda'; }
    tindak.appendChild(tStempel);

    if (p.hadiah_siap > 0) tindak.appendChild(el('button', { class: 'tombol tombol--rimba tombol--penuh', type: 'button', teks: 'Beri hadiah', onclick: function () { bukaHadiah(false); } }));
    if (p.boleh_stempel_awal && info.program_aktif) tindak.appendChild(el('div', {}, [
      el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', teks: 'Stempel Awal', onclick: bukaStempelAwal }),
      el('p', { class: 'isian__bantuan', teks: 'Untuk yang sudah pernah beli parfum APB di TikTok, Shopee, atau tempat lain. Sekali saja per pelanggan.' })
    ]));
    tindak.appendChild(el('div', { class: 'tindak__dua' }, [
      el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Batalkan stempel', onclick: bukaBatal }),
      el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Pelanggan berikutnya', onclick: berikutnya })
    ]));

    var lain = el('details', { class: 'lain' }, [
      el('summary', { teks: 'Lainnya' }),
      el('div', { class: 'lain__isi' }, [
        el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Riwayat lengkap', onclick: bukaRiwayat }),
        el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Ubah nama / nomor', onclick: bukaUbahNama }),
        el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Penyesuaian', onclick: bukaPenyesuaian }),
        el('button', { class: 'tombol tombol--bahaya tombol--kecil', type: 'button', teks: 'Hapus data', onclick: bukaHapus })
      ])
    ]);

    /* --- pesan siap kirim --- */
    var isiPesan = pesanLama !== null && pesanLama !== '' && !st.pesanBaru ? pesanLama : (st.pesan || st.pesanKartu || '');
    st.pesanBaru = false;
    var kotakPesan = kotakPanjang(isiPesan, { rows: '5', 'aria-label': 'Pesan siap kirim' });
    ui.kotakPesan = kotakPesan;
    var pesan = el('div', { class: 'papan pesan' }, [
      el('h3', { class: 'papan__judul', teks: st.pesan ? 'Pesan siap kirim' : 'Kirim link kartu' }),
      kotakPesan,
      el('div', { class: 'pesan__aksi' }, [
        el('button', { class: 'tombol tombol--emas', type: 'button', teks: 'Kirim lewat WhatsApp', onclick: function () { window.open(KA.tautanWa(p.wa, kotakPesan.value), '_blank', 'noopener'); } }),
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Salin pesan', onclick: function () { KA.salin(kotakPesan.value).then(function () { KA.kabar('Pesan disalin'); }, function () { KA.kabar('Tidak bisa menyalin. Salin manual dari kotak pesan.', true); }); } }),
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Salin link kartu', onclick: function () {
          if (!p.tautan) { KA.kabar('Alamat halaman kartu belum diatur. Minta Owner mengisinya di Pengaturan.', true); return; }
          KA.salin(p.tautan).then(function () { KA.kabar('Link kartu disalin'); }, function () { KA.kabar('Tidak bisa menyalin.', true); });
        } })
      ]),
      el('p', { class: 'pesan__catatan', teks: p.tautan ? 'Tombol WhatsApp membuka chat ke nomor pembeli dari WhatsApp yang sedang dipakai di perangkat ini.' : 'Alamat halaman kartu belum diatur, jadi link belum bisa dibuat. Owner bisa mengisinya di Pengaturan.' })
    ]);

    /* --- riwayat singkat --- */
    var jejak = el('div', { class: 'papan' }, [el('h3', { class: 'papan__judul', teks: 'Riwayat terakhir' })]);
    if (!st.trx) jejak.appendChild(el('div', { class: 'muat', teks: 'Memuat riwayat…' }));
    else jejak.appendChild(daftarJejak(st.trx.slice(0, 6), false));

    ui.panel.appendChild(el('div', { class: 'papan' }, [kepala, rinci, kartu, tindak, lain]));
    ui.panel.appendChild(pesan);
    ui.panel.appendChild(jejak);
  }

  function rincianTransaksi(t) {
    var r = [];
    if (t.jenis === 'STEMPEL' && t.jumlah > 1) r.push(t.jumlah + ' stempel');
    if (t.nomor_pesanan) r.push('Pesanan ' + t.nomor_pesanan);
    if (t.asal) r.push('Dari ' + t.asal);
    if (t.aroma) r.push('Aroma ' + t.aroma);
    if (t.jenis === 'PENYESUAIAN' && t.jumlah) r.push((t.jumlah > 0 ? '+' : '') + t.jumlah + ' stempel');
    if (t.catatan) r.push(t.catatan);
    if (t.batal) r.push('Dibatalkan');
    return r.join(', ');
  }

  function daftarJejak(trx, denganNama) {
    var ul = el('ul', { class: 'jejak' });
    if (!trx.length) { ul.appendChild(el('li', {}, [el('span', {}), el('span', { class: 'keterangan', teks: 'Belum ada catatan.' })])); return ul; }
    trx.forEach(function (t) {
      var bawah = rincianTransaksi(t), oleh = t.admin ? (t.sumber === 'otomatis' ? 'otomatis, ' : '') + t.admin : '';
      var apa = el('div', {}, [el('span', { class: 'jejak__apa', teks: (denganNama ? t.nama + ': ' : '') + (LABEL_JENIS[t.jenis] || t.jenis) })]);
      if (bawah) apa.appendChild(el('small', { teks: bawah }));
      if (oleh) apa.appendChild(el('small', { teks: 'Oleh ' + oleh }));
      ul.appendChild(el('li', { class: t.batal ? 'batal' : '' }, [el('div', { class: 'jejak__waktu', title: KA.waktu(t.waktu), teks: KA.waktuRingkas(t.waktu) }), apa]));
    });
    return ul;
  }

  /* ---------- aksi stempel ---------- */

  function kirimStempel(tombol, sudahKonfirmasi) {
    var p = st.terpilih;
    var badan = { id: p.id, nomor_pesanan: ui.nomorPesanan ? ui.nomorPesanan.value.trim() : '', jumlah: st.jumlah, konfirmasi: !!sudahKonfirmasi };
    sambilSibuk(tombol, 'Menstempel…', tulis('stempel', badan)).then(function (d) {
      st.jumlah = 1; st.pesanBaru = true;
      if (d.kartu_penuh) {
        st.terpilih = d.pelanggan; st.pesan = d.pesan_tunda || d.pesan;
        gambarPanel(); muatRinci();
        bukaHadiah(true);
      } else setelahAksi(d, 'Stempel masuk');
    }, function (e) {
      if (e.kode === 'BUTUH_KONFIRMASI') {
        var lembar;
        var ya = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Ya, stempel lagi' });
        var tidak = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', 'data-fokus': true, teks: 'Tidak jadi' });
        tidak.addEventListener('click', function () { lembar.tutup(); });
        ya.addEventListener('click', function () { lembar.tutup(); kirimStempel(tombol, true); });
        lembar = KA.lembar(el('div', {}, [
          el('h2', { class: 'lembar__judul', teks: 'Stempel lagi?' }),
          el('div', { class: 'lembar__isi' }, [el('p', { teks: e.message }), el('p', { teks: 'Isi nomor pesanan supaya pesanan yang sama tidak terstempel dua kali.' })]),
          el('div', { class: 'lembar__aksi' }, [tidak, ya])
        ]));
        return;
      }
      tunjukGalat(e);
    });
  }

  function bukaHadiah(baruPenuh) {
    var p = st.terpilih, lembar;
    var idDaftar = 'aroma-' + Math.random().toString(36).slice(2, 8);
    var aroma = kotak({ type: 'text', list: idDaftar, autocomplete: 'off', maxlength: '40', placeholder: 'Aroma yang dikirim', 'data-fokus': true });
    var daftar = el('datalist', { id: idDaftar });
    (info.aroma || []).forEach(function (a) { daftar.appendChild(el('option', { value: a })); });
    var ikut = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Hadiah ikut paket ini' });
    var tunda = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', teks: 'Tunda dulu' });
    ikut.addEventListener('click', function () {
      sambilSibuk(ikut, 'Mencatat…', tulis('hadiah', { id: p.id, aroma: aroma.value, baru_penuh: !!baruPenuh })).then(function (d) {
        lembar.tutup(); st.pesanBaru = true; setelahAksi(d, 'Hadiah dicatat');
      }, tunjukGalat);
    });
    tunda.addEventListener('click', function () {
      sambilSibuk(tunda, 'Mencatat…', tulis('hadiah_tunda', { id: p.id, catatan: aroma.value ? 'Aroma diminta: ' + aroma.value : '' })).then(function (d) {
        lembar.tutup(); st.pesanBaru = true; setelahAksi(d, 'Hadiah ditunda');
      }, tunjukGalat);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: baruPenuh ? 'Kartu penuh' : 'Beri hadiah' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: p.nama + ' berhak atas ' + info.hadiah + '. Kalau hadiahnya ikut dikirim sekarang, catat aromanya. Kalau stok kosong atau pembeli belum memilih, tunda dulu.' })]),
      el('div', { style: 'margin-top:16px' }, [isian('Aroma hadiah', aroma, 'Hanya tampil di riwayat kartu pembeli ini.'), daftar]),
      el('div', { class: 'lembar__aksi' }, [ikut, tunda])
    ]));
  }

  function bukaStempelAwal() {
    var p = st.terpilih, lembar;
    var pilihan = el('div', { class: 'pilihan' });
    (info.asal || []).forEach(function (asal, i) {
      var t = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', teks: asal });
      if (i === 0) t.setAttribute('data-fokus', '');
      t.addEventListener('click', function () {
        sambilSibuk(t, 'Menstempel…', tulis('stempel_awal', { id: p.id, asal: asal })).then(function (d) {
          lembar.tutup(); st.pesanBaru = true; setelahAksi(d, 'Stempel awal masuk');
        }, tunjukGalat);
      });
      pilihan.appendChild(t);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Stempel Awal' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Satu stempel untuk parfum APB yang sudah pernah dibeli ' + p.nama + ' sebelumnya. Hanya sekali per pelanggan. Di mana belinya?' })]),
      el('div', { style: 'margin-top:16px' }, [pilihan])
    ]));
  }

  function bukaBatal() {
    var p = st.terpilih, lembar;
    var sasaran = null;
    (st.trx || []).some(function (t) { if ((t.jenis === 'STEMPEL' || t.jenis === 'STEMPEL_AWAL') && !t.batal) { sasaran = t; return true; } return false; });
    var alasan = kotakPanjang('', { rows: '3', maxlength: '200', placeholder: 'Mis. pesanan dibatalkan pembeli', 'data-fokus': true });
    var ya = el('button', { class: 'tombol tombol--bahaya tombol--penuh', type: 'button', teks: 'Batalkan stempel' });
    var tutup = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', teks: 'Tidak jadi' });
    tutup.addEventListener('click', function () { lembar.tutup(); });
    ya.addEventListener('click', function () {
      if (alasan.value.trim().length < 3) { KA.kabar('Tulis alasannya dulu.', true); alasan.focus(); return; }
      sambilSibuk(ya, 'Membatalkan…', tulis('batal', { id: p.id, alasan: alasan.value })).then(function (d) {
        lembar.tutup(); st.pesan = ''; setelahAksi(d, d.hadiah_ditarik ? 'Stempel dibatalkan, hadiah ditarik lagi' : 'Stempel dibatalkan');
      }, tunjukGalat);
    });
    var ket = sasaran ? 'Yang dibatalkan: ' + (LABEL_JENIS[sasaran.jenis] || sasaran.jenis).toLowerCase() + ' pada ' + KA.waktu(sasaran.waktu) + (sasaran.nomor_pesanan ? ' (pesanan ' + sasaran.nomor_pesanan + ')' : '') + '.' : 'Stempel terakhir pelanggan ini akan dibatalkan.';
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Batalkan stempel terakhir?' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: ket }), el('p', { teks: 'Pembatalan tetap tercatat di Aktivitas beserta alasannya.' })]),
      el('div', { style: 'margin-top:16px' }, [isian('Alasan', alasan)]),
      el('div', { class: 'lembar__aksi' }, [ya, tutup])
    ]));
  }

  function bukaPenyesuaian() {
    var p = st.terpilih, lembar;
    var jumlah = kotak({ type: 'number', inputmode: 'numeric', step: '1', min: '-36', max: '36', placeholder: 'Mis. 1 atau -1', 'data-fokus': true });
    var alasan = kotakPanjang('', { rows: '3', maxlength: '200', placeholder: 'Mis. pindahan dari kartu kertas' });
    var ya = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Simpan penyesuaian' });
    ya.addEventListener('click', function () {
      var n = parseInt(jumlah.value, 10);
      if (!n) { KA.kabar('Isi jumlahnya, misalnya 1 atau -1.', true); jumlah.focus(); return; }
      if (alasan.value.trim().length < 3) { KA.kabar('Tulis alasannya dulu.', true); alasan.focus(); return; }
      sambilSibuk(ya, 'Menyimpan…', tulis('penyesuaian', { id: p.id, delta: n, alasan: alasan.value })).then(function (d) {
        lembar.tutup(); st.pesan = ''; setelahAksi(d, 'Penyesuaian dicatat');
      }, tunjukGalat);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Penyesuaian stempel' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Untuk koreksi di luar pembelian biasa. Angka positif menambah stempel, angka negatif mengurangi. Tercatat atas namamu.' })]),
      el('div', { style: 'margin-top:16px' }, [isian('Jumlah stempel', jumlah), isian('Alasan', alasan)]),
      el('div', { class: 'lembar__aksi' }, [ya])
    ]));
  }

  function bukaUbahNama() {
    var p = st.terpilih, lembar;
    var nama = kotak({ type: 'text', maxlength: '60', autocapitalize: 'words', 'data-fokus': true });
    nama.value = p.nama;
    var wa = kotak({ type: 'tel', inputmode: 'tel', autocomplete: 'off', maxlength: '24' });
    wa.value = p.wa_tampil;
    var ya = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Simpan' });
    ya.addEventListener('click', function () {
      var ubah = { id: p.id };
      if (nama.value.trim() !== p.nama) ubah.nama = nama.value;
      if (wa.value.trim() !== p.wa_tampil) ubah.wa = wa.value;
      if (ubah.nama === undefined && ubah.wa === undefined) { lembar.tutup(); return; }
      sambilSibuk(ya, 'Menyimpan…', api('ubah_pelanggan', ubah)).then(function (d) {
        lembar.tutup(); st.pesan = ''; setelahAksi(d, ubah.wa !== undefined ? 'Nomor WhatsApp diganti' : 'Nama diubah');
      }, tunjukGalat);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Ubah nama atau nomor' }),
      el('div', { style: 'margin-top:8px' }, [
        isian('Nama di kartu', nama),
        isian('Nomor WhatsApp', wa, 'Kartu, stempel, dan link-nya tetap sama. Penggantian nomor tercatat di Aktivitas.')
      ]),
      el('div', { class: 'lembar__aksi' }, [ya])
    ]));
  }

  function bukaHapus() {
    var p = st.terpilih, lembar;
    var ketik = kotak({ type: 'text', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'HAPUS', 'data-fokus': true });
    var ya = el('button', { class: 'tombol tombol--bahaya tombol--penuh', type: 'button', teks: 'Hapus data pelanggan' });
    ya.addEventListener('click', function () {
      if (ketik.value.trim().toUpperCase() !== 'HAPUS') { KA.kabar('Ketik HAPUS untuk melanjutkan.', true); ketik.focus(); return; }
      sambilSibuk(ya, 'Menghapus…', tulis('hapus_pelanggan', { id: p.id, konfirmasi: 'HAPUS' })).then(function () {
        lembar.tutup(); KA.kabar('Data pelanggan dihapus'); berikutnya();
      }, tunjukGalat);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Hapus data ' + p.nama + '?' }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Nama, nomor WhatsApp, dan kartunya dihapus, dan link kartunya mati. Catatan transaksinya tetap ada tanpa nama. Ini tidak bisa dibatalkan.' })]),
      el('div', { style: 'margin-top:16px' }, [isian('Ketik HAPUS untuk melanjutkan', ketik)]),
      el('div', { class: 'lembar__aksi' }, [ya])
    ]));
  }

  function bukaRiwayat() {
    var p = st.terpilih;
    KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Riwayat ' + p.nama }),
      el('div', { style: 'margin-top:8px' }, [st.trx ? daftarJejak(st.trx, false) : el('div', { class: 'muat', teks: 'Memuat…' })])
    ]));
  }

  /* =====================================================================
   * TAB PELANGGAN
   * ===================================================================== */

  var pl = { q: '', saring: 'semua', urut: 'terbaru', halaman: 1, baris: [], total: 0, hitung: null, nomor: 0 };
  var SARING = [['semua', 'Semua'], ['tinggal_satu', 'Tinggal 1 stempel'], ['hadiah_tunda', 'Hadiah tertunda'], ['lama_tidak_beli', 'Lama tidak beli'], ['belum_beli', 'Belum beli lewat WA']];

  function tabPelanggan() {
    var masukan = kotak({ type: 'search', autocomplete: 'off', placeholder: 'Cari nama, nomor, atau kode', 'aria-label': 'Cari pelanggan' });
    masukan.value = pl.q;
    var urut = el('select', { class: 'isian__kotak', 'aria-label': 'Urutkan' }, [
      el('option', { value: 'terbaru', teks: 'Terbaru daftar' }), el('option', { value: 'terakhir_beli', teks: 'Terakhir beli' }),
      el('option', { value: 'stempel', teks: 'Stempel terbanyak' }), el('option', { value: 'nama', teks: 'Nama A–Z' })
    ]);
    urut.value = pl.urut;
    var keping = el('div', { class: 'saring', role: 'group', 'aria-label': 'Saring pelanggan' });
    var daftar = el('div', { 'aria-live': 'polite' });
    var tunda = null;

    function gambarKeping() {
      kosongkan(keping);
      SARING.forEach(function (s) {
        keping.appendChild(el('button', { class: 'keping', type: 'button', 'aria-pressed': pl.saring === s[0] ? 'true' : 'false', onclick: function () { pl.saring = s[0]; pl.halaman = 1; muat(false); } }, [s[1], pl.hitung ? el('b', { teks: String(pl.hitung[s[0]]) }) : null]));
      });
    }
    function gambarDaftar() {
      kosongkan(daftar);
      if (!pl.baris.length) { daftar.appendChild(el('p', { class: 'kosong', teks: pl.q ? 'Tidak ada yang cocok.' : 'Belum ada pelanggan di kelompok ini.' })); return; }
      var ul = el('ul', { class: 'daftar' });
      pl.baris.forEach(function (p) {
        var ket = pl.saring === 'lama_tidak_beli' || pl.urut === 'terakhir_beli' ? (p.stempel_terakhir ? 'terakhir ' + KA.berapaLama(p.stempel_terakhir) : 'belum pernah') : '';
        ul.appendChild(barisPelanggan(p, function (x) { tabAktif = 'stempel'; bukaTab('stempel'); pilih(x); }, ket));
      });
      daftar.appendChild(ul);
      if (pl.baris.length < pl.total) daftar.appendChild(el('div', { class: 'lagi' }, [el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Muat lagi (' + (pl.total - pl.baris.length) + ')', onclick: function () { pl.halaman += 1; muat(true); } })]));
    }
    function muat(tambah) {
      var nomor = ++pl.nomor;
      gambarKeping();
      if (!tambah) { kosongkan(daftar); daftar.appendChild(el('div', { class: 'muat', teks: 'Memuat pelanggan…' })); }
      api('daftar_pelanggan', { q: pl.q, saring: pl.saring, urut: pl.urut, halaman: pl.halaman }).then(function (d) {
        if (nomor !== pl.nomor || tabAktif !== 'pelanggan') return;
        pl.baris = tambah ? pl.baris.concat(d.baris) : d.baris; pl.total = d.total; pl.hitung = d.hitung;
        gambarKeping(); gambarDaftar();
      }, function (e) { if (nomor === pl.nomor && e.kode !== 'SESI_HABIS') { kosongkan(daftar); daftar.appendChild(el('p', { class: 'kosong galat-teks', teks: e.message })); } });
    }
    masukan.addEventListener('input', function () { clearTimeout(tunda); tunda = setTimeout(function () { pl.q = masukan.value; pl.halaman = 1; muat(false); }, 350); });
    urut.addEventListener('change', function () { pl.urut = urut.value; pl.halaman = 1; muat(false); });

    wadah.appendChild(el('h1', { class: 'judul-tab', teks: 'Pelanggan' }));
    wadah.appendChild(el('div', { class: 'alat' }, [masukan, urut]));
    wadah.appendChild(keping);
    wadah.appendChild(daftar);
    pl.halaman = 1;
    muat(false);
  }

  /* =====================================================================
   * TAB AKTIVITAS
   * ===================================================================== */

  var ak = { jenis: '', admin: '', dari: '', sampai: '', halaman: 1, baris: [], total: 0, nomor: 0, adminAda: [] };

  function tabAktivitas() {
    var jenis = el('select', { class: 'isian__kotak', 'aria-label': 'Jenis catatan' }, [el('option', { value: '', teks: 'Semua jenis' })]);
    ['STEMPEL', 'STEMPEL_AWAL', 'HADIAH', 'HADIAH_TUNDA', 'BATAL', 'PENYESUAIAN', 'DAFTAR', 'PERSETUJUAN', 'HAPUS_DATA'].forEach(function (j) { jenis.appendChild(el('option', { value: j, teks: LABEL_JENIS[j] })); });
    jenis.value = ak.jenis;
    var admin = el('select', { class: 'isian__kotak', 'aria-label': 'Admin' }, [el('option', { value: '', teks: 'Semua admin' })]);
    var dari = kotak({ type: 'date', 'aria-label': 'Dari tanggal' }); dari.value = ak.dari;
    var sampai = kotak({ type: 'date', 'aria-label': 'Sampai tanggal' }); sampai.value = ak.sampai;
    var daftar = el('div', { class: 'papan', style: 'margin-top:14px', 'aria-live': 'polite' });

    function gambar() {
      kosongkan(daftar);
      if (!ak.baris.length) { daftar.appendChild(el('p', { class: 'kosong', teks: 'Belum ada catatan untuk saringan ini.' })); return; }
      daftar.appendChild(daftarJejak(ak.baris, true));
      if (ak.baris.length < ak.total) daftar.appendChild(el('div', { class: 'lagi' }, [el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Muat lagi (' + (ak.total - ak.baris.length) + ')', onclick: function () { ak.halaman += 1; muat(true); } })]));
    }
    function muat(tambah) {
      var nomor = ++ak.nomor;
      if (!tambah) { kosongkan(daftar); daftar.appendChild(el('div', { class: 'muat', teks: 'Memuat aktivitas…' })); }
      api('aktivitas', { jenis: ak.jenis, admin: ak.admin, dari: ak.dari, sampai: ak.sampai, halaman: ak.halaman }).then(function (d) {
        if (nomor !== ak.nomor || tabAktif !== 'aktivitas') return;
        ak.baris = tambah ? ak.baris.concat(d.baris) : d.baris; ak.total = d.total;
        if (d.admin.join('|') !== ak.adminAda.join('|')) {
          ak.adminAda = d.admin;
          while (admin.options.length > 1) admin.remove(1);
          d.admin.forEach(function (n) { admin.appendChild(el('option', { value: n, teks: n })); });
          admin.value = ak.admin;
        }
        gambar();
      }, function (e) { if (nomor === ak.nomor && e.kode !== 'SESI_HABIS') { kosongkan(daftar); daftar.appendChild(el('p', { class: 'kosong galat-teks', teks: e.message })); } });
    }
    function ubah() { ak.jenis = jenis.value; ak.admin = admin.value; ak.dari = dari.value; ak.sampai = sampai.value; ak.halaman = 1; muat(false); }
    [jenis, admin, dari, sampai].forEach(function (x) { x.addEventListener('change', ubah); });
    ak.adminAda = [];

    wadah.appendChild(el('h1', { class: 'judul-tab', teks: 'Aktivitas' }));
    wadah.appendChild(el('div', { class: 'alat alat--empat' }, [jenis, admin, dari, sampai]));
    wadah.appendChild(daftar);
    ak.halaman = 1;
    muat(false);
  }

  /* =====================================================================
   * TAB RINGKASAN (Owner)
   * ===================================================================== */

  function kotakAngka(label, nilai, kecil) {
    return el('div', { class: 'angka__kotak' }, [
      el('div', { class: 'angka__label', teks: label }),
      el('div', { class: 'angka__nilai' }, [String(nilai), kecil ? el('small', { teks: kecil }) : null])
    ]);
  }

  function rentangMinggu(mulai) {
    var a = new Date(mulai + 'T00:00:00+07:00'), b = new Date(a.getTime() + 6 * 86400000);
    return KA.hariBulan(a.toISOString()) + ' – ' + KA.hariBulan(b.toISOString());
  }

  // Grafik kolom satu seri: pembelian lewat WhatsApp per minggu.
  // Digambar sesuai lebar wadahnya (bukan diperkecil), supaya angka sumbu tetap terbaca di HP.
  function grafikMingguan(data, lebarWadah) {
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, a, teks) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); if (teks !== undefined) e.textContent = teks; return e; }
    var L = Math.max(260, Math.round(lebarWadah || 640)), T = L < 480 ? 204 : 244, kiri = 30, kanan = 6, atas = 24, bawah = 28;
    var lebarPlot = L - kiri - kanan, tinggiPlot = T - atas - bawah;
    var maks = 0;
    data.forEach(function (d) { if (d.stempel > maks) maks = d.stempel; });
    var langkah = maks <= 4 ? 1 : maks <= 10 ? 2 : maks <= 25 ? 5 : maks <= 50 ? 10 : maks <= 100 ? 20 : Math.pow(10, Math.floor(Math.log(maks) / Math.LN10));
    if (maks > 100 && maks / langkah > 5) langkah *= 2;
    var puncak = Math.max(langkah * 2, Math.ceil(maks / langkah) * langkah);
    var svgEl = s('svg', { viewBox: '0 0 ' + L + ' ' + T, role: 'img', 'aria-label': 'Grafik kolom pembelian lewat WhatsApp per minggu, ' + data.length + ' minggu terakhir' });
    for (var g = 0; g <= puncak; g += langkah) {
      var y = Math.round(atas + tinggiPlot - (g / puncak) * tinggiPlot) + 0.5;
      svgEl.appendChild(s('line', { class: g === 0 ? 'grafik__dasar' : 'grafik__garis', x1: kiri, x2: L - kanan, y1: y, y2: y }));
      svgEl.appendChild(s('text', { class: 'grafik__teks', x: kiri - 8, y: y + 4, 'text-anchor': 'end' }, String(g)));
    }
    var pita = lebarPlot / data.length, lebar = Math.max(6, Math.min(24, pita - 6));
    var tip = el('div', { class: 'grafik__tip', hidden: true });
    var bungkus = el('div', { class: 'grafik' }, [svgEl, tip]);
    function tunjuk(i, x, yPuncak) {
      kosongkan(tip);
      tip.appendChild(el('strong', { teks: data[i].stempel + ' pembelian' }));
      tip.appendChild(document.createTextNode(rentangMinggu(data[i].mulai)));
      tip.hidden = false;
      var kotakSvg = svgEl.getBoundingClientRect(), skala = kotakSvg.width / L, setengah = tip.offsetWidth / 2;
      tip.style.left = Math.max(setengah, Math.min(kotakSvg.width - setengah, x * skala)) + 'px';
      tip.style.top = (yPuncak * skala - 8) + 'px';
    }
    data.forEach(function (d, i) {
      var x = kiri + i * pita, tinggi = (d.stempel / puncak) * tinggiPlot, dasar = atas + tinggiPlot, yAtas = dasar - tinggi, xb = x + (pita - lebar) / 2;
      var kol = s('g', { class: 'grafik__kolom', tabindex: '0', role: 'img', 'aria-label': rentangMinggu(d.mulai) + ': ' + d.stempel + ' pembelian' });
      kol.appendChild(s('rect', { class: 'grafik__sorot', x: x + 1, y: atas - 4, width: pita - 2, height: tinggiPlot + 4, rx: 4 }));
      if (d.stempel > 0) {
        var r = Math.min(4, tinggi, lebar / 2);
        // ujung data membulat 4px, rata di garis dasar
        kol.appendChild(s('path', { class: 'grafik__batang', d: 'M' + xb + ' ' + dasar + 'V' + (yAtas + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) + 'H' + (xb + lebar - r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + dasar + 'Z' }));
      }
      // hanya kolom terakhir (minggu berjalan) yang diberi angka; sisanya lewat sumbu, sorot, dan tabel
      if (i === data.length - 1) svgEl.appendChild(s('text', { class: 'grafik__nilai', x: xb + lebar / 2, y: yAtas - 7, 'text-anchor': 'middle' }, String(d.stempel)));
      if ((data.length - 1 - i) % 3 === 0) svgEl.appendChild(s('text', { class: 'grafik__teks', x: x + pita / 2, y: T - 8, 'text-anchor': 'middle' }, KA.hariBulan(new Date(d.mulai + 'T00:00:00+07:00').toISOString())));
      function masuk() { tunjuk(i, x + pita / 2, yAtas); }
      kol.addEventListener('pointerenter', masuk); kol.addEventListener('focus', masuk);
      kol.addEventListener('pointerleave', function () { tip.hidden = true; }); kol.addEventListener('blur', function () { tip.hidden = true; });
      svgEl.appendChild(kol);
    });
    return bungkus;
  }

  function tabelMingguan(data) {
    var badan = el('tbody');
    data.slice().reverse().forEach(function (d) {
      badan.appendChild(el('tr', {}, [el('td', { teks: rentangMinggu(d.mulai) }), el('td', { class: 'angka-kol', teks: String(d.stempel) }), el('td', { class: 'angka-kol', teks: String(d.kartu_baru) })]));
    });
    return el('div', { class: 'gulir' }, [el('table', { class: 'tabel' }, [
      el('thead', {}, [el('tr', {}, [el('th', { teks: 'Minggu' }), el('th', { class: 'angka-kol', teks: 'Pembelian lewat WA' }), el('th', { class: 'angka-kol', teks: 'Kartu baru' })])]),
      badan
    ])]);
  }

  function tabelOrang(daftar, kolomAkhir, pesanChat) {
    if (!daftar.length) return el('p', { class: 'kosong', teks: 'Tidak ada.' });
    var badan = el('tbody');
    daftar.forEach(function (x) {
      badan.appendChild(el('tr', {}, [
        el('td', {}, [el('button', { class: 'tautan', type: 'button', teks: x.nama, onclick: function () { api('pelanggan', { id: x.id }).then(function (d) { bukaTab('stempel'); pilih(d.pelanggan); }, tunjukGalat); } })]),
        el('td', { class: 'tak-patah', teks: kolomAkhir(x) }),
        el('td', { class: 'angka-kol' }, [el('a', { href: KA.tautanWa(x.wa, pesanChat(x)), target: '_blank', rel: 'noopener', teks: 'Chat' })])
      ]));
    });
    return el('div', { class: 'gulir' }, [el('table', { class: 'tabel' }, [badan])]);
  }

  function tabRingkasan() {
    wadah.appendChild(el('h1', { class: 'judul-tab', teks: 'Ringkasan' }));
    var isi = el('div', {}, [el('div', { class: 'muat', teks: 'Menghitung…' })]);
    wadah.appendChild(isi);
    api('ringkasan').then(function (r) {
      if (tabAktif !== 'ringkasan') return;
      kosongkan(isi);
      if (r.ada_contoh) isi.appendChild(el('p', { class: 'orang__hadiah', style: 'margin:0 0 14px', teks: 'Angka di bawah masih memuat data contoh. Hapus data contoh di Pengaturan sebelum dipakai sungguhan.' }));
      isi.appendChild(el('div', { class: 'angka' }, [
        kotakAngka('Pemegang kartu aktif', r.pemegang_kartu, r.kartu_baru_7 ? '+' + r.kartu_baru_7 + ' dalam 7 hari' : ''),
        kotakAngka('Pembelian lewat WA, 30 hari terakhir', r.stempel_beli_30, r.stempel_beli_7 + ' dalam 7 hari'),
        kotakAngka('Beli lewat WA 2 kali atau lebih', r.pembeli_ulang, 'dari ' + r.pembeli_wa + ' pembeli'),
        kotakAngka('Hadiah yang sudah keluar', r.hadiah_keluar, r.hadiah_tunda ? r.hadiah_tunda + ' masih ditunda' : '')
      ]));

      var tampilTabel = false;
      var wadahGrafik = el('div');
      var tukar = el('button', { class: 'tombol tombol--teks tombol--kecil', type: 'button', teks: 'Lihat tabel' });
      var lebarGrafik = 0;
      function gambarGrafik() {
        kosongkan(wadahGrafik);
        lebarGrafik = wadahGrafik.clientWidth;
        wadahGrafik.appendChild(tampilTabel ? tabelMingguan(r.mingguan) : grafikMingguan(r.mingguan, lebarGrafik));
        tukar.textContent = tampilTabel ? 'Lihat grafik' : 'Lihat tabel';
      }
      tukar.addEventListener('click', function () { tampilTabel = !tampilTabel; gambarGrafik(); });
      isi.appendChild(el('section', { class: 'papan', style: 'margin-top:14px' }, [
        el('div', { class: 'grafik__kepala' }, [el('h2', { class: 'papan__judul', style: 'margin:0', teks: 'Pembelian lewat WhatsApp per minggu' }), tukar]),
        wadahGrafik
      ]));
      gambarGrafik();
      // gambar ulang kalau lebarnya berubah (HP diputar, jendela diubah ukurannya)
      if (window.ResizeObserver) {
        var pengamat = new ResizeObserver(function () {
          if (!document.body.contains(wadahGrafik)) { pengamat.disconnect(); return; }
          if (!tampilTabel && Math.abs(wadahGrafik.clientWidth - lebarGrafik) > 8) gambarGrafik();
        });
        pengamat.observe(wadahGrafik);
      }

      var badanAsal = el('tbody');
      Object.keys(r.asal).forEach(function (a) {
        var x = r.asal[a];
        badanAsal.appendChild(el('tr', {}, [el('td', { class: 'tak-patah', teks: a }), el('td', { class: 'angka-kol', teks: String(x.jumlah) }), el('td', { class: 'angka-kol', teks: String(x.lanjut_beli) }), el('td', { class: 'angka-kol', teks: x.jumlah ? Math.round(x.lanjut_beli / x.jumlah * 100) + '%' : '–' })]));
      });
      isi.appendChild(el('section', { class: 'papan', style: 'margin-top:14px' }, [
        el('h2', { class: 'papan__judul', teks: 'Asal pembeli yang mengambil Stempel Awal' }),
        el('div', { class: 'gulir' }, [el('table', { class: 'tabel' }, [
          el('thead', {}, [el('tr', {}, [el('th', { teks: 'Asal' }), el('th', { class: 'angka-kol', teks: 'Pelanggan' }), el('th', { class: 'angka-kol', teks: 'Lanjut beli di WA' }), el('th', { class: 'angka-kol', teks: 'Persen' })])]),
          badanAsal
        ])])
      ]));

      isi.appendChild(el('div', { class: 'dua-papan' }, [
        el('section', { class: 'papan' }, [
          el('h2', { class: 'papan__judul', teks: 'Tinggal 1 stempel (' + r.jumlah_tinggal_satu + ')' }),
          tabelOrang(r.tinggal_satu, function (x) { return x.wa_tampil; }, function (x) { return 'Halo Kak ' + x.nama.split(' ')[0] + ', kartu ' + info.program + ' Kakak tinggal 1 stempel lagi untuk ' + info.hadiah + '.'; })
        ]),
        el('section', { class: 'papan' }, [
          el('h2', { class: 'papan__judul', teks: 'Lama tidak beli (' + r.jumlah_lama_tidak_beli + ')' }),
          tabelOrang(r.lama_tidak_beli, function (x) { return 'terakhir ' + KA.tanggalPendek(x.terakhir); }, function (x) { return 'Halo Kak ' + x.nama.split(' ')[0] + ', stempel di kartu ' + info.program + ' Kakak masih tersimpan (' + x.stempel + ' dari ' + r.target + ').'; })
        ])
      ]));
      isi.appendChild(el('p', { class: 'keterangan', style: 'margin-top:16px', teks: 'Dihitung ' + KA.waktu(r.dibuat) + ' WIB. Angka yang sama tertulis di tab Ringkasan pada spreadsheet.' }));
    }, function (e) { if (e.kode !== 'SESI_HABIS') { kosongkan(isi); isi.appendChild(el('p', { class: 'kosong galat-teks', teks: e.message })); } });
  }

  /* =====================================================================
   * TAB PENGATURAN (Owner)
   * ===================================================================== */

  function saklar(label, kecil, nyala, saatUbah) {
    var cek = el('input', { type: 'checkbox' });
    cek.checked = !!nyala;
    cek.addEventListener('change', function () { saatUbah(cek.checked); });
    return el('label', { class: 'saklar' }, [el('span', { class: 'saklar__teks' }, [label, kecil ? el('small', { teks: kecil }) : null]), cek, el('span', { class: 'saklar__tuas', 'aria-hidden': 'true' })]);
  }

  function tabPengaturan() {
    wadah.appendChild(el('h1', { class: 'judul-tab', teks: 'Pengaturan' }));
    var isi = el('div', {}, [el('div', { class: 'muat', teks: 'Memuat pengaturan…' })]);
    wadah.appendChild(isi);
    api('pengaturan_baca').then(function (d) { if (tabAktif === 'pengaturan') gambarPengaturan(isi, d); }, function (e) { if (e.kode !== 'SESI_HABIS') { kosongkan(isi); isi.appendChild(el('p', { class: 'kosong galat-teks', teks: e.message })); } });
  }

  function gambarPengaturan(isi, d) {
    kosongkan(isi);
    var asal = d.pengaturan, ubah = {};
    var bar = el('div', { class: 'simpan-bar', hidden: true });
    var tSimpan = el('button', { class: 'tombol tombol--emas tombol--kecil', type: 'button', teks: 'Simpan perubahan' });
    bar.appendChild(el('span', { teks: 'Ada perubahan yang belum disimpan.' }));
    bar.appendChild(tSimpan);

    function catat(kunci, nilai) {
      if (String(nilai) === String(asal[kunci])) delete ubah[kunci]; else ubah[kunci] = nilai;
      bar.hidden = Object.keys(ubah).length === 0;
    }
    function teks(kunci, label, bantuan, atribut) {
      var k = kotak(atribut || { type: 'text' });
      k.value = asal[kunci];
      k.addEventListener('input', function () { catat(kunci, k.value); });
      return isian(label, k, bantuan);
    }
    function panjang(kunci, label, bantuan, baris) {
      var k = kotakPanjang(asal[kunci], { rows: String(baris || 4) });
      k.addEventListener('input', function () { catat(kunci, k.value); });
      return isian(label, k, bantuan);
    }

    tSimpan.addEventListener('click', function () {
      sambilSibuk(tSimpan, 'Menyimpan…', api('pengaturan_simpan', { ubah: ubah })).then(function (r) {
        KA.kabar(r.dirapikan ? 'Tersimpan. ' + r.dirapikan + ' kartu disesuaikan dengan aturan baru.' : 'Pengaturan tersimpan');
        return api('info').then(function (i) { info = i; return api('pengaturan_baca'); });
      }).then(function (baru) { if (baru && tabAktif === 'pengaturan') gambarPengaturan(isi, baru); }, tunjukGalat);
    });

    /* Program */
    var radio = el('div', { class: 'radio', role: 'radiogroup', 'aria-label': 'Aturan stempel' });
    [['pesanan', '1 stempel per pesanan', 'Berapa pun jumlah botolnya.'], ['botol', '1 stempel per botol', 'Sisa stempel dibawa ke kartu berikutnya.']].forEach(function (o) {
      var r = el('input', { type: 'radio', name: 'aturan', value: o[0] });
      r.checked = asal.aturan_stempel === o[0];
      r.addEventListener('change', function () { if (r.checked) catat('aturan_stempel', o[0]); });
      radio.appendChild(el('label', {}, [r, el('span', {}, [o[1], el('small', { teks: o[2] })])]));
    });
    var program = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'Program' }),
      saklar('Program berjalan', 'Kalau dimatikan, stempel baru dihentikan sementara. Stempel yang ada tetap tersimpan.', asal.program_aktif === 'ya', function (v) { catat('program_aktif', v ? 'ya' : 'tidak'); }),
      el('div', { class: 'baris-isian baris-isian--dua', style: 'margin-top:14px' }, [
        teks('nama_program', 'Nama program'),
        teks('sebutan', 'Sebutan pemegang kartu')
      ]),
      el('div', { class: 'baris-isian baris-isian--dua', style: 'margin-top:14px' }, [
        teks('target_stempel', 'Stempel untuk 1 hadiah', '2 sampai 12.', { type: 'number', min: '2', max: '12', step: '1', inputmode: 'numeric' }),
        teks('teks_hadiah', 'Hadiah', 'Tampil di kartu dan pesan.')
      ]),
      el('div', { style: 'margin-top:14px' }, [el('div', { class: 'isian__label', teks: 'Aturan stempel' }), radio]),
      el('div', { class: 'baris-isian baris-isian--dua', style: 'margin-top:14px' }, [
        teks('masa_berlaku_bulan', 'Masa berlaku stempel (bulan)', '0 = tidak hangus.', { type: 'number', min: '0', max: '60', step: '1', inputmode: 'numeric' }),
        teks('angkatan_pertama', 'Angkatan Pertama', 'Sekian anggota pertama diberi tanda di kartunya. 0 = mati.', { type: 'number', min: '0', step: '1', inputmode: 'numeric' })
      ])
    ]);

    /* WhatsApp & link */
    var tautan = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'WhatsApp dan link kartu' }),
      teks('wa_admin', 'Nomor WhatsApp tujuan tombol "Pesan lagi"', 'Nomor yang menerima pesanan (nomor Laura). Contoh: 0812-3456-7890.', { type: 'tel', inputmode: 'tel', autocomplete: 'off' }),
      teks('url_kartu', 'Alamat halaman kartu', 'Terisi otomatis. Ubah hanya kalau alamat situsnya pindah.', { type: 'url', inputmode: 'url', autocomplete: 'off' }),
      el('div', { class: 'baris-isian baris-isian--dua', style: 'margin-top:14px' }, [
        teks('jeda_konfirmasi_menit', 'Tanya dulu kalau distempel lagi dalam (menit)', 'Berlaku kalau nomor pesanan kosong. 0 = mati.', { type: 'number', min: '0', max: '1440', step: '1', inputmode: 'numeric' }),
        teks('lama_tidak_beli_hari', '"Lama tidak beli" dihitung setelah (hari)', '', { type: 'number', min: '7', max: '730', step: '1', inputmode: 'numeric' })
      ])
    ]);

    /* Templat pesan */
    var templat = el('section', { class: 'papan lebar-penuh' }, [
      el('h2', { class: 'papan__judul', teks: 'Templat pesan' }),
      el('p', { class: 'keterangan', style: 'margin-bottom:14px', teks: 'Yang di dalam kurung kurawal diisi otomatis: {nama} {stempel} {sisa} {target} {hadiah} {link} {kode}.' }),
      el('div', { class: 'baris-isian baris-isian--dua' }, [
        panjang('tpl_kartu_baru', 'Kartu baru dibuat'),
        panjang('tpl_stempel_awal', 'Stempel Awal diberikan'),
        panjang('tpl_stempel', 'Stempel pembelian masuk'),
        panjang('tpl_penuh', 'Kartu penuh, hadiah ikut paket'),
        panjang('tpl_penuh_tunda', 'Kartu penuh, hadiah ditunda'),
        panjang('tpl_hadiah', 'Hadiah yang ditunda akhirnya dikirim')
      ])
    ]);

    /* Aroma */
    var aroma = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'Pilihan aroma hadiah' }),
      panjang('daftar_aroma', 'Satu aroma per baris', 'Hanya untuk memudahkan admin mengetik. Daftar ini tidak pernah tampil ke pembeli.', 5)
    ]);

    /* Admin */
    var daftarAdmin = el('div');
    d.admin.forEach(function (a) {
      var ini = a.nama === sesi.nama;
      daftarAdmin.appendChild(el('div', { class: 'admin-baris' }, [
        el('div', { class: 'admin-baris__nama' }, [a.nama, el('small', { teks: (a.peran === 'owner' ? 'Owner' : 'Admin') + (a.status !== 'aktif' ? ', nonaktif' : '') + (a.wajib_ganti_pin ? ', belum ganti PIN' : '') })]),
        el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Reset PIN', onclick: function () { bukaResetPin(a.nama, isi); } }),
        ini ? null : el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: a.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan', onclick: function (ev) {
          sambilSibuk(ev.currentTarget, '…', api('admin_ubah', { nama: a.nama, status: a.status === 'aktif' ? 'nonaktif' : 'aktif' })).then(function (baru) { KA.kabar('Tersimpan'); gambarPengaturan(isi, baru); }, tunjukGalat);
        } })
      ]));
    });
    var namaBaru = kotak({ type: 'text', maxlength: '30', autocomplete: 'off', placeholder: 'Nama admin' });
    var pinBaru = kotak({ type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'off', placeholder: 'PIN awal 6 angka' });
    var peranBaru = el('select', { class: 'isian__kotak' }, [el('option', { value: 'admin', teks: 'Admin' }), el('option', { value: 'owner', teks: 'Owner' })]);
    var tTambah = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', teks: 'Tambah admin' });
    tTambah.addEventListener('click', function () {
      sambilSibuk(tTambah, 'Menambah…', api('admin_tambah', { nama: namaBaru.value, pin: pinBaru.value, peran: peranBaru.value })).then(function (baru) { KA.kabar('Admin ditambahkan'); gambarPengaturan(isi, baru); }, tunjukGalat);
    });
    var admin = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'Admin' }),
      daftarAdmin,
      el('div', { class: 'baris-isian baris-isian--dua', style: 'margin-top:14px' }, [isian('Nama', namaBaru), isian('PIN awal', pinBaru, 'Wajib diganti saat pertama masuk.')]),
      el('div', { style: 'margin-top:14px' }, [isian('Peran', peranBaru, 'Owner bisa melihat Ringkasan dan mengubah Pengaturan.')]),
      el('div', { style: 'margin-top:14px' }, [tTambah])
    ]);

    /* Otomatis */
    var kunciTampil = false;
    var kodeKunci = el('code', { teks: '••••••••••••••••••••' });
    var tLihat = el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Lihat', onclick: function () { kunciTampil = !kunciTampil; kodeKunci.textContent = kunciTampil ? d.kunci_api : '••••••••••••••••••••'; tLihat.textContent = kunciTampil ? 'Tutup' : 'Lihat'; } });
    var otomatis = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'Stempel otomatis (Laura / n8n)' }),
      saklar('Pintu otomatis', 'Kalau nyala, alur pesanan di n8n bisa menambah stempel sendiri saat pesanan dikonfirmasi.', asal.otomatis_aktif === 'ya', function (v) { catat('otomatis_aktif', v ? 'ya' : 'tidak'); }),
      el('div', { style: 'margin-top:14px' }, [
        el('div', { class: 'isian__label', teks: 'Alamat API' }),
        el('div', { class: 'rahasia' }, [el('code', { teks: d.url_api || (KA.config && KA.config.api) || '(alamat Web App Apps Script)' }), el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Salin', onclick: function () { KA.salin(d.url_api || (KA.config && KA.config.api) || '').then(function () { KA.kabar('Alamat disalin'); }); } })])
      ]),
      el('div', { style: 'margin-top:14px' }, [
        el('div', { class: 'isian__label', teks: 'Kunci API' }),
        el('div', { class: 'rahasia' }, [kodeKunci, tLihat, el('button', { class: 'tombol tombol--garis tombol--kecil', type: 'button', teks: 'Salin', onclick: function () { KA.salin(d.kunci_api).then(function () { KA.kabar('Kunci disalin'); }); } })]),
        el('p', { class: 'isian__bantuan', teks: 'Siapa pun yang memegang kunci ini bisa menambah stempel. Simpan hanya di n8n.' })
      ]),
      el('div', { style: 'margin-top:12px' }, [el('button', { class: 'tombol tombol--teks tombol--kecil', type: 'button', teks: 'Buat kunci baru', onclick: function () {
        var lembar;
        var ya = el('button', { class: 'tombol tombol--bahaya tombol--penuh', type: 'button', teks: 'Buat kunci baru' });
        var tidak = el('button', { class: 'tombol tombol--garis tombol--penuh', type: 'button', 'data-fokus': true, teks: 'Tidak jadi' });
        tidak.addEventListener('click', function () { lembar.tutup(); });
        ya.addEventListener('click', function () {
          sambilSibuk(ya, 'Membuat…', api('kunci_api_baru')).then(function () { return api('pengaturan_baca'); }).then(function (baru) { lembar.tutup(); KA.kabar('Kunci baru dibuat'); gambarPengaturan(isi, baru); }, tunjukGalat);
        });
        lembar = KA.lembar(el('div', {}, [
          el('h2', { class: 'lembar__judul', teks: 'Buat kunci API baru?' }),
          el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Kunci lama langsung tidak berlaku. Alur di n8n harus diisi kunci yang baru, kalau tidak stempel otomatis berhenti.' })]),
          el('div', { class: 'lembar__aksi' }, [tidak, ya])
        ]));
      } })])
    ]);

    /* Data contoh (bagian bawah panel Perawatan) */
    var contoh = el('div', { class: 'papan__sub' }, [
      el('h3', { class: 'papan__judul', teks: 'Data contoh' }),
      el('p', { class: 'keterangan', style: 'margin-bottom:14px', teks: 'Lima puluh pelanggan rekaan untuk mencoba tampilan. Semua bertanda Contoh dan bisa dihapus tanpa menyentuh data asli.' }),
      el('div', { class: 'tindak__dua' }, [
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Isi data contoh', onclick: function (ev) { sambilSibuk(ev.currentTarget, 'Mengisi…', api('isi_contoh')).then(function (r) { KA.kabar(r.ditambah ? r.ditambah + ' pelanggan contoh ditambahkan' : 'Data contoh sudah ada'); }, tunjukGalat); } }),
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Hapus data contoh', onclick: function (ev) { sambilSibuk(ev.currentTarget, 'Menghapus…', api('hapus_contoh')).then(function (r) { KA.kabar(r.dihapus ? 'Data contoh dihapus' : 'Tidak ada data contoh'); }, tunjukGalat); } })
      ])
    ]);

    /* Perawatan: yang di spreadsheet biasanya ada di menu, di sini bisa dijalankan dari HP */
    var perawatan = el('section', { class: 'papan' }, [
      el('h2', { class: 'papan__judul', teks: 'Perawatan' }),
      el('p', { class: 'keterangan', style: 'margin-bottom:14px', teks: 'Tes sistem mencoba semua langkah dengan satu pelanggan uji, lalu menghapusnya lagi. Periksa saldo mencocokkan jumlah stempel tiap kartu dengan buku transaksi.' }),
      el('div', { class: 'tindak__dua' }, [
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Tes sistem', onclick: function (ev) {
          sambilSibuk(ev.currentTarget, 'Mengetes…', api('tes_sistem', {}, { batas: 180000 })).then(function (r) { bukaHasilTes(r.hasil); }, tunjukGalat);
        } }),
        el('button', { class: 'tombol tombol--garis', type: 'button', teks: 'Periksa saldo', onclick: function (ev) {
          sambilSibuk(ev.currentTarget, 'Memeriksa…', api('periksa_saldo', {}, { batas: 120000 })).then(function (r) {
            KA.kabar(r.diperbaiki ? r.diperbaiki + ' kartu dibetulkan supaya cocok dengan buku transaksi' : 'Semua saldo cocok dengan buku transaksi');
          }, tunjukGalat);
        } })
      ]),
      d.url_buku ? el('div', { style: 'margin-top:14px' }, [
        el('a', { class: 'tombol tombol--garis tombol--penuh', href: d.url_buku, target: '_blank', rel: 'noopener', teks: 'Buka spreadsheet data' }),
        el('p', { class: 'isian__bantuan', teks: 'Hanya terbuka di akun Google pemilik spreadsheet.' })
      ]) : null,
      contoh
    ]);

    isi.appendChild(el('div', { class: 'atur' }, [program, tautan, templat, aroma, admin, otomatis, perawatan]));
    isi.appendChild(bar);
    isi.appendChild(el('p', { class: 'keterangan', style: 'margin-top:18px', teks: 'Kartu Aura versi ' + d.versi + '. Perubahan langsung di tab Pengaturan pada spreadsheet baru terbaca setelah sekitar 2 menit.' }));
  }

  // Hasil "Tes sistem": satu baris per langkah, dan satu kalimat penutup.
  function bukaHasilTes(teks) {
    var baris = String(teks || '').split('\n').filter(function (b) { return b.trim() !== ''; });
    var lulus = false, penutup = '', langkah = [];
    baris.forEach(function (b) {
      if (b.indexOf('OK') === 0) langkah.push({ nama: b.replace(/^OK\s+/, ''), gagal: false });
      else if (b.indexOf('GAGAL') === 0) langkah.push({ nama: b.replace(/^GAGAL\s+/, ''), gagal: true });
      else { penutup = b; if (b.indexOf('SEMUA TES LULUS') === 0) lulus = true; }
    });
    var lembar;
    var tutup = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', 'data-fokus': true, teks: 'Tutup' });
    tutup.addEventListener('click', function () { lembar.tutup(); });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: lulus ? 'Semua tes lulus' : 'Tes berhenti di tengah' }),
      el('div', { class: 'lembar__isi' }, [el('p', { class: lulus ? '' : 'galat-teks', teks: lulus ? langkah.length + ' langkah dicoba. Baris uji sudah dibersihkan.' : (penutup.replace(/^BERHENTI:\s*/, '') || 'Server tidak mengirim hasil.') + ' Kirim tangkapan layar ini ke yang memasang sistem.' })]),
      el('ul', { class: 'hasil-tes' }, langkah.map(function (l) { return el('li', { class: l.gagal ? 'gagal' : '', teks: (l.gagal ? 'Gagal: ' : '') + l.nama }); })),
      el('div', { class: 'lembar__aksi' }, [tutup])
    ]));
  }

  function bukaResetPin(nama, isi) {
    var lembar;
    var pin = kotak({ type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'off', placeholder: '6 angka', 'data-fokus': true });
    var ya = el('button', { class: 'tombol tombol--emas tombol--penuh', type: 'button', teks: 'Reset PIN' });
    ya.addEventListener('click', function () {
      sambilSibuk(ya, 'Menyimpan…', api('admin_reset_pin', { nama: nama, pin: pin.value })).then(function (baru) {
        lembar.tutup(); KA.kabar('PIN ' + nama + ' di-reset');
        if (nama === sesi.nama) { keluar('PIN-mu baru saja di-reset. Masuk lagi dengan PIN baru.'); return; }
        gambarPengaturan(isi, baru);
      }, tunjukGalat);
    });
    lembar = KA.lembar(el('div', {}, [
      el('h2', { class: 'lembar__judul', teks: 'Reset PIN ' + nama }),
      el('div', { class: 'lembar__isi' }, [el('p', { teks: 'Beri PIN sementara. ' + nama + ' akan diminta membuat PIN sendiri saat masuk berikutnya, dan semua sesi lamanya langsung keluar.' })]),
      el('div', { style: 'margin-top:16px' }, [isian('PIN sementara', pin)]),
      el('div', { class: 'lembar__aksi' }, [ya])
    ]));
  }

  var TAB = { stempel: tabStempel, pelanggan: tabPelanggan, aktivitas: tabAktivitas, ringkasan: tabRingkasan, pengaturan: tabPengaturan };

  /* ---------- mulai ---------- */

  // Dipakai halaman demo untuk memberi tahu Meja bahwa data berubah dari luar.
  window.addEventListener('message', function (e) { if (e.data && e.data.jenis === 'ka-segarkan' && sesi && st.terpilih && tabAktif === 'stempel') muatRinci(); });

  if (sesi && sesi.sesi) layarUtama(); else layarMasuk('');
})();
