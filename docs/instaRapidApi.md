# Instagram Rapid API

Dokumen ini menjelaskan endpoint Instagram berbasis RapidAPI yang membutuhkan autentikasi dan pembatasan role.

## Konfigurasi Environment

- `RAPIDAPI_KEY` **wajib diisi**. Jika kosong, service akan mengembalikan error konfigurasi (HTTP 500) sebelum mencoba request ke RapidAPI.
- `RAPIDAPI_FALLBACK_KEY` dan `RAPIDAPI_FALLBACK_HOST` bersifat opsional. Jika tersedia, service akan otomatis mencoba host cadangan ketika host utama mengembalikan HTTP 401/403 (mis. key utama invalid atau rate limit).

## Autentikasi & Role

Semua endpoint Rapid Instagram berada di bawah prefix `/api/insta` sehingga memerlukan token JWT (`Authorization: Bearer <token>` atau cookie `token`).

Aturan akses:
- **Admin/superadmin**: akses penuh ke seluruh endpoint Rapid Instagram.
- **Operator**: hanya boleh mengakses endpoint yang berada pada allowlist middleware (`src/middleware/authMiddleware.js`). Saat ini, `/api/insta/rapid-profile` sudah di-allowlist sehingga operator bisa menggunakannya. Endpoint Rapid Instagram lain akan ditolak dengan HTTP 403 untuk role operator.

## GET /api/insta/rapid-profile

Mengambil profil Instagram via RapidAPI berdasarkan username dan menyimpan cache serta metrik profil ke database.

### Query Params
- `username` (wajib): username Instagram yang akan diambil. Input akan dinormalisasi (trim spasi, menghapus awalan `@`). Format yang diterima: `username`, `@username`, atau URL profil Instagram.

### Contoh Request
```
GET /api/insta/rapid-profile?username=polri
```

### Response
- Sukses: format `sendSuccess` (lihat `src/utils/response.js`) dengan payload profil dari RapidAPI.
- Gagal:
  - `400` jika `username` kosong.
  - `401` jika token tidak valid.
  - `403` jika role operator mencoba mengakses endpoint Rapid Instagram yang tidak di-allowlist.

### Catatan Perilaku
- Jika cache tersedia, data diambil dari cache; jika tidak, sistem akan memanggil RapidAPI lalu menyimpan cache.
- Saat data profil valid, sistem melakukan `upsert` ke tabel profil dan metrik pengguna Instagram.

## Integrasi WA DirRequest (Input Manual IG/TikTok)

Selain endpoint HTTP di atas, backend juga memakai helper RapidAPI yang dipicu dari menu WhatsApp `dirrequest`:

- **4️⃣6️⃣ Input IG post manual** → memanggil helper `fetchSinglePostKhusus(link, clientId)` untuk mengambil detail post Instagram dari link, lalu menyimpan ke `insta_post_khusus` dan `insta_post`. Pada alur manual ini, `created_at` diset ke waktu upload manual bot (format ISO string), sedangkan waktu publish asli platform disimpan di `original_created_at` (diambil dari `taken_at` jika tersedia). `insta_post.source_type` ditandai `manual_input`.
- **4️⃣7️⃣ Input TikTok post manual** → memanggil helper `fetchAndStoreSingleTiktokPost(clientId, videoInput)` untuk mengambil detail video TikTok dari link/video ID, lalu upsert ke `tiktok_post` dengan `source_type = manual_input`. Pada alur ini, `created_at` tetap waktu input manual operator, sementara waktu publish asli platform disimpan di `original_created_at` dari `createTime/create_time/timestamp` jika ada.

Catatan kompatibilitas:
- Penambahan alur manual ini **tidak mengubah kontrak endpoint HTTP yang sudah ada**.
- Pipeline fetch akun resmi via scheduler/endpoint tetap berjalan seperti sebelumnya, dan data manual hanya menambah sumber konten untuk modul task/rekap.
