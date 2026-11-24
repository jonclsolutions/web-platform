#!/usr/bin/env bash
# =============================================================================
# @file deploy.sh
# @path deploy/vps/deploy.sh  (on the server: /srv/app/deploy.sh)
# @project JS web-platform
# @author JS
# @created 2026
# @description Releases, rollbacks and backups of one installation on its VPS (Docker stack of
#   deploy/compose.prod.yaml in /srv/app). Run as the user `deploy`:
#     release <tag>        deploy a release: check .env, pull the images, back up, stop the API,
#                          migrate + seed, start, smoke test; on a failure back to the previous
#                          release (and its database) automatically
#     rollback [--with-db] back to the previous successful release (--with-db also restores the
#                          database backup taken before the current release)
#     backup [label]       database dump + storage/app archive into backups/, retention, copy to
#                          the backup server (BACKUP_REMOTE)
#     restore-db <backup>  restore the database from a backup folder (asks for confirmation)
#     import <folder>      move an existing site in: db.sql[.gz] (+ storage.tar.gz of storage/app)
#                          from the former hosting, then migrate + seed (asks for confirmation)
#     create-sysadmin      first system administrator of a new installation (interactive)
#     install-cron         nightly backup at 02:40 (crontab of the user deploy)
#     check                check /srv/app/.env only
#     status               running release, containers, releases, backups, disk
#     ci                   entry of GitHub Actions: the forced command of the deploy key
#                          (authorized_keys: command="/srv/app/deploy.sh ci") - allows only
#                          `release <tag>`, `rollback`, `status`; the registry token comes on stdin
# @usage ssh klient-vps '/srv/app/deploy.sh status'      (guide: deploy/deploy_workflow.md)
# @note A release ships its own compose.yaml and deploy.sh inside the API image (/opt/deploy) -
#   this script installs them, so the server always runs the files of the deployed release.
# @note Downtime of a release: the API stops for the migrations (typically 20-60 s; the proxy keeps
#   serving the pages, API calls answer 502). Nothing writes into the database meanwhile, so a
#   failed release can restore the backup taken right before it without losing data.
# @security Never prints a secret: the database passwords stay inside the db container (MYSQL_PWD
#   from its environment), the registry token is read from stdin into a temporary Docker config
#   that is deleted on exit. Backups are mode 600 in a 700 folder (they hold personal data -
#   retention BACKUP_KEEP_DAYS, GDPR).
# @return 0 = done, 1 = failed (the message says what and what was rolled back).
# =============================================================================
set -Eeuo pipefail
umask 027

APP_DIR="${APP_DIR:-/srv/app}"
ENV_FILE="$APP_DIR/.env"
COMPOSE_FILE="$APP_DIR/compose.yaml"
BACKUP_DIR="$APP_DIR/backups"
LOG_DIR="$APP_DIR/logs"
RELEASES_LOG="$APP_DIR/releases.log"
INCOMING="$APP_DIR/.incoming"
LOCK_FILE="$APP_DIR/.deploy.lock"
CRON_MARK="# web-platform-backup"
TAG_PATTERN='^v[0-9A-Za-z][0-9A-Za-z._-]{0,62}$'

step() { printf '\n\e[34m==> %s\e[0m\n' "$*"; }
info() { printf '    - %s\n' "$*"; }
warn() { printf '\e[33m    ! %s\e[0m\n' "$*" >&2; }
die()  { printf '\e[31mERROR: %s\e[0m\n' "$*" >&2; exit 1; }
trap 'die "unexpected failure at line $LINENO: $BASH_COMMAND"' ERR

# -----------------------------------------------------------------------------
# @description docker compose of this installation (project directory /srv/app, its .env).
# -----------------------------------------------------------------------------
dc() { docker compose --project-directory "$APP_DIR" -f "$COMPOSE_FILE" "$@"; }

