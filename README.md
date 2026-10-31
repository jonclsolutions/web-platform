<!--
  @file README.md
  @path README.md (repository root)
  @project RPSW Web
  @author RPSW
  @created 2026
  @description Developer guide for the web-platform monorepo: structure, first-time
  setup, daily local workflow, background jobs, production build and deployment.
  @refactor-note (2026-10-31) Local development in Docker (compose.yaml, docker/app/Dockerfile):
  setup, daily workflow, tools, troubleshooting rewritten; XAMPP / host packages removed.
  @refactor-note (2026-10-31b) Every platform: Linux, macOS, Windows (WSL 2 - init-workspace.cmd,
  dev.cmd).
  @refactor-note (2026-10-31c) Root clean-up: the local environment lives in dev/ (compose.yaml,
  .env, docker/, windows/, logs/).
-->

# RPSW Web – web-platform

Commercial web application: **public website**, **e-shop** and one **administration**
split into a web section and a shop section, backed by a secured **Laravel API**.
The solution is developed and operated in line with EU law (GDPR, ePrivacy).

| Part | Technology | Directory |
|---|---|---|
| Frontend – public web, e-shop, admin | Angular 21 (Node.js 24) | `erp/` |
| Backend – REST API, queue, scheduler | Laravel 12 (PHP 8.5) | `api/` |
| Database | MariaDB (locally a Docker container) | `api/database/` (schema, migrations, seeders) |
| Local environment | Docker – PHP 8.5, Node.js 24, MariaDB, Mailpit, phpMyAdmin | `dev/` |

---

## Repository structure

```
web-platform/
├── api/                 Laravel API
├── erp/                 Angular application (public web, shop, admin)
├── dev/                 everything of the LOCAL environment (used by the scripts below):
│   ├── compose.yaml       services api, queue, scheduler, erp, db, mailpit, phpmyadmin
│   ├── docker/Dockerfile  development image (PHP 8.5, Composer, Node.js, Chromium)
│   ├── .env.example       settings of the Docker environment (→ dev/.env, git-ignored)
│   ├── windows/           init-workspace.ps1, dev.ps1 – behind the .cmd launchers
│   └── logs/, pids/       (git-ignored) one log file per service, PIDs of the log writers
├── deploy/
│   ├── build.sh         production build → build/www.zip
│   └── server/          server config shipped into the webroot (.htaccess, .user.ini, configure-server.sh)
├── docs/                project documentation, DOCS templates
├── tests/
│   ├── regression_tests/ manual regression tests (scripts + checklists)
│   └── unit_tests/      runners for the erp (Karma) and api (PHPUnit) unit tests, see its README
├── init-workspace.sh    prepares a freshly cloned app for local development (repeatable)
├── init-workspace.cmd   Windows: WSL 2 + Docker Desktop + project in WSL, then init-workspace.sh
├── dev.cmd              Windows: runs dev.sh inside WSL
├── .gitattributes       fixed line endings (*.sh LF, *.cmd / *.ps1 CRLF)
├── dev.sh               starts / stops the local environment, runs artisan / composer / npm / tests in Docker
├── temp/                (git-ignored) local scratch files – not backed up
└── build/               (git-ignored) output of deploy/build.sh, wiped on every build
```

---

## First-time setup

**Everything runs in Docker** – the computer needs only **Docker** (Engine + Compose + buildx
plugins) and **git**. PHP 8.5 (the same version as the FORPSI hosting), Composer, Node.js 24,
Chromium (unit tests), MariaDB, Mailpit and phpMyAdmin are containers, so the application is the
same on every computer and never conflicts with packages of the system. On every platform it is
**clone → init → dev**:

