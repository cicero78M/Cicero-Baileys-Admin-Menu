<style>
.page-break { break-after: page; page-break-after: always; }
body { font-family: Arial, sans-serif; color: #172033; }
h1 { color: #0b2d4d; font-size: 30px; margin-top: 20px; }
h2 { color: #116466; font-size: 23px; }
h3 { color: #0b2d4d; }
blockquote { border-left: 4px solid #d69e2e; padding-left: 14px; color: #4a5568; }
strong { color: #0b2d4d; }
</style>

# CICERO
## Polres Performance & Public Communication Intelligence

### Membantu Polres melihat, menggerakkan, dan membuktikan pelaksanaan komunikasi publik

**Marketing presentation — level Polres**  
Draft: 21 September 2026

> Cicero bukan pengganti sistem resmi Polri. Cicero adalah lapisan data, workflow, rekap, dan evidence yang dapat diuji melalui pilot resmi.

<div class="page-break"></div>

# 1. Realitas kerja Polres

Polres bekerja dalam ritme yang cepat dan berlapis:

- arahan pimpinan harus turun menjadi aktivitas satuan dan personel;
- informasi publik bergerak melalui banyak akun dan kanal;
- Humas/Binmas perlu membuktikan aktivitas, bukan hanya mengirim laporan;
- pimpinan memerlukan ringkasan yang cepat, sementara operator membutuhkan detail;
- data dan akses harus mengikuti struktur organisasi serta kewenangan.

**Pertanyaan utama:**

> “Apakah pimpinan dapat melihat bukti pelaksanaan dan hasil komunikasi publik tanpa menunggu rekap manual yang panjang?”

<div class="page-break"></div>

# 2. Masalah yang biasanya terasa di Polres

### Sebelum Cicero

1. Daftar akun, post, likes, comments, dan laporan berada di tempat berbeda.
2. Rekap harian/mingguan memakan waktu operator.
3. Pimpinan menerima angka, tetapi sulit menelusuri sumbernya.
4. Tugas dan pengingat tersebar di chat.
5. Perbandingan antarperiode tidak konsisten.

### Dampaknya

- waktu rapat habis untuk menyamakan data;
- isu keterlambatan baru terlihat setelah periode berakhir;
- sulit membedakan aktivitas, kepatuhan, dan hasil;
- beban operator tinggi dan rawan salah salin.

> Ini adalah hipotesis masalah untuk divalidasi pada discovery Polres, bukan klaim statistik nasional.

<div class="page-break"></div>

# 3. Solusi Cicero untuk Polres

## Dari data menjadi tindakan

**Collect** → kumpulkan data Instagram/TikTok dan data unit  
**Map** → hubungkan akun, user, client, role, dan scope  
**Monitor** → lihat aktivitas, engagement, tren, dan status  
**Notify** → kirim pengingat/rekap melalui workflow operator  
**Report** → hasilkan dashboard Anev dan ekspor laporan  
**Decide** → pimpinan mengambil tindakan berbasis evidence

### Nilai untuk Polres

- satu pandangan untuk evaluasi;
- lebih sedikit rekap manual;
- alur kerja operator yang familiar;
- laporan dapat ditelusuri ke sumber;
- akses dapat dibatasi berdasarkan role dan scope.

<div class="page-break"></div>

# 4. Apa yang sudah tersedia di Cicero

Kemampuan yang terlihat di repository saat ini:

- **multi-client, role, dan regional scope** untuk struktur organisasi;
- **ingest Instagram dan TikTok** melalui service yang tersedia;
- **monitoring akun/media resmi Satbinmas**;
- **rekap likes, comments, engagement ranking, dan ekspor Excel**;
- **dashboard Anev** dengan filter waktu, role, scope, dan regional;
- **workflow operator melalui WhatsApp** dan notifikasi terjadwal;
- **link report/amplification recap**;
- **OTP, login log, audit, dan pembatasan akses**;
- arsitektur backend Node/Express dengan PostgreSQL, Redis, RabbitMQ, dan PM2.

**Catatan:** jumlah pengguna, customer, penghematan waktu, dan dampak kinerja belum boleh diklaim sebelum diukur melalui pilot.

<div class="page-break"></div>

# 5. Use case prioritas di Polres

## A. Dashboard pimpinan

Ringkasan periode, unit/scope, aktivitas, engagement, dan laporan yang perlu ditindaklanjuti.

## B. Humas/komunikasi publik

Daftar akun resmi, konten, distribusi link, dan rekap engagement yang lebih konsisten.

## C. Binmas/Satbinmas

Monitoring akun/media resmi serta rekap aktivitas yang dapat dibawa ke evaluasi.

## D. Operator

Input, pengingat, rekap, dan pengiriman laporan dari workflow yang lebih terstruktur.

## E. IT/security

Matriks akses, audit event, backup, data minimization, dan penilaian deployment.

> Cicero tidak diposisikan sebagai pengganti Dumas Presisi, SPKT, command center, atau sistem penegakan hukum resmi.

<div class="page-break"></div>

# 6. Demo 15 menit untuk Polres

### Menit 1–2 — konteks

Tetapkan satu masalah: misalnya rekap komunikasi publik mingguan atau monitoring akun resmi.

### Menit 3–6 — struktur

Tunjukkan client, user, role, scope, dan akun yang dipantau.

### Menit 7–10 — evidence

Tunjukkan post, likes/comments, tren, dashboard Anev, dan sumber data.

### Menit 11–13 — workflow

Tunjukkan rekap, ekspor, notifikasi, serta tindakan operator.

### Menit 14–15 — keputusan

Sepakati baseline, unit pilot, sponsor, akses data minimum, dan acceptance criteria.

<div class="page-break"></div>

# 7. Pilot Polres 30 hari

## Minggu 1 — desain

- pilih satu use case;
- tunjuk sponsor pimpinan dan owner operasional;
- petakan akun, user, role, dan data minimum;
- ukur baseline waktu rekap dan kualitas laporan.

## Minggu 2 — onboarding

- konfigurasi scope Polres;
- daftarkan operator dan akun yang disetujui;
- uji dashboard, workflow, dan akses;
- lakukan security/data review awal.

## Minggu 3 — operasi

- jalankan alur harian;
- kirim rekap terjadwal;
- catat error, keterlambatan, dan kebutuhan operator;
- review singkat dengan sponsor.

## Minggu 4 — pembuktian

- bandingkan baseline dan endline;
- validasi laporan dengan sumber;
- tutup temuan akses;
- putuskan scale, perbaikan, atau stop.

<div class="page-break"></div>

# 8. Cara mengukur hasil

### KPI pilot yang dapat diverifikasi

- **waktu membuat laporan:** baseline vs setelah Cicero;
- **ketepatan waktu:** persentase laporan dikirim sesuai jadwal;
- **kelengkapan:** field wajib terisi dan sumber dapat ditelusuri;
- **adopsi:** operator aktif mingguan dan workflow yang selesai;
- **kualitas rapat:** pertanyaan/isu yang dapat dijawab dari dashboard;
- **reliability:** error, reprocessing, dan keterlambatan data;
- **security:** temuan akses kritis yang belum terselesaikan.

### Output akhir

1. laporan hasil pilot;
2. matriks gap dan rekomendasi;
3. estimasi rollout bertahap;
4. keputusan sponsor: scale / improve / stop.

<div class="page-break"></div>

# 9. Pembagian manfaat

| Pihak | Manfaat utama |
|---|---|
| Kapolres/Wakapolres | ringkasan evidence untuk Anev dan keputusan |
| Kabag Ops/Kasat | visibility aktivitas dan tindak lanjut |
| Kasi Humas | konsistensi monitoring komunikasi publik |
| Kasat Binmas | rekap akun/media dan engagement |
| Operator | lebih sedikit pekerjaan salin-rekap |
| IT/security | akses, log, backup, dan scope yang dapat diperiksa |

**Keputusan pembelian harus tetap berbasis hasil pilot dan proses resmi**, bukan hanya kualitas demo.

<div class="page-break"></div>

# 10. Keamanan, tata kelola, dan batasan

Sebelum data production digunakan, sepakati:

- klasifikasi data dan data minimum;
- pemilik data dan tujuan penggunaan;
- role/access matrix;
- retensi, backup, dan pemusnahan;
- lokasi deployment dan SLA;
- audit log dan incident response;
- persetujuan penggunaan akun/media;
- acceptance criteria dan exit plan.

### Prinsip komersial

- tidak mengklaim aplikasi resmi Polri tanpa dokumen;
- tidak menggunakan logo atau nama pejabat sebagai endorsement;
- tidak memberikan gratifikasi atau komisi informal;
- tidak mengirim blast ke nomor pribadi tanpa dasar yang sah;
- mengikuti mekanisme pengadaan yang berlaku.

<div class="page-break"></div>

# 11. Proposal keputusan hari ini

## Kami tidak meminta keputusan pembelian pada pertemuan pertama.

Kami meminta persetujuan untuk:

1. discovery 90 menit dengan pemilik proses;
2. memilih satu use case Polres;
3. menetapkan sponsor dan operator;
4. menyepakati data minimum dan acceptance criteria;
5. mengirimkan desain pilot serta estimasi biaya.

### Kalimat penutup

> “Jika Cicero tidak dapat membuktikan pengurangan friksi kerja dan peningkatan keterlacakan laporan dalam pilot, Polres tidak perlu melanjutkan. Jika terbukti, kita memiliki dasar yang lebih sehat untuk memperluas implementasi melalui mekanisme resmi.”

## Kontak

- Legal entity: `[isi setelah verifikasi]`
- PIC: `[isi]`
- Email/telepon resmi: `[isi]`
- Dokumen legal dan procurement: `[isi]`

### Basis materi

Repository Cicero: `README.md`, `docs/business_process.md`, `docs/database_structure.md`, `docs/admin_whatsapp_access.md`, `docs/enterprise_architecture.md`, serta implementasi pada `src/`.
