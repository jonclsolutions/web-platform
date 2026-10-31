#!/usr/bin/env bash
# =============================================================================
# @file init-workspace.sh
# @path init-workspace.sh (root of the web-platform monorepo)
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Prepares a freshly cloned application for LOCAL development - in DOCKER, so it
# runs the same on every machine (any Linux, macOS, Windows via WSL 2): the host needs only Docker and
# git, PHP / Composer / Node.js / MariaDB / Mailpit run in containers (dev/compose.yaml,
# dev/docker/Dockerfile). It is universal – the same unchanged script works for web-platform and
# for every application cloned from it (the app name is taken from the directory):
#
#   git clone git@github.com:jonclsolutions/web-platform.git my-app
#   cd my-app && ./init-workspace.sh          (Linux, macOS)
#   init-workspace.cmd                         (Windows - prepares WSL 2 + Docker Desktop, then runs
#                                               this script inside WSL)
#
# (No SSH key on GitHub yet? Clone over HTTPS - https://github.com/jonclsolutions/web-platform.git -
#  and let step 1 connect this computer over SSH; it then offers to switch the remote to SSH.)
#
# Steps (each one is skipped when already done – safe to run again, nothing
# existing is overwritten):
#   1. GitHub (SSH)    – checks the SSH connection to GitHub; when missing it offers to connect
#                        (SSH key, adding it on GitHub, check) – may be skipped
#   2. Temp folder     – temp/ with temp.txt: local scratch space (media, notes, …), git-ignored
#   3. Docker          – Docker + Compose + buildx present and usable: Linux – installed with the
#                        package manager (asked), on demand (docker.socket), docker group;
#                        macOS – Docker Desktop (brew, asked) started; WSL – Docker Desktop
#   4. Docker settings – dev/.env from dev/.env.example: project name, your UID / GID, random local
#                        database password
#   5. Images          – builds the dev image (PHP 8.5, Composer, Node.js, Chromium) and pulls
#                        MariaDB, Mailpit, phpMyAdmin
#   6. Laravel         – api/.env, composer install, APP_KEY, storage folders + symlink
#   7. Database        – creates the database in the MariaDB container, runs the migrations and
#                        the seeders: base data + the local test account sysadmin@sysadmin.sysadmin
#   8. Angular         – npm ci, local SSL certificate for `ng serve`
#   9. Repository      – .gitignore entries, executable scripts, git remote check
#  10. Shell aliases   – <app>, <app>-dev, <app>-build in your shell profile
#  11. Summary         – result + the manual step: review api/.env
#
# @refactor-note (2026-10-24) Open finding #54: the dev certificate of `ng serve` was a committed
#   Laragon key pair (`erp/ssl/laragon.*`); it is generated per developer as
#   `erp/ssl/localhost.{crt,key}` and the whole `erp/ssl/` is git-ignored.
# @refactor-note (2026-10-30) Arch Linux support (pacman packages, PHP extensions in conf.d).
# @refactor-note (2026-10-30d) Database created by Laravel (db:create-if-missing, migrate,
#   db:seed) instead of the manual phpMyAdmin import; .temp/ folder for local scratch files.
# @bugfix-note (2026-10-30) Stored as 100755 (it was 100644 – `./init-workspace.sh` could not start).
# @refactor-note (2026-10-31b) GitHub (SSH) as the first step; .temp/temp.txt right after the clone.
# @refactor-note (2026-10-31c) DOCKER instead of host packages: the steps "System packages"
#   (dnf / pacman, PHP extensions, pcov from the AUR) and "Mailpit" (~/.local/bin) and the XAMPP
#   prerequisite are gone - PHP 8.5 (like the FORPSI hosting), Composer, Node.js 24, Chromium,
#   MariaDB, Mailpit and phpMyAdmin are containers. Every PHP / Node.js command of this script
#   runs in the dev container; the host is not changed except Docker itself (asked first).
#   The database of a former XAMPP installation is NOT moved automatically - see the summary
#   (`./dev.sh db-import`). The storage symlink is relative now (valid on the host and in the
#   container).
# @refactor-note (2026-10-31e) EVERY PLATFORM: Linux (Docker installed with the package manager of
#   Arch, Debian / Ubuntu, Fedora, openSUSE - asked), macOS (Docker Desktop via Homebrew, bash 4+
#   from Homebrew - the script re-runs itself with it) and Windows (WSL 2 + Docker Desktop:
#   init-workspace.cmd prepares them and runs this script inside WSL). Platform detected by
#   `uname` / /proc/version - no menu.
# @refactor-note (2026-10-31g) The scratch folder is temp/ (was .temp/ - hidden on some systems);
#   an existing .temp/ is renamed once, with its content.
# @refactor-note (2026-10-31f) Root clean-up: everything of the local environment lives in dev/
#   (compose.yaml, .env / .env.example, docker/Dockerfile, windows/*.ps1, logs/, pids/); the
#   root keeps only the entry points. A root .env of the previous layout is moved to dev/.env.
# @refactor-note (2026-10-31d) Docker on demand: step 3 enables docker.socket instead of
#   docker.service (asked; an enabled docker.service is offered the switch) - the daemon starts
#   on the first docker command, not with the computer.
# @note THE DATABASE IS CREATED BY THIS SCRIPT (step 7): `db:create-if-missing`, `migrate`,
#   `db:seed` - an existing database is never dropped or overwritten, only missing migrations and
#   missing base data are added. Its data live in the Docker volume <app>_db-data.
#
# @note ISOLATION: everything the script writes belongs to this checkout (dev/.env, api/.env,
# vendor/, node_modules/, erp/ssl/, temp/) or is named after the app (Docker project
# <app>: containers, volumes, network; shell alias block), so any number of cloned apps can be
# set up on one machine without affecting each other. The user crontab is never touched.
#
# @security
#   - GitHub SSH: github.com is trusted only with the host key GitHub publishes (pinned below, no
#     "trust on first use"); a new key pair is created only after asking, with ssh-keygen (it asks
#     for a passphrase); only the PUBLIC key is ever printed / copied, the private key never leaves
#     ~/.ssh. An existing key, ~/.ssh/config or known_hosts entry is never changed.
#   - Never overwrites an existing .env / api/.env and never regenerates an existing APP_KEY.
#   - The local database password is random (openssl / /dev/urandom), stored only in the
#     git-ignored dev/.env and never printed; every port of the containers is bound to 127.0.0.1.
#   - Docker starts on demand (docker.socket), never with the computer; the app containers have
#     no restart policy - nothing of the app runs unless ./dev.sh was started.
#   - Does not run as root; sudo is used only to install / start Docker and to add you to the
#     docker group (all asked first). Membership of the docker group equals root access on this
#     machine – that is how Docker works; rootless Docker is an alternative (see README).
#   - The generated SSL key is for localhost only and is git-ignored.
#
# @usage
#   ./init-workspace.sh                full setup
#   ./init-workspace.sh --no-aliases   do not touch the shell profile
#   ./init-workspace.sh --help
# =============================================================================