| | Linux (any distribution) | macOS | Windows 10 / 11 |
|---|---|---|---|
| 1. clone | `git clone <repo>` | `git clone <repo>` | `git clone <repo>` (Git for Windows) |
| 2. set up | `./init-workspace.sh` | `./init-workspace.sh` | `init-workspace.cmd` (double-click or `.\init-workspace.cmd`) |
| 3. work | `./dev.sh` | `./dev.sh` | `dev.cmd` (or `./dev.sh` in the WSL terminal) |
| Docker | installed by the script with the package manager (Arch, Debian / Ubuntu, Fedora, openSUSE – asked), other distributions: [docs.docker.com](https://docs.docker.com/engine/install/) | Docker Desktop – installed by the script with Homebrew (asked) | WSL 2 + Docker Desktop – installed by `init-workspace.cmd` (`wsl --install`, `winget` – asked) |
| notes | Docker starts on demand (`docker.socket`) | needs [Homebrew](https://brew.sh) and `brew install bash` (macOS ships bash 3.2; the scripts switch to the newer one themselves) | the project is cloned **into WSL** (`~/<folder>`) – Docker is very slow on `C:\` and `ng serve` does not see changes there; edit it with VS Code + the WSL extension (the script offers to open it) |

```bash
git clone git@github.com:jonclsolutions/web-platform.git
cd web-platform
./init-workspace.sh        # Windows: init-workspace.cmd
./dev.sh                   # Windows: dev.cmd
```

**Windows in detail:** `init-workspace.cmd` checks WSL 2 (offers `wsl --install -d Ubuntu`, then a
restart and one start of Ubuntu to create the Linux user), Docker Desktop (offers
`winget install Docker.DockerDesktop`, then logging out and in), starts Docker Desktop and checks
its WSL integration, clones the project into the Linux home (`\\wsl.localhost\Ubuntu\home\<you>\<folder>`
– only committed work is copied) and runs `./init-workspace.sh` there. `dev.cmd` in the Windows
folder then starts that WSL copy (path stored in the git-ignored `dev/wsl-workspace`); the Windows
folder itself is only the launcher – work in the WSL copy. Line endings are fixed by
`.gitattributes` (`*.sh` always LF), so a checkout with `core.autocrlf=true` does not break the
scripts.

No SSH key on GitHub yet (`Permission denied (publickey)`)? Clone over HTTPS
(`git clone https://github.com/jonclsolutions/web-platform.git`) – the first step of the script
connects this computer to GitHub over SSH and then offers to switch the remote to SSH.

The script is universal – the same unchanged file works for web-platform and every app cloned
from it (the app name is the directory name). It is safe to run again any time; steps that are
already done are skipped and nothing existing is overwritten.

| Step | What happens |
|---|---|
| GitHub (SSH) | checks `ssh -T git@github.com`; when not connected it asks whether to connect: uses the existing default key or creates one with `ssh-keygen` (asks for a passphrase), shows the **public** key with the GitHub page to add it and checks again – can be skipped. github.com is trusted only with the host key GitHub publishes. Offers to switch an HTTPS `origin` to SSH |
| Temp folder | the git-ignored `temp/` folder for local scratch files (media, notes, … – see `temp/temp.txt`): not backed up, may be deleted any time, keep nothing important there |
| Docker | checks Docker, Compose and buildx; when missing offers to install them – Linux with the package manager (Arch, Debian / Ubuntu, Fedora, openSUSE), macOS Docker Desktop with Homebrew, inside WSL it needs Docker Desktop (prepared by `init-workspace.cmd`). Linux: sets Docker **on demand** (`docker.socket` – the daemon starts on the first use, not with the computer; an enabled `docker.service` is offered the switch); offers to add you to the `docker` group (log out and in afterwards) – all asked first |
| Docker settings | `dev/.env` (git-ignored) from `dev/.env.example`: project name = app directory, your UID / GID (files written by the containers belong to you), a random local database password |
| Images | builds the dev image `dev/docker/Dockerfile` and pulls MariaDB, Mailpit, phpMyAdmin |
| Laravel | `api/.env` from `api/.env.example` with local defaults (only if missing), `composer install`, `APP_KEY` (only if empty), storage folders, relative `public/storage` symlink |
| Database | starts the MariaDB container, **creates the database** (`DB_DATABASE`, `utf8mb4_unicode_ci`), runs the migrations and the seeders – base data plus, with `APP_ENV=local`, the test account and test roles (see [Local test login](#local-test-login)); an existing database is never dropped or overwritten |
| Angular | `npm ci`, local SSL certificate `erp/ssl/localhost.{crt,key}` for `ng serve` (browser-trusted if `mkcert` is installed on the host; per developer, git-ignored) |
| Repository | required `.gitignore` rules, executable scripts, warns if a new app still pushes to web-platform |
| Shell aliases | `<app>` (cd), `<app>-dev`, `<app>-build` in `~/.zshrc` / `~/.bashrc` – one block per app |

Every PHP / Composer / Node.js command of the script runs in a container – nothing is installed
on the host except Docker (asked first). It never touches the user crontab; everything it writes
belongs to the checkout (`dev/.env`, `api/.env`, `vendor/`, `node_modules/`, `erp/ssl/`, `temp/`)
or carries the app's name (Docker containers / volumes / network `<app>_*`, the alias block),
so any number of cloned apps can live on one machine. Options: `--no-aliases`, `--help`.

The script ends with one of:

- **`WORKSPACE SETUP COMPLETE`** – review `api/.env` (below), then start with `./dev.sh`.
- **`WORKSPACE SETUP INCOMPLETE`** – fix the listed warnings and run the script again.

**Coming from XAMPP?** The old local database is not moved automatically:
`/opt/lampp/bin/mysqldump -uroot <database> > temp/xampp.sql`, then
`./dev.sh db-import temp/xampp.sql && ./dev.sh artisan migrate`. Afterwards XAMPP, Mailpit in
`~/.local/bin`, `/etc/php/conf.d/20-laravel-dev.ini` and the PHP / Node.js packages installed for
this app are no longer needed (keep them if other projects use them).

### Docker settings – `dev/.env`

| Keys | Meaning |
|---|---|
| `COMPOSE_PROJECT_NAME` | prefix of this app's containers and volumes (= directory name) |
| `HOST_UID`, `HOST_GID` | your user – kept current by `init-workspace.sh` |
| `PHP_VERSION`, `NODE_VERSION`, `MARIADB_VERSION` | keep PHP and MariaDB **equal to the hosting** (FORPSI: PHP up to 8.5; the database version is shown by phpMyAdmin on the hosting); after a change: `./dev.sh rebuild` |
| `API_PORT`, `ERP_PORT`, `DB_PORT`, `MAILPIT_PORT`, `PMA_PORT`, `BIND_IP` | ports on your computer, published on 127.0.0.1 only (the Angular app calls the API at `http://127.0.0.1:8000` – change both together) |
| `DB_ROOT_PASSWORD` | random root password of the **local** database container (phpMyAdmin login: `root` + this password) |

### Manual step – review `api/.env`

A new `api/.env` is created from `api/.env.example` with local defaults; an existing one is never
changed. Either way, check it before the first start:

| Keys | What to check |
|---|---|
| `APP_NAME`, `APP_URL`, `FRONTEND_URL` | name and local URLs of this app (`http://127.0.0.1:8000`, `https://localhost:4200`) |
| `DB_DATABASE` | the database the script creates – after a change run `./init-workspace.sh` again. Host, port, user and password of the database and of Mailpit are set by `dev/compose.yaml` inside Docker (`db:3306`, `mailpit:1025`) and win over `api/.env` |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | sender of e-mails – locally all mail is caught by Mailpit |
| `TURNSTILE_SECRET_KEY` | captcha – Cloudflare's public **test** key is preset for local use |
| other keys of the app | API keys, payment gateway, … – see `api/.env.example` |

`api/.env` and `dev/.env` are git-ignored – never commit them.

### Database – created by Laravel

The script creates and fills the database itself (step *Database*); no phpMyAdmin import is
needed. The same commands work by hand (in the container):

```bash
./dev.sh artisan db:create-if-missing   # CREATE DATABASE (utf8mb4_unicode_ci) only when it does not exist
./dev.sh artisan migrate                # empty database: the whole schema; filled database: only new migrations
./dev.sh artisan db:seed                # base data; with APP_ENV=local also the test account + test roles
./dev.sh db-dump                        # backup to temp/<db>-<date>.sql (personal data – never commit)
./dev.sh db-import <file.sql>           # import a dump (asks first)
```

**Nothing runs in the background after a restart:** the containers have no restart policy, so
they run only between `./dev.sh` and Ctrl+C / `./dev.sh stop`, and Docker itself starts on demand
(`docker.socket`) – with many projects the computer starts with none of them running.

The data live in the Docker volume `<app>_db-data` – `./dev.sh stop` / `down` keep them; only
`docker compose -f dev/compose.yaml down -v` deletes them (Docker by hand always with `-f dev/compose.yaml`).

- **Schema:** `api/database/migrations/0000_00_00_000000_create_baseline_schema.php` creates the
  whole schema (`api/database/schema/baseline.sql`, structure as of 2026-10-29) on an **empty**
  database and does nothing on a database that already has the tables. Every later change of the
  schema is a new Laravel migration – never edit `baseline.sql` for it.
- **Base data** (`BaseDataSeeder`, every installation): permissions, the protected `sysadmin`
  role with all permissions, page titles, legal document types, default web / e-shop settings,
  **placeholder company details** ("Company name Ltd.", info@example.com – the footer, contact
  page and FAQ need them) with a neutral default logo, **English templates of the legal documents**
  (privacy policy, terms of service, cookie policy – placeholders like `[Company name]`,
  `[Contact e-mail]`) and the default files they refer to (logo, flag of the built-in language –
  `storage/` is not in git). **Before going live:** fill in the company details and replace the
  placeholders of the legal texts in the admin (and have the texts reviewed).
- **Development data** (`DevelopmentSeeder`, only `APP_ENV=local`): see below.
- All seeders only **add what is missing** – edited texts, changed passwords and edited roles stay.
- Do not run `php artisan migrate:fresh` / `db:wipe` on a database with data you need.
- The former root folder `database/` (the SQL dump `db.sql` and the manual SQL scripts) was removed
  on 2026-10-31: the setup does not use it and every script had been run on the server. The
  schema lives in `api/database/schema/baseline.sql` + the Laravel migrations.

### Local test login

With `APP_ENV=local` the seeders create:

| | |
|---|---|
| e-mail | `sysadmin@sysadmin.sysadmin` (the domain `sysadmin.sysadmin` is allowed in the e-mail access policy) |
| password | `123456Ab.` |
| 2FA | always required for the sysadmin role – the code arrives in Mailpit, http://127.0.0.1:8025 |
| test roles | `read-only-core`, `read-only-web`, `read-only-shop` (viewing only), `full-web-core`, `full-shop-core` (every permission of the module and of Core), `all-permissions` (every permission – an ordinary user, not the protected sysadmin) |

The account and roles exist **only locally** – production never gets an account with a known
password (see [Deployment checklist](#deployment-checklist-monthly-release)).

### Creating a new application from web-platform

web-platform is the base for other applications. A new app starts as a clone and keeps
web-platform as `upstream`, so fixes in the base can be pulled in later:

```bash
cd ~/Git
git clone git@github.com:jonclsolutions/web-platform.git app-two
cd app-two
git remote rename origin upstream                       # web-platform = base for this app
git remote add origin git@github.com:jonclsolutions/app-two.git
./init-workspace.sh       # Windows: init-workspace.cmd
# → WORKSPACE SETUP COMPLETE (the database is created and filled by the script)
./dev.sh                  # Windows: dev.cmd
```

Later, to take over changes from the base: `git fetch upstream && git merge upstream/main`.

Each app has its own containers, network and database volume (Docker project = directory name).
By default all apps use the same ports (API 8000, ERP 4200, …), so **one runs at a time** – stop
one (`./dev.sh stop`) before starting another. To run two at once, give the second other ports in
its `dev/.env` and its `erp/src/environments/environment.ts`.

### Without Docker (not supported)

The project is set up and tested only with Docker. Running it directly on the host needs PHP 8.4+
(api/composer.lock) with the extensions of `dev/docker/Dockerfile`, Composer, Node.js 24,
MariaDB, Mailpit and Chromium – the old host-based scripts are in the git history
(before 2026-10-31); `deploy/build.sh` builds on the host with `BUILD_ON_HOST=1`.

---

## Daily workflow

Everything is started and stopped with one command from the repository root:

```bash
./dev.sh                       # start everything, follow logs; Ctrl+C stops everything
./dev.sh up -d                 # start in the background – keeps running after the terminal is closed
./dev.sh stop                  # stop the containers (data kept)
./dev.sh status                # what is running + URLs
./dev.sh logs [service]        # follow dev/logs/<service>.log (api, queue, erp, db, mailpit, …)
./dev.sh up --with-scheduler   # also run the Laravel scheduler
```

Every service writes its own log file **`dev/logs/<service>.log`** (api, queue, erp, db, mailpit,
phpmyadmin, scheduler – plain text with timestamps, emptied on every start, git-ignored); the
console of `./dev.sh` shows all of them together. `./dev.sh up -d` waits until the API and the ERP
answer and prints the end of the log of a service that failed.

| Service | URL |
|---|---|
| ERP (Angular, SSL) | https://localhost:4200 |
| API | http://127.0.0.1:8000 |
| Mailpit (caught e-mails) | http://127.0.0.1:8025 |
| phpMyAdmin | http://127.0.0.1:8080 (`root` + `DB_ROOT_PASSWORD` from `dev/.env`) |
| Database from the host (DBeaver, …) | `127.0.0.1:3307` (inside Docker: `db:3306`) |

Project tools run in the dev container – no PHP / Node.js needed on the host:

```bash
./dev.sh artisan migrate          # php artisan … (tinker, queue:failed, …)
./dev.sh composer require x/y     # composer … in api/
./dev.sh npm install x            # npm … in erp/      (./dev.sh npx ng generate …)
./dev.sh test                     # all unit tests (erp + api) – tests/unit_tests/run_all.sh
./dev.sh shell                    # bash in the dev container   (./dev.sh shell api – in the running API)
./dev.sh rebuild                  # rebuild the image after changing PHP_VERSION / NODE_VERSION in .env
./dev.sh help                     # everything else
```

The repository is mounted into the containers, so changes in the editor apply at once
(`ng serve` recompiles, the API answers with the new code). Files the containers create
(`vendor/`, `node_modules/`, `build/`, logs) belong to your user.

### Background jobs (queue and scheduler)

| | Local development | Production |
|---|---|---|
| Queue | container `queue` (`queue:listen`), runs with `./dev.sh` | `queue:work` under Supervisor / systemd |
| Scheduler | off by default, `./dev.sh up --with-scheduler` or `./dev.sh artisan schedule:test` | system cron: `* * * * * php artisan schedule:run` |

The queue worker (and optionally the scheduler) run only while the environment runs. Neither
`dev.sh` nor `init-workspace.sh` ever adds or removes cron jobs.
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

The build runs **inside the dev container** (same PHP as the hosting, Composer, Node.js,
Chromium for the tests) – `deploy/build.sh` started on the host re-runs itself there
(`./dev.sh build` does the same; `BUILD_ON_HOST=1` builds with the host tools).

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
     `bash configure-server.sh` in the webroot. It also prepares the database:
     `db:create-if-missing` (on shared hosting create the empty database in the hosting panel
     first), `migrate --force` (whole schema on an empty database), `db:seed --force` (base data
     only – no test account in production) and `security:create-sysadmin --if-none`, which **asks
     for the e-mail and password of the first sysadmin** (typed in the console, never stored in a
     file; the e-mail is allowed in the e-mail access policy). 2FA by e-mail is forced for
     sysadmins, so `MAIL_*` must work before the first login. *(The database part of
     configure-server.sh is not tested on the server yet – go through its output carefully.)*
   - **Never regenerate `APP_KEY` on a running production** – it logs out all users and makes
     encrypted data unreadable.
   - Production `.env` must contain `APP_ENV=production` and `APP_DEBUG=false`; with debug on,
     error pages expose credentials and server paths.
6. **On the server** (in `laravel/`):
   ```bash
   php artisan down
   php artisan migrate --force       # existing database: only new migrations (the baseline is a no-op)
   php artisan db:seed --force       # adds new base data (e.g. new permission keys), changes nothing else
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

1. ~~**SQL migrations** (`database/migrations/*.sql`)~~ – **done on the server**; the scripts were
   removed with the root `database/` folder on 2026-10-31. Later schema changes are Laravel
   migrations, run by `php artisan migrate --force` (step 6 above).
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
7. **`APP_KEY` check** (open finding #67) – `api/.env.example` contained a real `APP_KEY` until
   2026-10-31. Make sure the production `laravel/.env` does **not** use that key
   (`git log -p -- api/.env.example` shows it); if it does, generate a new one in a planned window
   (`php artisan key:generate --force` – everyone is logged out, data encrypted with the old key
   can no longer be read).

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
- **No real personal data in the repository**: `api/database/` contains the schema, migrations
  and seeders only (placeholder data); database dumps (`./dev.sh db-dump` → `temp/`) stay outside git.
- User uploads (`storage/app/private`) are personal data – never copied into builds or shared.
- Retention of personal data is enforced by scheduled clean-up jobs (security events,
  import batches) – keep the production scheduler cron running.
- `dev/.env`, `dev/logs/`, `dev/pids/` and `build/` are git-ignored; check with `git status` before every commit.
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
| *port is already allocated* / *address already in use* | Something else uses the port (another app of web-platform, an old XAMPP / `php artisan serve`): `ss -ltnp \| grep 8000`, stop it, or change the port in `dev/.env`. |
| E-mails do not arrive in Mailpit | Inside Docker the mail goes to `mailpit:1025` (set by `dev/compose.yaml`); check `./dev.sh logs queue` and http://127.0.0.1:8025. |
| Queued jobs are not processed | `QUEUE_CONNECTION` must not be `sync` for queued jobs; check `./dev.sh status` and `./dev.sh artisan queue:failed`. |
| *permission denied … docker.sock* | Your user is not in the `docker` group yet: `sudo usermod -aG docker $USER`, log out and in (`./init-workspace.sh` offers it). |
| Files in the repository owned by root / another user | `HOST_UID` / `HOST_GID` in `dev/.env` do not match `id -u` / `id -g` – run `./init-workspace.sh` (fixes them), then `./dev.sh rebuild`; fix existing files with `sudo chown -R $USER: .` |
| *the input device is not a TTY* | Run the command in a terminal (not from a script / pipe) or use `docker compose run -T …`. |
| Build fails with *"Angular output not found"* | The output path is read from `outputPath` in `erp/angular.json`; override with `ANGULAR_OUTPUT=dist/<name> deploy/build.sh`. |
