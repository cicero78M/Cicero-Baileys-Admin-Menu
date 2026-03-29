# Runbook: Tuning Baileys untuk Proses `menu` di PM2 (Production)

Dokumen ini untuk standarisasi tuning Baileys pada proses PM2 `menu` agar timeout `timed out waiting for message` berkurang tanpa meningkatkan retry berlebihan.

## 1) Verifikasi proses PM2 dan environment yang aktif

> Jalankan di **server production**.

```bash
pm2 list
pm2 show menu
pm2 env menu
```

Jika nama proses bukan `menu`, pakai id proses dari `pm2 list`:

```bash
pm2 env <id>
```

Verifikasi juga file ecosystem yang sedang dipakai saat start/restart:

```bash
pm2 prettylist | rg -n "name|pm_exec_path|pm_cwd|env|env_production"
```

## 2) Variabel env wajib untuk tuning Baileys

Pastikan 4 env ini terpasang di proses `menu`:

- `WA_BAILEYS_SEND_RETRY_COUNT`
- `WA_BAILEYS_SEND_RETRY_DELAY_MS`
- `WA_BAILEYS_QUERY_TIMEOUT_MS`
- `WA_BAILEYS_SYNC_HISTORY`

Cek cepat dari PM2 env:

```bash
pm2 env menu | rg -n "WA_BAILEYS_SEND_RETRY_COUNT|WA_BAILEYS_SEND_RETRY_DELAY_MS|WA_BAILEYS_QUERY_TIMEOUT_MS|WA_BAILEYS_SYNC_HISTORY"
```

## 3) Baseline konservatif (disarankan untuk menu interaktif)

Gunakan nilai awal konservatif berikut:

```bash
WA_BAILEYS_SEND_RETRY_COUNT=1
WA_BAILEYS_SEND_RETRY_DELAY_MS=1000
WA_BAILEYS_QUERY_TIMEOUT_MS=10000
WA_BAILEYS_SYNC_HISTORY=false
```

Catatan:
- `retry_count=1` menjaga total percobaan tetap rendah (attempt awal + 1 retry).
- `query_timeout=10000` lebih pendek dari default adapter (`15000`) untuk fail-fast.
- `sync_history=false` menghindari blocking sinkronisasi history saat koneksi awal.

## 4) Terapkan env ke PM2 dan restart terkontrol

Contoh via ecosystem:

```bash
# edit ecosystem.config.js (env/env_production proses menu)
pm2 reload ecosystem.config.js --only menu --env production
```

Contoh via shell env + restart (jika pola deploy Anda memakai source .env):

```bash
pm2 restart menu --update-env
```

Setelah restart, verifikasi ulang env aktif:

```bash
pm2 env menu | rg -n "WA_BAILEYS_SEND_RETRY_COUNT|WA_BAILEYS_SEND_RETRY_DELAY_MS|WA_BAILEYS_QUERY_TIMEOUT_MS|WA_BAILEYS_SYNC_HISTORY"
```

## 5) Monitoring event (sebelum vs sesudah deploy)

Event yang wajib dimonitor:

- `send_message_retry`
- `send_message_error`
- `reinitializing_client`

### Ambil baseline (misalnya 30 menit sebelum deploy)

```bash
pm2 logs menu --lines 5000 --nostream | rg 'send_message_retry|send_message_error|reinitializing_client|timed out waiting for message' > /tmp/menu_before.log
```

```bash
printf "retry=%s\nerror=%s\nreinit=%s\ntimeout=%s\n" \
  "$(rg -c 'send_message_retry' /tmp/menu_before.log)" \
  "$(rg -c 'send_message_error' /tmp/menu_before.log)" \
  "$(rg -c 'reinitializing_client' /tmp/menu_before.log)" \
  "$(rg -c 'timed out waiting for message' /tmp/menu_before.log)"
```

### Ambil data setelah deploy (window durasi sama)

```bash
pm2 logs menu --lines 5000 --nostream | rg 'send_message_retry|send_message_error|reinitializing_client|timed out waiting for message' > /tmp/menu_after.log
```

```bash
printf "retry=%s\nerror=%s\nreinit=%s\ntimeout=%s\n" \
  "$(rg -c 'send_message_retry' /tmp/menu_after.log)" \
  "$(rg -c 'send_message_error' /tmp/menu_after.log)" \
  "$(rg -c 'reinitializing_client' /tmp/menu_after.log)" \
  "$(rg -c 'timed out waiting for message' /tmp/menu_after.log)"
```

Kriteria awal membaik:
- frekuensi `timed out waiting for message` turun,
- `send_message_error` tidak naik signifikan,
- `reinitializing_client` tidak melonjak.

## 6) Nilai final env (isi setelah observasi)

Isi bagian ini sebagai standar operasional lintas restart/deploy.

- `WA_BAILEYS_SEND_RETRY_COUNT=<isi_final>`
- `WA_BAILEYS_SEND_RETRY_DELAY_MS=<isi_final>`
- `WA_BAILEYS_QUERY_TIMEOUT_MS=<isi_final>`
- `WA_BAILEYS_SYNC_HISTORY=false`

Simpan nilai final yang sama pada:
- file environment deploy (`.env.production`/secret manager),
- ecosystem PM2 aktif,
- dokumen runbook ini.

## Referensi implementasi kode

Variabel env di atas digunakan langsung oleh adapter Baileys di `src/service/baileysAdapter.js`.
