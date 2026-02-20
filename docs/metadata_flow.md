# Cicero Flow Metadata
*Last updated: 2026-12-15*

This document outlines the flow of data and the main database tables used by the Cicero_V2 system. It provides an overview from the initial onboarding steps through to reporting and notifications.

## 1. Initial Flow

1. **Client and User Setup**
   - Administrators log in through the dashboard and register new clients using the `/clients` API.
   - Users for each client are created via the `/users` API, imported from Google Sheets, or self-service through the OTP claim flow (`/api/claim/*`).
2. **Authentication & Claim**
   - Users authenticate by calling `/api/auth/login`, `/api/auth/user-login`, or `/api/auth/dashboard-login` and receive a JWT token.
   - Operators without updated records request OTP codes through `/api/claim/request-otp`. OTPs are emailed instantly and must be verified before profile edits. Jika NRP tidak ditemukan tetapi email sudah dipakai akun lain, API mengembalikan konflik 409 dengan pesan yang menjelaskan agar user memakai email berbeda atau menghubungi admin.
   - The JWT token or HTTP-only cookie is included in subsequent API calls to authorize access.

## 2. Database Overview

Key tables defined in [`sql/schema.sql`](../sql/schema.sql):

| Table              | Purpose                                   |
|--------------------|-------------------------------------------|
| `clients`          | Stores client information and social media identifiers. |
| `user`             | Holds user profiles linked to a client.   |
| `dashboard_user` / `dashboard_user_clients` | Dashboard accounts and their permitted clients. |
| `insta_post` / `insta_post_khusus` | Instagram posts fetched via RapidAPI (regular & khusus). |
| `insta_like` / `insta_comment` | List of likes and comments for each Instagram post. |
| `insta_profile`             | Basic profile info for Instagram accounts. |
| `instagram_user`, `instagram_user_metrics`, `ig_ext_*` | Detailed Instagram profile, metrics, and extended RapidAPI data. |
| `tiktok_post` / `tiktok_post_roles` | TikTok posts associated with a client and role-based visibility. |
| `tiktok_comment`            | Comments for each TikTok post.            |
| `premium_request`           | Premium subscription applications.        |
| `link_report`, `link_report_khusus` | Amplification links from field agents. |

These tables are updated regularly by scheduled jobs and form the basis for analytics and attendance calculations.

## 3. Process Flow

1. **Data Collection**
   - Cron jobs (`cronDirRequestFetchSosmed.js`, etc.) fetch posts, metrics, and rankings once the relevant WhatsApp client becomes ready. Results are saved to PostgreSQL and cached in Redis.
2. **Analytics & Attendance**
   - The backend matches likes or comments with registered users to compute attendance statistics and generates aggregator summaries for dashboards.
3. **Reporting & Messaging**
  - Cron tasks (`cronDirRequestFetchSosmed.js`, `cronRekapLink.js`, `cronAmplifyLinkMonthly.js`, etc.) send recaps to administrators through `waClient` or `waGatewayClient`.
   - OTP emails and complaint confirmations are sent immediately via SMTP to reduce follow-up latency.
4. **Queue Processing (Optional)**
   - Heavy operations can publish tasks to RabbitMQ with `rabbitMQService.js` and are processed asynchronously.

## 4. Final Output

Administrators receive automated WhatsApp reports summarizing daily engagement. The dashboard retrieves analytics via REST endpoints, giving a complete view of social media activity per client.

## 5. Kontrak Metadata Instagram Post (`insta_post`)

Standar canonical yang dipakai backend untuk penulisan data Instagram:

- `source_type`
  - `cron_fetch` untuk fetch rutin/scheduler.
  - `manual_input` untuk input manual operator (menu dirrequest 4️⃣6️⃣).
  - Nilai legacy `manual_fetch` dinormalisasi ke `manual_input` saat write.
- `created_at`
  - Menyimpan timestamp event dalam format ISO-8601 UTC (`Date#toISOString`).
  - Untuk `cron_fetch`, berasal dari `taken_at` post (epoch dari platform).
  - Untuk `manual_input`, berasal dari waktu input operator (waktu ingest sistem).
- `original_created_at`
  - Menyimpan waktu publish asli dari platform jika tersedia (`taken_at`).

Kontrak timezone harian:

- Basis timezone operasional tetap **Asia/Jakarta (WIB)**.
- Seluruh query tanggal harian harus membaca `created_at` dengan pola:
  `((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date`.
  Pola ini dipakai agar data lama/baru tetap konsisten pada klasifikasi hari WIB.

Backfill data lama tersedia di migrasi:

- `sql/migrations/20261215_normalize_insta_post_source_and_timestamp.sql`
  untuk normalisasi `source_type` dan koreksi kandidat `created_at` manual lama
  yang berpotensi bergeser hari akibat penulisan timestamp offset ke kolom tanpa timezone.


Refer to [docs/naming_conventions.md](naming_conventions.md) for code style guidelines.
