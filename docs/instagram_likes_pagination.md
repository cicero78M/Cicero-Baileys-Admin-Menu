# Instagram Likes Pagination via RapidAPI

Dokumen ini menjelaskan cara kerja pengambilan likes Instagram berbasis RapidAPI pada service `instaRapidService` dan langkah untuk memastikan seluruh data likes pada satu konten dapat diambil (tidak berhenti di sekitar 1.058 username).

## Endpoint yang digunakan

Service memakai endpoint RapidAPI berikut:

- `GET /v1/likes`
- Query utama: `code_or_id_or_url` (shortcode, id, atau URL post)
- Query paginasi: `cursor`

Response dibaca dari:

- `data.items`: daftar user yang me-like
- `data.next_cursor`/`data.end_cursor`: token halaman berikutnya
- `data.has_more`: indikator ada halaman lanjutan

## Penyebab data likes berhenti sebelum lengkap

Secara umum, data likes berhenti di angka tertentu jika:

1. Proses paginasi dibatasi `maxPage`.
2. Cursor tidak dipakai untuk request berikutnya.
3. Request antar halaman terlalu agresif sehingga terkena throttling/intermiten error.
4. Provider RapidAPI memang mengembalikan data parsial untuk post tertentu.

## Perubahan implementasi

Perubahan pada module `src/service/instaRapidService.js`:

1. Menambahkan resolver batas halaman `resolveLikesMaxPages(maxPage)`.
2. Menambahkan helper penghentian paginasi `shouldStopLikesPagination(...)`.
3. `fetchAllInstagramLikes` dan `fetchAllInstagramLikesItems` sekarang default `maxPage = 0` (tanpa batas internal), sehingga paginasi berjalan sampai `has_more=false` atau `cursor` habis.
4. Menambahkan delay antar halaman (`1200ms`) untuk mengurangi risiko rate-limit.
5. Menambahkan debug log per halaman saat `DEBUG_FETCH_INSTAGRAM=true`.
6. `fetchAllInstagramComments` sekarang default `maxPage = 0` (tanpa batas internal) dengan pola stop yang sama seperti likes (`has_more=false`, token habis, atau limit eksplisit), sehingga data komentar bisa dipakai sebagai sumber pelengkap username.

Perubahan pada module `src/handler/fetchengagement/fetchLikesInstagram.js`:

1. Pipeline `fetchAndStoreLikes(shortcode)` sekarang mengambil dua sumber data dari RapidAPI yang sama:
   - likes via `fetchAllInstagramLikes(shortcode)`
   - komentar via `fetchAllInstagramComments(shortcode, 0)`
2. Username dari komentar diekstrak dari `comment.user.username` (dengan fallback ke `comment.username`/`comment.owner.username`), lalu dinormalisasi (`trim`, hapus `@`, lowercase).
3. Username likes + username komentar digabung, dideduplikasi, lalu tetap digabung dengan data likes existing di tabel `insta_like` sebelum upsert.
4. Hasil akhirnya tetap disimpan di kolom `insta_like.likes` agar modul rekap likes existing tetap kompatibel.
5. Log debug akhir sekarang menampilkan ringkasan volume likes dan komentar per shortcode.

Perubahan konfigurasi environment:

- Variabel baru: `INSTAGRAM_LIKES_MAX_PAGES`
  - `0` = tanpa batas halaman (default)
  - `>0` = batasi jumlah halaman secara eksplisit

Perubahan pada module datamining `src/handler/datamining/fetchDmLikes.js`:

- Mengubah `MAX_LIKE_PAGES` dari `100` menjadi `0` agar mengikuti mode tanpa batas (kecuali jika dibatasi lewat environment).

## Langkah operasional untuk ambil semua likes

1. Pastikan env terisi:
   - `RAPIDAPI_KEY`
   - (opsional) `RAPIDAPI_FALLBACK_KEY` dan `RAPIDAPI_FALLBACK_HOST`
2. Set `INSTAGRAM_LIKES_MAX_PAGES=0`.
3. (Opsional) set `DEBUG_FETCH_INSTAGRAM=true` untuk memantau progres tiap halaman.
4. Jalankan flow fetch likes seperti biasa (cron/manual/DM handler).
5. Verifikasi jumlah likes tersimpan di tabel `insta_like` dan/atau audit `insta_like_audit`.

## Mekanisme gabung likes + komentar (ringkas)

1. Untuk setiap shortcode, sistem fetch halaman likes hingga tuntas.
2. Untuk shortcode yang sama, sistem fetch halaman komentar hingga tuntas.
3. Sistem ekstrak username komentar, normalisasi, lalu union dengan daftar username likes.
4. Sistem union lagi dengan data likes existing (agar tidak kehilangan histori fetch sebelumnya).
5. Hasil union di-upsert ke `insta_like.likes` sebagai satu daftar username final.

## Validasi jika hasil masih parsial

Jika masih berhenti di angka tertentu:

1. Cek log debug apakah `has_more` masih `true` saat berhenti.
2. Cek apakah ada error retry berulang pada request `v1/likes`.
3. Uji manual endpoint yang sama memakai cursor terakhir untuk memastikan provider masih memberi halaman lanjutan.
4. Jika endpoint provider berhenti mengirim cursor meskipun likes publik lebih besar, tandai sebagai limitasi provider RapidAPI dan pertimbangkan provider alternatif.
