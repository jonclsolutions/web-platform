<!--
  @file README.md
  @path README.md (repository root)
  @project RPSW Web
  @author RPSW
  @created 2026
  @description Developer guide for the web-platform monorepo: structure, first-time
  setup, daily local workflow, background jobs, production build and deployment.
-->

# RPSW Web – web-platform

Commercial web application: **public website**, **e-shop** and one **administration**
split into a web section and a shop section, backed by a secured **Laravel API**.
The solution is developed and operated in line with EU law (GDPR, ePrivacy).

| Part | Technology | Directory |
|---|---|---|
| Frontend – public web, e-shop, admin | Angular 21 | `erp/` |
| Backend – REST API, queue, scheduler | Laravel 11+ | `api/` |
| Database | MySQL / MariaDB (XAMPP locally) | `database/` |
| Local e-mail catcher | Mailpit | – |

---

## Repository structure

```
web-platform/
├── api/                 Laravel API
├── erp/                 Angular application (public web, shop, admin)
├── database/            SQL files: schema and code lists – NO real personal data
├── deploy/
│   ├── build.sh         production build → build/www.zip
│   └── server/          server config shipped into the webroot (.htaccess, .user.ini, configure-server.sh)
├── docs/                project documentation, DOCS templates
├── tests/
│   ├── regression_tests/ manual regression tests (scripts + checklists)
│   └── unit_tests/      runners for the erp (Karma) and api (PHPUnit) unit tests, see its README
├── init-workspace.sh    prepares a freshly cloned app for local development (repeatable)
├── dev.sh               starts / stops the whole local environment
├── .dev/                (git-ignored) logs and PID files of dev.sh
└── build/               (git-ignored) output of deploy/build.sh, wiped on every build
```

---

## First-time setup

