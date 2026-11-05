# Kartu Aura

Kartu stempel digital APB untuk pembelian parfum lewat WhatsApp.
Bawaan: 5 stempel = 1 Parfum Aura gratis. Angkanya bisa diubah di Pengaturan.

## Isinya

| Bagian | Dipakai oleh | Letaknya |
|---|---|---|
| Kartu Pembeli | pembeli, dari link di chat WhatsApp | `situs/kartu/` |
| Meja Stempel | admin dan Owner | `situs/meja/` |
| Server | berjalan di Google, tidak perlu dijaga | `apps-script/Code.gs` |
| Data dan laporan | Owner | Google Sheet `Kartu Aura - Data` (tab Pelanggan, Transaksi, Admin, Pengaturan, Ringkasan) |
| Demo | siapa saja yang mau mencoba | `demo/demo-kartu-aura.html` |

Tidak ada biaya bulanan. Semuanya memakai Google Sheets, Google Apps Script, dan GitHub Pages yang gratis.

## Memasang dari nol

Perlu sekitar 15 menit. Bagian A dikerjakan pemilik akun Google. Bagian B dikerjakan lewat GitHub. Bagian C dikerjakan Owner dari HP atau laptop.

### A. Server (Google Apps Script)

1. Buka **script.google.com** dengan akun Google yang dipilih Owner, lalu tekan **New project (Project baru)**. Lihat foto profil di pojok kanan atas: spreadsheet data nanti dibuat di Google Drive akun itu.
2. Hapus semua isi `Code.gs` (atau `Kode.gs`) di sana, lalu tempel seluruh isi file `apps-script/Code.gs` dari paket ini. Simpan (Ctrl+S).
3. Di sebelah tombol **Run (Jalankan)**, pastikan fungsi yang terpilih **`pasang`**. Letaknya paling atas di daftar. Tekan **Run**.
4. Google meminta izin. Pilih akun, lalu **Advanced (Lanjutan) > Go to ... (unsafe) > Allow (Izinkan)**. Kalau ada daftar kotak izin, **centang semuanya**. Peringatan itu muncul karena skripnya buatan sendiri, bukan dari toko aplikasi. Izin yang diminta:
   - melihat dan mengelola spreadsheet di akun itu. Tulisannya "semua spreadsheet", tetapi skrip hanya membuat dan membuka satu file, yaitu `Kartu Aura - Data`;
   - berjalan saat Owner tidak sedang membuka apa pun (untuk tugas harian);
   - menampilkan menu dan pesan di spreadsheet.

   Izin ini diberikan ke skrip milik akun itu sendiri. Tidak ada orang lain yang mendapat akses.
5. Setelah selesai, **Execution log (Log eksekusi)** di bagian bawah menampilkan `Kartu Aura terpasang` dan alamat spreadsheet datanya. Di Google Drive akun itu muncul file **Kartu Aura - Data** berisi 5 tab.
6. Tekan **Deploy (Terapkan) > New deployment (Deployment baru)**. Tekan ikon gerigi, pilih jenis **Web app (Aplikasi web)**, lalu isi:
   - Execute as (Jalankan sebagai): **Me (Saya)**
   - Who has access (Yang memiliki akses): **Anyone (Siapa saja)**
7. Tekan **Deploy**. Salin **Web app URL** yang berakhiran `/exec`. Alamat inilah yang dipakai di bagian B.
8. Buka alamat `/exec` itu di browser. Yang benar tampil seperti ini:

   ```
   {"ok":true,"data":{"layanan":"Kartu Aura","versi":"1.1.0","buku":true,"terpasang":true}}
   ```

   Kalau `"buku"` atau `"terpasang"` bernilai `false`, lihat tabel **Kalau ada masalah** di bawah.

"Anyone" di langkah 6 berarti halaman kartu dan Meja Stempel boleh memanggil server. Isi spreadsheet tetap tidak bisa dibuka orang lain. Jangan membagikan spreadsheet ke siapa pun selain Owner.

**Cara lain: skrip menempel di sebuah Google Sheet.** Buat Google Sheet, buka **Extensions (Ekstensi) > Apps Script**, tempel `Code.gs`, lalu lanjutkan dari langkah 3. Sheet itulah yang dipakai, tidak ada spreadsheet baru yang dibuat, dan setelah dimuat ulang sheet itu punya menu **Kartu Aura**. Kalau menu Extensions tidak mau membuka Apps Script, pakai cara utama di atas.

### B. Situs (GitHub Pages)

