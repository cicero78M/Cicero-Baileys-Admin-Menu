# CICERO — Company Profile untuk Institusi Kepolisian

**Versi:** 21 September 2026  
**Status:** draft komersial berbasis bukti repository dan sumber publik; wajib divalidasi sebelum dipakai sebagai materi resmi.

## 1. Ringkasan perusahaan

Cicero adalah platform **intelligence, orkestrasi, dan akuntabilitas kerja digital** untuk organisasi yang bekerja melalui banyak satuan, wilayah, operator, dan kanal komunikasi.

Untuk konteks Polri, posisi Cicero yang paling kredibel saat ini adalah sebagai lapisan penghubung antara:

- data aktivitas Instagram/TikTok;
- direktori personel/pelaksana dan struktur client/role;
- tugas, engagement, kehadiran/absensi, dan rekap;
- dashboard analitik;
- notifikasi serta tindakan operator melalui WhatsApp;
- audit dan pembatasan akses berdasarkan hirarki organisasi.

**Janji nilai:** pimpinan memperoleh gambaran yang dapat ditindaklanjuti; operator mengurangi kerja rekap manual; pelaksana memahami tugas dan tenggat; organisasi memiliki jejak data yang lebih mudah diaudit.

## 2. Masalah yang diselesaikan

Pada organisasi berjenjang, masalah utamanya bukan hanya “punya data”, melainkan:

1. data aktivitas tersebar pada kanal dan akun yang berbeda;
2. pimpinan daerah/direktorat membutuhkan sudut pandang agregat, sementara operator membutuhkan detail;
3. laporan harian/mingguan sering bergantung pada spreadsheet dan rekap manual;
4. pesan, tugas, dan laporan tidak selalu memiliki jejak status yang sama;
5. akses data harus mengikuti client, role, direktorat, wilayah, dan level organisasi;
6. keputusan komunikasi publik membutuhkan bukti tren, bukan hanya jumlah unggahan.

## 3. Produk dan kemampuan yang sudah terlihat di repository

| Kapabilitas | Bukti implementasi | Nilai bisnis yang dapat dijual |
|---|---|---|
| Multi-client dan hirarki organisasi | `docs/database_structure.md`, `src/model`, client/role middleware | Satu platform dapat memisahkan Mabes/direktorat/Polda/satker sesuai desain akses |
| Ingest Instagram dan TikTok | `src/service/instaRapidService.js`, `src/service/tiktokRapidService.js`, route sosial | Pengumpulan data kanal publik untuk monitoring dan evaluasi |
| Engagement dan rekap | controller/service likes, comments, ranking, rekap Excel | Mengubah aktivitas media sosial menjadi laporan terukur |
| Akun/media resmi Satbinmas | `satbinmas_official_accounts`, `satbinmas_official_media`, service terkait | Monitoring akun resmi dan histori konten yang lebih terstruktur |
| Dashboard Anev | `src/controller/anevController.js`, README endpoint `/api/dashboard/anev` | Pandangan ringkas untuk pimpinan dengan filter waktu, role, scope, dan regional |
| Menu operator melalui WhatsApp | `src/handler/menu`, `src/service/waService.js` | Operasi dan notifikasi dari kanal yang sudah familiar bagi operator |
| Laporan dan ekspor | berbagai `*ExcelService`, `docs/laporan_harian_engagement.md` | Bukti kerja yang dapat dibawa ke rapat dan evaluasi |
| Link amplification dan pelacakan | `linkReport*`, `amplify*` routes/services | Mengukur distribusi link/konten dan rekap hasilnya |
| OTP dan claim data | `claimRoutes`, `otpService`, email delivery | Onboarding/claim data dengan verifikasi tambahan |
| Audit dan pembatasan akses | auth middleware, premium/audit models, login logs | Mendukung prinsip least privilege dan penelusuran aktivitas |
| Arsitektur operasional | Node/Express, PostgreSQL, Redis, RabbitMQ, PM2; migrasi ke Baileys | Dapat dioperasikan sebagai backend modular dengan proses terkelola |

### Klaim yang boleh dipakai sekarang

- “Cicero memiliki modul dan kode untuk kemampuan di atas.”
- “Cicero dirancang untuk multi-client, role, scope, dan regional filtering.”
- “Cicero menyediakan alur analitik Instagram/TikTok, rekap, dashboard, WhatsApp operator, dan ekspor.”

### Klaim yang belum boleh dipakai tanpa bukti tambahan

- jumlah Polda/Polres/pengguna yang sudah membayar;
- persentase kenaikan engagement atau penghematan jam kerja;
- status sebagai aplikasi resmi Polri atau rekomendasi pejabat;
- sertifikasi keamanan, klasifikasi data, SLA, dan kepatuhan tertentu;
- angka “60% lebih hemat memory” dan “80% lebih cepat startup” dari README sebelum ada benchmark yang dapat diaudit;
- kemampuan menangani data rahasia, penegakan hukum, atau prediksi kriminal—itu bukan bukti yang terlihat dari repository ini.

## 4. Segmen pembeli dan pintu masuk

