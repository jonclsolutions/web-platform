#!/usr/bin/env bash
# =============================================================================
# @file dev.sh
# @path dev.sh (root of the web-platform monorepo)
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Starts / stops the LOCAL development environment and runs the project tools -
# everything in Docker (dev/compose.yaml), nothing installed on the host except Docker and git:
#   api        Laravel API – `php artisan serve`            http://127.0.0.1:8000
#   queue      `php artisan queue:listen`
#   scheduler  `php artisan schedule:work`                  (only with --with-scheduler)
#   erp        Angular – `ng serve`                          https://localhost:4200
#   db         MariaDB                                       127.0.0.1:3307 (from the host)
#   mailpit    catches every e-mail                          http://127.0.0.1:8025
#   phpmyadmin                                               http://127.0.0.1:8080
# (ports from the root .env). First run ./init-workspace.sh once.
#
# @refactor-note (2026-10-31) Rewritten for Docker: XAMPP, Mailpit in ~/.local/bin and the PHP /
#   Node.js of the host are no longer used; the services are containers of compose.yaml (one dev
#   image docker/app/Dockerfile). The former PID files / logs in .dev/ are replaced by
#   `docker compose ps` / `logs`; Ctrl+C in the foreground mode stops the containers like before.
#   New: tool commands (artisan, composer, npm, npx, shell), tests, build, db-import / db-dump.
# @refactor-note (2026-10-31d) Root clean-up: the Docker files live in dev/ (dev/compose.yaml,
#   dev/.env, dev/docker/Dockerfile), the logs in dev/logs/, PID files in dev/pids/. A root .env of
#   the previous layout is moved to dev/.env once; the scratch folder .temp/ is renamed to temp/.
# @refactor-note (2026-10-31b) Log files are back: every service writes its own
#   dev/logs/<service>.log again (api, queue, scheduler, erp, db, mailpit, phpmyadmin - plain
#   text with Docker timestamps, emptied on every start). A background `docker compose logs -f`
#   per service writes them (PID files in .dev/pids/); they end with their container. The
#   console shows all services together as before; `./dev.sh logs [service]` follows the files.
#   `up -d` waits until the API and the ERP answer and prints the end of the log of a service
#   that failed.
# @note WHY NOT CRON (unchanged): the queue and the scheduler run only while the environment
#   runs - nothing is written to crontab or systemd. Production: queue:work + cron
#   (deploy/server/configure-server.sh).
# @note The database data live in the Docker volume <app>_db-data: `stop` / `down` keep them,
#   only `docker compose -f dev/compose.yaml down -v` deletes them.
# @refactor-note (2026-10-31c) macOS: re-runs itself with bash 4+ from Homebrew (macOS ships 3.2);
#   no setsid there - the log writers use nohup. Windows: dev.cmd runs this script inside WSL.
#
# @security
#   - Every port is published on 127.0.0.1 only (dev/compose.yaml, BIND_IP).
#   - The script never prints secrets; db-import / db-dump use the root password from inside the
#     db container (its environment), it is not passed on the command line of the host.
#
# @usage
#   ./dev.sh                         start everything, follow the logs; Ctrl+C stops everything
#   ./dev.sh up -d                   start in the background (stop with ./dev.sh stop)
#   ./dev.sh up --with-scheduler     also the scheduler (schedule:work)
#   ./dev.sh stop                    stop the containers (data stay)
#   ./dev.sh down                    stop and remove the containers (data stay in the volume)
#   ./dev.sh status                  running services and URLs
#   ./dev.sh logs [service]          follow dev/logs/<service>.log (api, queue, erp, db, mailpit, …)
#   ./dev.sh artisan <args>          php artisan … in the api container (e.g. migrate, tinker)
#   ./dev.sh composer <args>         composer … in api/
#   ./dev.sh npm <args>              npm … in erp/        ./dev.sh npx <args>   npx … in erp/
#   ./dev.sh shell [service]         bash in a container (default: a new dev container)
#   ./dev.sh test [args]             all unit tests (tests/unit_tests/run_all.sh) in the container
#   ./dev.sh build [args]            production build (deploy/build.sh) in the container
#   ./dev.sh db-import <file.sql>    import an SQL dump into the app database (DB_DATABASE of api/.env)
#   ./dev.sh db-dump [file.sql]      dump the app database (default temp/<db>-<date>.sql)
#   ./dev.sh rebuild                 rebuild the dev image (after changing PHP / Node.js / UID in .env)
#   ./dev.sh help
# =============================================================================