1. Buat repo GitHub baru, misalnya `kartu-aura`, lalu masukkan isi paket ini.
2. Buka `situs/aset/config.js`, isi `api` dengan alamat `/exec` dari langkah A7.
3. Di repo: **Settings > Pages > Source = GitHub Actions**. Berkas `.github/workflows/pages.yml` menerbitkan folder `situs/` setiap ada perubahan.
4. Alamat situsnya menjadi `https://<akun>.github.io/kartu-aura/`.
   - Meja Stempel: `.../kartu-aura/meja/`
   - Kartu Pembeli: `.../kartu-aura/kartu/#<kode rahasia tiap pembeli>`

### C. Menyalakan

1. Buka alamat Meja Stempel. Masuk sebagai **Owner** dengan PIN **123456**. PIN langsung wajib diganti.
2. Buka tab **Pengaturan**:
   - periksa **Nomor WhatsApp** tujuan tombol "Pesan lagi". Nomor Laura sudah terisi; ganti di sini kalau nomornya berubah,
   - periksa **Alamat halaman kartu** (terisi sendiri),
   - tambahkan admin yang akan menstempel. PIN awal mereka juga wajib diganti saat pertama masuk.
3. Masih di Pengaturan, di bagian **Perawatan**, tekan **Tes sistem**. Hasilnya harus **Semua tes lulus**. Tes ini membuat satu pelanggan uji, menjalankan semua langkah, lalu menghapusnya lagi.
4. Coba dengan nomor sendiri: buat kartu, beri Stempel Awal, buka link kartunya di HP.

## Memperbarui

| Yang berubah | Caranya |
|---|---|
| Tampilan (folder `situs/`) | Kirim perubahan ke repo. Terbit sendiri dalam 1 sampai 2 menit. |
| Server (`Code.gs`) | Tempel ulang isinya di Apps Script, lalu **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. |

Untuk server, selalu pakai **Manage deployments**, jangan **New deployment**. New deployment menghasilkan alamat baru, sehingga situs kehilangan sambungan.

Nomor versi di `?v=110` pada `situs/kartu/index.html` dan `situs/meja/index.html` dinaikkan setiap tampilan berubah, supaya HP pembeli tidak memakai file lama.

## Mencoba di laptop tanpa Google

Perlu Node.js 20 atau lebih baru. Tidak ada yang perlu di-install selain itu.

```
npm test          # tes aturan stempel dan server
npm run jalan     # http://localhost:8787/meja/  (Owner, PIN 123456)
npm run bangun    # membuat ulang apps-script/Code.gs dan demo
```

`Code.gs` dibuat dari `src/inti.js` (aturan) dan `src/server.js` (penghubung ke Google Sheets). Ubah sumbernya, jangan `Code.gs`-nya.

## Yang perlu diketahui

**Data**
- Tab **Transaksi** adalah buku besar. Baris hanya ditambah, tidak pernah diubah. Pembatalan dicatat sebagai baris baru.
- Tab **Pelanggan** adalah keadaan terakhir tiap kartu. Kalau ada yang tidak cocok, tombol **Periksa saldo** di Meja Stempel > Pengaturan > Perawatan membetulkannya dari buku besar.
- Spreadsheet data bisa dibuka dari Meja Stempel > Pengaturan > Perawatan > **Buka spreadsheet data**, atau dicari di Google Drive dengan nama `Kartu Aura - Data`. Namanya boleh diganti dan filenya boleh dipindah folder. Jangan dihapus.
- Tab **Ringkasan** ditulis ulang otomatis setiap hari (sekitar pukul 01.00 WIB) dan setiap spreadsheet dibuka.
- Jangan mengubah urutan atau judul kolom di tab Pelanggan, Transaksi, Admin, dan Pengaturan. Menambah tab sendiri boleh.
- Jangan mengurutkan (sort), menyisipkan, atau menghapus baris di tab Pelanggan dan Transaksi. Kalau ingin mengolah datanya, salin dulu ke tab lain. Kalau telanjur diurutkan, stempel tidak hilang: sistem membaca urutan dari waktunya, bukan dari letak barisnya.
- Nilai di tab Pengaturan boleh diubah langsung. Perubahannya terbaca setelah sekitar 2 menit.

**Cadangan**
- Google Sheets menyimpan riwayat sendiri: **File > Version history**.
- Sebulan sekali, buat salinan lewat **File > Make a copy**. Skrip tidak membuat salinan otomatis, karena membersihkan salinan lama butuh izin ke seluruh Google Drive.

