#!/usr/bin/env bash
# =============================================================================
# @file dev.sh
# @path dev.sh (root of the web-platform monorepo)
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Starts / stops the whole LOCAL development environment with one
# command instead of starting each service by hand in separate terminals:
#   1. XAMPP (MySQL/MariaDB, optionally Apache) – sudo /opt/lampp/lampp
#   2. Mailpit (catches outgoing e-mails)        – SMTP :1025, UI :8025
#   3. API – `php artisan serve`                 – web-platform/api
#   4. Queue worker – `php artisan queue:listen` (only if QUEUE_CONNECTION != sync)
#   5. Scheduler – `php artisan schedule:work`   (optional, --with-scheduler)
#   6. ERP – `ng serve`                          – web-platform/erp
#
# @note WHY NOT CRON: during development the queue and scheduler should run
# only while you are working. This script starts them as processes tied to the
# current session; Ctrl+C (or `./dev.sh stop`) ends everything. Nothing is
# written to crontab or systemd, so nothing keeps running in the background
# afterwards (see the orphaned `rpsw-queue-worker` cron incident, 2026-10-19).
#
# @note queue:listen vs. queue:work: locally `queue:listen` is used because it
# reboots the application for every job, so code changes apply without
# restarting the worker. In PRODUCTION use `queue:work` under Supervisor/systemd
# and the scheduler via system cron `* * * * * php artisan schedule:run`
# (see routes/console.php).
#
# @note The scheduler (routes/console.php) currently contains only nightly
# clean-up jobs (03:15 security:purge-events, 03:30 purge import batches), so it
# is OFF by default in development. Run once by hand: `php artisan schedule:test`.
#
# @security
#   - All services bind to 127.0.0.1 only (not reachable from the LAN).
#   - The script never reads or prints secrets from .env (reads QUEUE_CONNECTION only).
#   - sudo is used exclusively to control XAMPP.
#   - The .dev/ directory (logs, PID files) must be git-ignored.
#
# @usage
#   ./dev.sh                       start everything and follow logs; Ctrl+C stops all
#   ./dev.sh up --with-scheduler   same, plus the scheduler (schedule:work)
#   ./dev.sh up -d                 start everything in the background (detached)
#   ./dev.sh stop                  stop everything this script started
#   ./dev.sh status                show running services and URLs
#   ./dev.sh logs                  follow the logs of running services
#
# @config Override with environment variables, e.g. `API_PORT=8001 ./dev.sh`:
#   API_HOST, API_PORT, ERP_PORT, DB_PORT, MAILPIT_BIN, XAMPP_CTL,
#   XAMPP_START_CMD, XAMPP_STOP_CMD, STOP_XAMPP_ON_EXIT (1/0)
# =============================================================================

set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Paths – derived from the script location, so it works from any directory.
# -----------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
ERP_DIR="$ROOT_DIR/erp"
DEV_DIR="$ROOT_DIR/.dev"
LOG_DIR="$DEV_DIR/logs"
PID_DIR="$DEV_DIR/pids"

# -----------------------------------------------------------------------------
# Configuration (defaults; overridable from the environment)
# -----------------------------------------------------------------------------
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
ERP_PORT="${ERP_PORT:-4200}"
DB_PORT="${DB_PORT:-3306}"
MAILPIT_SMTP_PORT="${MAILPIT_SMTP_PORT:-1025}"
MAILPIT_UI_PORT="${MAILPIT_UI_PORT:-8025}"
MAILPIT_BIN="${MAILPIT_BIN:-mailpit}"

# XAMPP: "start" = MySQL + Apache (+ phpMyAdmin). If Apache is not needed,
# use XAMPP_START_CMD=startmysql XAMPP_STOP_CMD=stopmysql.
XAMPP_CTL="${XAMPP_CTL:-/opt/lampp/lampp}"
XAMPP_START_CMD="${XAMPP_START_CMD:-start}"
XAMPP_STOP_CMD="${XAMPP_STOP_CMD:-stop}"
STOP_XAMPP_ON_EXIT="${STOP_XAMPP_ON_EXIT:-1}"

