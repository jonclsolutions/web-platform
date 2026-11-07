#!/usr/bin/env bash
#
# @file attack_security_monitoring.sh
# @project JS web-platform
# @description LOCAL load / test script of the security monitoring (core_security_events).
# Generates real HTTP traffic against YOUR OWN dev API that triggers the detection hooks
# (CaptchaVerificationService, AuthController,
# the throttle exception handler in bootstrap/app.php, the fallback route in api.php,
# CheckPermission middleware, AccountActivationController, PasswordResetController,
# WebSalesLeadController).
#
# LOCAL DEVELOPMENT / TESTING ONLY - never run it against production or a foreign domain.
# The target is the API (Laravel), NOT the Angular dev server on :4200 - none of the hooks
# runs in the browser, the monitoring watches the backend traffic only.
#
# Usage:
#   chmod +x attack_security_monitoring.sh
#   ./attack_security_monitoring.sh
#
#   # Optional for section [12] (permission_denied) - a real LOW-privilege account
#   # WITHOUT 'core-security-view' (otherwise the section only reports that access passed):
#   TEST_USER_EMAIL="low-privilege@example.com" TEST_USER_PASSWORD="Password123!" \
#     ./attack_security_monitoring.sh
#
# Needs: bash + curl (Linux / macOS / WSL / Git Bash).
# Needs a RUNNING Laravel API (./dev.sh) at the address below.

set -uo pipefail

# ── Configuration - adjust to your local environment ─────────────────────
API_BASE="http://127.0.0.1:8000/api"   # APP_URL of the local api/.env
FAKE_EMAIL="utok-test@example.com"      # e-mail used for simulating the brute-force login
SCANNER_UA="Mozilla/5.0 (compatible; SecurityTestBot/1.0)"

# Optional - see section [12] (permission_denied). Empty = the section is skipped.
TEST_USER_EMAIL="${TEST_USER_EMAIL:-}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-}"
# Endpoint the test account must NOT have access to, for section [12] to show something.
TEST_PROTECTED_ENDPOINT="${TEST_PROTECTED_ENDPOINT:-core/security_events}"

# Timeouts for EVERY curl call - without them curl waits forever for a TCP connection
# when nothing listens at the address.
CONNECT_TIMEOUT=3   # max seconds to establish the TCP connection
MAX_TIME=8          # max seconds for the whole request (connection + response)

# `-H "Accept: application/json"` - Laravel answers JSON instead of redirects / HTML.
curl_opts=(--connect-timeout "${CONNECT_TIMEOUT}" --max-time "${MAX_TIME}" -s -H "Accept: application/json")

echo "=================================================================="
echo " Security monitoring - LOCAL test traffic"
echo " Target: ${API_BASE}"
echo "=================================================================="
echo

# ── Preflight: check that the API answers at all, BEFORE the attack ───────────
# Uses a public endpoint without authentication (web/public/status).
echo "Checking that the API answers (${API_BASE}/web/public/status)..."
preflight_code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" "${API_BASE}/web/public/status" 2>/dev/null)
preflight_exit=$?

if [ "$preflight_exit" -ne 0 ] || [ "$preflight_code" = "000" ]; then
  echo
  echo "❌ The API does not answer at ${API_BASE} (curl exit code: ${preflight_exit}, HTTP: ${preflight_code})."
  echo
  echo "   Most common causes:"
  echo "   1) The Laravel server is not running - start the dev environment: ./dev.sh"
  echo "      (the API listens on http://127.0.0.1:8000 by default)"
  echo "   2) The server runs on another port / address - change the API_BASE variable at the top"
  echo "      of this script."
  echo "   3) A web server (Apache / nginx) serves the API - check the address / port it really"
  echo "      uses (typically http://localhost/api)."
  echo
  echo "Stopping - an attack against a server that is not running would log nothing anyway."
  exit 1
fi

echo "✅ The API answered (HTTP ${preflight_code}). Starting the test traffic..."
echo

# ── [1/12] Brute-force login (login_failed, login_brute_force_suspected,    ──
# ──        login_captcha_failed - see AuthController::CAPTCHA_THRESHOLD)    ──
# NOTE: the RateLimiter key 'login-fail:<email>' lives in the cache (CACHE_STORE=database,
# TTL 15 minutes - AuthController::FAILED_ATTEMPTS_DECAY_SECONDS). Running the script again
# with the same FAKE_EMAIL within 15 minutes requires the captcha FROM THE FIRST attempt
# (the counter remembers the previous run) - correct behaviour, not a bug. To start from
# zero: wait, run `./dev.sh artisan cache:clear`, or change FAKE_EMAIL below.
#
# From the 4th attempt (CAPTCHA_THRESHOLD=3 exceeded) the script sends NO captcha_token,
# so CaptchaVerificationService::verify() gets an empty token and records
# `login_captcha_failed` (reason: empty_token) - this section tests that hook as well.
echo "[1/12] Simulating a brute-force login (10 attempts, e-mail: ${FAKE_EMAIL})..."
for i in $(seq 1 10); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/login" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (SecurityTestScript)" \
    -d "{\"email\":\"${FAKE_EMAIL}\",\"password\":\"spatne-heslo-${i}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [2/12] Throttle of /forgot-password (throttle:5,1) + e-mail rate limit ──
