# Current System Baseline: WhatsApp Admin Menu

**Status**: Baseline — audit 2026-10-24  
**Runtime**: PM2 `menu`, stopped  
**Entry**: `app.js` → Express controllers/routes and WhatsApp menu handlers

## Purpose and topology

The service exposes admin-menu APIs and WhatsApp operator/directorate flows for clients, posts, profiles, attendance, analytics, amplification, claims, change logs, and recaps.

```text
HTTP routes/controllers + WA handlers → services → models/repositories → PostgreSQL/Redis
                                      ↘ response utilities / auth middleware
```

Key modules are `src/controller/`, `src/routes/`, `src/handler/menu/`, `src/service/`, `src/model/`, and `src/db/`.

## Current capabilities

- Health/readiness and API auth/claim flows.
- Client/profile/post/like/comment/log endpoints.
- Aggregator, Anev, amplification, recap, attendance, and WhatsApp menu operations.

## Safety invariants

- Preserve route authorization, client/role scoping, idempotency, response envelopes, and Jakarta operational dates.
- Keep destructive endpoints guarded and auditable; never broaden delete/update scope.
- Use existing service/model boundaries and parameterized queries.
- Do not start the stopped `menu` process or alter PM2 configuration in a documentation task.

## Acceptance checks

- Run the repository lint/test/build scripts available in `package.json`.
- Verify health/readiness, auth, role scope, and affected route smoke tests.
- Any runtime change must include a rollback-safe migration and must not depend on the stopped process being started.