WITH_SCHEDULER=0
DETACH=0

# Stop order = reverse start order.
MANAGED_PROCS=(erp scheduler queue api mailpit)

# -----------------------------------------------------------------------------
# Output helpers
# -----------------------------------------------------------------------------
c_reset=$'\e[0m'; c_green=$'\e[32m'; c_yellow=$'\e[33m'; c_red=$'\e[31m'; c_blue=$'\e[34m'

info() { printf '%s[dev]%s %s\n' "$c_blue" "$c_reset" "$*"; }
ok()   { printf '%s[ ok]%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s[!!!]%s %s\n' "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s[err]%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# @description Checks whether something listens on 127.0.0.1:<port>, without
# external tools (uses bash's /dev/tcp).
# @param $1 port
# @return 0 = port in use, 1 = free
# -----------------------------------------------------------------------------
port_in_use() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# -----------------------------------------------------------------------------
# @description Waits until a service starts listening on a port.
# @param $1 service name (for output), $2 port, $3 timeout in seconds
# @return 0 = listening, 1 = timed out
# -----------------------------------------------------------------------------
wait_for_port() {
    local name="$1" port="$2" timeout="${3:-30}" i
    for ((i = 0; i < timeout; i++)); do
        port_in_use "$port" && { ok "$name is listening on :$port"; return 0; }
        sleep 1
    done
    warn "$name is not listening on :$port after ${timeout}s – check its log ($LOG_DIR/)"
    return 1
}

# -----------------------------------------------------------------------------
# @description Returns 0 if the named process (via its PID file) is running.
# @param $1 service name
# -----------------------------------------------------------------------------
is_running() {
    local pidfile="$PID_DIR/$1.pid" pid
    [[ -f "$pidfile" ]] || return 1
    pid="$(<"$pidfile")"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# -----------------------------------------------------------------------------
# @description Starts a background process in its own session (setsid) so it
# can later be stopped together with its children (ng serve and artisan serve
# spawn subprocesses), and so the Ctrl+C meant for the log viewer does not hit
# it directly – the script performs the clean-up itself.
# @param $1 service name, $2 working directory, $3.. command
# -----------------------------------------------------------------------------
start_proc() {
    local name="$1" dir="$2"; shift 2
    if is_running "$name"; then
        ok "$name already running (PID $(<"$PID_DIR/$name.pid")) – skipping"
        return 0
    fi
    : > "$LOG_DIR/$name.log"
    (cd "$dir" && exec setsid "$@" >>"$LOG_DIR/$name.log" 2>&1 </dev/null) &
    echo $! > "$PID_DIR/$name.pid"
    info "started $name (PID $!) → .dev/logs/$name.log"
}

# -----------------------------------------------------------------------------
# @description Stops a service's whole process group: SIGTERM, then SIGKILL after 8 s.
# @param $1 service name
# -----------------------------------------------------------------------------
stop_proc() {
    local name="$1" pidfile="$PID_DIR/$1.pid" pid i
    [[ -f "$pidfile" ]] || return 0
    pid="$(<"$pidfile")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
        for ((i = 0; i < 16; i++)); do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.5
        done
        if kill -0 "$pid" 2>/dev/null; then
            warn "$name ignores SIGTERM – sending SIGKILL"
            kill -KILL -- "-$pid" 2>/dev/null || true
        fi
        ok "stopped $name"
    fi
    rm -f "$pidfile"
}

# -----------------------------------------------------------------------------
# @description Reads QUEUE_CONNECTION from api/.env (this single value only; no
# secrets are read or printed). Laravel's default value is "database".
# @return prints the connection name
# -----------------------------------------------------------------------------
queue_connection() {
    local v
    v="$(grep -E '^[[:space:]]*QUEUE_CONNECTION=' "$API_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    v="${v%%#*}"; v="${v//[\"\' ]/}"
    echo "${v:-database}"
}

# -----------------------------------------------------------------------------
# @description Prerequisite checks before starting – fail early and clearly.
# -----------------------------------------------------------------------------
preflight() {
    [[ -d "$API_DIR" ]] || die "Directory $API_DIR is missing"
    [[ -d "$ERP_DIR" ]] || die "Directory $ERP_DIR is missing"
    [[ -f "$API_DIR/.env" ]] || die "$API_DIR/.env is missing (copy .env.example and configure it)"
    command -v php >/dev/null || die "php is not in PATH"
    command -v npx >/dev/null || die "npx (Node.js) is not in PATH"
    command -v setsid >/dev/null || die "setsid is not available (package util-linux)"
    [[ -d "$ERP_DIR/node_modules" ]] || die "$ERP_DIR/node_modules is missing – run 'npm ci' in erp/"
    [[ -x "$XAMPP_CTL" ]] || warn "XAMPP not found at $XAMPP_CTL – database will not be started (set XAMPP_CTL)"
    command -v "$MAILPIT_BIN" >/dev/null || warn "mailpit not found ($MAILPIT_BIN) – e-mails will not be caught"

    # Make sure logs/PID files never end up in git. Git itself decides
    # (`check-ignore`), so any valid pattern works (.dev, .dev/, /.dev/, a
    # global gitignore…). Skipped outside a git repository.
    if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
        && ! git -C "$ROOT_DIR" check-ignore -q .dev/; then
        warn "'.dev/' is not git-ignored – add it: echo '.dev/' >> .gitignore"
    fi

    port_in_use "$API_PORT" && ! is_running api && die "Port $API_PORT is used by another process (API)"
    port_in_use "$ERP_PORT" && ! is_running erp && die "Port $ERP_PORT is used by another process (ERP)"
    return 0
}

# -----------------------------------------------------------------------------
# @description XAMPP is controlled via sudo. The .dev/xampp.started marker makes
# sure XAMPP is stopped on exit only if this script actually started it.
# -----------------------------------------------------------------------------
start_xampp() {
    [[ -x "$XAMPP_CTL" ]] || return 0
    if port_in_use "$DB_PORT"; then
        ok "database already running on :$DB_PORT – not starting XAMPP"
        return 0
    fi
    info "starting XAMPP ($XAMPP_START_CMD) – may ask for your sudo password"
    # Validate sudo first so the password prompt is not hidden by the redirected output.
    sudo -v || die "sudo was not confirmed – cannot start XAMPP"
    # Intentional: the log is written by the normal user (not root), so .dev/
    # can be removed without sudo.
    # shellcheck disable=SC2024
    sudo "$XAMPP_CTL" "$XAMPP_START_CMD" >"$LOG_DIR/xampp.log" 2>&1 \
        || die "XAMPP failed to start – see .dev/logs/xampp.log"
    touch "$DEV_DIR/xampp.started"
    wait_for_port "MySQL" "$DB_PORT" 30 || die "Database did not come up"
}

stop_xampp() {
    [[ -f "$DEV_DIR/xampp.started" ]] || return 0
    if [[ "$STOP_XAMPP_ON_EXIT" == "1" ]]; then
        info "stopping XAMPP ($XAMPP_STOP_CMD) – may ask for your sudo password"
        # shellcheck disable=SC2024  # see start_xampp – the log stays user-owned
        sudo "$XAMPP_CTL" "$XAMPP_STOP_CMD" >>"$LOG_DIR/xampp.log" 2>&1 || warn "XAMPP could not be stopped"
        ok "stopped XAMPP"
    fi
    rm -f "$DEV_DIR/xampp.started"
}

# -----------------------------------------------------------------------------
# @description Starts Mailpit unless something already holds the SMTP port
# (e.g. Mailpit started by hand or as a service) – that one is left untouched.
# -----------------------------------------------------------------------------
start_mailpit() {
    command -v "$MAILPIT_BIN" >/dev/null || return 0
    if port_in_use "$MAILPIT_SMTP_PORT" && ! is_running mailpit; then
        ok "Mailpit (or another SMTP server) already running on :$MAILPIT_SMTP_PORT – skipping"
        return 0
    fi
    start_proc mailpit "$ROOT_DIR" "$MAILPIT_BIN" \
        --smtp "127.0.0.1:$MAILPIT_SMTP_PORT" --listen "127.0.0.1:$MAILPIT_UI_PORT"
    wait_for_port "Mailpit" "$MAILPIT_SMTP_PORT" 10 || true
}

# -----------------------------------------------------------------------------
# Main actions
# -----------------------------------------------------------------------------
cmd_up() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
    preflight

    start_xampp
    start_mailpit

    start_proc api "$API_DIR" php artisan serve --host="$API_HOST" --port="$API_PORT" --no-reload
    wait_for_port "API" "$API_PORT" 20 || true

    local qc; qc="$(queue_connection)"
    if [[ "$qc" == "sync" ]]; then
        info "QUEUE_CONNECTION=sync – no queue worker needed"
    else
        start_proc queue "$API_DIR" php artisan queue:listen --tries=3 --timeout=90
    fi

    if [[ "$WITH_SCHEDULER" == "1" ]]; then
        start_proc scheduler "$API_DIR" php artisan schedule:work
    else
        info "scheduler off (nightly jobs only) – enable with --with-scheduler"
    fi

    start_proc erp "$ERP_DIR" npx ng serve --host 127.0.0.1 --port "$ERP_PORT"
    info "ERP is compiling, the first build may take a while…"
    wait_for_port "ERP" "$ERP_PORT" 120 || true

    echo
    cmd_status

    if [[ "$DETACH" == "1" ]]; then
        info "running in the background. Stop: ./dev.sh stop · logs: ./dev.sh logs"
        return 0
    fi

    # Foreground: follow the logs; Ctrl+C => clean up everything we started.
    trap 'echo; info "shutting down…"; cmd_stop; exit 0' INT TERM
    info "following logs – Ctrl+C stops the whole environment"
    tail -n 0 -F "$LOG_DIR"/*.log || true
    cmd_stop
}

cmd_stop() {
    trap - INT TERM
    local p
    for p in "${MANAGED_PROCS[@]}"; do stop_proc "$p"; done
    stop_xampp
    ok "environment stopped – nothing is running in the background"
}

cmd_status() {
    local p state
    printf '%-10s %s\n' "SERVICE" "STATE"
    for p in api queue scheduler erp mailpit; do
        if is_running "$p"; then state="${c_green}running${c_reset} (PID $(<"$PID_DIR/$p.pid"))"
        else state="${c_yellow}stopped${c_reset}"; fi
        printf '%-10s %s\n' "$p" "$state"
    done
    if port_in_use "$DB_PORT"; then state="${c_green}running${c_reset} (:$DB_PORT)"; else state="${c_yellow}stopped${c_reset}"; fi
    printf '%-10s %s\n' "database" "$state"
    echo
    echo "  API      http://$API_HOST:$API_PORT"
    echo "  ERP      http://127.0.0.1:$ERP_PORT"
    echo "  Mailpit  http://127.0.0.1:$MAILPIT_UI_PORT"
}

cmd_logs() {
    compgen -G "$LOG_DIR/*.log" >/dev/null || die "No logs – the environment is not running"
    tail -n 50 -F "$LOG_DIR"/*.log
}

usage() {
    sed -n '/^# @usage/,/^# @config/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' | sed '$d'
}

# -----------------------------------------------------------------------------
# Argument parsing
# -----------------------------------------------------------------------------
ACTION="${1:-up}"
[[ $# -gt 0 ]] && shift
for arg in "$@"; do
    case "$arg" in
        --with-scheduler) WITH_SCHEDULER=1 ;;
        -d|--detach)      DETACH=1 ;;
        *) die "Unknown option: $arg (see ./dev.sh help)" ;;
    esac
done

case "$ACTION" in
    up|start)  cmd_up ;;
    stop|down) cmd_stop ;;
    status)    cmd_status ;;
    logs)      cmd_logs ;;
    help|-h|--help) usage ;;
    *) die "Unknown action: $ACTION (see ./dev.sh help)" ;;
esac
