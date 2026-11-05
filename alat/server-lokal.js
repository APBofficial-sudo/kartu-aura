// Server uji coba di laptop: menyajikan folder situs/ dan API tiruan di /api.
// API-nya menjalankan apps-script/Code.gs yang sama, di atas tiruan layanan Google (data di memori,
// disimpan ke .data-lokal.json supaya tidak hilang saat server dinyalakan ulang).
// Jalankan: npm run jalan  →  http://localhost:8787/meja/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { muatServer } = require('./muat-server.js');

const PORT = Number(process.env.PORT || 8787);
const SITUS = path.join(__dirname, '..', 'situs');
const BERKAS = process.env.DATA === 'memori' ? null : path.join(__dirname, '..', '.data-lokal.json');
const JENIS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

// Skripnya dijalankan sebagai proyek yang berdiri sendiri, sama seperti pemasangan aslinya.
const s = muatServer({ diam: false, tiruan: { berdiriSendiri: true } });
if (BERKAS && fs.existsSync(BERKAS)) { s.gas._muatKeadaan(fs.readFileSync(BERKAS, 'utf8')); console.log('Data lama dimuat dari', path.basename(BERKAS)); }
console.log(s.ctx.pasang());
function simpan() { if (BERKAS) fs.writeFileSync(BERKAS, s.gas._ambilKeadaan()); }
simpan();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api') {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(s.jalankan('doGet').getContent()); return; }
    let badan = '';
    req.on('data', (c) => { badan += c; if (badan.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const lambat = Number(process.env.LAMBAT || 0);
      setTimeout(() => {
        const keluar = s.jalankan('doPost', { postData: { contents: badan } }).getContent();
        simpan();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(keluar);
      }, lambat);
    });
    return;
  }
  // Uji coba lokal selalu memakai server tiruan di /api, apa pun isi situs/aset/config.js (yang menunjuk server asli).
  if (url.pathname === '/aset/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end("window.KA = window.KA || {};\nKA.config = { api: '' };\n");
    return;
  }
  let berkas = path.normalize(path.join(SITUS, decodeURIComponent(url.pathname)));
  if (!berkas.startsWith(SITUS)) { res.writeHead(403); res.end('dilarang'); return; }
  if (fs.existsSync(berkas) && fs.statSync(berkas).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(302, { Location: url.pathname + '/' + url.search }); res.end(); return; }
    berkas = path.join(berkas, 'index.html');
  }
  if (!fs.existsSync(berkas)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Tidak ditemukan'); return; }
  res.writeHead(200, { 'Content-Type': JENIS[path.extname(berkas)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(berkas).pipe(res);
});

server.listen(PORT, () => {
  console.log('Kartu Aura (uji coba lokal) jalan di http://localhost:' + PORT);
  console.log('  Meja Stempel : http://localhost:' + PORT + '/meja/   (Owner, PIN awal 123456)');
  console.log('  Kartu Pembeli: link-nya muncul di Meja Stempel setelah pelanggan dibuat');
});