# 8 requests for the SAME e-mail also exceed the per-e-mail limiter of
# PasswordResetController (EMAIL_MAX_ATTEMPTS=3/15min) - from the 4th call expect
# `password_reset_email_rate_limited` (limiter of the mailbox, not the IP) besides
# `throttle_exceeded` (IP throttle of the route).
echo "[2/12] Flooding /forgot-password (8 fast requests, the limit is 5/min per IP + 3/15 min per e-mail)..."
for i in $(seq 1 8); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/forgot-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${FAKE_EMAIL}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [3/12] Throttle of the public /sales_orders (throttle:10,1) ────────────────
echo "[3/12] Flooding /sales_orders (14 fast requests, the limit is 10/min)..."
for i in $(seq 1 14); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/sales_orders" \
    -H "Content-Type: application/json" \
    -d "{\"client_email\":\"spam-cil-${i}@example.com\",\"thema\":\"test\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [4/12] Scanning / probing - typical paths of automated scanners ─
# Note: only the fallback route of routes/api.php catches them, i.e. paths UNDER
# /api/... - real bots also try root paths (/.env, /wp-login.php outside
# /api), ty by v tomhle projektu padly do web.php a NEBYLY by zachyceny (web.php
# its own fallback) - a possible future extension, not a bug of this script.
echo "[4/12] Simulating scanning / probing under /api/... (typical paths of vulnerability scanners)..."
SCAN_PATHS=(
  ".env"
  "wp-login.php"
  ".git/config"
  "phpinfo.php"
  "wp-admin"
  "config.php"
  "admin/login"
  "server-status"
  "actuator/health"
  "telescope"
)
for path in "${SCAN_PATHS[@]}"; do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/${path}" \
    -H "User-Agent: ${SCANNER_UA}")
  printf "  GET /api/%-20s -> HTTP %s\n" "$path" "$code"
done
echo

# ── [5/12] Invalid refresh token (refresh_token_invalid) ───────────────────
# The refresh token is read only from its HttpOnly cookie (jsw_refresh) - a token in the body
# is ignored (answer "Refresh token is missing.", no event).
echo "[5/12] Sending invalid refresh tokens (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/refresh" \
    -H "Accept: application/json" \
    -H "Cookie: jsw_refresh=neplatny-token-${i}-$(date +%s%N)")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [6/12] Unauthenticated access to a protected route, NO token ──────────
# Caught by the global AuthenticationException handler of bootstrap/app.php
# (unauthenticated_access_attempt, severity info) - `auth:sanctum` middleware tenhle
# refuses the request before it reaches CheckPermission.
echo "[6/12] Calling a protected endpoint (core/users) WITHOUT any token (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/core/users")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [7/12] Unauthenticated access - INVALID / guessed Bearer token ─────────
# Same event_type as [6] (unauthenticated_access_attempt), another path to it - the
# token LOOKS like a valid Sanctum token, it just does not exist in the database. Tests
# the hook with an "almost valid" token, not only with none.
echo "[7/12] Calling a protected endpoint with an INVALID Bearer token (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/core/users" \
    -H "Authorization: Bearer 999${i}|neexistujici-sanctum-token-${i}$(date +%s%N)")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [8/12] Account activation - invalid / unknown token (GET and POST) ─────────
# account_activation_token_invalid (warning) - AccountActivationController::findValidToken().
echo "[8/12] Verifying + activating with a NON-EXISTENT activation token (5x GET, 3x POST)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/account-activation/neplatny-aktivacni-token-${i}")
  printf "  GET  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
for i in $(seq 1 3); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/account-activation/neplatny-aktivacni-token-post-${i}" \
    -H "Content-Type: application/json" \
    -d '{"password":"Heslo123!","password_confirmation":"Heslo123!"}')
  printf "  POST pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [9/12] Password reset - invalid / unknown token ────────────────────────
# password_reset_token_invalid (warning) - PasswordResetController::resetPassword().
echo "[9/12] Completing a password reset with a NON-EXISTENT token (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/reset-password" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"neplatny-reset-token-${i}\",\"password\":\"Heslo123!\",\"password_confirmation\":\"Heslo123!\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [10/12] 2FA - invalid / unknown pending-login session ───────────────
# login_2fa_session_invalid (info) - AuthController::verifyTwoFactor()/resendTwoFactor().
# Tests guessing the `login_token` (opaque session identifier), NOT guessing the 6-digit OTP
# code (covered by login_2fa_invalid, not tested here - it would need a real account
# s vynucenou 2FA a platnou pending session).
echo "[10/12] Verifying + requesting a new code with a NON-EXISTENT 2FA session (3x verify, 3x resend)..."
for i in $(seq 1 3); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/login/verify-2fa" \
    -H "Content-Type: application/json" \
    -d "{\"login_token\":\"neexistujici-2fa-session-${i}\",\"code\":\"000000\"}")
  printf "  verify pokus %-2s -> HTTP %s\n" "$i" "$code"
