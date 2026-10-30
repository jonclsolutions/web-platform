#!/usr/bin/env bash
# =============================================================================
# @file init-workspace.sh
# @path init-workspace.sh (root of the web-platform monorepo)
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Prepares a freshly cloned application for LOCAL development on
# Fedora. It is universal – the same unchanged script works for web-platform and
# for every application cloned from it (the app name is taken from the directory):
#
#   git clone git@github.com:jonclsolutions/web-platform.git my-app
#   cd my-app && ./init-workspace.sh
#
# PREREQUISITE (checked first – the script stops without it):
#   XAMPP installed in /opt/lampp – https://www.apachefriends.org/download.html
#
# Steps (each one is skipped when already done – safe to run again, nothing
# existing is overwritten):
#   1. System packages – PHP + extensions (incl. pcov for test coverage), Composer, Node.js, tools
#                        (Fedora: dnf, Arch Linux: pacman)
#   2. Mailpit         – local SMTP catcher, verified release → ~/.local/bin
#   3. Laravel         – api/.env, composer install, APP_KEY, storage symlink, permissions
#   4. Database        – creates the database (XAMPP MariaDB), runs the migrations and the seeders:
#                        base data + the local test account sysadmin@sysadmin.sysadmin / 123456Ab.
#   5. Angular         – npm ci, local SSL certificate for `ng serve`
#   6. Repository      – .gitignore entries, executable scripts, .temp/ folder, git remote check
#   7. Shell aliases   – <app>, <app>-dev, <app>-build in your shell profile
#   8. Summary         – result + the manual step: review api/.env
#
# @refactor-note (2026-10-24) Open finding #54: the dev certificate of `ng serve` was a committed
#   Laragon key pair (`erp/ssl/laragon.*`). Laragon is no longer used (XAMPP); the pair is now
#   generated per developer as `erp/ssl/localhost.{crt,key}` and the whole `erp/ssl/` is git-ignored.
# @refactor-note (2026-10-30) Arch Linux support (step 1): packages via pacman, the PHP extensions
#   Arch ships disabled are enabled in /etc/php/conf.d/20-laravel-dev.ini, pcov (AUR only) is
#   reported, not installed. Step 3 stops with a clear message when Composer / PHP is missing
#   (before: "composer: command not found" from the ERR trap).
# @refactor-note (2026-10-30d) New step 4 "Database" replaces the manual phpMyAdmin import of
#   database/db.sql; step 6 creates the git-ignored .temp/ folder for local scratch files.
# @bugfix-note (2026-10-30) This file was stored without the executable bit (mode 100644): after a
#   clone / checkout `./init-workspace.sh` could not be started and git showed a mode change once
#   the script had made itself executable. Stored as 100755 now; a trailing space removed.
# @bugfix-note (2026-10-30b) Fresh Arch Linux (e.g. a VM): stops with instructions when sudo is
#   missing (not in a base installation) or the pacman database was never synced; installs
#   net-tools (netstat, used by XAMPP's lampp script).
# @bugfix-note (2026-10-30c) Used Arch Linux: installed packages are checked with `pacman -T`
#   (honours "provides") instead of `pacman -Q` (exact name) - with e.g. nodejs-lts-jod the script
#   tried to install nodejs, which conflicts and stopped the step.
# @note THE DATABASE IS CREATED BY THIS SCRIPT (step 4, since 2026-10-30): `db:create-if-missing`,
# `migrate`, `db:seed` - an existing database is never dropped or overwritten, only missing
# migrations and missing base data are added. Only one application runs at a time (all use
# ports 8000/4200).
#
# @note ISOLATION: everything the script writes belongs to this checkout
# (api/.env, vendor/, node_modules/, erp/ssl/, .dev/) or is a block named after
# the app (shell aliases), so any number of cloned apps can be set up on one
# machine without affecting each other. The user crontab is never touched.
#
# @security
#   - Never overwrites an existing api/.env and never regenerates an existing APP_KEY.
#   - Mailpit is installed only if its SHA-256 matches the digest GitHub publishes.
#   - Does not run as root; sudo is used only for the package manager (dnf / pacman) and, on
#     Arch Linux, to enable the required PHP extensions (/etc/php/conf.d/20-laravel-dev.ini).
#   - Never installs from the AUR (user-submitted, unreviewed) – it only tells what is missing.
#   - The generated SSL key is for localhost only and is git-ignored.
#
# @usage
#   ./init-workspace.sh                full setup
#   ./init-workspace.sh --skip-system  skip the system packages (dnf / pacman)
#   ./init-workspace.sh --no-aliases   do not touch the shell profile
#   ./init-workspace.sh --help
# =============================================================================