**Prerequisite (once per machine):** XAMPP installed in `/opt/lampp` –
[download](https://www.apachefriends.org/download.html), then
`chmod +x xampp-linux-*-installer.run && sudo ./xampp-linux-*-installer.run`.
`init-workspace.sh` checks this first and stops without changing anything if XAMPP is missing.

Then a freshly cloned application is prepared by one script:

```bash
git clone git@github.com:jonclsolutions/web-platform.git
cd web-platform
./init-workspace.sh
```

The script is universal – the same unchanged file works for web-platform and every app cloned
from it (the app name is the directory name). It is safe to run again any time; steps that are
already done are skipped and nothing existing is overwritten.

| Step | What happens |
|---|---|
| System packages | installs missing PHP extensions, Composer, Node.js and tools via `dnf` |
| Mailpit | downloads the latest release to `~/.local/bin`, **only if its SHA-256 matches** the digest GitHub publishes |
| Laravel | creates `api/.env` from `.env.example` with local defaults (only if missing), `composer install`, `APP_KEY` (only if empty), `public/storage` symlink (stale ones are fixed), writable `storage/` |
| Angular | `npm ci`, local SSL certificate `erp/ssl/localhost.{crt,key}` for `ng serve` (trusted if `mkcert` is installed; per developer, git-ignored) |
| Repository | required `.gitignore` rules, executable scripts, warns if a new app still pushes to web-platform |
| Shell aliases | `<app>` (cd), `<app>-dev`, `<app>-build` in `~/.zshrc` / `~/.bashrc` – one block per app |

It never touches the user crontab, and everything it writes belongs to the checkout itself
(`api/.env`, `vendor/`, `node_modules/`, `erp/ssl/`, `.dev/`) or to the app's own alias block –
any number of cloned apps can be set up on one machine without affecting each other.
Options: `--skip-system` (no `dnf`), `--no-aliases`, `--help`.

The script ends with one of:

- **`WORKSPACE SETUP COMPLETE`** – do the two manual steps below, then start with `./dev.sh`.
- **`WORKSPACE SETUP INCOMPLETE`** – fix the listed warnings and run the script again.

### Manual step 1 – review `api/.env`

A new `api/.env` is created from `.env.example` with local defaults; an existing one is never
changed. Either way, check it before the first start:

| Keys | What to check |
|---|---|
| `APP_NAME`, `APP_URL`, `FRONTEND_URL` | name and local URLs of this app (`http://127.0.0.1:8000`, `https://localhost:4200`) |
| `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | the database created in step 2 (XAMPP default: `root`, no password) |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | sender of e-mails – locally all mail is caught by Mailpit |
| `TURNSTILE_SECRET_KEY` | captcha – Cloudflare's public **test** key is preset for local use |
| other keys of the app | API keys, payment gateway, … – see `.env.example` |

`api/.env` is git-ignored – never commit it.

### Manual step 2 – database in phpMyAdmin

The script does **not** create the database; its summary prints the name to use
(`DB_DATABASE` in `api/.env` – for a new app the directory name, `app-two` → `app_two`):

1. start XAMPP: `sudo /opt/lampp/lampp start`
2. open https://localhost/phpmyadmin/
3. create the database with the printed name, collation `utf8mb4_unicode_ci`
4. tab **Import** → `database/db.sql`

> **Database schema:** `database/db.sql` is the authoritative schema; `api/database/migrations`
> covers only part of it. Do not run `php artisan migrate:fresh` – review pending migrations with
> `php artisan migrate:status` first.

### Creating a new application from web-platform

web-platform is the base for other applications. A new app starts as a clone and keeps
web-platform as `upstream`, so fixes in the base can be pulled in later:

```bash
cd ~/Git
git clone git@github.com:jonclsolutions/web-platform.git app-two
cd app-two
git remote rename origin upstream                       # web-platform = base for this app
git remote add origin git@github.com:jonclsolutions/app-two.git
./init-workspace.sh
# → WORKSPACE SETUP COMPLETE, then import the database in phpMyAdmin (see above)
./dev.sh
```

Later, to take over changes from the base: `git fetch upstream && git merge upstream/main`.

Only **one application runs at a time** – all apps use the same ports (API 8000, ERP 4200).
Stop one (`./dev.sh stop`) before starting another; `dev.sh` refuses to start while the ports are taken.

### Manual setup (other systems)

Prerequisites: PHP + extensions required by `api/composer.lock` (check with
`composer check-platform-reqs --lock`), Composer, Node.js 20.19+/22.12+/24+, MySQL/MariaDB,
[Mailpit](https://mailpit.axllent.org/), `rsync`, `zip`, `openssl`.

```bash
cd api && composer install && cp .env.example .env && php artisan key:generate && php artisan storage:link && cd ..
mysql -u root -e "CREATE DATABASE rp_website CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root rp_website < database/db.sql
cd erp && npm ci && cd ..
```

Mail settings for local development in `api/.env`:

```dotenv
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1   # not "localhost" – it may resolve to IPv6 ::1, where Mailpit does not listen
MAIL_PORT=1025
```

---

## Daily workflow

Everything is started and stopped with one command from the repository root:

```bash
./dev.sh                       # start everything, follow logs; Ctrl+C or closing the terminal/editor stops everything
./dev.sh up -d                 # start in the background – keeps running after the terminal is closed
./dev.sh stop                  # stop everything started by dev.sh
./dev.sh status                # what is running + URLs
./dev.sh logs                  # follow logs (.dev/logs/*.log)
./dev.sh up --with-scheduler   # also run the Laravel scheduler
```

Start errors are shown right in the `dev.sh` output: before starting it checks the dev
certificate of `ng serve` (`erp/ssl/localhost.{crt,key}`, created by `./init-workspace.sh`);
while a service starts, a crash or a fatal log line (missing file, port taken, PHP fatal
error …) is printed with the end of its log at once. When the API or the ERP does not start,
the whole environment is stopped (exit code 1); a TypeScript compile error is only printed –
`ng serve` keeps running and recompiles on save.

| Service | URL |
|---|---|
| ERP (Angular, SSL) | https://127.0.0.1:4200 |
| API | http://127.0.0.1:8000 |
| Mailpit (caught e-mails) | http://127.0.0.1:8025 |

`dev.sh` starts XAMPP (asks for sudo), Mailpit, `php artisan serve`, the queue worker
(`queue:listen`, only when `QUEUE_CONNECTION` is not `sync`) and `ng serve`. Services that
are already running (e.g. Mailpit started by hand) are detected and left untouched.
XAMPP and Mailpit are stopped on exit only if `dev.sh` started them.

**Closing the terminal or VSCodium** while `./dev.sh` runs in the foreground stops everything,
the same as Ctrl+C (the shutdown is logged to `.dev/logs/dev.log`). The one exception is XAMPP:
stopping it needs sudo, and with no terminal there is nowhere to type the password – if sudo has
no cached credentials, XAMPP is left running and the next `./dev.sh stop` stops it.
With `./dev.sh up -d` the environment deliberately keeps running after the terminal is closed.

Overrides via environment variables, e.g. `API_PORT=8001 ./dev.sh` or
`STOP_XAMPP_ON_EXIT=0 ./dev.sh`. Full list: header of `dev.sh`.

### Background jobs (queue and scheduler)

| | Local development | Production |
|---|---|---|
| Queue | `queue:listen` started by `dev.sh` | `queue:work` under Supervisor / systemd |
| Scheduler | off by default, `--with-scheduler` or `php artisan schedule:test` | system cron: `* * * * * php artisan schedule:run` |

`dev.sh` runs the queue worker (and optionally the scheduler) only while you work. Neither
`dev.sh` nor `init-workspace.sh` ever adds or removes cron jobs – existing entries in your crontab
keep working as they are.
The scheduler currently contains only nightly GDPR clean-up jobs (see `api/routes/console.php`).

---

## Production build

```bash
deploy/build.sh                         # all unit tests first, then the full build
deploy/build.sh --skip-tests            # build without running the tests
deploy/build.sh --skip-angular          # reuse the existing Angular build
deploy/build.sh --with-public-storage   # also ship storage/app/public (first install only)
deploy/build.sh --no-zip                # skip the archive
```

**Tests first:** every build starts with all unit tests (`tests/unit_tests/run_all.sh`, erp +
api, report in `tests/unit_tests/report/`). When all of them pass, the build says
`ALL TESTS PASSED – starting the production build` and continues; when one fails (or a part
cannot run), the build stops with an error and the previous `build/` stays untouched.
`--skip-tests` skips this gate.

Output:

```
build/
├── www/                  → hosting webroot
│   ├── index.html, chunks, assets      (Angular production build)
│   ├── .htaccess, .user.ini, configure-server.sh   (from deploy/server/)
│   └── laravel/          (API with production dependencies only)
├── www.zip               → the same www/ as one archive
├── www.zip.sha256        → checksum to verify the upload
├── database/             → SQL files (never part of www)
└── README.md             → preview only (never part of www)
```

The build **never ships**: `.env` files, logs, framework cache/sessions/views, user uploads
in `storage/app/private` (personal data), dev dependencies, tests, IDE helpers, private keys.
`storage/app/public` is skipped by default so local test files cannot overwrite production
uploads. A final check aborts the build if any `.env`, `.sql`, key or log file ends up in `www/`.

---

## Deployment checklist (monthly release)

1. **Prepare**
   - all changes committed and pushed, tests and manual regression (`tests/regression_tests/`) done
   - tag the release: `git tag -a vYYYY.MM -m "Release YYYY-MM" && git push --tags`
2. **Build** – `deploy/build.sh` (runs all unit tests first), check that it ends with `COMPLETE`
3. **Back up production** – database dump, `laravel/.env`, `laravel/storage/app/`
4. **Upload** `build/www.zip` – see [Uploading the package](#uploading-the-package):
   - use **SFTP or FTPS** (FTP over TLS), never plain FTP – it sends the hosting password unencrypted
   - upload it **outside the webroot**, or delete it right after extracting – the archive contains
     the complete source code and would be downloadable at `https://<domain>/www.zip`
   - verify it was not corrupted: `sha256sum -c www.zip.sha256` must print `www.zip: OK`
5. **Extract over the existing deployment.** Do **not** delete `laravel/.env` or
   `laravel/storage/` on the server – the package intentionally contains neither, so the
   production secrets and user uploads stay in place.
   - **First install only:** `cp .env.example .env`, fill in the production values and run
     `php artisan key:generate`.
   - **Never regenerate `APP_KEY` on a running production** – it logs out all users and makes
     encrypted data unreadable.
   - Production `.env` must contain `APP_ENV=production` and `APP_DEBUG=false`; with debug on,
     error pages expose credentials and server paths.
6. **On the server** (in `laravel/`):
   ```bash
   php artisan down
   php artisan migrate --force
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   php artisan storage:link          # first install only
   php artisan queue:restart         # workers pick up the new code
   php artisan up
   ```
7. **Smoke test**
   - public web, e-shop, admin login, sending an e-mail
   - `curl -I https://<domain>/laravel/.env` must return **403 or 404**, never 200

### One-time steps of the October 2026 fixes (findings-fixes 1–4)

Run once on the first release that contains them (back up the database first):

1. **SQL migrations** (`database/migrations/`, in this order, phpMyAdmin → *Import* or
   `mysql -u <user> -p <db> < file.sql`):
   - `2026_10_23_shop_orders_vat_contact_retention.sql` – VAT rate per order line, buyer
     snapshot on the order, orders kept when a customer is deleted
   - `2026_10_24_enum_slug_column_defaults.sql` – English slug defaults of status / priority /
     state (raw requests, sales leads, job applications)
   - `2026_10_26_normalize_user_emails.sql` – login e-mails lower case without surrounding
     whitespace (run the duplicate check from its header first)
   - `2026_10_26_scrub_logged_passwords.sql` – removes the maintenance confirmation password that
     older releases wrote into the web / shop audit logs (run the SELECT from its header first:
     every admin listed there must change the password)
   - `2026_10_27_not_found_page_titles.sql` – browser tab titles of the public 404 pages
     (`web.not-found`, `shop.not-found`)
2. **Legacy attachments to the private disk** (GDPR, in `laravel/`):
   `php artisan attachments:migrate-legacy --dry-run`, check the output, then without `--dry-run`
3. **Clear caches**: `php artisan optimize:clear`, then the `config:cache` / `route:cache` /
   `view:cache` of step 6
4. **Runtime translations** – the public web / shop texts live in
   `laravel/storage/app/public/translations/{web,shop}/<lang>.json` on the server and are **not**
   part of the package (they are edited in the admin). Add the new keys to every language file
   there (admin → translations, or copy the values from the repo `cz.json`); a missing key shows
   an empty text:
   - web: `login.errors.{too_many_attempts, login_failed, verification_failed, request_failed}`,
     `tos` / `privacy_policy` / `cookies_policy.effective_from_text`,
     `contact.errors.{submit_error_title, too_many_requests}`, `faq.empty_state_text`,
     `jobs.{form_first_name_pattern_error, form_last_name_pattern_error, form_phone_pattern_error,
     form_cv_size_error, form_too_many_requests}`, `order_form.errors.too_many_requests`,
     `order_form.link_states.{loading, invalid_title, invalid_text, used_title, used_text}`,
     `projects.label_{category, client, duration, facts, features, result, role, scope, stack}`,
     `services.cards.{admin, auth, custom, hosting, integrations, security, seo, support}_tags`
   - shop: `cart.{confirm_remove_confirm, confirm_remove_cancel}`,
     `checkout.alerts.{price_invalid_message, stock_message, order_rejected_message, too_many_requests}`,
     `checkout.errors.invalid_value`, `checkout.coupon_too_many`,
     `product_detail.errors.alert_title`, `api_errors.too_many_requests`,
     `not_found.{header, text, button}` (404 page of the e-shop, 2026-10-27)
5. **API + frontend together** – findings-fixes-4 changed the response format of the API
   (one envelope `{data, meta?}`, see [API response format](#api-response-format)); deploy the
   Laravel API and the Angular build of the same release at once, never one without the other.
6. **Deploy SSH key** – the key that was committed in `docs/scripts/` must be treated as leaked:
   generate a new one (`bash docs/scripts/generate-ssh.sh`, writes to `~/.ssh`), put the new
   public key into the server's `~/.ssh/authorized_keys` and **remove the old one** there.

### Uploading the package

**`www.zip`** is a plain, unencrypted ZIP archive – no key or password is needed to upload
or extract it. FTP cannot extract archives; extract it in the hosting file manager or over
SSH (`unzip www.zip`), or upload the extracted `build/www/` directory instead.

**`www.zip.sha256`** is a checksum (fingerprint) of the archive – not a key, nothing is
encrypted. Changing a single byte of the archive produces a completely different value, so it
answers two questions:

- *Did the upload succeed?* An interrupted transfer leaves a truncated archive that may extract
  only partially and break production. Verify on the server before extracting:
  ```bash
  sha256sum -c www.zip.sha256     # with the .sha256 file uploaded next to the archive
  sha256sum www.zip               # or compare the value with build/www.zip.sha256 by hand
  ```
- *Is this the right build?* The checksum identifies one specific build, so you can tell which
  of several `www.zip` files is current and what exactly is deployed.

Without SSH access the check cannot run on the server – then at least compare the file size on
the server with the local one. The checksum file does not need to be deployed.

---

## Security and GDPR rules

- **Never commit secrets**: `.env`, passwords, API keys, SSH/TLS private keys. Keys belong in `~/.ssh`.
- **No real personal data in the repository**: `database/` contains schema and code lists only;
  dumps with customer data stay outside git.
- User uploads (`storage/app/private`) are personal data – never copied into builds or shared.
- Retention of personal data is enforced by scheduled clean-up jobs (security events,
  import batches) – keep the production scheduler cron running.
- `.dev/` and `build/` are git-ignored; check with `git status` before every commit.
- **E-mail access policy** (admin → Account management → E-mail domains) applies to every role,
  sysadmin included: an account outside the allowed domains / exceptions cannot log in, and its
  open sessions end as soon as the policy excludes it. The editor refuses a change that would
  lock out the sysadmin making it. Emergency access when nobody can log in (shell on the server):
  `php artisan security:email-policy-allow admin@example.com`.
- **Password confirmation of sysadmin operations** (step-up re-authentication, OWASP ASVS):
  creating / promoting / demoting / editing / deleting / restoring a sysadmin account, emptying a
  trash that contains one and changing the e-mail access policy need the own password
  (`POST /api/confirm-password`). The confirmation is single-use, bound to the user, the login
  token and the operation, and valid 10 minutes; 5 wrong passwords lock it for 15 minutes. A stolen
  session alone therefore cannot add another sysadmin or remove the others - it does not protect
  against a known password (sysadmin 2FA stays forced).
- **Audit logs never contain secrets**: `LogsActivity` drops every key matching
  `password|token|secret` (also nested) from `context_data`.

---

## API response format

Every successful answer of the Laravel API that carries a payload has ONE shape
(`App\Traits\RespondsWithData`, used by every controller through the base `Controller`):

| Answer | Shape | Controller |
|---|---|---|
| record / result | `{ "data": { … } }` (201 for a created record) | `$this->respond($resource, 201)` |
| list | `{ "data": [ … ] }` | `$this->respond(XResource::collection($rows))` |
| page | `{ "data": [ … ], "meta": { "total", "per_page", "current_page", "last_page" } }` | `$this->respondPaginated($page, XResource::class)` |
| extra information | `"meta": { … }` beside `data` (e.g. `activation_email_sent`, `has_more_older_messages`) | `respond($data, 200, ['key' => …])` |
| no payload | `204` without a body, or `{ "message" }` | `response()->json(null, 204)` |
| error | `{ "message", "errors"? }` (+ `error_code`, `retry_after`) – never wrapped | `response()->json(['message' => …], 4xx)` |

Rules: records always go through an API Resource (explicit field list, never a bare model);
no hand-built `['data' => …]`, no `success` / `status` flags. `tests/Unit/Other/ResponseEnvelopeTest`
fails on a success shape built by hand. On the frontend `DataHandler` / `PublicDataService` return
the `data`; `getPaginatedCollection()`, `getWithMeta()` and `postWithMeta()` return the envelope
(`ApiEnvelope` / `ApiPage` in `erp/src/app/shared/interfaces/api-envelope.ts`).

---

## Styles (CSS)

The CSS is organised in layers: component CSS, `shared-styles/` per module, admin / public shared
styles, and `erp/src/app/shared/styles/` for both. Colours come from global primitives
(`--color-*`) and one `theme.css` per look (admin, public web, e-shop).
Read **[erp/src/app/shared/styles/README.md](erp/src/app/shared/styles/README.md)** before adding or
moving styles – it describes the structure, the tokens and where a new rule goes.

---

## Documentation standards

All code must be documented using the DOCS templates in `docs/`:
`doc_PHPDoc_template.json`, `doc_JSDoc_template.json`, `doc_CSS_comment_block.json`,
`doc_HTML_comment_clock.json`. Code comments are written in English.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Terminal keeps printing *"You have new mail"* | A cron job is failing and cron mails its output. Check `crontab -l` and `tail -50 /var/mail/$USER` – usually a job whose directory no longer exists; fix or remove that entry, or add `MAILTO=""` to the crontab. |
| `Port 8000/4200 is used by another process` | Something else runs on the port: `ss -ltnp \| grep 8000`, stop it or use `API_PORT=8001 ./dev.sh`. |
| E-mails do not arrive in Mailpit | `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025` in `api/.env`; check `.dev/logs/queue.log`. |
| Queued jobs are not processed | `QUEUE_CONNECTION` must not be `sync` for queued jobs; check `./dev.sh status` and `php artisan queue:failed`. |
| Build fails with *"Angular output not found"* | The output path is read from `outputPath` in `erp/angular.json`; override with `ANGULAR_OUTPUT=dist/<name> deploy/build.sh`. |
