// Membuat demo/demo-kartu-aura.html: satu halaman yang menjalankan Kartu Pembeli dan Meja Stempel yang ASLI
// berdampingan, dengan Code.gs yang sama berjalan di atas tiruan layanan Google di dalam browser.
// Halaman ini dipakai untuk memperlihatkan sistemnya tanpa memasang apa pun. Jalankan: npm run bangun
const fs = require('fs');
const path = require('path');
const akar = path.join(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(akar, p), 'utf8');

// Isi <script> tidak boleh memuat "</script" atau "<!--" mentah.
function amanSkrip(s, nama) {
  if (s.indexOf('<!--') >= 0) throw new Error(nama + ' memuat "<!--", tidak aman ditaruh di dalam <script>');
  return s.replace(/<\/script/gi, '<\\/script');
}

function bangunDemo() {
  const { bangunCodeGs } = require('./bangun.js');
  const kode = bangunCodeGs();

  const huruf = [
    ['Cormorant Garamond', 'normal', '300 700', 'cormorant-garamond.woff2'],
    ['Cormorant Garamond', 'italic', '300 700', 'cormorant-garamond-miring.woff2'],
    ['Plus Jakarta Sans', 'normal', '200 800', 'plus-jakarta-sans.woff2']
  ].map(([keluarga, gaya, berat, berkas]) => {
    const b64 = fs.readFileSync(path.join(akar, 'situs/aset/huruf', berkas)).toString('base64');
    return '@font-face{font-family:"' + keluarga + '";src:url(data:font/woff2;base64,' + b64 + ') format("woff2");font-weight:' + berat + ';font-style:' + gaya + ';font-display:swap}';
  }).join('\n');

  // Huruf sudah ditanam di atas, jadi @font-face yang menunjuk file dibuang dari gaya dasar.
  const dasar = baca('situs/aset/dasar.css').replace(/@font-face\s*\{[^}]*\}\s*/g, '');
  if (dasar.indexOf('url("huruf/') >= 0) throw new Error('masih ada @font-face yang menunjuk file');

  const blok = [
    ['css-dasar', dasar], ['css-kartu', baca('situs/aset/kartu.css')], ['css-meja', baca('situs/aset/meja.css')],
    ['js-api', baca('situs/aset/api.js')], ['js-kartu', baca('situs/aset/kartu.js')], ['js-meja', baca('situs/aset/meja.js')]
  ].map(([id, isi]) => '<script type="text/plain" id="' + id + '">' + amanSkrip(isi, id) + '</script>').join('\n');

  const cadangan = [
    ['cadangan-meja.jpg', 'Meja Stempel: admin mencari pembeli lalu menekan Stempel.'],
    ['cadangan-kartu.jpg', 'Kartu yang dibuka pembeli dari link di chat WhatsApp.']
  ].filter(([berkas]) => fs.existsSync(path.join(akar, 'demo', berkas))).map(([berkas, ket]) =>
    '<figure><img alt="' + ket + '" src="data:image/jpeg;base64,' + fs.readFileSync(path.join(akar, 'demo', berkas)).toString('base64') + '"><figcaption>' + ket + '</figcaption></figure>'
  ).join('');

  let html = baca('demo/kerangka.html');
  const tukar = (tanda, isi) => {
    if (html.split(tanda).length !== 2) throw new Error('penanda ' + tanda + ' harus ada tepat satu kali');
    html = html.split(tanda).join(isi);
  };
  tukar('/*@HURUF*/', huruf);
  tukar('<!--@BLOK-->', blok);
  tukar('<!--@CADANGAN-->', cadangan);
  tukar('/*@LOGO*/', amanSkrip(baca('situs/aset/logo.js'), 'logo.js'));
  tukar('/*@TIRUAN*/', amanSkrip(baca('src/tiruan-gas.js'), 'tiruan-gas.js'));
  tukar('/*@SERVER*/', amanSkrip(kode, 'Code.gs'));

  const keluar = path.join(akar, 'demo/demo-kartu-aura.html');
  fs.writeFileSync(keluar, html);
  console.log('demo/demo-kartu-aura.html dibuat (' + Math.round(html.length / 1024) + ' KB)');
  return keluar;
}

if (require.main === module) bangunDemo();
module.exports = { bangunDemo };
