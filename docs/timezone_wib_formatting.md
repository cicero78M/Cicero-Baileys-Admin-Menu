# Timezone WIB untuk Formatter Tanggal/Jam

Dokumen ini menjelaskan standar formatter tanggal/jam setelah sentralisasi util timezone ke `src/utils/dateJakarta.js`.

## Latar belakang

Sebelumnya beberapa modul report menggunakan `new Date().toLocaleDateString()` / `toLocaleTimeString()` tanpa `timeZone` eksplisit. Pada environment server non-WIB, tanggal/jam report bisa bergeser dan menyebabkan mismatch data harian.

## Util terpusat

Gunakan util berikut:

- `formatJakartaDisplayDate(date, options)` → tampilan tanggal report (`id-ID`) dengan timezone default `Asia/Jakarta`.
- `formatJakartaDisplayTime(date, options)` → tampilan jam report (`id-ID`) dengan timezone default `Asia/Jakarta`.
- `formatJakartaQueryDateKey(date)` → key tanggal query harian (`en-CA`, format `YYYY-MM-DD`) dengan timezone `Asia/Jakarta`.

File sumber: `src/utils/dateJakarta.js`.

## Modul yang sudah disinkronkan

- `src/handler/fetchabsensi/insta/absensiLikesInsta.js`
  - Seluruh formatter tanggal/jam narasi report dipindahkan ke util timezone terpusat.
  - Narasi report ditambah baris periode: `Periode: hari ini (WIB)`.
- `src/service/jajaranAttendanceService.js`
  - Formatter TikTok jajaran memakai util timezone terpusat.
  - Header formatter Instagram/TikTok menegaskan periode: `hari ini (WIB)`.
- `src/utils/attendanceOperationalDate.js`
  - Query date key dan formatter tampilan menggunakan util timezone terpusat agar konsisten.

## Panduan troubleshooting

Jika report harian terlihat bergeser tanggal:

1. Verifikasi kode tidak lagi memanggil `toLocaleDateString`/`toLocaleTimeString` secara langsung untuk report.
2. Pastikan helper yang dipakai berasal dari `dateJakarta.js`.
3. Pastikan narasi report mencantumkan periode `hari ini (WIB)` untuk mengurangi ambigu waktu operasional.