# -----------------------------------------------------------------------------
# @description Value of KEY in /srv/app/.env (last occurrence, without quotes / \r).
# @param $1 Variable name.
# -----------------------------------------------------------------------------
env_get() {
    [[ -f "$ENV_FILE" ]] || return 0
    sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -n1 \
        | sed -e 's/\r$//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# -----------------------------------------------------------------------------
# @description Sets KEY=VALUE in /srv/app/.env in place (the file keeps its owner and mode 600).
# @param $1 Variable name. @param $2 Value (no quoting needed - a release tag).
# -----------------------------------------------------------------------------
env_set() {
    local tmp
    tmp="$(mktemp "$APP_DIR/.env.XXXXXX")"
    if grep -q "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE"; then
        awk -v k="$1" -v v="$2" 'BEGIN { re = "^[[:space:]]*" k "[[:space:]]*=" } $0 ~ re { print k "=" v; next } { print }' "$ENV_FILE" > "$tmp"
    else
        cat "$ENV_FILE" > "$tmp"
        printf '%s=%s\n' "$1" "$2" >> "$tmp"
    fi
    cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
}

# -----------------------------------------------------------------------------
# @description Only one release / rollback / backup at a time.
# @param $1 "wait" (a release waits for a running backup) or "skip" (a backup skips while a
#   release runs).
# -----------------------------------------------------------------------------
take_lock() {
    exec 9>"$LOCK_FILE"
    if [[ "$1" == "skip" ]]; then
        flock -n 9 || { info "another deployment step is running - skipped"; exit 0; }
    else
        flock -w 900 9 || die "another deployment step is still running (lock $LOCK_FILE)"
    fi
}

# -----------------------------------------------------------------------------
# @description Writes the output of this run also into logs/<name>.log.
# @param $1 Log name.
# -----------------------------------------------------------------------------
log_to() {
    mkdir -p "$LOG_DIR"
    exec > >(tee -a "$LOG_DIR/$1.log") 2>&1
    printf '\n===== %s %s =====\n' "$(date -Iseconds)" "$*"
}

validate_tag() {
    [[ "$1" =~ $TAG_PATTERN ]] || die "release tag '$1' is not valid (expected e.g. v2026.11.1)"
}

# -----------------------------------------------------------------------------
# @description Checks /srv/app/.env. ERROR = would break production or open a hole (stops),
# WARNING = questionable (continues). Lists everything at once.
# -----------------------------------------------------------------------------
check_env() {
    step "Checking $ENV_FILE"
    [[ -f "$ENV_FILE" ]] || die "$ENV_FILE is missing - deploy/setup_hosting.md, step 10"
    [[ -f "$COMPOSE_FILE" ]] || die "$COMPOSE_FILE is missing - deploy/setup_hosting.md, step 10"
    local -a errors=() warnings=()
    local v

    [[ "$(stat -c %a "$ENV_FILE")" == "600" ]] || errors+=(".env must be readable by its owner only: chmod 600 $ENV_FILE")

    # --- stack ---
    v="$(env_get IMAGE_PREFIX)"
    [[ "$v" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._/-]+$ ]] || errors+=("IMAGE_PREFIX must be ghcr.io/<organisation>/<repository> in lower case (is '$v')")
    local domain; domain="$(env_get SITE_DOMAIN)"
    [[ "$domain" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || errors+=("SITE_DOMAIN must be the domain without www in lower case (is '$domain')")
    [[ "$domain" == www.* ]] && errors+=("SITE_DOMAIN must be WITHOUT www (www.<domain> redirects to it)")
    [[ "$(env_get ACME_EMAIL)" == *@*.* ]] || errors+=("ACME_EMAIL is not an e-mail address")
    [[ -n "$(env_get DB_ROOT_PASSWORD)" ]] || errors+=("DB_ROOT_PASSWORD is empty (openssl rand -hex 24)")

    # --- application ---
    [[ "$(env_get APP_ENV)" == "production" ]] || errors+=("APP_ENV must be 'production'")
    [[ "$(env_get APP_DEBUG)" == "false" ]] || errors+=("APP_DEBUG must be 'false' - debug pages show the configuration to anybody")
    [[ "$(env_get APP_KEY)" =~ ^base64:[A-Za-z0-9+/]{43}=$ ]] || errors+=("APP_KEY is missing or not a Laravel key (echo \"base64:\$(openssl rand -base64 32)\") - NEVER change it on a running installation")
    for v in APP_URL FRONTEND_URL; do
        [[ "$(env_get "$v")" == "https://$domain" ]] || errors+=("$v must be https://$domain (is '$(env_get "$v")')")
    done
    [[ "$(env_get SESSION_SECURE_COOKIE)" == "true" ]] || errors+=("SESSION_SECURE_COOKIE must be 'true'")
    [[ "$(env_get LOG_LEVEL)" =~ ^(debug)?$ ]] && warnings+=("LOG_LEVEL is 'debug' or empty - logs grow fast and may contain personal data (use warning)")

    # --- database ---
    for v in DB_DATABASE DB_USERNAME DB_PASSWORD; do
        [[ -n "$(env_get "$v")" ]] || errors+=("$v is empty")
    done
    [[ "$(env_get DB_USERNAME)" == "root" ]] && errors+=("DB_USERNAME must not be 'root' (the db container creates its own user)")

    # --- CORS / proxies ---
    [[ "$(env_get CORS_ALLOWED_ORIGINS)" == *"*"* ]] && errors+=("CORS_ALLOWED_ORIGINS contains '*' - leave it empty (one origin)")
    [[ "$(env_get TRUSTED_PROXIES)" == '*' ]] && warnings+=("TRUSTED_PROXIES is '*' - a client could fake its IP; Caddy needs no trusted proxy")

    # --- mail (2FA codes) ---
    v="$(env_get MAIL_MAILER)"
    [[ -z "$v" || "$v" =~ ^(log|array)$ ]] && errors+=("MAIL_MAILER is '${v:-empty}' - no e-mail would leave the server, nobody could finish the 2FA login")
    [[ "$v" == "smtp" && -z "$(env_get MAIL_HOST)" ]] && errors+=("MAIL_HOST is empty")
    [[ "$v" == "smtp" && -z "$(env_get MAIL_PASSWORD)" ]] && warnings+=("MAIL_PASSWORD is empty")
    [[ "$(env_get MAIL_FROM_ADDRESS)" =~ example\.com$|^$ ]] && warnings+=("MAIL_FROM_ADDRESS is empty or an example address")
    [[ -z "$(env_get MAIL_REPLY_TO_ADDRESS)" ]] && warnings+=("MAIL_REPLY_TO_ADDRESS is empty - answers to e-mails go to noreply@")

    # --- captcha ---
    [[ "$(env_get TURNSTILE_SITE_KEY)" =~ ^0x[A-Za-z0-9_-]{16,}$ ]] || errors+=("TURNSTILE_SITE_KEY is missing or a test key (expected 0x…)")
    [[ "$(env_get TURNSTILE_SECRET_KEY)" =~ ^0x[A-Za-z0-9_-]{16,}$ ]] || errors+=("TURNSTILE_SECRET_KEY is missing or a test key (expected 0x…)")

    # --- shop ---
    [[ "$(env_get SHOP_PAYMENT_SIMULATION)" =~ ^(true|1|on|yes)$ ]] && errors+=("SHOP_PAYMENT_SIMULATION is on - anybody could mark orders as paid")

    for v in "${warnings[@]}"; do warn "$v"; done
    if [[ ${#errors[@]} -gt 0 ]]; then
        for v in "${errors[@]}"; do printf '\e[31m    ✗ %s\e[0m\n' "$v" >&2; done
        die "${#errors[@]} error(s) in $ENV_FILE - nothing was changed"
    fi
    info "OK (${#warnings[@]} warning(s))"
}

# -----------------------------------------------------------------------------
# @description Logs in to ghcr.io with the user and token of the workflow read from stdin (two
# lines). The credentials live in a temporary Docker config, deleted when the script exits.
# -----------------------------------------------------------------------------
registry_login_stdin() {
    local user token
    IFS= read -r user || true
    IFS= read -r token || true
    [[ -n "$user" && -n "$token" ]] || die "registry user / token expected on stdin"
    DOCKER_CONFIG="$(mktemp -d)"
    export DOCKER_CONFIG
    trap 'rm -rf "$DOCKER_CONFIG"' EXIT
    printf '%s' "$token" | docker login ghcr.io -u "$user" --password-stdin >/dev/null \
        || die "login to ghcr.io failed"
    info "logged in to ghcr.io (temporary)"
}

# -----------------------------------------------------------------------------
# @description Pulls both images of the release (skipped when they are on the server already).
# @param $1 Release tag.
# -----------------------------------------------------------------------------
pull_images() {
    step "Images $1"
    local prefix image
    prefix="$(env_get IMAGE_PREFIX)"
    for image in "$prefix-api:$1" "$prefix-web:$1"; do
        if docker image inspect "$image" >/dev/null 2>&1 && [[ -z "${DOCKER_CONFIG:-}" ]]; then
            info "$image (on the server)"
        else
            docker pull --quiet "$image" >/dev/null || die "cannot pull $image (does the release exist? is the registry login valid?)"
            info "$image"
        fi
    done
}

# -----------------------------------------------------------------------------
# @description Copies compose.yaml and deploy.sh of the release out of its API image into
# .incoming/ (installed only when the release succeeds).
# @param $1 Release tag.
# -----------------------------------------------------------------------------
extract_bundle() {
    local cid
    rm -rf "$INCOMING"
    mkdir -p "$INCOMING"
    cid="$(docker create "$(env_get IMAGE_PREFIX)-api:$1")"
    docker cp -q "$cid:/opt/deploy/." "$INCOMING/" || { docker rm -f "$cid" >/dev/null; die "the image of $1 has no /opt/deploy bundle"; }
    docker rm -f "$cid" >/dev/null
    [[ -s "$INCOMING/compose.yaml" && -s "$INCOMING/deploy.sh" ]] || die "the bundle of $1 is incomplete"
    info "compose.yaml + deploy.sh of $1 ready"
}

# -----------------------------------------------------------------------------
# @description Backup into backups/<date>-<label>/: db.sql.gz (consistent dump, single
# transaction), storage.tar.gz (storage/app: uploads, translations - no logs, no caches),
# RELEASE, SHA256SUMS. Old backups go after BACKUP_KEEP_DAYS (default 14); a copy goes to
# BACKUP_REMOTE when set. Sets LAST_BACKUP.
# @param $1 Label (nightly, pre-<tag>, manual, pre-restore).
# -----------------------------------------------------------------------------
backup() {
    local label="${1:-manual}" dir release
    release="$(env_get RELEASE)"
    [[ -n "$release" ]] || die "no release is running - nothing to back up"
    step "Backup ($label)"
    install -d -m 700 "$BACKUP_DIR"
    dir="$BACKUP_DIR/$(date +%Y%m%d-%H%M%S)-$label"
    install -d -m 700 "$dir"

    dc up -d --wait db >/dev/null 2>&1 || die "the database container does not start"
    # shellcheck disable=SC2016 # expanded inside the db container
    dc exec -T db sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb-dump -u"$MARIADB_USER" --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 "$MARIADB_DATABASE"' \
        | gzip -6 > "$dir/db.sql.gz"
    dc run --rm --no-deps -T --entrypoint tar app -czf - -C /var/www/html/storage app > "$dir/storage.tar.gz"
    printf '%s\n' "$release" > "$dir/RELEASE"
    (cd "$dir" && sha256sum db.sql.gz storage.tar.gz > SHA256SUMS)
    chmod 600 "$dir"/*
    gzip -t "$dir/db.sql.gz" || die "the database dump is damaged"
    info "$dir ($(du -sh "$dir" | cut -f1))"
    LAST_BACKUP="$dir"

    local keep; keep="$(env_get BACKUP_KEEP_DAYS)"; keep="${keep:-14}"
    [[ "$keep" =~ ^[0-9]+$ ]] || keep=14
    find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$keep" -exec rm -rf {} +
    info "backups older than $keep days removed"

    local remote key
    remote="$(env_get BACKUP_REMOTE)"
    if [[ -n "$remote" ]]; then
        key="$(env_get BACKUP_SSH_KEY)"; key="${key:-$HOME/.ssh/id_ed25519_backup}"
        if rsync -a -e "ssh -i $key -o BatchMode=yes -o IdentitiesOnly=yes" "$dir" "$remote/"; then
            info "copied to the backup server"
        else
            warn "copy to BACKUP_REMOTE failed - the backup stays only on this server"
        fi
    else
        warn "BACKUP_REMOTE is not set - the backups stay only on this server"
    fi
}

# -----------------------------------------------------------------------------
# @description Replaces the database with db.sql.gz of a backup (drop + create + import).
# @param $1 Backup folder.
# -----------------------------------------------------------------------------
restore_db_from() {
    local dir="$1"
    [[ -f "$dir/db.sql.gz" ]] || die "no db.sql.gz in $dir"
    (cd "$dir" && sha256sum -c --quiet --ignore-missing SHA256SUMS) || die "checksum of $dir does not match"
    step "Restoring the database from $dir"
    # shellcheck disable=SC2016 # expanded inside the db container
    gunzip -c "$dir/db.sql.gz" | dc exec -T db sh -c '
        export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"
        mariadb -uroot -e "DROP DATABASE IF EXISTS \`$MARIADB_DATABASE\`; CREATE DATABASE \`$MARIADB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
        && exec mariadb -uroot "$MARIADB_DATABASE"'
    info "database restored"
}

# -----------------------------------------------------------------------------
# @description Unpacks storage.tar.gz (the folder app/ of a Laravel storage) into the volume
# `storage`: files of the archive replace the same files, other files stay.
# @param $1 Archive.
# -----------------------------------------------------------------------------
restore_storage_from() {
    [[ -f "$1" ]] || die "$1 does not exist"
    tar -tzf "$1" | grep -E '^(\./)?app/' >/dev/null || die "$1 does not contain the folder app/ (tar czf storage.tar.gz -C <storage> app)"
    step "Restoring storage/app from $1"
    dc run --rm --no-deps -T --entrypoint tar app -xzf - -C /var/www/html/storage --no-same-owner < "$1"
    info "storage/app restored"
}

# -----------------------------------------------------------------------------
# @description Smoke test of the whole chain (Caddy → PHP-FPM → Laravel → MariaDB) through the
# internal door of the Caddyfile (http://127.0.0.1:8080 inside the proxy container - works before
# the DNS points here): /api/version answers the release, the page contains the app (the root
# redirects to the language), /robots.txt is answered by Laravel (Sitemap line), /.env is
# 404. Then the public HTTPS address on this server: a missing certificate is only a warning
# (DNS not switched yet - Caddy obtains it as soon as the domain points here).
# @param $1 Expected release tag.
# -----------------------------------------------------------------------------
smoke_test() {
    step "Smoke test"
    local out="" domain
    for _ in $(seq 1 45); do
        out="$(dc exec -T proxy wget -q -O - http://127.0.0.1:8080/api/version 2>&1)" \
            && [[ "$out" == *"\"version\":\"$1\""* ]] && break
        sleep 2
    done
    if [[ "$out" != *"\"version\":\"$1\""* ]]; then
        warn "GET /api/version did not answer $1: ${out:0:200}"
        return 1
    fi
    info "/api/version = $1"
    dc exec -T proxy wget -q -O - http://127.0.0.1:8080/ | grep 'runtime-config.js' >/dev/null \
        || { warn "the home page does not contain the app"; return 1; }
    info "home page OK"
    dc exec -T proxy wget -q -O - http://127.0.0.1:8080/robots.txt | grep 'Sitemap:' >/dev/null \
        || { warn "/robots.txt is not answered by the API (Caddyfile route of / /robots.txt /sitemap.xml)"; return 1; }
    info "robots.txt OK"
    if dc exec -T proxy wget -q --spider http://127.0.0.1:8080/.env >/dev/null 2>&1; then
        warn "/.env is served - it must be 404"
        return 1
    fi
    info "/.env = 404"

    domain="$(env_get SITE_DOMAIN)"
    if curl --silent --fail --max-time 10 --resolve "$domain:443:127.0.0.1" -o /dev/null "https://$domain/api/version"; then
        info "https://$domain answers with a valid certificate"
    else
        warn "https://$domain has no valid certificate yet - does the DNS A record point to this server (setup_hosting.md, step 12)? Caddy keeps trying: docker compose logs proxy"
    fi
}

# -----------------------------------------------------------------------------
# @description Last successful release in releases.log other than $1 (lines: date tag
# ok|failed|rolledback).
# -----------------------------------------------------------------------------
previous_release() {
    [[ -f "$RELEASES_LOG" ]] || return 0
    # A release rolled back from is never a rollback target again.
    awk -v cur="$1" '{ tag[NR] = $2; st[NR] = $3; last[$2] = $3 }
        END { for (i = 1; i <= NR; i++) if (st[i] == "ok" && tag[i] != cur && last[tag[i]] != "rolledback") r = tag[i]; print r }' "$RELEASES_LOG"
}

record_release() { printf '%s %s %s\n' "$(date -Iseconds)" "$1" "$2" >> "$RELEASES_LOG"; }

# -----------------------------------------------------------------------------
# @description Keeps the images of the last 3 successful releases (fast rollback), removes
# older ones and dangling layers.
# -----------------------------------------------------------------------------
prune_images() {
    local prefix keep tag repo
    prefix="$(env_get IMAGE_PREFIX)"
    keep=" $(awk '$3 == "ok" { print $2 }' "$RELEASES_LOG" | tail -n 3 | tr '\n' ' ') "
    for repo in "$prefix-api" "$prefix-web"; do
        while IFS= read -r tag; do
            [[ -z "$tag" || "$keep" == *" $tag "* ]] && continue
            docker image rm "$repo:$tag" >/dev/null 2>&1 || true
        done < <(docker image ls "$repo" --format '{{.Tag}}' || true)
    done
    docker image prune -f >/dev/null 2>&1 || true
    info "images kept:$keep"
}

# -----------------------------------------------------------------------------
# @description Deploys a release (see the header). A failure after the API was stopped puts
# the previous release - and, once the migrations started, its database - back.
# @param $1 Release tag.
# -----------------------------------------------------------------------------
cmd_release() {
    local tag="${1:-}" prev pre_backup="" migrated=0
    validate_tag "$tag"
    take_lock wait
    log_to deploy "release $tag"
    check_env
    prev="$(env_get RELEASE)"
    [[ "$prev" == "$tag" ]] && info "$tag is running already - deployed again"
    [[ -z "$prev" ]] && info "first release of this installation"

    pull_images "$tag"
    extract_bundle "$tag"

    if [[ -n "$prev" ]]; then
        backup "pre-$tag"
        pre_backup="$LAST_BACKUP"
        step "Stopping the API of $prev"
        dc stop queue scheduler app
    fi

    step "Starting $tag"
    [[ -f "$COMPOSE_FILE" ]] && cp -p "$COMPOSE_FILE" "$APP_DIR/compose.yaml.prev"
    install -m 640 "$INCOMING/compose.yaml" "$COMPOSE_FILE"
    env_set RELEASE "$tag"

    if dc up -d --wait db \
        && { migrated=1; dc run --rm -T app php artisan migrate --force --no-interaction; } \
        && dc run --rm -T app php artisan db:seed --force --no-interaction \
        && dc up -d --wait --wait-timeout 300 --remove-orphans \
        && smoke_test "$tag"; then
        record_release "$tag" ok
        install -m 750 "$INCOMING/deploy.sh" "$APP_DIR/deploy.sh.new" && mv -f "$APP_DIR/deploy.sh.new" "$APP_DIR/deploy.sh"
        rm -rf "$INCOMING"
        prune_images
        step "Release $tag is live (previous: ${prev:-none})"
        return 0
    fi

    record_release "$tag" failed
    if [[ -z "$prev" ]]; then
        die "the first release $tag failed - the stack stays as it is for a diagnosis (docker compose logs). Fix the cause and run the release again."
    fi
    step "Release $tag FAILED - back to $prev"
    dc stop queue scheduler app proxy || true
    [[ $migrated -eq 1 && -n "$pre_backup" ]] && restore_db_from "$pre_backup"
    [[ -f "$APP_DIR/compose.yaml.prev" ]] && cp -p "$APP_DIR/compose.yaml.prev" "$COMPOSE_FILE"
    env_set RELEASE "$prev"
    dc up -d --wait --wait-timeout 300 --remove-orphans || true
    if smoke_test "$prev"; then
        die "release $tag failed; $prev runs again$([[ $migrated -eq 1 ]] && echo " with the database from before the release")"
    fi
    die "release $tag failed AND $prev does not answer - check: docker compose ps; docker compose logs"
}

# -----------------------------------------------------------------------------
# @description Back to the previous successful release (its images are on the server).
# @param $1 Optional --with-db: also restore the backup taken before the current release.
# -----------------------------------------------------------------------------
cmd_rollback() {
    local with_db="${1:-}" cur prev backup_dir=""
    [[ -z "$with_db" || "$with_db" == "--with-db" ]] || die "usage: rollback [--with-db]"
    take_lock wait
    log_to deploy "rollback $with_db"
    cur="$(env_get RELEASE)"
    prev="$(previous_release "$cur")"
    [[ -n "$prev" ]] || die "no previous successful release in $RELEASES_LOG"
    docker image inspect "$(env_get IMAGE_PREFIX)-api:$prev" >/dev/null 2>&1 \
        || die "the images of $prev are no longer on the server - deploy it as a release instead"
    if [[ -n "$with_db" ]]; then
        backup_dir="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "*-pre-$cur" | sort | tail -n1)"
        [[ -n "$backup_dir" ]] || die "no backup pre-$cur found - roll back without --with-db, or restore-db by hand"
    fi
    step "Rollback $cur → $prev"
    dc stop queue scheduler app
    if [[ -n "$backup_dir" ]]; then
        backup "pre-rollback"
        restore_db_from "$backup_dir"
    fi
    # compose.yaml of the previous release, from its own image.
    extract_bundle "$prev"
    install -m 640 "$INCOMING/compose.yaml" "$COMPOSE_FILE"
    env_set RELEASE "$prev"
    dc up -d --wait --wait-timeout 300 --remove-orphans
    smoke_test "$prev" || die "$prev does not answer after the rollback - check: docker compose logs"
    install -m 750 "$INCOMING/deploy.sh" "$APP_DIR/deploy.sh.new" && mv -f "$APP_DIR/deploy.sh.new" "$APP_DIR/deploy.sh"
    rm -rf "$INCOMING"
    record_release "$cur" rolledback
    record_release "$prev" ok
    step "Rolled back to $prev$([[ -n "$backup_dir" ]] && echo " with the database of $(basename "$backup_dir")")"
}

cmd_backup() {
    take_lock skip
    log_to backup "backup ${1:-manual}"
    backup "${1:-manual}"
}

cmd_restore_db() {
    local dir="${1:-}" answer domain
    [[ -n "$dir" ]] || die "usage: restore-db <backup folder> (ls $BACKUP_DIR)"
    [[ "$dir" == /* ]] || dir="$BACKUP_DIR/$dir"
    [[ -d "$dir" ]] || die "$dir does not exist"
    domain="$(env_get SITE_DOMAIN)"
    printf 'The database of %s will be REPLACED with %s.\nType the domain to confirm: ' "$domain" "$dir"
    IFS= read -r answer
    [[ "$answer" == "$domain" ]] || die "not confirmed - nothing changed"
    take_lock wait
    log_to deploy "restore-db $dir"
    dc stop queue scheduler app
    backup "pre-restore"
    restore_db_from "$dir"
    dc up -d --wait --wait-timeout 300
    info "done - the current state before the restore is in $LAST_BACKUP"
}

# -----------------------------------------------------------------------------
# @description Moves the data of an existing installation in (former hosting): the database
# dump replaces the database, storage.tar.gz (optional) is unpacked into storage/app, then the
# migrations and the seed of the running release bring the data up to date.
# @param $1 Folder with db.sql or db.sql.gz and optionally storage.tar.gz.
# -----------------------------------------------------------------------------
cmd_import() {
    local dir="${1:-}" answer domain dump release
    [[ -n "$dir" && -d "$dir" ]] || die "usage: import <folder with db.sql[.gz] and storage.tar.gz>"
    dir="$(cd "$dir" && pwd)"
    release="$(env_get RELEASE)"
    [[ -n "$release" ]] || die "deploy a release first (deploy_workflow.md) - import goes into a running installation"
    if [[ -f "$dir/db.sql.gz" ]]; then
        dump="$dir/db.sql.gz"
    elif [[ -f "$dir/db.sql" ]]; then
        gzip -c "$dir/db.sql" > "$dir/db.sql.gz"; chmod 600 "$dir/db.sql.gz"; dump="$dir/db.sql.gz"
    else
        die "no db.sql or db.sql.gz in $dir"
    fi
    gzip -t "$dump" || die "$dump is damaged"
    domain="$(env_get SITE_DOMAIN)"
    printf 'The database%s of %s will be REPLACED with the data of %s.\nType the domain to confirm: ' \
        "$([[ -f "$dir/storage.tar.gz" ]] && echo " and storage/app")" "$domain" "$dir"
    IFS= read -r answer
    [[ "$answer" == "$domain" ]] || die "not confirmed - nothing changed"
    take_lock wait
    log_to deploy "import $dir"
    dc stop queue scheduler app
    backup "pre-import"
    (cd "$dir" && sha256sum db.sql.gz > SHA256SUMS)
    restore_db_from "$dir"
    [[ -f "$dir/storage.tar.gz" ]] && restore_storage_from "$dir/storage.tar.gz"
    step "Bringing the data up to $release"
    dc run --rm -T app php artisan migrate --force --no-interaction
    dc run --rm -T app php artisan db:seed --force --no-interaction
    dc up -d --wait --wait-timeout 300
    smoke_test "$release" || die "the installation does not answer after the import - the state before it is in $LAST_BACKUP"
    step "Imported - the state before the import is in $LAST_BACKUP. Delete $dir (personal data)."
}

cmd_create_sysadmin() {
    [[ -t 0 ]] || die "run it in an interactive SSH session: ssh -t <server> /srv/app/deploy.sh create-sysadmin"
    dc run --rm app php artisan security:create-sysadmin --if-none
}

cmd_install_cron() {
    mkdir -p "$LOG_DIR"
    { crontab -l 2>/dev/null | grep -vF "$CRON_MARK" || true
      echo "40 2 * * * $APP_DIR/deploy.sh backup nightly >/dev/null 2>&1 $CRON_MARK"
    } | crontab -
    info "nightly backup at 02:40 (log: $LOG_DIR/backup.log)"
}

cmd_status() {
    step "Release"
    info "running: $(env_get RELEASE)"
    [[ -f "$RELEASES_LOG" ]] && tail -n 5 "$RELEASES_LOG" | sed 's/^/      /'
    step "Containers"
    dc ps --format 'table {{.Service}}\t{{.Status}}'
    step "Backups"
    find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort | tail -n 5 | sed 's/^/      /'
    step "Disk"
    df -h / | tail -n 1 | awk '{ print "      used " $3 " of " $2 " (" $5 "), free " $4 }'
}

# -----------------------------------------------------------------------------
# @description Entry of GitHub Actions (forced command of its SSH key): runs only the allowed
# commands of SSH_ORIGINAL_COMMAND; `release` reads the registry login from stdin first.
# -----------------------------------------------------------------------------
cmd_ci() {
    local -a args
    read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"
    case "${args[0]:-}" in
        release)
            [[ ${#args[@]} -eq 2 ]] || die "usage: release <tag>"
            validate_tag "${args[1]}"
            registry_login_stdin
            cmd_release "${args[1]}" ;;
        rollback)
            [[ ${#args[@]} -le 2 ]] || die "usage: rollback [--with-db]"
            cmd_rollback "${args[1]:-}" ;;
        status)
            cmd_status ;;
        *)  die "command not allowed for the deploy key: '${SSH_ORIGINAL_COMMAND:-}'" ;;
    esac
}

main() {
    [[ $EUID -ne 0 ]] || die "run as the user deploy, not root"
    command -v docker >/dev/null || die "docker is missing - deploy/vps/bootstrap.sh"
    cd "$APP_DIR"
    local cmd="${1:-}"
    shift || true
    case "$cmd" in
        release)         cmd_release "$@" ;;
        rollback)        cmd_rollback "$@" ;;
        backup)          cmd_backup "$@" ;;
        restore-db)      cmd_restore_db "$@" ;;
        import)          cmd_import "$@" ;;
        create-sysadmin) cmd_create_sysadmin ;;
        install-cron)    cmd_install_cron ;;
        check)           check_env ;;
        status)          cmd_status ;;
        ci)              cmd_ci ;;
        *) sed -n '/^# @description/,/^# @usage/p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
    esac
}

main "$@"