### Segmen prioritas

1. **Pemilik kebijakan tingkat Mabes/direktorat** — membutuhkan standar pelaporan lintas wilayah, visibility, dan pengawasan implementasi.
2. **Polda** — membutuhkan konsolidasi Polda–Polres/satker dan regional performance view.
3. **Ditbinmas/Satbinmas** — paling dekat dengan bukti produk saat ini: akun resmi, engagement, rekap, operator, dan aktivitas lapangan.
4. **Penmas/Humas** — membutuhkan monitoring kanal, distribusi konten, dan bukti pelaksanaan komunikasi publik.
5. **SPKT/kanal layanan** — prospek pengembangan; jangan dijual sebagai Dumas atau sistem pengaduan resmi tanpa integrasi dan persetujuan formal.

### Persona keputusan

- **Policy owner:** membeli outcome dan standardisasi lintas wilayah.
- **Operational champion:** membeli kemudahan kerja harian dan rekap otomatis.
- **IT/security:** membeli kontrol akses, integrasi, logging, backup, dan operability.
- **Procurement/finance:** membeli ruang lingkup, SLA, deliverables, dan mekanisme pengadaan yang jelas.
- **End user/operator:** membeli pengurangan pekerjaan berulang.

## 5. Model nilai

### Produk inti — Cicero Command & Social Intelligence

Dashboard, ingestion Instagram/TikTok, struktur client/role, rekap, Anev, dan ekspor.

### Modul orkestrasi — Cicero Operator

Menu WhatsApp, notifikasi, task/reminder, rekap terjadwal, dan workflow operator.

### Modul akuntabilitas — Cicero Evidence Layer

Direktori user, scope regional, log login, audit perubahan, link report, dan histori data.

### Modul pengembangan

Integrasi kanal resmi, API data internal, Dumas/SPKT/CRM sesuai kewenangan, serta deployment private/on-premise setelah assessment keamanan.

## 6. Prinsip komersial dan kepatuhan

Cicero dijual melalui kebutuhan dan bukti, bukan kedekatan personal atau imbalan. Semua pendekatan ke Polri harus:

- menggunakan kanal resmi dan agenda yang tercatat;
- mengutamakan demo/pilot dengan ruang lingkup dan acceptance criteria;
- memisahkan demo, konsultasi, pilot, dan pengadaan;
- mengikuti mekanisme PBJ yang berlaku, termasuk kanal elektronik yang diwajibkan/tersedia;
- tidak memberikan hadiah, komisi informal, fasilitas pribadi, atau pembayaran untuk memengaruhi keputusan;
- menghindari klaim “disetujui/ditunjuk/dipakai Polri” tanpa dokumen resmi;
- menerapkan minimisasi data, otorisasi berbasis peran, retensi, backup, dan incident response.

## 7. Bukti yang perlu dikumpulkan sebelum go-to-market penuh

- 1–3 customer reference yang boleh disebut secara tertulis;
- baseline dan endline pilot: waktu rekap, kelengkapan data, waktu respons, dan adopsi pengguna;
- benchmark performa Baileys terhadap implementasi lama;
- threat model, data classification, penetration test, dan SOP operasional;
- SLA, RTO/RPO, lokasi hosting, dukungan, dan harga;
- dokumentasi integrasi dan data flow yang disetujui;
- studi kasus dengan data yang dianonimkan.

## 8. Kontak dan identitas yang masih harus diisi

> Jangan mengirim profile ini sebagai company profile final sebelum blok berikut dilengkapi.

- **Legal entity:** `[nama PT/badan usaha]`
- **NIB/NPWP/alamat:** `[isi setelah verifikasi legal]`
- **Founder/lead:** `[isi]`
- **Email/telepon resmi:** `[isi]`
- **Website/deck link:** `[isi]`
- **Customer/reference:** `[isi hanya dengan izin tertulis]`

## Sumber

- Repository internal: `README.md`, `docs/business_process.md`, `docs/enterprise_architecture.md`, `docs/database_structure.md`, `docs/admin_whatsapp_access.md`, route/service/model di `src/`.
- Polri, “Polri Perkuat Pengawasan Digital—Dorong Transparansi dan Akuntabilitas”, 30 Desember 2025: <https://tribratanews.polri.go.id/blog/nasional-3/polri-perkuat-pengawasan-digital-dorongtransparansi-dan-akuntabilitas-97228>
- Portal Dumas Presisi: <https://dumaspresisi.polri.go.id/>
- LKPP, “Era Baru Pengadaan Barang/Jasa Pemerintah dengan Katalog Elektronik V6”, 6 Januari 2025: <https://www.lkpp.go.id/read/s/era-baru-pengadaan-barang-jasa-pemerintah-dengan-katalog-elektronik-v6>
- Korlantas, transformasi digital dan penguatan SDM dalam kebijakan Beyond Trust Presisi, 16 Oktober 2025: <https://korlantas.polri.go.id/kabagrenmin-korlantas-polri-buka-rakor-bagrenmin-t-a-2025-tekankan-transformasi-digital-penguatan-sdm/>