# macOS ships bash 3.2 (too old for this script) - re-run with bash 4+ from Homebrew.
if [ -z "${BASH_VERSINFO:-}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    for _bash in /opt/homebrew/bin/bash /usr/local/bin/bash; do
        [ -x "$_bash" ] && exec "$_bash" "$0" "$@"
    done
    echo "ERROR: bash 4 or newer is needed (this is bash ${BASH_VERSION:-?}). macOS: install Homebrew (https://brew.sh), then: brew install bash – and run ./init-workspace.sh again" >&2
    exit 1
fi

set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Paths and settings
# -----------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
ERP_DIR="$ROOT_DIR/erp"
DOCKER_ENV="$ROOT_DIR/dev/.env"

# Application name = directory name (lower-case, [a-z0-9-]); used for the Docker project,
# the aliases and as the suggested database name of a new app.
APP_SLUG="$(basename "$ROOT_DIR" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
APP_SLUG="${APP_SLUG:-app}"

# Angular `ng serve` uses these (erp/angular.json → serve.options.sslKey/sslCert).
SSL_DIR="$ERP_DIR/ssl"
SSL_CERT="$SSL_DIR/localhost.crt"   # per developer, git-ignored (finding #54)
SSL_KEY="$SSL_DIR/localhost.key"

# GitHub over SSH. Host key of github.com as published by GitHub
# (https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints,
# Ed25519 SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU) - added to ~/.ssh/known_hosts only
# when github.com is not there yet, so the first connection needs no "trust on first use".
GITHUB_SSH="git@github.com"
GITHUB_HOST_KEY="github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"
GITHUB_KEYS_URL="https://github.com/settings/ssh/new"

# Platform: linux, macos or wsl (Linux inside WSL 2 on Windows - Docker Desktop provides Docker).
case "$(uname -s)" in
    Darwin) OS_KIND=macos ;;
    *) if grep -qi microsoft /proc/version 2>/dev/null; then OS_KIND=wsl; else OS_KIND=linux; fi ;;
esac

WITH_ALIASES=1
ENV_CREATED=0      # 1 = api/.env was created by this run (summary asks to review it)

# -----------------------------------------------------------------------------
# Output helpers and result tracking (printed in the summary)
# -----------------------------------------------------------------------------
STEP=0
TOTAL_STEPS=11
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
        --no-aliases)  WITH_ALIASES=0 ;;
        -h|--help) sed -n '/^# @usage/,/^# =====/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' | sed '$d'; exit 0 ;;
        *) die "unknown option: $arg (see --help)" ;;
    esac
done

