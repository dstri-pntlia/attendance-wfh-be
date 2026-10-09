# WFH Attendance API

[![CI](https://github.com/dstri-pntlia/REPO_NAME/actions/workflows/ci.yml/badge.svg)](https://github.com/dstri-pntlia/REPO_NAME/actions/workflows/ci.yml)

Backend for a work-from-home attendance system. Employees check in with a photo
and the server's own clock; HR admins manage employee master data and monitor
submitted attendance read-only.

Built with **NestJS + TypeScript + PostgreSQL + TypeORM**.

## What it does

**Employee self-service**
- Log in, stay signed in via a refresh-token cookie
- Check in once per working day with a photo as proof of working from home
- The server stamps the time from its own clock and derives the work date in
  `Asia/Jakarta`; a check-in after `WORK_START_TIME` is marked `LATE`
- Browse own attendance history by date range

**HR admin**
- Create, read, update employees; activate and deactivate accounts
- Monitor all attendance with date-range, department, status, and name filters
- View check-in photos — **read-only**: there is deliberately no route to edit or
  delete an attendance record, and none to delete an employee

Photos are never public: `GET /attendances/:id/photo` streams the bytes and still
requires the bearer token, and an employee can only reach their own.

## Quick start

The fastest path is Docker — it brings up PostgreSQL, runs the migrations, seeds
the demo accounts, and starts the API:

```bash
docker compose up
```

Then open Swagger at <http://localhost:8080/api/docs>. PostgreSQL is published on
`5433` to avoid clashing with a local install; override with `POSTGRES_PORT`.
Stop with `docker compose down` (add `-v` to also drop the database volume).

Compose ships working defaults, so this succeeds on a fresh clone with no `.env`
at all. Note that Compose also reads `.env` when one is present, so a local
`SEED_ON_START=false` there will disable seeding.

### Running on the host instead

```bash
pnpm install
cp .env.example .env          # then fill in the values described below
createdb attendance_db        # or point DATABASE_URL at any PostgreSQL
pnpm migration:run
pnpm seed
pnpm start:dev
```

`.env` needs three things before the app will start — it validates its whole
configuration on boot and refuses to run on anything invalid:

1. **`DATABASE_URL`** — any PostgreSQL instance.
2. **`JWT_ACCESS_SECRET`** — at least 32 characters; `openssl rand -hex 32`.
3. **`S3_*`** — check-in photos go to S3-compatible object storage. Create a
   bucket and an API token in [Cloudflare R2](https://developers.cloudflare.com/r2/)
   (10 GB free), or point these at any S3-compatible service such as MinIO.

Everything except uploading and viewing a check-in photo works with placeholder
`S3_*` values, so you can explore the API without an object-storage account.

Open Swagger at <http://localhost:8080/api/docs> and log in with a seeded account
(see **Seed and demo accounts** below).

## Environment variables

Copy `.env.example` to `.env`. All variables are validated on startup; the API refuses to start and lists every invalid variable.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test`, or `production`; controls log level (`test` is silent) |
| `PORT` | no | `8080` | HTTP port |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string (`postgres://…`); on startup the API retries 5 times, 2 s apart, then stops if it still cannot connect |
| `JWT_ACCESS_SECRET` | **yes** | — | Access token signing secret, at least 32 characters |
| `JWT_ACCESS_TTL` | no | `15m` | Access token lifetime (`900s`, `15m`, `8h`, `1d`) |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | Refresh token (JWT) lifetime in days (1–365) |
| `FRONTEND_ORIGIN` | **yes** | — | Comma-separated CORS allow-list of exact origins, e.g. `http://localhost:5173,http://localhost:3000` |
| `S3_ENDPOINT` | **yes** | — | S3-compatible endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | **yes** | — | Bucket that holds check-in photos |
| `S3_ACCESS_KEY_ID` | **yes** | — | Object storage access key |
| `S3_SECRET_ACCESS_KEY` | **yes** | — | Object storage secret key |
| `S3_REGION` | no | `auto` | Cloudflare R2 ignores it; the S3 protocol requires a value |
| `UPLOAD_MAX_BYTES` | no | `5242880` | Max photo size; cannot exceed 5 MB (database constraint) |
| `APP_TIMEZONE` | no | `Asia/Jakarta` | Business time zone (IANA name) |
| `WORK_START_TIME` | no | `09:00` | Lateness threshold, `HH:mm` |
| `COOKIE_SECURE` | no | `false` | `Secure` flag on the refresh cookie (`true`/`false`) |
| `SEED_ON_START` | no | `false` | Run the idempotent seed after migrations on container start (`true`/`false`) |

## URLs

- API: `http://localhost:8080/api/v1` (health: `GET /api/v1/health`)
- Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI JSON: `http://localhost:8080/api/docs-json`

## Database

PostgreSQL 16 or newer. The schema is created **only by migrations** (`synchronize` is never enabled). Entities, migrations, and seeds live in `src/core/database/`.

### One-time setup (local PostgreSQL)

Create the role and an empty database that `DATABASE_URL` points to (default: user `app`, password `app`, database `wfh`):

```sql
CREATE ROLE app LOGIN PASSWORD 'app';
CREATE DATABASE wfh OWNER app;
```

If you use different credentials, change `DATABASE_URL` in `.env`.

### Migrations

All scripts build the project first and run the compiled output.

```bash
$ pnpm migration:run        # apply pending migrations
$ pnpm migration:revert     # revert the last migration (run again to go further back)
$ pnpm migration:show       # list migrations and whether they have run
$ pnpm migration:generate src/core/database/migrations/<Name>   # after changing an entity
```

Migrations are reviewed by hand: constraint and index names follow a fixed convention (`pk_`, `fk_`, `uq_`, `ck_`, `ix_`) because the API maps them to error codes. After `migration:run`, `migration:generate` should report "No changes" (entities and migrations agree). Every migration has a working `down()`.

### Seed and demo accounts

```bash
$ pnpm seed                 # needs a migrated database; safe to run repeatedly
```

The seed is idempotent. Departments are upserted by `code`; users and employees are created only when missing (by `email` / `employee_number`), so re-running never resets a password or changes a status. No attendance is seeded.

| Account | Email | Password | Role |
|---|---|---|---|
| HR admin | `hr@example.com` | `Admin12345` | `HR_ADMIN` (no employee profile) |
| Employees `EMP-0001` to `EMP-0005` | `budi@`, `siti@`, `agus@`, `dewi@`, `rizky@example.com` | `Employee123` | `EMPLOYEE`, active |
| Employee `EMP-0006` | `maya@example.com` | `Employee123` | `EMPLOYEE`, **inactive** (cannot log in) |

Departments: `ENG` Engineering, `HR` Human Resources, `FIN` Finance, `OPS` Operations.

> These are public demo credentials. **Never run the seed against a production database.**

## Authentication

| Endpoint | Notes |
|---|---|
| `POST /api/v1/auth/login` | `{ email, password }` → `{ accessToken, expiresIn, user }`; sets the `refresh_token` cookie. Every failure is `401 INVALID_CREDENTIALS`. Limit: 5 per minute per IP and email. |
| `POST /api/v1/auth/refresh` | Uses the cookie; returns a new access token and sets a new refresh token. Fails if the user was deactivated or their password changed. Limit: 20 per minute per IP. |
| `POST /api/v1/auth/logout` | Clears the cookie; `204`, idempotent, no bearer needed. |
| `GET /api/v1/auth/me` | Current user (bearer token). |

Every other route requires `Authorization: Bearer <accessToken>` unless marked `@Public()`. Use `@Roles(UserRole.HR_ADMIN)` to restrict a route, and `@CurrentUser()` to read the caller. The access token (HS256, claims `sub`, `role`, `ver`) is checked against the database on each request, so deactivating a user or bumping `token_version` takes effect immediately.

The refresh token is a **stateless signed JWT** (claims `sub`, `ver`, `jti`) signed with a key derived from `JWT_ACCESS_SECRET`; there is no sessions or refresh-token table. It is re-checked against `is_active` and `token_version` on every refresh, so deactivation and password change end it at once. Logout only clears the cookie, so a copied token works until it expires (`REFRESH_TOKEN_TTL_DAYS`). Changing `JWT_ACCESS_SECRET` ends every session.

```bash
# Try it with the seeded HR admin (see "Seed and demo accounts")
$ curl -i -c jar.txt -X POST http://localhost:8080/api/v1/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"hr@example.com","password":"Admin12345"}'
$ curl http://localhost:8080/api/v1/auth/me -H "Authorization: Bearer <accessToken>"
$ curl -b jar.txt -c jar.txt -X POST http://localhost:8080/api/v1/auth/refresh
```

In Swagger UI (`/api/docs`) use **Authorize** with the access token.

## Quality checks

```bash
$ pnpm run lint          # ESLint (type-aware)
$ pnpm run typecheck     # tsc --noEmit, strict
$ pnpm run format:check  # Prettier
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# test coverage
$ pnpm run test:cov

# end-to-end tests over HTTP against a real PostgreSQL
$ docker compose up -d postgres
$ DATABASE_URL=postgres://attendance:attendance@localhost:5433/attendance pnpm run test:e2e
```

The end-to-end suite in `test/app.e2e-spec.ts` boots the real application and walks
through both use cases: login and refresh, role checks, HR creating an employee,
that employee checking in with a photo, ownership rules, HR monitoring, and
deactivation taking effect immediately. It migrates and seeds a temporary schema
and drops it afterwards, so it is safe to point at any database. Photo storage is
replaced by an in-memory implementation, so no S3 credentials are needed.

CI runs format, lint, typecheck, unit tests, the end-to-end suite and the build
on every push.

## Architecture

One deployable NestJS application organised into bounded modules — `auth`,
`users`, `employees`, `departments`, `attendance` — each owning its entities and
exposing only services. No module reads another module's tables.

The brief asks for a "microservices concept". This is built as a modular monolith
instead: modules talk only through services, so any of them can be extracted into
a separate service later without rewriting its callers.

```
src/
├── common/     cross-cutting: error filter, pagination, pipes, interceptors, utils
├── config/     environment validation (fail-fast) and Swagger setup
├── core/       database (entities, migrations, seeds) and file storage
└── modules/    auth, users, employees, departments, attendance
```

Points worth knowing:

- **Entities are never returned from controllers.** Every response goes through an
  explicit DTO, so internal columns (`password_hash`, `storage_key`, `ip_address`)
  cannot leak.
- **Schema changes only through migrations.** `synchronize` is off everywhere.
- **Login failures are indistinguishable.** Every failure returns the same
  `INVALID_CREDENTIALS`, and an unknown email still costs a password hash, so
  response time does not reveal which accounts exist.
- **Deactivation takes effect immediately** — every request re-checks `is_active`
  and `token_version`, so an already-issued JWT stops working.

## Scope

This repository is the backend API only. It covers both use cases end to end at
the API level.

## License

MIT — see [LICENSE](LICENSE).
