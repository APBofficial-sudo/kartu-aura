// Menjalankan seluruh tes dua kali: sebagai skrip yang berdiri sendiri (cara pasang utama),
// lalu sebagai skrip yang menempel di sebuah Google Sheet. Dipanggil lewat: npm test
const { spawnSync } = require('child_process');
const path = require('path');

let gagal = 0;
for (const cara of ['berdiri', 'menempel']) {
  console.log('\n=== Skrip ' + (cara === 'berdiri' ? 'berdiri sendiri' : 'menempel di sheet') + ' ===');
  const hasil = spawnSync(process.execPath, ['--test'], { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, KA_SKRIP: cara } });
  if (hasil.status !== 0) gagal = 1;
}
process.exit(gagal);