# -----------------------------------------------------------------------------
# @description Reads one value from a dotenv file (KEY=VALUE; quotes and trailing comments
# removed). No PHP needed - the host has none.
# @param $1 key, $2 file (default api/.env)
# -----------------------------------------------------------------------------
env_get() {
    local key="$1" file="${2:-$API_DIR/.env}" v
    v="$(grep -E "^[[:space:]]*$key=" "$file" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
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
# @description Sets KEY=VALUE in a dotenv file (replaces the line or appends).
# @param $1 key, $2 value, $3 file (default api/.env)
# -----------------------------------------------------------------------------
env_set() {
    local key="$1" value="$2" file="${3:-$API_DIR/.env}" tmp
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

# @description docker compose of this repository (from the root, with the root .env).
dc() { docker compose -f "$ROOT_DIR/dev/compose.yaml" "$@"; }

# @description Runs a command in a new dev container (removed afterwards), without the database.
# @param $1 directory inside the repository (api, erp or .), rest = command
in_app() { local dir="$1"; shift; dc run --rm --no-deps -T -w "/workspace/${dir#.}" api "$@"; }

# @description Same, with the database and Mailpit started (artisan commands that need them).
in_app_db() { local dir="$1"; shift; dc run --rm -T -w "/workspace/${dir#.}" api "$@"; }

# -----------------------------------------------------------------------------
# @description Basic checks before anything is changed: not root, run from the repository root.
# -----------------------------------------------------------------------------
preflight() {
    [[ "$EUID" -ne 0 ]] || die "do not run as root – the script asks for sudo only where it is needed"
    [[ -f "$API_DIR/composer.json" ]] || die "api/composer.json not found – run from the repository root"
    [[ -f "$ERP_DIR/package.json" ]]  || die "erp/package.json not found – run from the repository root"
    [[ -f "$ROOT_DIR/dev/compose.yaml" ]] || die "dev/compose.yaml not found – run from the repository root"
    if [[ "$OS_KIND" == "wsl" && "$ROOT_DIR" == /mnt/[a-z]/* ]]; then
        printf '\e[33m   ! The project is on a Windows drive (%s): Docker is very slow there and ng serve does not\n     notice changes. Clone it inside WSL (e.g. ~/%s) – init-workspace.cmd on Windows does it for you.\e[0m\n' "$ROOT_DIR" "$APP_SLUG" >&2
        WARNINGS+=("project on a Windows drive (slow) – clone it inside WSL")
    fi
}

# -----------------------------------------------------------------------------
# 1. GitHub (SSH) – checks that this computer can reach GitHub over SSH. When it cannot (and a
#    terminal is attached) it offers to connect: uses the existing default key or creates one
#    with ssh-keygen, shows the PUBLIC key with the GitHub page to add it, and checks again until
#    it works or the user skips. Skipping never stops the script (GitHub is needed only to push /
#    pull, not to run the app).
# -----------------------------------------------------------------------------
setup_github_ssh() {
    step "GitHub (SSH)"
    if ! command -v ssh >/dev/null || ! command -v ssh-keygen >/dev/null; then
        skip "ssh not installed – GitHub SSH check skipped (Fedora: sudo dnf install openssh-clients, Arch: sudo pacman -S openssh)"
        return 0
    fi
    pin_github_host_key

    local user
    if user="$(github_ssh_user batch)"; then
        done_ "connected to GitHub over SSH as $user"
        offer_ssh_remote
        return 0
    fi
    if [[ ! -t 0 ]]; then
        skip "not connected to GitHub over SSH (no terminal to ask) – run the script in a terminal to connect"
        return 0
    fi

    local answer
    printf '   This computer is not connected to GitHub over SSH (needed to push / pull with git@github.com).\n'
    read -r -p "   Connect now? [y/N] " answer || answer=""
    if [[ ! "$answer" =~ ^[YyAa]$ ]]; then
        skip "GitHub SSH connection skipped – run the script again to connect later"
        return 0
    fi

    local pub
    pub="$(github_public_key)" || { warn "no SSH key created – GitHub SSH connection skipped"; return 0; }

    printf '\n   Add this PUBLIC key on GitHub (Settings → SSH and GPG keys → New SSH key):\n'
    printf '     %s\n' "$GITHUB_KEYS_URL"
    printf '     Title: %s, Key type: Authentication Key, Key:\n\n' "$(uname -n)"
    printf '%s\n\n' "$(cat "$pub")"
    if copy_to_clipboard < "$pub"; then info "the public key is also in the clipboard"; fi

    while true; do
        read -r -p "   Press Enter once the key is added on GitHub (s = skip): " answer || answer="s"
        if [[ "$answer" =~ ^[Ss]$ ]]; then
            skip "GitHub SSH connection skipped – the key ${pub/#$HOME/\~} stays, add it on GitHub later"
            return 0
        fi
        if user="$(github_ssh_user)"; then
            done_ "connected to GitHub over SSH as $user"
            offer_ssh_remote
            return 0
        fi
        printf '\e[33m   ! GitHub does not accept the key yet – check that the whole line above was pasted, then try again\e[0m\n'
    done
}

# @description Adds GitHub's published Ed25519 host key to ~/.ssh/known_hosts when github.com is
# not known yet (an existing entry is never changed).
pin_github_host_key() {
    local kh="$HOME/.ssh/known_hosts"
    if [[ -f "$kh" ]] && ssh-keygen -F github.com -f "$kh" >/dev/null 2>&1; then return 0; fi
    mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
    printf '%s\n' "$GITHUB_HOST_KEY" >> "$kh"
    chmod 600 "$kh"
    info "GitHub host key (published by GitHub) added to ~/.ssh/known_hosts"
}

# @description Prints the GitHub user name when `ssh -T git@github.com` authenticates.
# @param $1 'batch' = never ask anything (no passphrase prompt) - for the silent first check.
# @return 0 connected (user name printed), 1 not connected.
github_ssh_user() {
    local opts=(-T -o ConnectTimeout=15 -o StrictHostKeyChecking=yes) out
    [[ "${1:-}" == "batch" ]] && opts+=(-o BatchMode=yes)
    # GitHub answers "Hi <user>! You've successfully authenticated…" and exits with 1 (no shell).
    out="$(ssh "${opts[@]}" "$GITHUB_SSH" 2>&1 </dev/null)" || true
    [[ "$out" =~ Hi\ ([^!]+)!\ You\'ve\ successfully\ authenticated ]] || return 1
    printf '%s' "${BASH_REMATCH[1]}"
}

# @description Path of the public key to add on GitHub: the first default key that exists
# (id_ed25519, id_ecdsa, id_rsa), else a new Ed25519 pair created by ssh-keygen (it asks for a
# passphrase - recommended). Only the .pub path is printed.
# @return 0 path printed, 1 no key (ssh-keygen cancelled / failed).
github_public_key() {
    local k
    for k in id_ed25519 id_ecdsa id_rsa; do
        if [[ -f "$HOME/.ssh/$k" && -f "$HOME/.ssh/$k.pub" ]]; then
            info "using the existing key ~/.ssh/$k" >&2
            printf '%s' "$HOME/.ssh/$k.pub"
            return 0
        fi
    done
    local comment
    comment="$(git config --get user.email 2>/dev/null || true)"
    comment="${comment:-$USER@$(uname -n)}"
    mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
    info "creating a new SSH key ~/.ssh/id_ed25519 ($comment) – choose a passphrase (recommended)" >&2
    ssh-keygen -t ed25519 -C "$comment" -f "$HOME/.ssh/id_ed25519" </dev/tty >&2 || return 1
    printf '%s' "$HOME/.ssh/id_ed25519.pub"
}

# @description Copies stdin to the clipboard when a clipboard tool exists (Wayland / X11).
copy_to_clipboard() {
    if command -v pbcopy >/dev/null; then pbcopy 2>/dev/null; return; fi
    if command -v clip.exe >/dev/null; then clip.exe 2>/dev/null; return; fi
    if command -v wl-copy >/dev/null && [[ -n "${WAYLAND_DISPLAY:-}" ]]; then wl-copy 2>/dev/null; return; fi
    if command -v xclip >/dev/null && [[ -n "${DISPLAY:-}" ]]; then xclip -selection clipboard 2>/dev/null; return; fi
    return 1
}

# @description When `origin` is a GitHub HTTPS URL, offers to switch it to SSH (asked, never
# automatic) - with a working SSH key git then needs no password / token.
offer_ssh_remote() {
    local origin ssh_url answer
    origin="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"
    [[ "$origin" =~ ^https://github\.com/([^/]+/[^/]+)$ ]] || return 0
    ssh_url="$GITHUB_SSH:${BASH_REMATCH[1]%.git}.git"
    [[ -t 0 ]] || { info "origin uses HTTPS – switch to SSH with: git remote set-url origin $ssh_url"; return 0; }
    read -r -p "   origin uses HTTPS ($origin). Switch it to SSH ($ssh_url)? [y/N] " answer || answer=""
    if [[ "$answer" =~ ^[YyAa]$ ]]; then
        git -C "$ROOT_DIR" remote set-url origin "$ssh_url"
        done_ "origin switched to $ssh_url"
    else
        skip "origin left on HTTPS"
    fi
}

# -----------------------------------------------------------------------------
# 2. Temp folder – the git-ignored temp/ folder for local scratch files (media, notes, …),
#    created right after the clone, with temp.txt explaining it. An existing temp.txt is left
#    unchanged; an info.txt of an older version of this script is left as it is.
# -----------------------------------------------------------------------------
setup_temp_dir() {
    step "Temp folder (temp/)"
    local dir="$ROOT_DIR/temp"
    # Layout before 2026-10-31: the folder was .temp/ (hidden on some systems) - moved once,
    # with its content.
    if [[ -d "$ROOT_DIR/.temp" && ! -e "$dir" ]]; then
        mv "$ROOT_DIR/.temp" "$dir"
        done_ ".temp/ renamed to temp/ (content kept)"
    fi
    mkdir -p "$dir"
    # temp.txt of this script with the old name in its title is rewritten; any other is kept.
    if [[ -f "$dir/temp.txt" ]] && ! head -n 1 "$dir/temp.txt" | grep -q '^\.temp/'; then
        skip "temp/ exists"
        return 0
    fi
    cat > "$dir/temp.txt" <<'TXT'
temp/ – VYGENEROVANÉ DOČASNÉ PROSTŘEDÍ
=====================================

Tuto složku vytvořil skript init-workspace.sh. Je to dočasné lokální prostředí pro
ukládání médií, obrázků, souborů, poznámek apod. při vývoji – vše na jednom místě
jen na tomto počítači.

Nic odtud nejde do gitu (složka je v .gitignore) ani na server.

UPOZORNĚNÍ: nedávejte sem nic důležitého. Obsah se může kdykoliv smazat (úklid,
nový checkout, nová instalace) a NENÍ ZÁLOHOVANÝ. Co je potřeba zachovat, patří
do repozitáře nebo do zálohy.

---
temp/ – GENERATED TEMPORARY WORKSPACE
Created by init-workspace.sh: a temporary local place for media, images, files, notes, …
used during development, on this computer only. Git-ignored, never deployed.
WARNING: keep nothing important here – the content may be deleted at any time and is
NOT BACKED UP.
TXT
    done_ "temp/ created (local scratch folder, git-ignored – see temp/temp.txt)"
}

# -----------------------------------------------------------------------------
# 3. Docker – Docker Engine, the Compose plugin and buildx must be usable by your user.
#    Arch Linux: missing packages are installed with pacman (asked first); other systems get the
#    official instructions. The service is started (asked) and your user is added to the docker
#    group (asked; takes effect after logging out and in).
# -----------------------------------------------------------------------------
setup_docker() {
    step "Docker"
    if ! docker_complete; then
        case "$OS_KIND" in
            macos) install_docker_macos ;;
            wsl)   die "Docker is not available in WSL – on Windows run init-workspace.cmd (it installs / starts Docker Desktop), or in Docker Desktop: Settings → Resources → WSL integration → enable it for this distribution ($(wsl_distro)), then run this script again" ;;
            *)     install_docker_linux ;;
        esac
        docker_complete || die "Docker with the Compose and buildx plugins is still missing – install them (https://docs.docker.com/engine/install/), then run this script again"
    fi

    case "$OS_KIND" in
        macos) start_docker_desktop ;;
        wsl)   docker info >/dev/null 2>&1 || die "Docker does not answer in WSL – start Docker Desktop on Windows (and check Settings → Resources → WSL integration for $(wsl_distro)), then run this script again" ;;
        *)     setup_docker_linux_access ;;
    esac
    done_ "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?'), Compose $(docker compose version --short 2>/dev/null || echo '?')"
}

# @description Whether the docker CLI with the Compose and buildx plugins exists.
docker_complete() {
    command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && docker buildx version >/dev/null 2>&1
}

# @description Name of the WSL distribution (WSL only).
wsl_distro() { printf '%s' "${WSL_DISTRO_NAME:-your WSL distribution}"; }

# -----------------------------------------------------------------------------
# @description Linux: installs Docker Engine + Compose + buildx with the package manager of the
# distribution (asked first). Packages of the distribution itself - no extra repository:
#   Arch / Manjaro / EndeavourOS  pacman  docker docker-compose docker-buildx
#   Debian / Ubuntu / Mint / Pop  apt     docker.io docker-buildx + docker-compose-v2 (Ubuntu)
#                                         or docker-compose (Debian)
#   Fedora                        dnf     moby-engine docker-compose docker-buildx
#   openSUSE                      zypper  docker docker-compose docker-buildx
# Other distributions (or a failed install): the official instructions.
# -----------------------------------------------------------------------------
install_docker_linux() {
    local family answer cmd=()
    family="$(linux_family)"
    case "$family" in
        arch)   cmd=(sudo pacman -S --needed --noconfirm docker docker-compose docker-buildx) ;;
        debian) cmd=(sh -c 'sudo apt-get update -q && sudo apt-get install -y docker.io docker-buildx && { sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose; }') ;;
        fedora) cmd=(sudo dnf install -y moby-engine docker-compose docker-buildx) ;;
        suse)   cmd=(sudo zypper --non-interactive install docker docker-compose docker-buildx) ;;
        *) die "Docker Engine with the Compose and buildx plugins is required – install it for your distribution (https://docs.docker.com/engine/install/), then run this script again" ;;
    esac
    [[ -t 0 ]] || die "Docker is not installed – run this script in a terminal (it offers to install it) or install Docker yourself"
    command -v sudo >/dev/null || die "sudo not found – install Docker as root (https://docs.docker.com/engine/install/), then run this script again"
    printf '   Docker (engine, compose, buildx) is not installed.\n'
    read -r -p "   Install it now with the package manager of your system ($family)? [y/N] " answer || answer=""
    [[ "$answer" =~ ^[YyAa]$ ]] || die "Docker is required – install it (https://docs.docker.com/engine/install/), then run this script again"
    "${cmd[@]}" || die "the package manager could not install Docker – update the system first, or follow https://docs.docker.com/engine/install/ – then run this script again"
    done_ "Docker installed ($family packages)"
}

# @description Family of the Linux distribution from /etc/os-release: arch, debian, fedora,
# suse or other.
linux_family() {
    local id="" like=""
    if [[ -r /etc/os-release ]]; then
        id="$(. /etc/os-release && printf '%s' "${ID:-}")"
        like="$(. /etc/os-release && printf '%s' "${ID_LIKE:-}")"
    fi
    case " $id $like " in
        *" arch "*|*" manjaro "*|*" endeavouros "*) echo arch ;;
        *" debian "*|*" ubuntu "*)                  echo debian ;;
        *" fedora "*)                               echo fedora ;;
        *" suse "*|*" opensuse "*|*opensuse-*)      echo suse ;;
        *)                                          echo other ;;
    esac
}

# -----------------------------------------------------------------------------
# @description Linux: Docker on demand (docker.socket) and permission of your user (docker
# group) - both asked first.
# -----------------------------------------------------------------------------
setup_docker_linux_access() {
    local answer
    setup_docker_on_demand

    docker info >/dev/null 2>&1 && return 0
    # Not running, or no permission to use it.
    if command -v systemctl >/dev/null && ! systemctl is-active --quiet docker.socket && ! systemctl is-active --quiet docker; then
        die "Docker is not running – enable it: sudo systemctl enable --now docker.socket (starts Docker when it is used), then run this script again"
    fi
    docker info >/dev/null 2>&1 && return 0
    if ! id -nG "$USER" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
        if [[ -t 0 ]]; then
            printf '   Your user may not use Docker yet. The docker group gives this access (equal to root on this machine).\n'
            read -r -p "   Add $USER to the docker group (sudo usermod -aG docker $USER)? [y/N] " answer || answer=""
            if [[ "$answer" =~ ^[YyAa]$ ]]; then
                sudo usermod -aG docker "$USER"
                die "$USER added to the docker group – LOG OUT AND IN (or restart), then run ./init-workspace.sh again"
            fi
        fi
        die "your user may not use Docker – add it to the docker group (sudo usermod -aG docker $USER, then log out and in) or set up rootless Docker, then run this script again"
    fi
    die "Docker does not answer (docker info failed) – check: sudo systemctl status docker"
}

# -----------------------------------------------------------------------------
# @description macOS: Docker Desktop through Homebrew (asked first), otherwise the download page.
# -----------------------------------------------------------------------------
install_docker_macos() {
    local answer
    if [[ -d /Applications/Docker.app ]]; then
        # Installed, but the CLI is not on PATH yet (Docker Desktop was never started).
        start_docker_desktop
        return 0
    fi
    command -v brew >/dev/null && [[ -t 0 ]] \
        || die "Docker Desktop is required – install it (https://docs.docker.com/desktop/setup/install/mac-install/ or: brew install --cask docker), start it once, then run this script again"
    read -r -p "   Docker Desktop is not installed. Install it now (brew install --cask docker)? [y/N] " answer || answer=""
    [[ "$answer" =~ ^[YyAa]$ ]] || die "Docker Desktop is required – install it, start it once, then run this script again"
    brew install --cask docker || die "brew could not install Docker Desktop – install it from https://docs.docker.com/desktop/setup/install/mac-install/"
    done_ "Docker Desktop installed (brew)"
    start_docker_desktop
}

# @description macOS: starts Docker Desktop when it does not answer and waits for it (the first
# start asks to accept its terms in its window).
start_docker_desktop() {
    docker info >/dev/null 2>&1 && return 0
    info "starting Docker Desktop (the first start shows its terms – accept them in its window)"
    open -a Docker || die "Docker Desktop could not be started – start it yourself, then run this script again"
    local i
    # The CLI of a never-started Docker Desktop is not linked into PATH yet.
    PATH="$PATH:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin"
    for ((i = 0; i < 180; i++)); do
        docker info >/dev/null 2>&1 && return 0
        sleep 1
    done
    die "Docker Desktop did not start within 3 minutes – start it, wait until it says 'running', then run this script again"
}

# -----------------------------------------------------------------------------
# @description Docker ON DEMAND (systemd): docker.socket is enabled and docker.service is not,
# so the Docker daemon does NOT start with the computer - systemd starts it on the first use
# (./dev.sh, any docker command). The containers of the apps never start by themselves anyway
# (dev/compose.yaml has no restart policy). Asked first; a machine where docker.service starts at
# boot is offered the switch. Without systemd (macOS, WSL without systemd) nothing is done.
# -----------------------------------------------------------------------------
setup_docker_on_demand() {
    command -v systemctl >/dev/null || return 0
    systemctl cat docker.socket >/dev/null 2>&1 || return 0
    local answer
    if systemctl is-enabled --quiet docker.service 2>/dev/null; then
        if [[ -t 0 ]]; then
            printf '   Docker starts with the computer (docker.service) and keeps running in the background.\n'
            read -r -p "   Start it only when it is used instead (disable docker.service, enable docker.socket)? [Y/n] " answer || answer="n"
            if [[ ! "$answer" =~ ^[Nn]$ ]]; then
                sudo systemctl disable docker.service >/dev/null 2>&1 || true
                sudo systemctl enable --now docker.socket >/dev/null
                done_ "Docker starts on demand now (docker.socket) – not with the computer"
                return 0
            fi
        fi
        skip "Docker keeps starting with the computer (docker.service) – switch: sudo systemctl disable docker.service && sudo systemctl enable --now docker.socket"
    elif systemctl is-enabled --quiet docker.socket 2>/dev/null; then
        systemctl is-active --quiet docker.socket || sudo systemctl start docker.socket
        skip "Docker starts on demand (docker.socket)"
    else
        if [[ -t 0 ]]; then
            read -r -p "   Enable Docker on demand – it starts when used, not with the computer (sudo systemctl enable --now docker.socket)? [Y/n] " answer || answer="n"
            if [[ ! "$answer" =~ ^[Nn]$ ]]; then
                sudo systemctl enable --now docker.socket >/dev/null
                done_ "Docker enabled on demand (docker.socket) – it does not start with the computer"
                return 0
            fi
        fi
        warn "Docker is not enabled – run: sudo systemctl enable --now docker.socket"
    fi
}

# -----------------------------------------------------------------------------
# 4. Docker settings – dev/.env of dev/compose.yaml (git-ignored), created from dev/.env.example.
#    Always kept current: HOST_UID / HOST_GID (your user - files written by the containers belong
#    to it). Only when missing: COMPOSE_PROJECT_NAME (= app directory) and a random
#    DB_ROOT_PASSWORD. Everything else (ports, versions) is never changed by the script.
# -----------------------------------------------------------------------------
setup_docker_env() {
    step "Docker settings (dev/.env)"
    # Layout before 2026-10-31: the Docker settings were the root .env - moved once.
    if [[ -f "$ROOT_DIR/.env" && ! -f "$DOCKER_ENV" ]]; then
        mv "$ROOT_DIR/.env" "$DOCKER_ENV"
        done_ "Docker settings moved: .env → dev/.env"
    fi
    if [[ -f "$DOCKER_ENV" ]]; then
        skip "dev/.env exists – ports / versions left unchanged"
    else
        [[ -f "$ROOT_DIR/dev/.env.example" ]] || die "dev/.env.example is missing"
        cp "$ROOT_DIR/dev/.env.example" "$DOCKER_ENV"
        chmod 600 "$DOCKER_ENV"
        env_set COMPOSE_PROJECT_NAME "$APP_SLUG" "$DOCKER_ENV"
        done_ "dev/.env created (Docker project '$APP_SLUG')"
    fi

    local uid gid
    uid="$(id -u)"; gid="$(id -g)"
    if [[ "$(env_get HOST_UID "$DOCKER_ENV")" != "$uid" || "$(env_get HOST_GID "$DOCKER_ENV")" != "$gid" ]]; then
        env_set HOST_UID "$uid" "$DOCKER_ENV"
        env_set HOST_GID "$gid" "$DOCKER_ENV"
        done_ "HOST_UID / HOST_GID set to your user ($uid:$gid)"
    fi
    [[ -n "$(env_get COMPOSE_PROJECT_NAME "$DOCKER_ENV")" ]] || env_set COMPOSE_PROJECT_NAME "$APP_SLUG" "$DOCKER_ENV"

    if [[ -z "$(env_get DB_ROOT_PASSWORD "$DOCKER_ENV")" ]]; then
        env_set DB_ROOT_PASSWORD "$(random_secret)" "$DOCKER_ENV"
        done_ "random local database password stored in dev/.env (DB_ROOT_PASSWORD)"
    fi
}

# @description 32 random alphanumeric characters (no shell / dotenv special characters).
random_secret() {
    if command -v openssl >/dev/null; then
        openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32
    else
        LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
    fi
}

# -----------------------------------------------------------------------------
# 5. Images – the dev image is built (cached after the first time), the others are pulled.
# -----------------------------------------------------------------------------
setup_images() {
    step "Images"
    info "building the dev image (PHP $(env_get PHP_VERSION "$DOCKER_ENV"), Node.js $(env_get NODE_VERSION "$DOCKER_ENV")) – the first time takes a few minutes"
    dc build api || die "the dev image could not be built – see the output above"
    info "pulling MariaDB, Mailpit, phpMyAdmin"
    dc pull --quiet db mailpit phpmyadmin || die "the images could not be pulled – check the internet connection"
    done_ "images ready"
}

# -----------------------------------------------------------------------------
# 6. Laravel: .env, dependencies, application key, storage skeleton and symlink.
# -----------------------------------------------------------------------------
setup_laravel() {
    step "Laravel (api/)"

    if [[ -f "$API_DIR/.env" ]]; then
        skip "api/.env exists – left unchanged (inside Docker DB_* / MAIL_* come from dev/compose.yaml)"
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
        env_set DB_DATABASE "${APP_SLUG//-/_}"
        # Host / port / user / password of the database and Mailpit: set by dev/compose.yaml.
        env_set DB_HOST db
        env_set DB_PORT 3306
        env_set QUEUE_CONNECTION database
        env_set MAIL_MAILER smtp
        env_set MAIL_HOST mailpit
        env_set MAIL_PORT 1025
        env_set ANGULAR_I18N_PATH ../erp/src/assets/i18n
        # Cloudflare Turnstile official always-pass TEST secret (public, local only).
        [[ -n "$(env_get TURNSTILE_SECRET_KEY)" ]] || env_set TURNSTILE_SECRET_KEY 1x0000000000000000000000000000000AA
        ENV_CREATED=1
        done_ "api/.env created with local defaults (database: ${APP_SLUG//-/_}) – review it, see the summary"
    fi

    # Git does not keep empty directories – the storage skeleton Laravel expects.
    mkdir -p "$API_DIR"/storage/{logs,app/private,app/public} \
             "$API_DIR"/storage/framework/{cache/data,sessions,views} "$API_DIR"/bootstrap/cache
    chmod -R u+rwX,g+rwX "$API_DIR/storage" "$API_DIR/bootstrap/cache"

    info "composer install (container)"
    in_app api composer install --no-interaction --no-progress || die "composer install failed – see the output above"
    done_ "Composer dependencies installed"

    # Never regenerate an existing key: it would invalidate sessions and encrypted data.
    if [[ -z "$(env_get APP_KEY)" ]]; then
        in_app api php artisan key:generate --no-interaction >/dev/null
        done_ "APP_KEY generated"
    else
        skip "APP_KEY already set – not regenerated"
    fi

    # RELATIVE symlink: valid on the host and inside the container (/workspace). An absolute or
    # dangling one (old checkout path, `artisan storage:link` of a former host setup) is replaced.
    local link="$API_DIR/public/storage" rel="../storage/app/public"
    if [[ -L "$link" && "$(readlink "$link")" == "$rel" ]]; then
        skip "public/storage symlink OK"
    else
        [[ -L "$link" ]] && { info "replacing the storage symlink → $(readlink "$link")"; rm "$link"; }
        [[ -e "$link" ]] && die "api/public/storage exists and is not a symlink – move it away, then run this script again"
        ln -s "$rel" "$link"
        done_ "public/storage symlink created (relative)"
    fi

    in_app api php artisan config:clear --no-interaction >/dev/null 2>&1 || true
}

# -----------------------------------------------------------------------------
# 7. Database – created, migrated and seeded through Laravel in the MariaDB container.
# @note An existing database is never dropped: `migrate` adds only missing migrations (the
# baseline migration is a no-op on a filled database) and the seeders add only missing base
# data. With APP_ENV=local the seeders also create the test sysadmin
# sysadmin@sysadmin.sysadmin / 123456Ab. and the test roles (DevelopmentSeeder).
# -----------------------------------------------------------------------------
setup_database() {
    step "Database"
    local db; db="$(env_get DB_DATABASE)"
    info "starting MariaDB (container) and waiting until it is ready"
    dc up -d --wait db || { warn "the MariaDB container did not become ready – see: ./dev.sh logs db"; return 0; }

    if ! in_app_db api php artisan db:create-if-missing --no-interaction; then
        warn "database '${db:-?}' could not be created – check DB_DATABASE in api/.env, then run this script again"
        return 0
    fi
    if ! in_app_db api php artisan migrate --force --no-interaction; then
        warn "migrations failed – see the output above, then run this script again"
        return 0
    fi
    if ! in_app_db api php artisan db:seed --force --no-interaction; then
        warn "seeding the base data failed – see the output above, then run this script again"
        return 0
    fi

    if [[ "$(env_get APP_ENV)" == "local" ]]; then
        done_ "database '$db' ready – test login: sysadmin@sysadmin.sysadmin / 123456Ab. (2FA code in Mailpit)"
    else
        done_ "database '$db' ready (APP_ENV is not local – no test account created)"
    fi
    dc stop >/dev/null 2>&1 || true
    info "containers stopped again (./dev.sh starts them)"
}

# -----------------------------------------------------------------------------
# 8. Angular: dependencies and the local SSL certificate used by `ng serve`.
# -----------------------------------------------------------------------------
setup_angular() {
    step "Angular (erp/)"

    info "installing npm dependencies (container)"
    if [[ -f "$ERP_DIR/package-lock.json" ]]; then
        in_app erp npm ci --no-audit --no-fund || die "npm ci failed – see the output above"
    else
        in_app erp npm install --no-audit --no-fund || die "npm install failed – see the output above"
    fi
    done_ "npm dependencies installed"

    if [[ -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
        skip "local SSL certificate exists"
    else
        mkdir -p "$SSL_DIR"
        if command -v mkcert >/dev/null; then
            # mkcert on the host: the certificate is trusted by your browsers.
            mkcert -cert-file "$SSL_CERT" -key-file "$SSL_KEY" localhost 127.0.0.1 ::1 >/dev/null 2>&1
            done_ "trusted local SSL certificate created with mkcert"
        else
            in_app erp openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
                -keyout ssl/localhost.key -out ssl/localhost.crt -subj "/CN=localhost" \
                -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" >/dev/null 2>&1 \
                || die "the dev certificate could not be created"
            done_ "self-signed local SSL certificate created (install mkcert on the host for a browser-trusted one)"
        fi
        chmod 600 "$SSL_KEY"
    fi
}

# -----------------------------------------------------------------------------
# 9. Repository hygiene – ignore rules, executable scripts, remote check.
# -----------------------------------------------------------------------------
setup_repository() {
    step "Repository"
    local gi="$ROOT_DIR/.gitignore" rule added=()
    touch "$gi"
    for rule in '/build/' '/app_build/' '.~lock.*#' '/erp/ssl/' '/temp/' '/dev/.env' '/dev/logs/' '/dev/pids/' '/dev/wsl-workspace'; do
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
# 10. Shell aliases – one marked block per application in ~/.zshrc or ~/.bashrc,
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
# 11. Summary – including the manual review of api/.env.
# -----------------------------------------------------------------------------
summary() {
    step "Summary"
    if in_app api composer check-platform-reqs --lock --no-interaction >/dev/null 2>&1; then
        info "PHP of the dev image satisfies api/composer.lock"
    else
        warn "PHP of the dev image does not satisfy api/composer.lock – run './dev.sh composer check-platform-reqs --lock'"
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

    cat <<TXT

LAST STEP – BY HAND
  1. Review api/.env   ($env_state)
       APP_NAME, APP_URL, FRONTEND_URL      name and local URLs of this app
       DB_DATABASE=${db:-<name>}             the database (host, user and password come from Docker)
       MAIL_FROM_ADDRESS, MAIL_FROM_NAME    sender of e-mails (caught locally by Mailpit)
       TURNSTILE_SECRET_KEY                 captcha – a public TEST key is preset for local use
       any other keys of this app (API keys, payment gateway, …) – see .env.example
     Never commit api/.env or dev/.env – both are git-ignored.
     After changing DB_DATABASE run this script again – step 7 creates and fills the new database.

  LOCAL TEST LOGIN (APP_ENV=local only)
       e-mail:   sysadmin@sysadmin.sysadmin
       password: 123456Ab.
       2FA code: in Mailpit – http://127.0.0.1:$(env_get MAILPIT_PORT "$DOCKER_ENV") (sysadmin always needs 2FA)
       test roles: read-only-core, read-only-web, read-only-shop, full-web-core, full-shop-core, all-permissions

  COMING FROM XAMPP? Your old database is not moved automatically:
       /opt/lampp/bin/mysqldump -uroot <database> > temp/xampp.sql
       ./dev.sh db-import temp/xampp.sql && ./dev.sh artisan migrate
     XAMPP and the PHP / Node.js packages of the host are no longer needed by this app.
TXT

    echo
    echo "=========================================="
    if [[ ${#WARNINGS[@]} -eq 0 ]]; then
        printf '\e[32m WORKSPACE SETUP COMPLETE – %s\e[0m\n' "$APP_SLUG"
        echo "=========================================="
        echo "Once api/.env is reviewed, start the application:"
        echo "  ./dev.sh        (Ctrl+C stops everything; ./dev.sh help lists every command)"
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
echo "Workspace setup (Docker) – $APP_SLUG"
echo "------------------------------------------"
preflight
setup_github_ssh
setup_temp_dir
setup_docker
setup_docker_env
setup_images
setup_laravel
setup_database
setup_angular
setup_repository
setup_aliases
summary
