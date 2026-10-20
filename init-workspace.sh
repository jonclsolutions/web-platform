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
#   1. System packages – PHP + extensions, Composer, Node.js, tools (dnf)
#   2. Mailpit         – local SMTP catcher, verified release → ~/.local/bin
#   3. Laravel         – api/.env, composer install, APP_KEY, storage symlink, permissions
#   4. Angular         – npm ci, local SSL certificate for `ng serve`
#   5. Repository      – .gitignore entries, executable scripts, git remote check
#   6. Shell aliases   – <app>, <app>-dev, <app>-build in your shell profile
#   7. Summary         – result + the manual steps: review api/.env, import the database
#
# @note THE DATABASE IS NOT CREATED BY THIS SCRIPT – create it and import the
# SQL dump in phpMyAdmin (https://localhost/phpmyadmin/); the summary prints the
# database name. Only one application runs at a time (all use ports 8000/4200).
#
# @note ISOLATION: everything the script writes belongs to this checkout
# (api/.env, vendor/, node_modules/, erp/ssl/, .dev/) or is a block named after
# the app (shell aliases), so any number of cloned apps can be set up on one
# machine without affecting each other. The user crontab is never touched.
#
# @security
#   - Never overwrites an existing api/.env and never regenerates an existing APP_KEY.
#   - Mailpit is installed only if its SHA-256 matches the digest GitHub publishes.
#   - Does not run as root; sudo is used only for dnf.
#   - The generated SSL key is for localhost only and is git-ignored.
#
# @usage
#   ./init-workspace.sh                full setup
#   ./init-workspace.sh --skip-system  skip dnf package installation
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
SSL_CERT="$SSL_DIR/laragon.crt"
SSL_KEY="$SSL_DIR/laragon.key"

SKIP_SYSTEM=0
WITH_ALIASES=1
ENV_CREATED=0      # 1 = api/.env was created by this run (summary asks to review it)

# -----------------------------------------------------------------------------
# Output helpers and result tracking (printed in the summary)
# -----------------------------------------------------------------------------
STEP=0
TOTAL_STEPS=7
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

    [[ "$EUID" -ne 0 ]] || die "do not run as root – the script uses sudo only for dnf"
    [[ -f "$API_DIR/composer.json" ]] || die "api/composer.json not found – run from the repository root"
    [[ -f "$ERP_DIR/package.json" ]]  || die "erp/package.json not found – run from the repository root"
    mkdir -p "$DEV_DIR"
}

# -----------------------------------------------------------------------------
# 1. System packages (Fedora / dnf) – only missing packages are installed.
# @note php-process = pcntl/posix (queue workers), php-mysqlnd = pdo_mysql,
# libxcrypt-compat = libcrypt.so.1 needed by XAMPP on current Fedora.
# -----------------------------------------------------------------------------
install_system_packages() {
    step "System packages"
    if [[ "$SKIP_SYSTEM" == "1" ]]; then skip "system packages (--skip-system)"; return 0; fi
    if ! command -v dnf >/dev/null; then
        warn "dnf not found – not Fedora; install PHP, Composer, Node.js, zip, rsync, openssl manually"
        return 0
    fi

    local wanted=(
        php-cli php-common php-mbstring php-xml php-mysqlnd php-intl php-pecl-zip
        php-gd php-bcmath php-process php-opcache php-sodium
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
# 4. Angular: dependencies and the local SSL certificate used by `ng serve`.
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
# 5. Repository hygiene – ignore rules, executable scripts, remote check.
# -----------------------------------------------------------------------------
setup_repository() {
    step "Repository"
    local gi="$ROOT_DIR/.gitignore" rule added=()
    touch "$gi"
    for rule in '.dev/' '/build/' '/app_build/' '.~lock.*#' '/erp/ssl/*.key'; do
        grep -qxF "$rule" "$gi" || { printf '%s\n' "$rule" >> "$gi"; added+=("$rule"); }
    done
    if [[ ${#added[@]} -gt 0 ]]; then done_ ".gitignore: added ${added[*]}"; else skip ".gitignore complete"; fi

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
# 6. Shell aliases – one marked block per application in ~/.zshrc or ~/.bashrc,
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
# 7. Summary – including the manual database step.
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

LAST STEPS – BY HAND
  1. Review api/.env   ($env_state)
       APP_NAME, APP_URL, FRONTEND_URL      name and local URLs of this app
       DB_DATABASE=${db:-<name>}, DB_USERNAME, DB_PASSWORD
                                            database used in step 2 (XAMPP default: root, no password)
       MAIL_FROM_ADDRESS, MAIL_FROM_NAME    sender of e-mails (caught locally by Mailpit)
       TURNSTILE_SECRET_KEY                 captcha – a public TEST key is preset for local use
       any other keys of this app (API keys, payment gateway, …) – see .env.example
     Never commit api/.env – it is git-ignored.

  2. Import the database in phpMyAdmin
       start XAMPP:     sudo $XAMPP_DIR/lampp start
       open:            https://localhost/phpmyadmin/
       create database: ${db:-<DB_DATABASE from api/.env>}   (collation utf8mb4_unicode_ci)
       import into it:  database/db.sql   (tab "Import")
     If you change DB_DATABASE in step 1, use the new name here.
EOF

    echo
    echo "=========================================="
    if [[ ${#WARNINGS[@]} -eq 0 ]]; then
        printf '\e[32m WORKSPACE SETUP COMPLETE – %s\e[0m\n' "$APP_SLUG"
        echo "=========================================="
        echo "Once api/.env is reviewed and the database '${db:-<name>}' is imported, start the application:"
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
setup_angular
setup_repository
setup_aliases
summary