done
for i in $(seq 1 3); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/login/resend-2fa" \
    -H "Content-Type: application/json" \
    -d "{\"login_token\":\"neexistujici-2fa-session-resend-${i}\"}")
  printf "  resend pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [11/12] Public lead token - unknown ───────────────────────────────
# sales_lead_token_invalid (warning) - WebSalesLeadController::showByToken().
# The endpoint returns personal data of the contact, so token enumeration is more sensitive
# than on purely informational public endpoints - hence its own event_type, not a silent 404.
echo "[11/12] Loading the order form with a NON-EXISTENT lead token (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/public/sales-leads/neexistujici-lead-token-${i}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [12/12] OPTIONAL: permission_denied with a real low-privilege account ─
# Unlike [6] / [7] (missing / invalid token) this section tests a VALIDLY
# logged-in user lacking a specific permission - impossible to simulate
# without a real account. Without TEST_USER_EMAIL / TEST_USER_PASSWORD the section
# is skipped (a missing precondition, not an error).
if [ -z "$TEST_USER_EMAIL" ] || [ -z "$TEST_USER_PASSWORD" ]; then
  echo "[12/12] SKIPPED - permission_denied needs a real test account."
  echo "         Run the script with TEST_USER_EMAIL and TEST_USER_PASSWORD set to an account"
  echo "         WITHOUT the permission for '${TEST_PROTECTED_ENDPOINT}' (see the header comment)."
else
  echo "[12/12] Logging in as ${TEST_USER_EMAIL} and calling an endpoint without permission (${TEST_PROTECTED_ENDPOINT})..."

  login_response=$(curl "${curl_opts[@]}" \
    -X POST "${API_BASE}/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\"}")

  if echo "$login_response" | grep -q '"requires_2fa"'; then
    echo "  ⚠️  The account has forced 2FA - this script cannot complete the OTP step interactively."
    echo "      Use an account without forced 2FA, or test permission_denied by hand (e.g. Postman)."
  else
    # No jq (no extra dependency) - a rough extraction of "token":"..." from the JSON.
    test_token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | head -n1 | cut -d'"' -f4)

    if [ -z "$test_token" ]; then
      echo "  ❌ Login failed - check TEST_USER_EMAIL / TEST_USER_PASSWORD."
      echo "     Server response: ${login_response}"
    else
      code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
        -X GET "${API_BASE}/${TEST_PROTECTED_ENDPOINT}" \
        -H "Authorization: Bearer ${test_token}")

      printf "  GET /%s -> HTTP %s\n" "$TEST_PROTECTED_ENDPOINT" "$code"

      if [ "$code" = "403" ]; then
        echo "  ✅ Expected result - a 'permission_denied' event should appear."
      elif [ "$code" = "200" ]; then
        echo "  ⚠️  The account HAS the permission for this endpoint - nothing was logged (expected,"
        echo "      not a bug). Set TEST_PROTECTED_ENDPOINT to an endpoint the account must not use."
      fi
    fi
  fi
fi
echo

echo "=================================================================="
echo " Done. Check admin -> Core -> Security monitoring."
echo "=================================================================="
echo " Expected event types of sections [1]-[11]:"
echo "   login_failed, login_brute_force_suspected, login_captcha_failed,"
echo "   throttle_exceeded, password_reset_email_rate_limited, scan_probe,"
echo "   refresh_token_invalid, unauthenticated_access_attempt,"
echo "   account_activation_token_invalid, password_reset_token_invalid,"
echo "   login_2fa_session_invalid, sales_lead_token_invalid"
echo
echo " Section [12] (optional): permission_denied"
echo "=================================================================="
echo
echo " NOT AUTOMATED scenarios (they need a manual change of .env / the database, the script"
echo " deliberately does NOT run them so it changes nothing silently):"
echo
echo " • login_captcha_service_error / captcha 'rejected_by_provider':"
echo "   TURNSTILE_SECRET_KEY in .env is the Cloudflare test key"
echo "   '1x0000...AA', which ALWAYS passes as valid - so this script cannot"
echo "   produce a real captcha rejection. For a manual test, temporarily switch"
echo "   TURNSTILE_SECRET_KEY to '2x0000000000000000000000000000000AA' (the Cloudflare"
echo "   documented 'always fails' key), run 'php artisan config:clear' and try"
echo "   a login with any captcha_token after CAPTCHA_THRESHOLD is exceeded. DO NOT FORGET"
echo "   to restore the key after the test."
echo
echo " • account_activation_blocked_account:"
echo "   needs a real account that (a) has a valid activation token"
echo "   (create a new user in the admin) AND (b) is_blocked=1 (block it"
echo "   right after creating it, BEFORE activation). Then open the activation link of the e-mail -"
echo "   an 'account_activation_blocked_account' event should appear."
echo "=================================================================="