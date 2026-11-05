// Memuat apps-script/Code.gs ke dalam "kotak pasir" Node dengan tiruan layanan Google.
// Dipakai tes otomatis dan server lokal.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const buatTiruanGas = require('../src/tiruan-gas.js');
const { bangunCodeGs } = require('./bangun.js');

function muatServer(opsi = {}) {
  const jam = { geser: 0, tetap: opsi.waktu ? new Date(opsi.waktu).getTime() : null };
  jam.now = () => (jam.tetap !== null ? jam.tetap : Date.now()) + jam.geser;
  const gas = buatTiruanGas({ jam, ui: !!opsi.ui, urlApi: opsi.urlApi || '', ...(opsi.tiruan || {}) });

  // Date di dalam kotak pasir mengikuti jam tiruan, supaya waktu bisa dimajukan di tes.
  class Tanggal extends Date {
    constructor(...a) { if (a.length === 0) super(jam.now()); else super(...a); }
    static now() { return jam.now(); }
  }
  const ctx = vm.createContext({
    SpreadsheetApp: gas.SpreadsheetApp, LockService: gas.LockService, CacheService: gas.CacheService, PropertiesService: gas.PropertiesService,
    Utilities: gas.Utilities, ContentService: gas.ContentService, ScriptApp: gas.ScriptApp, Logger: gas.Logger, Charts: gas.Charts,
    console: opsi.diam ? { log() {}, error() {}, warn() {} } : console, Date: Tanggal
  });
  const kode = opsi.kode || bangunCodeGs();
  new vm.Script(kode, { filename: 'Code.gs' }).runInContext(ctx);

  // Di Apps Script, tiap eksekusi (satu permintaan web, satu kali Run, satu pemicu) mulai dari variabel global yang kosong.
  function eksekusiBaru() { ctx.BUKU_ = null; }
  // Menjalankan satu fungsi publik sebagai eksekusi tersendiri, seperti menekan Run di editor atau pemicu yang menyala.
  function jalankan(nama, ...argumen) { eksekusiBaru(); return ctx[nama](...argumen); }
  function panggil(aksi, data = {}) {
    eksekusiBaru();
    const keluar = ctx.doPost({ postData: { contents: JSON.stringify({ aksi, ...data }) } });
    return JSON.parse(keluar.getContent());
  }
  // Seperti panggil, tapi melempar galat kalau server menjawab ok:false.
  function minta(aksi, data = {}) {
    const j = panggil(aksi, data);
    if (!j.ok) { const e = new Error(j.pesan + (j.rinci ? ' — ' + j.rinci : '')); e.kode = j.kode; e.data = j.data; throw e; }
    return j.data;
  }
  function lembar(nama) {
    const l = gas._buku.getSheetByName(nama);
    return l ? l._nilai.filter((r) => r && r.some((v) => v !== '' && v !== undefined)) : null;
  }
  return { ctx, gas, jam, panggil, minta, lembar, jalankan, maju(ms) { jam.geser += ms; } };
}

module.exports = { muatServer };
