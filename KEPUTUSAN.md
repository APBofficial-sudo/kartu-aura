# Keputusan rancangan

Catatan singkat kenapa Kartu Aura dibuat seperti ini. Berguna kalau nanti ada yang mau mengubahnya.

## Untuk pembeli

| Keputusan | Alasan |
|---|---|
| Kartu berupa link pribadi, tanpa aplikasi dan tanpa login | Pembeli cukup mengetuk link di chat. Tidak ada kata sandi yang bisa lupa. |
| Kode rahasia kartu ditaruh di belakang tanda `#` pada link | Bagian itu tidak ikut terkirim ke server lain dan tidak tercatat di riwayat pihak ketiga. |
| Pembeli tidak bisa menambah stempel sendiri | Hanya admin (atau alur pesanan) yang menstempel. Kartu di HP pembeli hanya menampilkan. |
| Persetujuan data ditanyakan saat kartu pertama dibuka, terpisah dari syarat program | Pembeli tahu apa yang disimpan sebelum datanya ditampilkan. Buktinya tercatat sebagai satu baris transaksi. |
| "Hapus data saya" langsung berlaku | Nama dan nomor dihapus saat itu juga, tidak menunggu admin. Catatan stempel tetap ada tanpa identitas. |
| Satu muka kartu saja: segel stempel, kalimat status, dan kode kartu; aturan di lembar "Syarat & privasi" | Yang paling ingin dilihat pembeli adalah "sudah berapa". Tidak ada yang perlu dibalik atau dibuka. |
| Stempel digambar sebagai segel lilin merah berlambang APB, hadiah sebagai segel emas | Mengikuti desain "Kartu Member Digital Parfum Aura": stempel baru jatuh seperti cap lilin, terasa seperti hadiah, bukan tabel. |
| Tidak dibuat sebagai aplikasi yang "di-install" (tanpa manifest) | Supaya "Tambahkan ke layar utama" menyimpan link lengkap beserta kodenya. |
| Tidak ada poin, level, atau undian | Satu aturan saja: sekian stempel, satu hadiah. Mudah dijelaskan admin dan mudah dipercaya pembeli. |

## Untuk admin dan Owner

| Keputusan | Alasan |
|---|---|
| Google Sheets sebagai tempat data sekaligus laporan | Owner bisa membuka kapan saja tanpa meminta laporan ke siapa pun. Polanya sama dengan aplikasi stok gudang. |
| Tab Transaksi hanya ditambah, tidak pernah diubah | Setiap stempel, pembatalan, dan hadiah bisa ditelusuri: kapan, oleh siapa, dan kenapa. |
| Tab Pelanggan hanya ringkasan, bisa dibetulkan dari Transaksi | Kalau ada yang tidak sengaja mengubah angka di sheet, tombol "Periksa saldo" di Meja Stempel mengembalikannya. Tugas harian juga memeriksanya sendiri. |
| Tab Ringkasan ditulis sebagai angka, bukan rumus | Rumus mudah rusak saat baris bertambah atau ada yang mengetik di sel yang salah. |
| Bawaan 1 stempel per pesanan, bisa diganti per botol | Paling sederhana untuk admin. Pilihan per botol ada kalau Owner ingin mendorong beli banyak. |
| Stempel Awal sekali per nomor, tempat belinya dicatat | Menghargai pembelian sebelumnya, dan Owner bisa melihat dari mana pembeli WhatsApp berasal. |
| Nomor WhatsApp tujuan sudah terisi nomor Laura | Tidak ada yang perlu diketik saat memasang. Kalau nomornya berganti, Owner mengubahnya di Pengaturan tanpa menyentuh kode. |
| Hadiah dicatat terpisah: ikut paket, atau ditunda | Stok bisa kosong dan pembeli bisa belum memilih aroma. Hak pembeli tidak hilang, dan terlihat di daftar "Hadiah tertunda". |
| Nomor pesanan tidak bisa distempel dua kali | Pengaman utama terhadap stempel dobel. |
| Tanpa nomor pesanan, sistem bertanya dulu kalau pembeli yang sama distempel lagi dalam 10 menit | Pengaman kedua, untuk admin yang tidak mengisi nomor pesanan. |
| Mengulang setelah sinyal putus tidak mencatat dua kali | Tiap permintaan punya nomor sendiri. Server mengenali permintaan yang sama. |
| Pembatalan selalu untuk stempel terakhir dan wajib beralasan | Mencegah riwayat diacak, dan alasannya terbaca oleh Owner. |
| PIN 6 angka, sesi 12 jam, terkunci 15 menit setelah 5 kali salah | Cukup aman untuk dipakai di HP, tanpa merepotkan admin. |
| Sistem tidak pernah mengirim pesan sendiri | Ia hanya menyiapkan teks. Pengiriman tetap lewat WhatsApp yang sudah dipakai, sehingga jumlah pesan keluar tetap terkendali di satu tempat. |
| Tidak ada daftar aroma bawaan | Hanya Owner yang boleh mengisinya, khusus untuk memudahkan admin mengetik. Daftar itu tidak pernah tampil ke pembeli. |

