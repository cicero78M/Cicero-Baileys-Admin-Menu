# Link Reports API
*Last updated: 2026-02-16*

Dokumen ini menjelaskan endpoint untuk mengambil data link report.

## GET /api/link-reports
Mengembalikan daftar link report, termasuk pagination.

### Query Parameters
- `user_id` (opsional): filter berdasarkan user yang mengirim link report.
- `post_id` (opsional): filter berdasarkan shortcode post Instagram (nilai yang sama dengan `insta_post.shortcode`).
- `shortcode` (opsional): alias dari `post_id`.
- `limit` (opsional): jumlah data per halaman. Default `20`.
- `page` (opsional): nomor halaman. Default `1`.
- `offset` (opsional): offset data. Jika diisi, `page` akan diabaikan.

### Contoh Request
```
GET /api/link-reports?user_id=84110583&post_id=DSliyYzE10o
```

### Contoh Response
```
{
  "success": true,
  "data": {
    "items": [
      {
        "shortcode": "DSliyYzE10o",
        "user_id": "84110583",
        "instagram_link": "https://instagram.com/...",
        "facebook_link": null,
        "twitter_link": null,
        "tiktok_link": null,
        "youtube_link": null,
        "created_at": "2025-09-26T10:00:00.000Z",
        "caption": "...",
        "image_url": "...",
        "thumbnail_url": "..."
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "page": 1,
      "totalPages": 1
    }
  }
}
```

## GET /api/link-reports-khusus
Mengembalikan daftar link report khusus untuk post Instagram khusus.

### Query Parameters
- `user_id` (opsional): filter berdasarkan user yang mengirim link report khusus.
- `post_id` (opsional): filter berdasarkan shortcode post Instagram khusus (nilai yang sama dengan `insta_post_khusus.shortcode`).
- `shortcode` (opsional): alias dari `post_id`.

### Contoh Request
```
GET /api/link-reports-khusus?user_id=84110583&post_id=DSl7lfmgd14
```

### Contoh Response
```
{
  "success": true,
  "data": [
    {
      "shortcode": "DSl7lfmgd14",
      "user_id": "84110583",
      "instagram_link": "https://instagram.com/...",
      "facebook_link": null,
      "twitter_link": null,
      "tiktok_link": null,
      "youtube_link": null,
      "created_at": "2025-09-27T10:00:00.000Z",
      "caption": "...",
      "image_url": "...",
      "thumbnail_url": "..."
    }
  ]
}
```

## POST /api/link-reports-khusus
Membuat atau memperbarui (upsert) link report khusus berdasarkan `shortcode` dan `user_id` hasil resolusi role.

### Aturan payload berdasarkan role
- **Role `user`**
  - `user_id` dari body akan diabaikan.
  - Sistem selalu memakai `req.user.user_id` sebagai `data.user_id`.
  - `target_user_id` tidak wajib.
- **Role non-`user`**
  - Wajib kirim `target_user_id`.
  - Sistem memvalidasi bahwa `target_user_id` ada dan berada pada `client_id` yang sama.
  - Jika valid, `data.user_id` diisi dari `target_user_id`.

### Body Parameters
- `client_id` (wajib)
- `instagram_link` (wajib, URL post Instagram)
- `target_user_id` (wajib untuk role non-`user`)
- `facebook_link`, `twitter_link`, `tiktok_link`, `youtube_link` **tidak diizinkan** pada modul khusus.

### Contoh Request (role user)
```json
POST /api/link-reports-khusus
Authorization: Bearer <token-role-user>
Content-Type: application/json

{
  "client_id": "bidhumas",
  "instagram_link": "https://www.instagram.com/p/DX1Y2Z3aBcD/"
}
```

### Contoh Request (role non-user)
```json
POST /api/link-reports-khusus
Authorization: Bearer <token-role-admin>
Content-Type: application/json

{
  "client_id": "bidhumas",
  "target_user_id": "84110583",
  "instagram_link": "https://www.instagram.com/p/DX1Y2Z3aBcD/"
}
```

### Contoh Response Sukses
```json
{
  "success": true,
  "data": {
    "shortcode": "DX1Y2Z3aBcD",
    "user_id": "84110583",
    "instagram_link": "https://www.instagram.com/p/DX1Y2Z3aBcD/",
    "facebook_link": null,
    "twitter_link": null,
    "tiktok_link": null,
    "youtube_link": null,
    "created_at": "2026-02-16T09:15:00.000Z"
  }
}
```

### Contoh Response Error

#### 401 Unauthorized (context user tidak ada)
```json
{
  "success": false,
  "message": "unauthorized"
}
```

#### 400 Bad Request (target_user_id wajib untuk non-user)
```json
{
  "success": false,
  "message": "target_user_id is required for non-user role"
}
```

#### 403 Forbidden (target user tidak valid / beda client)
```json
{
  "success": false,
  "message": "target_user_id is invalid or does not belong to the same client_id"
}
```
