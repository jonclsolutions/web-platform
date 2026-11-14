# How to deploy

Step-by-step guide for putting **web-platform** on a hosting server – the first installation
and every later release. Each step says **what to do**, **what happens** and **how to check it**.

> In short: fill in `deploy/production.env` → `deploy/build.sh --check` → `deploy/build.sh` →
> upload and extract `build/www.zip` → first install: `bash configure-server.sh`,
> release: the update commands → smoke test.

Contents:

1. [What you need](#1-what-you-need)
2. [One-time preparation](#2-one-time-preparation)
3. [Check the configuration](#3-check-the-configuration)
4. [Build the package](#4-build-the-package)
5. [Upload and extract](#5-upload-and-extract)
6. [First installation – configure-server.sh](#6-first-installation--configure-serversh)
7. [Every later release – update](#7-every-later-release--update)
8. [Smoke test](#8-smoke-test)
9. [Rollback](#9-rollback)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What you need

**Locally**
- the repository with a working development environment (`./init-workspace.sh` done,
  Docker running) – the build runs inside the dev container (same PHP as the hosting)
- all changes committed; the build warns about uncommitted changes in `api/`, `erp/`, `deploy/`

**Hosting**
- Apache with `mod_rewrite`, `mod_headers` and `.htaccess` (`AllowOverride All`), PHP 8.5+ (the Composer platform of api/composer.json) with the GD extension built with WebP (profile photos; `php -r "var_dump(gd_info()['WebP Support']);"`), MySQL / MariaDB
- SSH access (needed for `configure-server.sh`, `php artisan` and cron) and SFTP / FTPS
- an empty database + user (hosting panel → databases) and an SMTP mailbox
- HTTPS certificate for the domain

**Cloudflare Turnstile** (captcha of the admin login)
- dash.cloudflare.com → Turnstile → *Add widget* → hostname = your domain, mode *Managed*
- you get a **Site Key** (public) and a **Secret Key** (secret), both start with `0x`

---

## 2. One-time preparation

All production settings live in **one local file**, `deploy/production.env`. It is git-ignored
(it contains secrets); the template `deploy/production.env.example` is in git.

```bash
cp deploy/production.env.example deploy/production.env
```

Fill in (everything else is preset for production):

| Value | Where it comes from |
|---|---|
| `APP_KEY` | new server: `./dev.sh artisan key:generate --show`; running server: **copy its current key** |
| `APP_URL`, `FRONTEND_URL` | `https://www.your-domain.cz` (both the same – one origin) |
| `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | hosting panel → databases |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | hosting panel → e-mail (SMTP) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → the site |
| `TRUSTED_PROXIES` | only behind a proxy / CDN (Cloudflare, load balancer): its IP ranges – see below |

What happens with the file:
- `deploy/build.sh` checks it and ships it in the package as **`laravel/.env`** – the server
  needs no manual editing, and **every deploy overwrites `laravel/.env`** on the server.
  Change settings here and build again, never edit `.env` on the server.
- `TURNSTILE_SITE_KEY` is built into the Angular app; the secret stays in `laravel/.env`.
  The captcha protects the admin login and the public forms (contact, order, job application);
  the privacy policy of the web must name Cloudflare Turnstile as a processor (GDPR).
- `TRUSTED_PROXIES` – every rate limit is per visitor IP. When the site runs behind a proxy or
  CDN, the API sees only the proxy's IP unless the proxy is trusted, and the limits would then be
  shared by all visitors (a few people could block the login or the forms for everybody). Set
  the proxy's IP ranges (for Cloudflare the published ranges at cloudflare.com/ips), or `*` only
  when the server accepts connections from the proxy alone. Leave empty without a proxy.
- The Angular production settings (`erp/src/environments/environment.prod.ts`) need **no
  editing** – the API and files are called relatively (`/api`, `/storage`).

> ⚠️ `APP_KEY` must never change once the server runs – a new key logs everybody out and makes
> encrypted data unreadable. Back the file up somewhere safe (password manager).

---

## 3. Check the configuration

```bash
./deploy/build.sh --check        # or: ./dev.sh build --check
```

**What happens:** checks the prerequisites (PHP / Composer of the container against
`api/composer.lock`, required tools) and `deploy/production.env`, lists **all** problems at once,
builds nothing.

- **ERROR** – the build would stop: values that break production or open a hole
  (`APP_ENV`≠production, `APP_DEBUG`≠false, missing / invalid `APP_KEY`, non-https or example
  `APP_URL` / `FRONTEND_URL`, empty `DB_HOST` / `DB_DATABASE` / `DB_USERNAME`,
  `SESSION_SECURE_COOKIE`≠true, `*` in `CORS_ALLOWED_ORIGINS`, `MAIL_MAILER` log / array, missing or test Turnstile keys,
  `SHOP_PAYMENT_SIMULATION` on, `.htaccess` without the rule that blocks `/laravel` or without
  `X-Frame-Options`).
- **WARNING** – the build continues, check the value (empty DB password, `root` DB user,
  local `MAIL_HOST`, a plain `http://` origin in `CORS_ALLOWED_ORIGINS`, example sender, `LOG_LEVEL=debug`, `QUEUE_CONNECTION=sync`, the same
  `APP_KEY` as locally, different hosts in `APP_URL` / `FRONTEND_URL`, `.htaccess` without an
  enforced `Content-Security-Policy`).

**Done when:** the output ends with `CHECK OK`. Also make sure no placeholder is left:

```bash
grep -n CHANGE_ME deploy/production.env      # must print nothing
```

---

## 4. Build the package

```bash
./deploy/build.sh                # or: ./dev.sh build
```

**What happens** (the numbers match the build output):

| Step | What it does |
|---|---|
| 1 Checking prerequisites | tools, PHP version vs. `composer.lock`, commit id |
| 2 Checking production settings | the check from section 3 – stops on any ERROR |
| 3 Running all unit tests | erp + api (`tests/unit_tests/run_all.sh`); a failure stops the build, the previous `build/` stays |
| 4 Preparing build/ | deletes and recreates `build/` |
| 5 Building Angular | `ng build --configuration production` with `environment.prod.ts` and the Turnstile site key; aborts if the bundle contains `127.0.0.1` or a test key |
| 6 Preparing Laravel | copies `api/` **without** the local `api/.env`, tests, logs, caches, private uploads and dev packages; `composer install --no-dev`; writes `laravel/.env` from `deploy/production.env` (permissions 600) |
| 7 Copying server configuration | `deploy/server/` → `.htaccess`, `.user.ini`, `configure-server.sh` |
| 8 Copying docs | README to `build/` (outside `www/`, never downloadable) |
| 9 Verifying package contents | aborts on any other `.env`, `.sql`, key or log file, on data in the schema baseline, on private uploads, or when `.htaccess` lacks `deny-internal-files` |
| 10 Creating www.zip | `build/www.zip` + `build/www.zip.sha256` |

Options: `--skip-tests` (rebuild of an already tested commit), `--skip-angular` (reuse the
Angular build), `--with-public-storage` (also ship `storage/app/public` – first install only, it
overwrites uploads on the server), `--no-zip`.

**Done when:** the output ends with `COMPLETE: package ready in build/`.

Result:

```
build/
├── www/                → the hosting webroot
│   ├── index.html, chunks, assets     Angular
│   ├── .htaccess, .user.ini, configure-server.sh
│   └── laravel/        API + vendor + .env (production secrets)
├── www.zip             → the same www/ as one archive – CONTAINS SECRETS
└── www.zip.sha256      → checksum of the archive
```

---

## 5. Upload and extract

1. **Release only:** back up production first – database dump, `laravel/.env`,
   `laravel/storage/app/` – and put the site into maintenance: `cd laravel && php artisan down`.
2. Upload `build/www.zip` and `build/www.zip.sha256` over **SFTP or FTPS** (never plain FTP – the
   archive holds all passwords), ideally **outside the webroot**.
3. Verify the upload: `sha256sum -c www.zip.sha256` → must print `www.zip: OK`.
   (Without SSH compare at least the file size with the local one.)
4. Extract into the webroot: `unzip -o www.zip -d <webroot>` (or the file manager of the
   hosting). Extracting over an existing deployment is correct: it replaces the code and
   `laravel/.env`, and keeps `laravel/storage/` (uploads, logs) and the `storage` symlink,
   because the package does not contain them.
5. **Delete `www.zip`** from the server right away.

---

## 6. First installation – configure-server.sh

```bash
cd <webroot>
bash configure-server.sh
```

**What happens, step by step** (go through the output carefully – the script has not been run
on a real server yet):

| Step | What it does |
|---|---|
| Composer | `composer install --no-dev` in `laravel/` (the package already has `vendor/`, this only verifies it) |
| .env | recognises the `.env` from the package (`# Built by deploy/build.sh …`) and keeps it – no questions; without it, it copies `.env.example` and waits until you edit it |
| APP_KEY | generated **only when missing** – the key from `production.env` stays |
| Caches | `config:clear`, `cache:clear` |
| Database | `db:create-if-missing` (on shared hosting create the empty database in the panel when asked), `migrate --force` (the whole schema from `database/schema/baseline.sql` + later migrations), `db:seed --force` (base data only: roles, permissions, legal texts – no test accounts) |
| First sysadmin | `security:create-sysadmin --if-none` **asks for the e-mail and password** (typed in the console, never stored); its e-mail domain is added to the e-mail access policy |
| Storage link | `storage:link` inside Laravel and the `storage` symlink in the webroot → `laravel/storage/app/public` |
| Cron | adds two cron entries (every minute): the queue worker (e-mails, imports) and the scheduler (nightly GDPR clean-up); idempotent. Without `crontab` it prints what to set up in the hosting panel |
| Permissions | `chmod -R 775 storage bootstrap/cache` |

**Done when:** it prints `COMPLETE!`. Then, in `laravel/`:

```bash
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

and continue with the [smoke test](#8-smoke-test). The first sysadmin logs in with a 2FA code
sent by e-mail – SMTP must work.

---

## 7. Every later release – update

After sections 3 – 5 (check, build, upload + extract), in `laravel/`:

```bash
php artisan migrate --force       # only new migrations (the baseline is skipped on an existing database)
php artisan db:seed --force       # adds new base data (e.g. new permission keys), changes nothing else
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan queue:restart         # workers pick up the new code
php artisan up                    # end of the maintenance from section 5
```

`configure-server.sh` is **not** needed for a release (it is idempotent, but asks questions).
Release notes may list extra one-time steps – see *One-time steps* in the README.

A release that renames or moves PHP classes (e.g. the modular refactor of November 2026,
applications in `app/Apps`) needs an **empty queue before the upload** – queued jobs and mails
store their class names: `php artisan queue:work --stop-when-empty` on the old release, then
upload. An application removed from the platform leaves its tables in the database; drop them by
hand only after a backup.

> The API and the Angular app of one release always go together (one package) – never deploy
> only one of them.

---

## 8. Smoke test

- public web, e-shop, admin login (incl. the 2FA e-mail), a contact form with an attachment
- `curl -I https://<domain>/laravel/.env` → must return **403** (or 404), **never 200**
- `curl -I https://<domain>/configure-server.sh` → **403**
- `https://<domain>/api/web/public/status` → JSON answer
- `curl -I https://<domain>/` → has `Content-Security-Policy`, `Strict-Transport-Security`,
  `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`; `curl -I https://<domain>/api/web/public/status`
  → `Content-Security-Policy: default-src 'none'; …` and `X-Frame-Options: DENY` (no header = `mod_headers` is off)
- open the web and the admin with the browser console open: no "Refused to load / execute …"
  (Content-Security-Policy) message
- after a few minutes: `laravel/storage/logs/queue-cron.log` and `scheduler-cron.log` exist (cron runs)
- `laravel/storage/logs/` has no new errors

---

## 9. Rollback

1. `php artisan down`
2. Extract the **previous** `www.zip` (keep the last packages and their `.sha256` locally).
3. If the release ran migrations that changed data, restore the database dump from section 5.
4. `php artisan config:cache && php artisan route:cache && php artisan view:cache`,
   `php artisan queue:restart`, `php artisan up`

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `deploy/production.env is missing` | `cp deploy/production.env.example deploy/production.env` and fill it in |
| `N configuration error(s)` | fix the listed values, run `./deploy/build.sh --check` again |
| `local PHP does not satisfy api/composer.lock` | build inside the dev container (default), not with `BUILD_ON_HOST=1` |
| `tests FAILED – the build was NOT started` | see `tests/unit_tests/report/report.html` |
| `the Angular bundle contains development settings` | `erp/angular.json` lost the production `fileReplacements`, or `--skip-angular` reused a dev build |
| `sensitive files found in build/www` | a file that must not be public got into the package – remove it from `api/` |
| `/laravel/.env` returns 200 | `.htaccess` missing or `mod_rewrite` / `AllowOverride` off – take the site offline until fixed and change all passwords |
| Page without styles / a feature does not work, console says "Refused to … Content-Security-Policy" | the policy in `deploy/server/.htaccess` blocks a source the page needs (Admin → Security events → *csp_violation* shows the directive and the origin). Add the origin to the right directive; to diagnose, rename the header to `Content-Security-Policy-Report-Only` (reports only, blocks nothing) and switch it back afterwards. Images from another host than the site: `APP_URL` must be the domain the site is opened on |
| Login asks for captcha and always fails | wrong or test Turnstile keys, or the domain is not set in the Turnstile widget |
| No 2FA / reset e-mails | `MAIL_*` in `production.env`, cron of the queue (`queue-cron.log`) |
| `500` after a deploy | `laravel/storage/logs/laravel.log`; usually `php artisan config:cache` or permissions of `storage/` |
