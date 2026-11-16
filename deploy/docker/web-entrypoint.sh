#!/bin/sh
# =============================================================================
# @file web-entrypoint.sh
# @path deploy/docker/web-entrypoint.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Start of the `proxy` container (web.Dockerfile): writes /srv/runtime/runtime-config.js
#   - the PUBLIC settings of this installation read by the Angular app before its bundle
#   (erp/public/runtime-config.js, environment.prod.ts) - from the environment, checks the
#   settings of the Caddyfile, then runs the given command (Caddy).
# @note Environment: TURNSTILE_SITE_KEY (public site key of Cloudflare Turnstile), SITE_DOMAIN,
#   ACME_EMAIL (Caddyfile).
# @security Only public values go to the browser. Every value is checked against a strict pattern
#   before it is written into JavaScript (no injection through the .env).
# =============================================================================
set -eu

fail() { echo "[web-entrypoint] ERROR: $*" >&2; exit 1; }

[ -n "${SITE_DOMAIN:-}" ] || fail "SITE_DOMAIN is not set (domain without www, e.g. example.com)"
printf '%s' "$SITE_DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+$' || fail "SITE_DOMAIN must be a bare domain name"
[ -n "${ACME_EMAIL:-}" ] || fail "ACME_EMAIL is not set (Let's Encrypt notices, e.g. sysadmin@${SITE_DOMAIN})"

key="${TURNSTILE_SITE_KEY:-}"
if [ -n "$key" ] && ! printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_-]{1,100}$'; then
    fail "TURNSTILE_SITE_KEY has an unexpected format"
fi
[ -n "$key" ] || echo "[web-entrypoint] WARNING: TURNSTILE_SITE_KEY is empty - the captcha of the forms will not work" >&2

mkdir -p /srv/runtime
cat > /srv/runtime/runtime-config.js <<JS
/* Settings of this installation - written by web-entrypoint.sh at the container start. */
window.__RUNTIME_CONFIG__ = { turnstileSiteKey: "${key}" };
JS

exec "$@"