set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Paths and settings
# -----------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
ERP_DIR="$ROOT_DIR/erp"
DEV_DIR="$ROOT_DIR/.dev"
XAMPP_DIR="${XAMPP_DIR:-/opt/lampp}"
LOCAL_BIN="$HOME/.local/bin"

# Application name = directory name (lower-case, [a-z0-9-]); used for aliases
# and as the suggested database name of a new app.
APP_SLUG="$(basename "$ROOT_DIR" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
APP_SLUG="${APP_SLUG:-app}"

# Angular `ng serve` uses these (erp/angular.json → serve.options.sslKey/sslCert).
SSL_DIR="$ERP_DIR/ssl"
SSL_CERT="$SSL_DIR/localhost.crt"   # per developer, git-ignored (finding #54)
SSL_KEY="$SSL_DIR/localhost.key"

SKIP_SYSTEM=0
WITH_ALIASES=1
ENV_CREATED=0      # 1 = api/.env was created by this run (summary asks to review it)

# -----------------------------------------------------------------------------
# Output helpers and result tracking (printed in the summary)
# -----------------------------------------------------------------------------
STEP=0
TOTAL_STEPS=8
DONE=()
SKIPPED=()
WARNINGS=()

step() { STEP=$((STEP + 1)); printf '\n\e[34m[%d/%d]\e[0m %s\n' "$STEP" "$TOTAL_STEPS" "$*"; }
info() { printf '   - %s\n' "$*"; }
done_() { printf '\e[32m   ✓ %s\e[0m\n' "$*"; DONE+=("$*"); }
skip() { printf '   · %s\n' "$*"; SKIPPED+=("$*"); }
warn() { printf '\e[33m   ! %s\e[0m\n' "$*" >&2; WARNINGS+=("$*"); }
die()  { printf '\e[31mERROR: %s\e[0m\n' "$*" >&2; exit 1; }

trap '[[ $BASH_SUBSHELL -eq 0 ]] && die "setup failed at line $LINENO (command: $BASH_COMMAND)"; exit 1' ERR

for arg in "$@"; do
    case "$arg" in
        --skip-system) SKIP_SYSTEM=1 ;;
        --no-aliases)  WITH_ALIASES=0 ;;
        -h|--help) sed -n '/^# @usage/,/^# =====/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' | sed '$d'; exit 0 ;;
        *) die "unknown option: $arg (see --help)" ;;
    esac
done