**Keamanan**
- PIN admin tidak disimpan apa adanya. Yang disimpan hanya hasil pengacakannya, yang tidak bisa dibalik menjadi PIN. Lima kali salah PIN mengunci nama itu 15 menit.
- Tiap kartu punya kode rahasia panjang di link-nya. Siapa pun yang memegang link bisa melihat kartu itu, tetapi tidak bisa menambah stempel.
- Kartu hanya menampilkan nama, nomor WhatsApp yang disamarkan, dan riwayat stempel.
- Pembeli menyetujui penyimpanan datanya saat pertama membuka kartu, dan bisa menghapus datanya sendiri dari kartu.
- Kunci API untuk stempel otomatis ada di Meja Stempel > Pengaturan. Simpan hanya di n8n.

**Batas**
- Apps Script untuk akun Gmail biasa: 6 menit per proses, 30 proses bersamaan, pemicu harian 90 menit per hari ([sumber](https://developers.google.com/apps-script/guides/services/quotas)). Pemakaian Kartu Aura jauh di bawah itu.
- Tiap permintaan biasanya butuh 1 sampai 3 detik, karena server Google perlu "bangun" dulu.
- Nyaman sampai sekitar 20.000 baris Transaksi. Kalau sudah mendekati, pindahkan baris lama ke spreadsheet arsip.

## Kalau ada masalah

| Gejala | Sebab yang paling sering | Perbaikan |
|---|---|---|
| Meja Stempel: "Server tidak bisa dihubungi" | `config.js` belum diisi, atau deployment bukan "Anyone" | Periksa langkah A6 dan B2 |
| Meja Stempel: "Server belum dipasang" | Fungsi `pasang` belum dijalankan | Jalankan `pasang` (langkah A3) |
| Kartu: "Kartu tidak ditemukan" | Link terpotong saat disalin, atau data pembeli sudah dihapus | Kirim ulang link dari Meja Stempel |
| Link kartu di pesan kosong | Alamat halaman kartu belum terisi | Owner masuk Meja Stempel sekali, atau isi di Pengaturan |
| Setelah `Code.gs` diganti, tidak ada yang berubah | Lupa membuat versi baru. Web app memakai versi yang di-deploy, sedangkan menu dan tombol Run memakai kode terakhir yang disimpan | Deploy > Manage deployments > Edit > New version |
| Alamat `/exec` menampilkan `"buku":false` atau `"terpasang":false` | Fungsi `pasang` belum dijalankan | Jalankan `pasang` (langkah A3) |
| `"buku":false` padahal `pasang` sudah pernah dijalankan, atau muncul "Spreadsheet data sedang tidak bisa dibuka" | File `Kartu Aura - Data` dihapus permanen, atau akun itu kehilangan aksesnya | Kalau filenya masih ada di Sampah Google Drive, pulihkan. Kalau benar-benar hilang: di Apps Script buka **Project Settings > Script Properties**, hapus baris `ID_BUKU`, lalu jalankan `pasang`. Ini membuat spreadsheet baru yang kosong. Skrip tidak pernah melakukannya sendiri |
| Versi di alamat `/exec` masih versi lama | File yang ditempel masih yang lama, atau belum dibuat versi baru | Tempel `Code.gs` terbaru, lalu Deploy > Manage deployments > Edit > New version |
| Alamat server malah membuka halaman login Google | Yang disalin alamat `/dev`, atau akses deployment bukan "Anyone" | Pakai alamat `/exec`, dan periksa langkah A6 |
| Izin gagal, muncul halaman kosong saat menekan Run, atau Apps Script tidak mau terbuka dari menu Extensions | Browser sedang masuk ke beberapa akun Google sekaligus | Buka script.google.com di jendela penyamaran (incognito) dengan satu akun saja, lalu ulangi |
| Tidak ada menu **Kartu Aura** di spreadsheet | Skrip yang berdiri sendiri memang tidak bisa menambah menu | Pakai Meja Stempel > Pengaturan > Perawatan. Isinya sama |
| Hasil `pasang` menyebut "Tugas harian belum terpasang" | Ada izin yang tidak dicentang | Jalankan `pasang` lagi dan centang semua izin. Tanpa tugas harian pun stempel tetap jalan dan Ringkasan di Meja Stempel tetap benar. Yang tertinggal hanya tab Ringkasan di spreadsheet |
| Lupa PIN admin | | Owner: Pengaturan > Reset PIN |
| Lupa PIN Owner | | Di Apps Script, pilih fungsi `resetPinOwner` lalu tekan Run. PIN Owner kembali 123456 dan wajib diganti saat masuk |

## Dokumen lain

- `PANDUAN-ADMIN.md`: cara pakai harian untuk admin.
- `KEPUTUSAN.md`: alasan di balik rancangan ini.