## Teknis

| Keputusan | Alasan |
|---|---|
| Halaman statis di GitHub Pages, server di Google Apps Script | Gratis, tidak ada server yang harus dijaga, dan sudah pernah dipakai APB. |
| Skrip berdiri sendiri dan membuat spreadsheet datanya sendiri | Langkah pasangnya paling sedikit: tempel, jalankan `pasang`, deploy. Tidak bergantung pada menu Extensions di Google Sheets, yang bisa gagal terbuka kalau browser masuk ke beberapa akun Google. Akibatnya izin yang diminta Google berbunyi "semua spreadsheet", walau skrip hanya membuka satu file. Skrip yang menempel di sebuah sheet tetap didukung. |
| Spreadsheet dibuka lewat ID yang dicatat saat pemasangan | Berlaku sama di editor, tugas harian, dan web app. Kalau spreadsheet tidak bisa dibuka, server berhenti dengan pesan yang jelas dan tidak pernah membuat spreadsheet pengganti sendiri. |
| Perawatan (tes sistem, periksa saldo, data contoh) ada di Meja Stempel | Skrip yang berdiri sendiri tidak bisa menambah menu di spreadsheet, dan Owner lebih sering memegang HP daripada membuka editor. |
| Tidak ada cadangan otomatis | Membersihkan salinan lama butuh izin ke seluruh Google Drive. Pakai riwayat versi Google Sheets dan salinan bulanan. |
| Satu sumber aturan (`src/inti.js`) untuk server, tes, dan demo | Aturan stempel tidak bisa berbeda antara yang dites dan yang dipasang. |
| Tes berjalan di atas tiruan layanan Google yang sengaja galak | Hal yang di Google Sheets diam-diam merusak data, misalnya nomor berubah jadi angka, di tes langsung jadi galat. |
| Semua sel teks diberi format teks sebelum ditulis, dan isian yang diawali `=`, `+`, `-`, `@` diamankan | Nomor WhatsApp tidak kehilangan angka depannya, dan nama pembeli tidak bisa menjadi rumus. |
| Waktu selalu dihitung dan ditampilkan dalam WIB | Tidak bergantung pada pengaturan HP atau zona waktu spreadsheet. |
| Tulisan dipaksa tersimpan sebelum kunci dilepas | Apps Script menahan tulisan sampai akhir proses. Tanpa ini, dua permintaan yang hampir bersamaan bisa saling menimpa. |
| Urutan transaksi ditentukan oleh waktunya, bukan letak barisnya | Kalau tab Transaksi pernah diurutkan orang, saldo dan pembatalan tetap benar. Waktu transaksi satu pembeli selalu berjarak minimal 1 detik. |
| Data contoh dihapus per baris, lembarnya tidak pernah ditulis ulang | Data asli tidak ikut terancam kalau proses terputus di tengah. |
| Server melaporkan sendiri versinya dan apakah ia bisa membuka spreadsheet | Membuka alamat `/exec` langsung menunjukkan pemasangannya sehat atau tidak, dan file mana yang sedang terpasang. |
| Huruf dan ikon disimpan di situs sendiri | Halaman tetap tampil benar walau layanan huruf pihak lain lambat atau diblokir. |
| Pintu stempel otomatis sudah ada, tetapi mati sampai dinyalakan Owner | Supaya alur pesanan di n8n bisa disambungkan tanpa mengubah server lagi. |

## Yang berbeda dari rancangan awal

| Rancangan awal | Yang dibuat | Kenapa |
|---|---|---|
| Cadangan mingguan otomatis | Tidak ada | Butuh izin ke seluruh Google Drive. Diganti riwayat versi dan salinan bulanan. |
| Ringkasan memakai rumus | Ditulis oleh skrip | Lebih tahan terhadap perubahan di sheet. |
| Permintaan hapus data diproses admin | Langsung berlaku | Lebih sederhana dan tidak ada yang tertunda. |
| Kartu mendatar, stempel di balik kartu | Kartu tegak, stempel di muka, tanpa sisi balik | Lebih pas di layar HP, dan stempel langsung terlihat. |
| Sambungan n8n menyusul | Pintunya dibuat sekarang, dalam keadaan mati | Laura menjadi pintu depan WhatsApp, jadi sambungannya sudah disiapkan. |
| Skrip ditempel di dalam Google Sheet, izin hanya ke file itu | Skrip berdiri sendiri, spreadsheet dibuat oleh `pasang` | Apps Script tidak bisa dibuka dari menu Extensions di akun Owner. Cara ini juga lebih sedikit langkah, dan web app selalu bisa menemukan spreadsheet-nya. |
