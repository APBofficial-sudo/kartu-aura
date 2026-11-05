// Menggabungkan src/inti.js + src/server.js menjadi apps-script/Code.gs (file yang ditempel ke Apps Script).
// Jalankan: npm run bangun
const fs = require('fs');
const path = require('path');
const akar = path.join(__dirname, '..');

function bangunCodeGs() {
  const inti = fs.readFileSync(path.join(akar, 'src/inti.js'), 'utf8');
  const server = fs.readFileSync(path.join(akar, 'src/server.js'), 'utf8');
  const versi = (server.match(/^var VERSI = '([^']+)';/m) || [])[1];
  if (!versi) throw new Error('Nomor versi tidak ditemukan di src/server.js');
  const kepala = [
    '/**',
    ' * KARTU AURA: kartu stempel digital Parfum Aura (APB)',
    ' * Versi ' + versi,
    ' * File ini dibuat otomatis dari src/inti.js + src/server.js. Jangan diedit di sini;',
    ' * ubah sumbernya lalu jalankan "npm run bangun".',
    ' *',
    ' * Cara pasang: lihat README.md. Singkatnya:',
    ' *   1. Tempel seluruh file ini ke proyek Apps Script (script.google.com > New project).',
    ' *   2. Jalankan fungsi "pasang". Spreadsheet datanya dibuat otomatis di Google Drive akun ini.',
    ' *   3. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).',
    ' *',
    ' * Skrip ini hanya membuka spreadsheet miliknya sendiri, walau izin yang diminta Google',
    ' * berbunyi "semua spreadsheet". Izin seluas itu diperlukan karena skripnya berdiri sendiri.',
    ' */',
    ''
  ].join('\n');
  const isi = kepala + '\n' + inti.trim() + '\n\n' + server.trim() + '\n';
  // File ini disalin-tempel oleh orang, kadang lewat editor yang salah membaca UTF-8.
  // Karena itu isinya wajib ASCII saja; huruf lain ditulis sebagai \uXXXX di sumbernya.
  isi.split('\n').forEach((baris, i) => {
    if (/[^\x00-\x7F]/.test(baris)) throw new Error('Code.gs baris ' + (i + 1) + ' memuat huruf di luar ASCII: ' + baris.trim().slice(0, 80));
  });
  fs.mkdirSync(path.join(akar, 'apps-script'), { recursive: true });
  fs.writeFileSync(path.join(akar, 'apps-script/Code.gs'), isi);
  return isi;
}

module.exports = { bangunCodeGs };   // sebelum blok di bawah: bangun-demo.js memanggil balik file ini

if (require.main === module) {
  const isi = bangunCodeGs();
  console.log('apps-script/Code.gs dibuat (' + isi.length + ' karakter)');
  const demo = path.join(__dirname, 'bangun-demo.js');
  if (fs.existsSync(demo)) require(demo).bangunDemo();
}
