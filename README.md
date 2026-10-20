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
├── docs/                project documentation, manual regression tests, DOCS templates
├── dev.sh               starts / stops the whole local environment
├── .dev/                (git-ignored) logs and PID files of dev.sh
└── build/               (git-ignored) output of deploy/build.sh, wiped on every build
```

---

## Prerequisites

- PHP and Composer (version as required by `api/composer.json`)
- Node.js + npm (version supported by Angular 21)
- XAMPP in `/opt/lampp` (MySQL/MariaDB)
- [Mailpit](https://mailpit.axllent.org/) in `PATH`
- `rsync` and `zip` (production build only)

---

## First-time setup

```bash
git clone <repository-url> web-platform
cd web-platform

# API
cd api
composer install
cp .env.example .env          # then fill in DB credentials etc. – never commit .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
cd ..

# Frontend
cd erp
npm ci
cd ..
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
./dev.sh                       # start everything, follow logs; Ctrl+C stops everything
./dev.sh up -d                 # start in the background
./dev.sh stop                  # stop everything started by dev.sh
./dev.sh status                # what is running + URLs
./dev.sh logs                  # follow logs (.dev/logs/*.log)
./dev.sh up --with-scheduler   # also run the Laravel scheduler
```

| Service | URL |
|---|---|
| ERP (Angular, SSL) | https://127.0.0.1:4200 |
| API | http://127.0.0.1:8000 |
| Mailpit (caught e-mails) | http://127.0.0.1:8025 |

`dev.sh` starts XAMPP (asks for sudo), Mailpit, `php artisan serve`, the queue worker
(`queue:listen`, only when `QUEUE_CONNECTION` is not `sync`) and `ng serve`. Services that
are already running (e.g. Mailpit started by hand) are detected and left untouched.
XAMPP and Mailpit are stopped on exit only if `dev.sh` started them.

Overrides via environment variables, e.g. `API_PORT=8001 ./dev.sh` or
`STOP_XAMPP_ON_EXIT=0 ./dev.sh`. Full list: header of `dev.sh`.

### Background jobs (queue and scheduler)

| | Local development | Production |
|---|---|---|
| Queue | `queue:listen` started by `dev.sh` | `queue:work` under Supervisor / systemd |
| Scheduler | off by default, `--with-scheduler` or `php artisan schedule:test` | system cron: `* * * * * php artisan schedule:run` |

**No cron jobs locally.** Nothing should run in the background when you are not working.
The scheduler currently contains only nightly GDPR clean-up jobs (see `api/routes/console.php`).

---

## Production build

```bash
deploy/build.sh                         # full build
deploy/build.sh --skip-angular          # reuse the existing Angular build
deploy/build.sh --with-public-storage   # also ship storage/app/public (first install only)
deploy/build.sh --no-zip                # skip the archive
```

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
   - all changes committed and pushed, tests and manual regression (`docs/manual_regression/`) done
   - tag the release: `git tag -a vYYYY.MM -m "Release YYYY-MM" && git push --tags`
2. **Build** – `deploy/build.sh`, check that it ends with `COMPLETE`
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

---

## Documentation standards

All code must be documented using the DOCS templates in `docs/`:
`doc_PHPDoc_template.json`, `doc_JSDoc_template.json`, `doc_CSS_comment_block.json`,
`doc_HTML_comment_clock.json`. Code comments are written in English.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Terminal keeps printing *"You have new mail"* | A cron job is failing and cron mails its output. Check `crontab -l` and `tail -50 /var/mail/$USER`; local development needs no cron. |
| `Port 8000/4200 is used by another process` | Something else runs on the port: `ss -ltnp \| grep 8000`, stop it or use `API_PORT=8001 ./dev.sh`. |
| E-mails do not arrive in Mailpit | `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025` in `api/.env`; check `.dev/logs/queue.log`. |
| Queued jobs are not processed | `QUEUE_CONNECTION` must not be `sync` for queued jobs; check `./dev.sh status` and `php artisan queue:failed`. |
| Build fails with *"Angular output not found"* | The output path follows the project name in `erp/angular.json` (`rp_website`); override with `ANGULAR_PROJECT=<name> deploy/build.sh`. |