# -----------------------------------------------------------------------------
# @description Reads one value from api/.env with the same semantics as Laravel:
# vlucas/phpdotenv when vendor/ exists, a simple parser otherwise.
# @param $1 key
# -----------------------------------------------------------------------------
env_get() {
    local key="$1"
    if [[ -f "$API_DIR/vendor/vlucas/phpdotenv/src/Dotenv.php" ]]; then
        (cd "$API_DIR" && php -r '
            require "vendor/autoload.php";
            $env = Dotenv\Dotenv::parse(file_get_contents(".env"));
            echo $env[$argv[1]] ?? "";' "$key")
        return
    fi
    local v
    v="$(grep -E "^[[:space:]]*$key=" "$API_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    if [[ "$v" == \"* ]]; then
        v="${v#\"}"; v="${v%\"*}"; v="${v//\\\"/\"}"; v="${v//\\\\/\\}"
    elif [[ "$v" == \'* ]]; then
        v="${v#\'}"; v="${v%\'*}"
    else
        v="${v%%[[:space:]]#*}"
    fi
    printf '%s' "$v"
}

# -----------------------------------------------------------------------------
# @description Sets KEY=VALUE in api/.env (replaces the line or appends).
# Used only on a freshly created .env, never on an existing one.
# @param $1 key, $2 value
# -----------------------------------------------------------------------------
env_set() {
    local key="$1" value="$2" file="$API_DIR/.env" tmp
    tmp="$(mktemp)"
    if grep -qE "^[[:space:]]*#?[[:space:]]*$key=" "$file"; then
        awk -v k="$key" -v v="$value" '
            !done && $0 ~ "^[[:space:]]*#?[[:space:]]*" k "=" { print k "=" v; done = 1; next }
            { print }' "$file" > "$tmp"
    else
        cat "$file" > "$tmp"
        printf '%s=%s\n' "$key" "$value" >> "$tmp"
    fi
    cat "$tmp" > "$file"
    rm -f "$tmp"
}

# -----------------------------------------------------------------------------
# @description Prerequisites. XAMPP is installed once per machine by hand, so
# its absence stops the script before anything is changed.
# -----------------------------------------------------------------------------
preflight() {
    printf '\nPREREQUISITE: XAMPP must be installed in %s before running this script.\n' "$XAMPP_DIR"
    printf '  Download: https://www.apachefriends.org/download.html\n'
    printf '  Install:  chmod +x xampp-linux-*-installer.run && sudo ./xampp-linux-*-installer.run\n\n'
    [[ -x "$XAMPP_DIR/lampp" ]] \
        || die "XAMPP not found in $XAMPP_DIR – install it first (see above), then run this script again"
    printf '\e[32m   ✓ XAMPP found in %s\e[0m\n' "$XAMPP_DIR"

    [[ "$EUID" -ne 0 ]] || die "do not run as root – the script uses sudo only for the package manager"
    # A minimal installation (e.g. Arch Linux base) has no sudo.
    command -v sudo >/dev/null \
        || die "sudo not found – install it as root (Arch: pacman -S sudo, then add your user to the wheel group: usermod -aG wheel <user>, and allow the group with EDITOR=nano visudo), then run this script again"
    [[ -f "$API_DIR/composer.json" ]] || die "api/composer.json not found – run from the repository root"
    [[ -f "$ERP_DIR/package.json" ]]  || die "erp/package.json not found – run from the repository root"
    mkdir -p "$DEV_DIR"
}

# -----------------------------------------------------------------------------
# 1. System packages – only missing packages are installed.
#    Fedora: dnf. Arch Linux: pacman (+ PHP extensions enabled in conf.d).
# -----------------------------------------------------------------------------
install_system_packages() {
    step "System packages"
    if [[ "$SKIP_SYSTEM" == "1" ]]; then skip "system packages (--skip-system)"; return 0; fi
    if command -v dnf >/dev/null; then
        install_packages_fedora
    elif command -v pacman >/dev/null; then
        install_packages_arch
    else
        warn "neither dnf (Fedora) nor pacman (Arch Linux) found – install PHP 8.2+ with the extensions of api/composer.lock, Composer, Node.js, zip, rsync, openssl manually"
        return 0
    fi
    check_tool_versions
}

# -----------------------------------------------------------------------------
# Fedora / dnf.
# @note php-process = pcntl/posix (queue workers), php-mysqlnd = pdo_mysql,
# libxcrypt-compat = libcrypt.so.1 needed by XAMPP on current Fedora.
# Unit tests (tests/unit_tests/api): php-pdo = pdo_sqlite (the tests run on SQLite
# in memory), php-pecl-pcov = code coverage driver (without it the tests still run,
# only the coverage is missing).
# -----------------------------------------------------------------------------
install_packages_fedora() {
    local wanted=(
        php-cli php-common php-mbstring php-xml php-mysqlnd php-intl php-pecl-zip
        php-gd php-bcmath php-process php-opcache php-sodium
        php-pdo php-pecl-pcov
        composer nodejs npm
        git unzip zip rsync openssl curl tar libxcrypt-compat
    )
    local missing=() p
    for p in "${wanted[@]}"; do
        rpm -q --whatprovides "$p" >/dev/null 2>&1 || missing+=("$p")
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        skip "all system packages already installed"
    else
        info "installing: ${missing[*]} (sudo)"
        sudo dnf install -y "${missing[@]}"
        done_ "installed: ${missing[*]}"
    fi
}

# -----------------------------------------------------------------------------
# Arch Linux / pacman.
# @note The `php` package contains mbstring, xml, curl, openssl, pcntl, posix, … built in, but
# ships bcmath, iconv, intl, mysqli, pdo_mysql and zip DISABLED; gd, sodium and sqlite
# (pdo_sqlite + sqlite3, needed by the unit tests) are separate packages, also disabled after
# installation. A package name the repositories do not know (renamed / merged) is reported, not
# installed, so one rename cannot stop the whole step. The script enables exactly the missing ones in ONE file of its own,
# /etc/php/conf.d/20-laravel-dev.ini (php.ini itself is never edited; delete the file to undo).
# libxcrypt-compat = libcrypt.so.1 and net-tools = netstat, both needed by XAMPP (its `lampp`
# script checks the ports with netstat; a base Arch has neither). No `-Sy`: a sync without upgrade is a partial
# upgrade, which Arch does not support - when packages cannot be found, run `sudo pacman -Syu`.
# pcov (coverage driver of the unit tests) exists only in the AUR, which this script never uses.
# -----------------------------------------------------------------------------
install_packages_arch() {
    local wanted=(
        php php-gd php-sodium php-sqlite
        composer nodejs npm
        git unzip zip rsync openssl curl tar libxcrypt-compat net-tools
    )
    local missing=() unknown=() p
    for p in "${wanted[@]}"; do
        # -T (deptest) also accepts a package that PROVIDES the name (nodejs-lts-* → nodejs, …),
        # so an existing alternative is kept instead of being replaced (= conflict, abort).
        pacman -T "$p" >/dev/null 2>&1 && continue
        if pacman -Si "$p" >/dev/null 2>&1; then missing+=("$p"); else unknown+=("$p"); fi
    done
    # `php` unknown = the package database was never synced (fresh installation) - nothing would work.
    [[ " ${unknown[*]} " != *" php "* ]] \
        || die "pacman does not know the package 'php' – the package database is not synced: run sudo pacman -Syu, then this script again"
    [[ ${#unknown[@]} -eq 0 ]] \
        || warn "not found in the pacman repositories: ${unknown[*]} – update the package database (sudo pacman -Syu) or install them yourself"
    if [[ ${#missing[@]} -eq 0 ]]; then
        skip "all system packages already installed"
    else
        info "installing: ${missing[*]} (sudo pacman)"
        sudo pacman -S --needed --noconfirm "${missing[@]}" \
            || die "pacman could not install the packages – update the system first (sudo pacman -Syu), then run this script again"
        done_ "installed: ${missing[*]}"
    fi

    enable_php_extensions_arch

    if php -m 2>/dev/null | grep -qix pcov; then
        skip "pcov (test coverage) already available"
    else
        # Optional - not a warning (the setup is complete without it).
        skip "pcov not installed (AUR only): the unit tests run, only their coverage is missing – for coverage install it yourself, e.g. 'yay -S php-pcov' (review the PKGBUILD first)"
    fi
}

# -----------------------------------------------------------------------------
# @description Enables the PHP extensions Laravel / the tests need and Arch ships disabled.
# Only extensions php -m does not list yet are written; an existing file of this script is
# extended, never replaced.
# -----------------------------------------------------------------------------
enable_php_extensions_arch() {
    local wanted=(bcmath gd iconv intl mysqli pdo_mysql pdo_sqlite sodium sqlite3 zip)
    local scan_dir ini loaded missing=() e
    scan_dir="$(php -r 'echo PHP_CONFIG_FILE_SCAN_DIR;' 2>/dev/null || true)"
    [[ -n "$scan_dir" ]] || scan_dir=/etc/php/conf.d
    ini="$scan_dir/20-laravel-dev.ini"
    loaded="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
    for e in "${wanted[@]}"; do
        grep -qx "$e" <<<"$loaded" || missing+=("$e")
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        skip "PHP extensions already enabled"
        return 0
    fi

    info "enabling PHP extensions in $ini: ${missing[*]} (sudo)"
    sudo mkdir -p "$scan_dir"
    if [[ ! -f "$ini" ]]; then
        printf '; Written by init-workspace.sh (Laravel development) - extensions Arch ships disabled.\n; Delete this file to undo.\n' \
            | sudo tee "$ini" >/dev/null
    fi
    for e in "${missing[@]}"; do
        printf 'extension=%s\n' "$e" | sudo tee -a "$ini" >/dev/null
    done

    loaded="$(php -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"
    local still=()
    for e in "${missing[@]}"; do grep -qx "$e" <<<"$loaded" || still+=("$e"); done
    if [[ ${#still[@]} -eq 0 ]]; then
        done_ "PHP extensions enabled: ${missing[*]}"
    else
        warn "PHP extensions still not loaded: ${still[*]} – check $ini and 'php -m'"
    fi
}

# -----------------------------------------------------------------------------
# @description Prints / checks the versions of PHP, Composer and Node.js.
# -----------------------------------------------------------------------------
check_tool_versions() {
    # Angular 21 requires Node.js ^20.19 || ^22.12 || >=24.
    local node_major
    node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if (( node_major < 20 )); then
        warn "Node.js $(node -v 2>/dev/null || echo 'missing') is too old for Angular 21 (need 20.19+, 22.12+ or 24+)"
    else
        info "PHP $(php -r 'echo PHP_VERSION;'), Composer $(composer --version 2>/dev/null | awk '{print $3}'), Node.js $(node -v)"
    fi
}

# -----------------------------------------------------------------------------
# 2. Mailpit – latest GitHub release, installed only after checksum verification.
# Mailpit ships no checksums file; GitHub publishes a SHA-256 `digest` for every
# release asset in its REST API – that is what is verified. Nothing unverified runs.
# -----------------------------------------------------------------------------
install_mailpit() {
    step "Mailpit"
    if command -v mailpit >/dev/null || [[ -x "$LOCAL_BIN/mailpit" ]]; then
        skip "Mailpit already installed"
        return 0
    fi

    local arch
    case "$(uname -m)" in
        x86_64)  arch=amd64 ;;
        aarch64) arch=arm64 ;;
        *) warn "unsupported CPU $(uname -m) – install Mailpit manually"; return 0 ;;
    esac

    local tmp asset="mailpit-linux-$arch.tar.gz" meta tag url digest
    tmp="$(mktemp -d)"
    if ! curl -fsSL -o "$tmp/release.json" https://api.github.com/repos/axllent/mailpit/releases/latest; then
        rm -rf "$tmp"; warn "cannot reach GitHub – install Mailpit manually"; return 0
    fi
    meta="$(php -r '
        $r = json_decode(file_get_contents($argv[1]), true);
        foreach ($r["assets"] ?? [] as $a) {
            if ($a["name"] === $argv[2]) {
                echo $r["tag_name"], " ", $a["browser_download_url"], " ", preg_replace("/^sha256:/", "", $a["digest"] ?? ""), "\n";
            }
        }' "$tmp/release.json" "$asset")"
    read -r tag url digest <<< "$meta"
    if [[ -z "${url:-}" || ! "${digest:-}" =~ ^[0-9a-f]{64}$ ]]; then
        rm -rf "$tmp"; warn "Mailpit release has no verifiable $asset – NOT installed, install it manually"; return 0
    fi
    if ! curl -fsSL -o "$tmp/$asset" "$url"; then
        rm -rf "$tmp"; warn "Mailpit $tag download failed – install it manually"; return 0
    fi
    if ! printf '%s  %s\n' "$digest" "$tmp/$asset" | sha256sum -c --status -; then
        rm -rf "$tmp"; warn "Mailpit checksum mismatch – NOT installed"; return 0
    fi

    mkdir -p "$LOCAL_BIN"
    tar -xzf "$tmp/$asset" -C "$tmp" mailpit
    install -m 0755 "$tmp/mailpit" "$LOCAL_BIN/mailpit"
    rm -rf "$tmp"
    done_ "Mailpit $tag installed to ~/.local/bin (checksum verified)"
}

# -----------------------------------------------------------------------------
# 3. Laravel: .env, dependencies, application key, storage symlink, permissions.
# -----------------------------------------------------------------------------
setup_laravel() {
    step "Laravel (api/)"

    if [[ -f "$API_DIR/.env" ]]; then
        skip "api/.env exists – left unchanged"
    else
        [[ -f "$API_DIR/.env.example" ]] || die "api/.env.example is missing"
        cp "$API_DIR/.env.example" "$API_DIR/.env"
        chmod 600 "$API_DIR/.env"
        # Local development defaults – applied only to this freshly created file.
        env_set APP_ENV local
        env_set APP_DEBUG true
        env_set APP_URL "http://127.0.0.1:8000"
        env_set FRONTEND_URL "https://localhost:4200"
        env_set DB_CONNECTION mysql
        env_set DB_HOST 127.0.0.1
        env_set DB_PORT 3306
        env_set DB_DATABASE "${APP_SLUG//-/_}"
        env_set DB_USERNAME root
        env_set DB_PASSWORD ""
        env_set QUEUE_CONNECTION database
        env_set MAIL_MAILER smtp
        env_set MAIL_HOST 127.0.0.1      # not "localhost": may resolve to ::1 where Mailpit does not listen
        env_set MAIL_PORT 1025
        env_set ANGULAR_I18N_PATH ../erp/src/assets/i18n
        # Cloudflare Turnstile official always-pass TEST secret (public, local only).
        [[ -n "$(env_get TURNSTILE_SECRET_KEY)" ]] || env_set TURNSTILE_SECRET_KEY 1x0000000000000000000000000000000AA
        ENV_CREATED=1
        done_ "api/.env created with local defaults (database: ${APP_SLUG//-/_}) – review it, see the summary"
    fi

    command -v php >/dev/null || die "PHP not found – install PHP 8.2+ (step 1), then run this script again"
    command -v composer >/dev/null || die "Composer not found – install it (step 1), then run this script again"
    info "composer install"
    (cd "$API_DIR" && composer install --no-interaction --no-progress)
    done_ "Composer dependencies installed"

    # Never regenerate an existing key: it would invalidate sessions and encrypted data.
    if [[ -z "$(env_get APP_KEY)" ]]; then
        (cd "$API_DIR" && php artisan key:generate --no-interaction >/dev/null)
        done_ "APP_KEY generated"
    else
        skip "APP_KEY already set – not regenerated"
    fi

    # Git does not keep empty directories – create the storage skeleton Laravel
    # expects BEFORE checking the symlink (its target must exist to be resolved).
    mkdir -p "$API_DIR"/storage/{logs,app/private,app/public} \
             "$API_DIR"/storage/framework/{cache/data,sessions,views} "$API_DIR"/bootstrap/cache
    chmod -R u+rwX,g+rwX "$API_DIR/storage" "$API_DIR/bootstrap/cache"
    info "storage/ and bootstrap/cache are writable"

    # The repository may contain a stale symlink from an old checkout path:
    # dangling, or resolving somewhere else than this checkout's storage.
    local link="$API_DIR/public/storage" target="$API_DIR/storage/app/public"
    if [[ -L "$link" ]] && { [[ ! -e "$link" ]] || [[ "$(readlink -f "$link")" != "$(readlink -f "$target")" ]]; }; then
        info "removing stale storage symlink → $(readlink "$link")"
        rm "$link"
    fi
    if [[ -L "$link" ]]; then
        skip "public/storage symlink OK"
    else
        (cd "$API_DIR" && php artisan storage:link --no-interaction >/dev/null)
        done_ "public/storage symlink created"
    fi

    # Config cache only – the cache store may be the database, which may not exist yet.
    (cd "$API_DIR" && php artisan config:clear --no-interaction >/dev/null 2>&1) || true
}

# -----------------------------------------------------------------------------
# 4. Database – created, migrated and seeded through Laravel (no phpMyAdmin step).
# @note Only a LOCAL database (DB_HOST 127.0.0.1 / localhost) is handled here; MariaDB of XAMPP
# is started for the step when it is not running and stopped again afterwards (dev.sh starts it
# for the work itself). An existing database is never dropped: `migrate` adds only missing
# migrations (the baseline migration is a no-op on a filled database) and the seeders add only
# missing base data. With APP_ENV=local the seeders also create the test sysadmin
# sysadmin@sysadmin.sysadmin / 123456Ab. and the test roles (DevelopmentSeeder).
# -----------------------------------------------------------------------------
MYSQL_STARTED=0

setup_database() {
    step "Database"
    local db host port
    db="$(env_get DB_DATABASE)"; host="$(env_get DB_HOST)"; port="$(env_get DB_PORT)"
    port="${port:-3306}"
    if [[ "$host" != "127.0.0.1" && "$host" != "localhost" ]]; then
        warn "DB_HOST=$host is not local – the database is not created by this script (create it there, then run: cd api && php artisan migrate && php artisan db:seed)"
        return 0
    fi

    if ! port_open "$port"; then
        info "starting MariaDB of XAMPP for this step (sudo)"
        sudo "$XAMPP_DIR/lampp" startmysql >/dev/null
        MYSQL_STARTED=1
        local _
        for _ in $(seq 1 30); do port_open "$port" && break; sleep 1; done
        port_open "$port" || { warn "MariaDB of XAMPP did not start on port $port – see $XAMPP_DIR/var/mysql/*.err, then run this script again"; return 0; }
    fi

    if ! (cd "$API_DIR" && php artisan db:create-if-missing --no-interaction); then
        warn "database '${db:-?}' could not be created – check DB_* in api/.env, then run this script again"
        stop_started_mysql; return 0
    fi
    if ! (cd "$API_DIR" && php artisan migrate --force --no-interaction); then
        warn "migrations failed – see the output above, then run this script again"
        stop_started_mysql; return 0
    fi
    if ! (cd "$API_DIR" && php artisan db:seed --force --no-interaction); then
        warn "seeding the base data failed – see the output above, then run this script again"
        stop_started_mysql; return 0
    fi

    if [[ "$(env_get APP_ENV)" == "local" ]]; then
        done_ "database '$db' ready – test login: sysadmin@sysadmin.sysadmin / 123456Ab. (2FA code in Mailpit)"
    else
        done_ "database '$db' ready (APP_ENV is not local – no test account created)"
    fi
    stop_started_mysql
}

# @description Whether something listens on 127.0.0.1:<port> (bash /dev/tcp, no extra tools).
port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# @description Stops MariaDB of XAMPP again when this script started it.
stop_started_mysql() {
    if [[ "$MYSQL_STARTED" == "1" ]]; then
        sudo "$XAMPP_DIR/lampp" stopmysql >/dev/null || true
        MYSQL_STARTED=0
        info "MariaDB of XAMPP stopped again (./dev.sh starts it)"
    fi
}

# -----------------------------------------------------------------------------
# @description Creates the git-ignored .temp/ folder for local scratch files (images, files,
# media, notes) with an info.txt explaining it. An existing info.txt is left unchanged.
# -----------------------------------------------------------------------------
setup_temp_dir() {
    local dir="$ROOT_DIR/.temp"
    mkdir -p "$dir"
    if [[ -f "$dir/info.txt" ]]; then
        skip ".temp/ exists"
        return 0
    fi
    cat > "$dir/info.txt" <<'TXT'
.temp/ – DOČASNÉ LOKÁLNÍ SOUBORY PRO VÝVOJ
==========================================

Tato složka slouží pro dočasné lokální soubory používané při vývoji – obrázky,
soubory, média a poznámky, které zůstávají jen na tomto počítači, ale vše na
jednom místě.

Složka je v .gitignore: nic odtud se necommitne ani nenasadí.

UPOZORNĚNÍ: nenechávejte tu nic důležitého – obsah se může snadno smazat
(úklid, nový checkout, nová instalace). Co je potřeba zachovat, patří do repozitáře
nebo do zálohy.

---
Temporary local files for development (images, files, media, notes) – kept only on this
machine, all in one place. Git-ignored. Do not keep anything important here: it can be
deleted easily.
TXT
    done_ ".temp/ created (local scratch folder, git-ignored – see .temp/info.txt)"
}

# -----------------------------------------------------------------------------
# 5. Angular: dependencies and the local SSL certificate used by `ng serve`.
# -----------------------------------------------------------------------------
setup_angular() {
    step "Angular (erp/)"

    info "installing npm dependencies"
    if [[ -f "$ERP_DIR/package-lock.json" ]]; then
        (cd "$ERP_DIR" && npm ci --no-audit --no-fund)
    else
        (cd "$ERP_DIR" && npm install --no-audit --no-fund)
    fi
    done_ "npm dependencies installed"

    if [[ -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
        skip "local SSL certificate exists"
    else
        mkdir -p "$SSL_DIR"
        if command -v mkcert >/dev/null; then
            mkcert -cert-file "$SSL_CERT" -key-file "$SSL_KEY" localhost 127.0.0.1 ::1 >/dev/null 2>&1
            done_ "trusted local SSL certificate created with mkcert"
        else
            openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
                -keyout "$SSL_KEY" -out "$SSL_CERT" -subj "/CN=localhost" \
                -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" >/dev/null 2>&1
            done_ "self-signed local SSL certificate created (install mkcert for a browser-trusted one)"
        fi
        chmod 600 "$SSL_KEY"
    fi
}

# -----------------------------------------------------------------------------
# 6. Repository hygiene – ignore rules, executable scripts, .temp/ folder, remote check.
# -----------------------------------------------------------------------------
setup_repository() {
    step "Repository"
    local gi="$ROOT_DIR/.gitignore" rule added=()
    touch "$gi"
    for rule in '.dev/' '/build/' '/app_build/' '.~lock.*#' '/erp/ssl/' '/.temp/'; do
        grep -qxF "$rule" "$gi" || { printf '%s\n' "$rule" >> "$gi"; added+=("$rule"); }
    done
    if [[ ${#added[@]} -gt 0 ]]; then done_ ".gitignore: added ${added[*]}"; else skip ".gitignore complete"; fi

    setup_temp_dir

    local s
    for s in dev.sh deploy/build.sh init-workspace.sh; do
        [[ -f "$ROOT_DIR/$s" ]] && chmod +x "$ROOT_DIR/$s"
    done
    info "scripts are executable"

    # A new application cloned from web-platform must not push into the base repository.
    local origin
    origin="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"
    if [[ "$APP_SLUG" != "web-platform" && "$origin" =~ /web-platform(\.git)?$ ]]; then
        warn "this app still pushes to web-platform – run: git remote rename origin upstream && git remote add origin <new-app-repo-url>"
    fi
    return 0
}

# -----------------------------------------------------------------------------
# 7. Shell aliases – one marked block per application in ~/.zshrc or ~/.bashrc,
# replaced on every run (so several cloned apps never overwrite each other).
# -----------------------------------------------------------------------------
setup_aliases() {
    step "Shell aliases"
    local names="$APP_SLUG, $APP_SLUG-dev, $APP_SLUG-build"
    if [[ "$WITH_ALIASES" == "0" ]]; then skip "aliases (--no-aliases)"; return 0; fi

    local rc
    case "${SHELL##*/}" in zsh) rc="$HOME/.zshrc" ;; *) rc="$HOME/.bashrc" ;; esac
    touch "$rc"
    local start="# >>> init-workspace: $APP_SLUG >>>" end="# <<< init-workspace: $APP_SLUG <<<"
    # Block written by the first version of this script (wp/wpdev/wpbuild) – replaced.
    local legacy_s='# >>> web-platform (init-workspace.sh) >>>' legacy_e='# <<< web-platform (init-workspace.sh) <<<'
    local tmp; tmp="$(mktemp)"
    awk -v s="$start" -v e="$end" -v ls="$legacy_s" -v le="$legacy_e" '
        $0 == s || $0 == ls {skip = 1}
        !skip {print}
        $0 == e || $0 == le {skip = 0}' "$rc" > "$tmp"
    {
        printf '%s\n' "$start"
        # shellcheck disable=SC2016  # $HOME/$PATH are expanded by the shell profile, not here
        printf 'case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac\n'
        printf "alias %s='cd %q'\n" "$APP_SLUG" "$ROOT_DIR"
        printf "alias %s-dev='%q/dev.sh'\n" "$APP_SLUG" "$ROOT_DIR"
        printf "alias %s-build='%q/deploy/build.sh'\n" "$APP_SLUG" "$ROOT_DIR"
        printf '%s\n' "$end"
    } >> "$tmp"
    cat "$tmp" > "$rc"
    rm -f "$tmp"
    done_ "aliases $names added to ~${rc#"$HOME"} (open a new terminal)"
}

# -----------------------------------------------------------------------------
# 8. Summary – including the manual review of api/.env.
# -----------------------------------------------------------------------------
summary() {
    step "Summary"
    if (cd "$API_DIR" && composer check-platform-reqs --lock --no-interaction >/dev/null 2>&1); then
        info "PHP satisfies api/composer.lock"
    else
        warn "PHP does not satisfy api/composer.lock – run 'composer check-platform-reqs --lock' in api/"
    fi

    local db; db="$(env_get DB_DATABASE)"
    echo
    printf 'Done: %d · already set up: %d\n' "${#DONE[@]}" "${#SKIPPED[@]}"
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        printf '\e[33mWarnings: %d – fix them and run ./init-workspace.sh again:\e[0m\n' "${#WARNINGS[@]}"
        local w; for w in "${WARNINGS[@]}"; do printf '  ! %s\n' "$w"; done
    fi

    local env_state="existing file – check it still matches this app"
    [[ "$ENV_CREATED" == "1" ]] && env_state="CREATED NOW from .env.example – review it before the first start"

    cat <<EOF

LAST STEP – BY HAND
  1. Review api/.env   ($env_state)
       APP_NAME, APP_URL, FRONTEND_URL      name and local URLs of this app
       DB_DATABASE=${db:-<name>}, DB_USERNAME, DB_PASSWORD
                                            database of step 4 (XAMPP default: root, no password)
       MAIL_FROM_ADDRESS, MAIL_FROM_NAME    sender of e-mails (caught locally by Mailpit)
       TURNSTILE_SECRET_KEY                 captcha – a public TEST key is preset for local use
       any other keys of this app (API keys, payment gateway, …) – see .env.example
     Never commit api/.env – it is git-ignored.
     After changing DB_* run this script again – step 4 creates and fills the new database.

  LOCAL TEST LOGIN (APP_ENV=local only)
       e-mail:   sysadmin@sysadmin.sysadmin
       password: 123456Ab.
       2FA code: in Mailpit – http://127.0.0.1:8025 (sysadmin always needs 2FA)
       test roles: read-only-core, read-only-web, read-only-shop, editor-web, editor-shop, manager
EOF

    echo
    echo "=========================================="
    if [[ ${#WARNINGS[@]} -eq 0 ]]; then
        printf '\e[32m WORKSPACE SETUP COMPLETE – %s\e[0m\n' "$APP_SLUG"
        echo "=========================================="
        echo "Once api/.env is reviewed, start the application:"
        echo "  ./dev.sh        (Ctrl+C stops everything)"
    else
        printf '\e[33m WORKSPACE SETUP INCOMPLETE – %s\e[0m\n' "$APP_SLUG"
        echo "=========================================="
        echo "Fix the warnings above and run ./init-workspace.sh again."
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
echo "------------------------------------------"
echo "Workspace setup – $APP_SLUG"
echo "------------------------------------------"
preflight
install_system_packages
install_mailpit
setup_laravel
setup_database
setup_angular
setup_repository
setup_aliases
summary