# macOS ships bash 3.2 (too old for this script) - re-run with bash 4+ from Homebrew.
if [ -z "${BASH_VERSINFO:-}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    for _bash in /opt/homebrew/bin/bash /usr/local/bin/bash; do
        [ -x "$_bash" ] && exec "$_bash" "$0" "$@"
    done
    echo "ERROR: bash 4 or newer is needed (this is bash ${BASH_VERSION:-?}). macOS: install Homebrew (https://brew.sh), then: brew install bash" >&2
    exit 1
fi

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
ERP_DIR="$ROOT_DIR/erp"
LOG_DIR="$ROOT_DIR/dev/logs"      # one log file per service (git-ignored)
PID_DIR="$ROOT_DIR/dev/pids"      # PIDs of the log writers (git-ignored)
DOCKER_ENV="$ROOT_DIR/dev/.env"   # settings of the Docker environment (git-ignored)

# Services of dev/compose.yaml (scheduler only with --with-scheduler).
SERVICES=(api queue erp db mailpit phpmyadmin)

c_reset=$'\e[0m'; c_green=$'\e[32m'; c_yellow=$'\e[33m'; c_red=$'\e[31m'; c_blue=$'\e[34m'
info() { printf '%s[dev]%s %s\n' "$c_blue" "$c_reset" "$*"; }
ok()   { printf '%s[ ok]%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s[!!!]%s %s\n' "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s[err]%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# @description Value of KEY from a dotenv file (simple KEY=VALUE lines, quotes removed).
# @param $1 file, $2 key, $3 default
# -----------------------------------------------------------------------------
env_value() {
    local v
    v="$(grep -E "^[[:space:]]*$2=" "$1" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    v="${v%%[[:space:]]#*}"; v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    printf '%s' "${v:-${3:-}}"
}

# @description docker compose of this repository (always from the root, whatever the cwd).
DC=(docker compose -f "$ROOT_DIR/dev/compose.yaml")
dc() { "${DC[@]}" "$@"; }

# -----------------------------------------------------------------------------
# @description Starts one background log writer per service: `docker compose logs -f` of the
# service since the start of this run → dev/logs/<service>.log (emptied first, no colours).
# A writer ends by itself when its container stops; stop_log_writers ends it earlier. The
# writers run in their own session, so Ctrl+C / closing the terminal does not kill them before
# the containers are stopped.
# @param $1 start time (RFC 3339, UTC), rest = services
# -----------------------------------------------------------------------------
start_log_writers() {
    local since="$1" s; shift
    mkdir -p "$LOG_DIR" "$PID_DIR"
    stop_log_writers
    for s in "$@"; do
        : > "$LOG_DIR/$s.log"
        if command -v setsid >/dev/null; then
            setsid "${DC[@]}" logs -f --no-color --no-log-prefix --timestamps --since "$since" "$s" \
                >> "$LOG_DIR/$s.log" 2>&1 < /dev/null &
        else
            nohup "${DC[@]}" logs -f --no-color --no-log-prefix --timestamps --since "$since" "$s" \
                >> "$LOG_DIR/$s.log" 2>&1 < /dev/null &
        fi
        printf '%s\n' "$!" > "$PID_DIR/$s.pid"
    done
}

# @description Ends the log writers of a previous start (if any are still running).
stop_log_writers() {
    local f
    for f in "$PID_DIR"/*.pid; do
        [[ -f "$f" ]] || continue
        kill "$(cat "$f")" 2>/dev/null || true
        rm -f "$f"
    done
}

# @description Whether something listens on 127.0.0.1:<port> (bash /dev/tcp, no extra tools).
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# -----------------------------------------------------------------------------
# @description Waits until a service answers on its port; stops at once when its container is
# no longer running and prints the end of its log file.
# @param $1 display name, $2 host port, $3 timeout in seconds, $4 service
# @return 0 ready, 1 failed / timed out (reported)
# -----------------------------------------------------------------------------
wait_for_service() {
    local name="$1" port="$2" timeout="$3" svc="$4" i
    for ((i = 0; i < timeout; i++)); do
        port_in_use "$port" && { ok "$name is ready on :$port"; return 0; }
        if ! dc ps --status running --services 2>/dev/null | grep -qx "$svc"; then
            warn "$name ($svc) is not running – end of dev/logs/$svc.log:"
            tail -n 20 "$LOG_DIR/$svc.log" 2>/dev/null | sed 's/^/        /' >&2
            return 1
        fi
        sleep 1
    done
    warn "$name did not answer on :$port within ${timeout}s – see ./dev.sh logs $svc"
    return 1
}

# -----------------------------------------------------------------------------
# @description Docker and the files of ./init-workspace.sh must exist before anything starts -
# a clear message instead of a compose / container error.
# @param $1 'full' = also the dependencies and the dev certificate (needed to start the app)
# -----------------------------------------------------------------------------
preflight() {
    # Layout before 2026-10-31: the Docker settings were the root .env - moved once.
    if [[ -f "$ROOT_DIR/.env" && ! -f "$DOCKER_ENV" && -f "$ROOT_DIR/dev/.env.example" ]]; then
        mv "$ROOT_DIR/.env" "$DOCKER_ENV"
        info "the Docker settings moved: .env → dev/.env"
    fi
    # Same for the scratch folder: .temp/ (hidden on some systems) became temp/.
    if [[ -d "$ROOT_DIR/.temp" && ! -e "$ROOT_DIR/temp" ]]; then
        mv "$ROOT_DIR/.temp" "$ROOT_DIR/temp"
        info "the scratch folder renamed: .temp/ → temp/ (content kept)"
    fi
    command -v docker >/dev/null || die "Docker is not installed – run ./init-workspace.sh"
    docker compose version >/dev/null 2>&1 || die "the Docker Compose plugin is missing – run ./init-workspace.sh"
    if ! docker info >/dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]]; then
        # macOS: start Docker Desktop and wait for it.
        info "starting Docker Desktop…"
        open -a Docker 2>/dev/null || true
        local i; for ((i = 0; i < 120; i++)); do docker info >/dev/null 2>&1 && break; sleep 1; done
    fi
    if ! docker info >/dev/null 2>&1; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            die "Docker does not answer – start Docker Desktop on Windows (dev.cmd starts it for you) and check Settings → Resources → WSL integration"
        fi
        [[ "$(uname -s)" == "Darwin" ]] && die "Docker Desktop does not answer – start it and wait until it is running"
        die "Docker is not running or you may not use it (start it: sudo systemctl start docker.socket; group: sudo usermod -aG docker \$USER, then log out and in)"
    fi
    [[ -f "$DOCKER_ENV" ]] || die "dev/.env (Docker settings) is missing – run ./init-workspace.sh"
    [[ "${1:-}" == "full" ]] || return 0
    [[ -f "$API_DIR/.env" ]] || die "api/.env is missing – run ./init-workspace.sh"
    [[ -d "$API_DIR/vendor" ]] || die "api/vendor is missing – run ./init-workspace.sh (or ./dev.sh composer install)"
    [[ -d "$ERP_DIR/node_modules" ]] || die "erp/node_modules is missing – run ./init-workspace.sh (or ./dev.sh npm ci)"
    [[ -f "$ERP_DIR/ssl/localhost.crt" && -f "$ERP_DIR/ssl/localhost.key" ]] \
        || die "the dev certificate of ng serve (erp/ssl/localhost.*) is missing – run ./init-workspace.sh"
}

# @description Prints the URLs of the environment (ports from the root .env).
print_urls() {
    local e="$DOCKER_ENV"
    cat <<EOF

  Application  https://localhost:$(env_value "$e" ERP_PORT 4200)   (self-signed certificate - accept it once)
  API          http://127.0.0.1:$(env_value "$e" API_PORT 8000)
  Mailpit      http://127.0.0.1:$(env_value "$e" MAILPIT_PORT 8025)
  phpMyAdmin   http://127.0.0.1:$(env_value "$e" PMA_PORT 8080)   (root / DB_ROOT_PASSWORD from dev/.env)
  Database     127.0.0.1:$(env_value "$e" DB_PORT 3307)           (from the host; containers use db:3306)

EOF
}

# @description Name of the app database (DB_DATABASE of api/.env).
app_database() {
    local db; db="$(env_value "$API_DIR/.env" DB_DATABASE)"
    [[ -n "$db" ]] || die "DB_DATABASE is not set in api/.env"
    printf '%s' "$db"
}

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------
cmd_up() {
    local detach=0 profiles=() services=("${SERVICES[@]}") arg since e="$DOCKER_ENV"
    for arg in "$@"; do
        case "$arg" in
            -d|--detach)      detach=1 ;;
            --with-scheduler) profiles=(--profile scheduler); services+=(scheduler) ;;
            *) die "unknown option for up: $arg (see ./dev.sh help)" ;;
        esac
    done
    preflight full
    since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    dc "${profiles[@]}" up -d --build || die "the containers could not be started – see the output above"
    start_log_writers "$since" "${services[@]}"
    info "logs: dev/logs/<service>.log (${services[*]})"

    if [[ "$detach" == "1" ]]; then
        local failed=0
        wait_for_service "API" "$(env_value "$e" API_PORT 8000)" 90 api || failed=1
        wait_for_service "ERP" "$(env_value "$e" ERP_PORT 4200)" 240 erp || failed=1
        print_urls
        [[ "$failed" == "0" ]] || die "a service did not start – fix it, then ./dev.sh up -d again (./dev.sh stop to stop the rest)"
        ok "running in the background – ./dev.sh logs [service] | ./dev.sh stop"
        return 0
    fi

    print_urls
    info "following the logs – Ctrl+C or closing the terminal stops everything"
    # Ctrl+C / closing the terminal: stop the containers (data stay) and the log writers.
    # Output may fail once the terminal is gone (HUP) - the containers are stopped regardless.
    trap 'trap - INT TERM HUP; { echo; info "stopping…"; } 2>/dev/null || true
          dc "${profiles[@]}" stop >/dev/null 2>&1 || true; stop_log_writers
          ok "stopped (data kept)" 2>/dev/null || true; exit 0' INT TERM HUP
    dc "${profiles[@]}" logs -f --since "$since" "${services[@]}" || true
    # The log stream ended by itself (every container stopped from elsewhere).
    trap - INT TERM HUP
    stop_log_writers
}

cmd_status() {
    preflight
    dc --profile scheduler ps
    print_urls
    [[ -d "$LOG_DIR" ]] && info "logs: dev/logs/ ($(cd "$LOG_DIR" && ls -- *.log 2>/dev/null | tr '\n' ' '))"
    return 0
}

# -----------------------------------------------------------------------------
# @description Follows the log files of dev/logs/ (all, or the given services); without log
# files (environment started elsewhere) the logs of Docker itself.
# @param $@ services (optional)
# -----------------------------------------------------------------------------
cmd_logs() {
    preflight
    local files=() s
    if [[ $# -eq 0 ]]; then
        for s in "$LOG_DIR"/*.log; do [[ -f "$s" ]] && files+=("$s"); done
    else
        for s in "$@"; do
            [[ -f "$LOG_DIR/$s.log" ]] || die "no log file dev/logs/$s.log (services: ${SERVICES[*]} scheduler)"
            files+=("$LOG_DIR/$s.log")
        done
    fi
    if [[ ${#files[@]} -eq 0 ]]; then
        info "no log files in dev/logs/ – showing the Docker logs"
        dc --profile scheduler logs -f --tail=100
        return
    fi
    tail -n 100 -F "${files[@]}"
}

# @description Runs a command in a new dev container (removed afterwards).
# @param $1 working directory inside the repository (api, erp or .), rest = command
dev_run() {
    local dir="$1"; shift
    preflight
    dc run --rm -w "/workspace/${dir#.}" api "$@"
}

# @description Same without starting the database / Mailpit (tools that do not need them).
dev_run_nodeps() {
    local dir="$1"; shift
    preflight
    dc run --rm --no-deps -w "/workspace/${dir#.}" api "$@"
}

cmd_db_import() {
    local file="${1:-}" db
    [[ -n "$file" && -f "$file" ]] || die "usage: ./dev.sh db-import <file.sql>"
    preflight
    db="$(app_database)"
    warn "importing $file into the database '$db' – tables in the file REPLACE the existing ones"
    read -r -p "Continue? [y/N] " answer || answer=""
    [[ "$answer" =~ ^[YyAa]$ ]] || die "cancelled"
    dc up -d --wait db
    # shellcheck disable=SC2016  # $MARIADB_ROOT_PASSWORD is expanded inside the db container
    dc exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$1\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" && mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$1"' _ "$db" < "$file"
    ok "imported into '$db' – then run: ./dev.sh artisan migrate"
}

cmd_db_dump() {
    local db file
    preflight
    db="$(app_database)"
    file="${1:-$ROOT_DIR/temp/$db-$(date +%Y%m%d-%H%M%S).sql}"
    mkdir -p "$(dirname "$file")"
    dc up -d --wait db
    # shellcheck disable=SC2016  # expanded inside the db container
    dc exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines "$1"' _ "$db" > "$file"
    chmod 600 "$file"
    ok "database '$db' dumped to ${file#"$ROOT_DIR"/} (contains personal data – never commit it)"
}

cmd_help() {
    sed -n '/^# @usage/,/^# =====/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' | sed '$d'
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
command="${1:-up}"
[[ $# -gt 0 ]] && shift

case "$command" in
    up|start)    cmd_up "$@" ;;
    stop)        preflight; dc --profile scheduler stop; stop_log_writers; ok "stopped (data kept)" ;;
    down)        preflight; dc --profile scheduler down; stop_log_writers; ok "containers removed (the database volume is kept)" ;;
    status|ps)   cmd_status ;;
    logs)        cmd_logs "$@" ;;
    artisan)     dev_run api php artisan "$@" ;;
    composer)    dev_run_nodeps api composer "$@" ;;
    npm)         dev_run_nodeps erp npm "$@" ;;
    npx)         dev_run_nodeps erp npx "$@" ;;
    shell)
        if [[ $# -gt 0 ]]; then preflight; dc exec "$1" bash; else dev_run . bash; fi ;;
    test)        dev_run_nodeps . tests/unit_tests/run_all.sh "$@" ;;
    build)       dev_run_nodeps . deploy/build.sh "$@" ;;
    db-import)   cmd_db_import "$@" ;;
    db-dump)     cmd_db_dump "$@" ;;
    rebuild)     preflight; dc build --pull; ok "image rebuilt – ./dev.sh up recreates the containers" ;;
    help|-h|--help) cmd_help ;;
    *) die "unknown command: $command (see ./dev.sh help)" ;;
esac
