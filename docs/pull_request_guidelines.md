# Pull Request Guidelines
*Last updated: 2025-07-10*

This document summarizes how to properly format a pull request for the **Cicero_V2** repository.

## Steps Before Opening a PR

1. **Lint and test the project** using:
   ```bash
   npm run lint
   npm test
   ```
   Fix any issues reported by `eslint` or failing tests.
2. **Make sure the working tree is clean** with `git status --short`.
3. **Write descriptive commit messages** that explain the change.

## Formatting the Pull Request

- Provide a **concise title** that summarizes the purpose of the PR.
- In the body, list the main changes and reference file paths or line numbers when they help reviewers.
- Mention related issues or context so others understand why the change is needed.
- Keep the description short but informative.
- When adding or updating cron jobs, register them in `src/cron/cronManifest.js` so documentation and runtime buckets stay in sync.

## Internal Time/Date Review Checklist (Wajib)

Untuk modul absensi dan narasi report harian:

- Semua output hari/tanggal/jam **wajib** memakai `getOperationalAttendanceDate()` dari `src/utils/attendanceOperationalDate.js`.
- Jangan gunakan pola manual berikut di kode baru/revisi:
  - `const now = new Date();` untuk menyusun narasi operasional.
  - `hariIndo[now.getDay()]`.
  - `toLocaleDateString("id-ID", ...)` langsung pada modul absensi/report.
  - `toLocaleTimeString("id-ID", ...)` langsung pada modul absensi/report.
- Saat code-review, tolak perubahan yang belum memakai helper operasional Jakarta terpusat.

Refer to [docs/naming_conventions.md](naming_conventions.md) for code style guidelines.
