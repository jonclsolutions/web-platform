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
#   TEST_USER_EMAIL="nizke-opravneni@example.com" TEST_USER_PASSWORD="Heslo123!" \
#     ./attack_security_monitoring.sh
#
# Needs: bash + curl (Linux / macOS / WSL / Git Bash).
# Needs a RUNNING Laravel API (./dev.sh) at the address below.

set -uo pipefail

# ── Configuration - adjust to your local environment ─────────────────────
API_BASE="http://127.0.0.1:8000/api"   # z local_laravel_.env: APP_URL=http://127.0.0.1:8000
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
echo " Bezpečnostní monitoring - LOKÁLNÍ testovací provoz"
echo " Cíl: ${API_BASE}"
echo "=================================================================="
echo

# ── Preflight: check that the API answers at all, BEFORE the attack ───────────
# Uses a public endpoint without authentication (web/public/status).
echo "Ověřuji dostupnost API (${API_BASE}/web/public/status)..."
preflight_code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" "${API_BASE}/web/public/status" 2>/dev/null)
preflight_exit=$?

if [ "$preflight_exit" -ne 0 ] || [ "$preflight_code" = "000" ]; then
  echo
  echo "❌ API neodpovídá na ${API_BASE} (curl exit kód: ${preflight_exit}, HTTP: ${preflight_code})."
  echo
  echo "   Nejčastější příčiny:"
  echo "   1) Laravel server neběží - spusť v adresáři backendu: php artisan serve"
  echo "      (poslouchá defaultně na http://127.0.0.1:8000)"
  echo "   2) Server běží na jiném portu/adrese - uprav proměnnou API_BASE nahoře"
  echo "      v tomto skriptu."
  echo "   3) Používáš XAMPP/Apache/nginx - zkontroluj, na jaké adrese/portu web"
  echo "      reálně jede (typicky http://localhost/api nebo http://rp_website.test/api)."
  echo
  echo "Skript se ukončuje - útok proti neběžícímu serveru by stejně nic nezalogoval."
  exit 1
fi

echo "✅ API odpovědělo (HTTP ${preflight_code}). Spouštím testovací provoz..."
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
echo "[1/12] Simuluji brute-force login (10 pokusů, email: ${FAKE_EMAIL})..."
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
echo "[2/12] Zahlcuji /forgot-password (8 rychlých požadavků, limit je 5/min IP + 3/15min e-mail)..."
for i in $(seq 1 8); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/forgot-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${FAKE_EMAIL}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [3/12] Throttle of the public /sales_orders (throttle:10,1) ────────────────
echo "[3/12] Zahlcuji /sales_orders (14 rychlých požadavků, limit je 10/min)..."
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
echo "[4/12] Simuluji scanning/probing pod /api/... (typické cesty skenerů zranitelností)..."
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
echo "[5/12] Posílám neplatné refresh tokeny (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"neplatny-token-${i}-$(date +%s%N)\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [6/12] Unauthenticated access to a protected route, NO token ──────────
# Caught by the global AuthenticationException handler of bootstrap/app.php
# (unauthenticated_access_attempt, severity info) - `auth:sanctum` middleware tenhle
# refuses the request before it reaches CheckPermission.
echo "[6/12] Volám chráněný endpoint (core/users) BEZ jakéhokoliv tokenu (5x)..."
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
echo "[7/12] Volám chráněný endpoint s NEPLATNÝM Bearer tokenem (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/core/users" \
    -H "Authorization: Bearer 999${i}|neexistujici-sanctum-token-${i}$(date +%s%N)")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [8/12] Account activation - invalid / unknown token (GET and POST) ─────────
# account_activation_token_invalid (warning) - AccountActivationController::findValidToken().
echo "[8/12] Ověřuji + aktivuji přes NEEXISTUJÍCÍ aktivační token (5x GET, 3x POST)..."
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
echo "[9/12] Dokončuji reset hesla s NEEXISTUJÍCÍM tokenem (5x)..."
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
echo "[10/12] Ověřuji + žádám o nový kód s NEEXISTUJÍCÍ 2FA session (3x verify, 3x resend)..."
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
echo "[11/12] Načítám objednávkový formulář přes NEEXISTUJÍCÍ lead token (5x)..."
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
  echo "[12/12] PŘESKOČENO - permission_denied vyžaduje reálný testovací účet."
  echo "         Spusť skript s TEST_USER_EMAIL a TEST_USER_PASSWORD nastavenými na účet,"
  echo "         který NEMÁ oprávnění na '${TEST_PROTECTED_ENDPOINT}' (viz komentář v hlavičce)."
else
  echo "[12/12] Přihlašuji se jako ${TEST_USER_EMAIL} a volám endpoint bez oprávnění (${TEST_PROTECTED_ENDPOINT})..."

  login_response=$(curl "${curl_opts[@]}" \
    -X POST "${API_BASE}/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\"}")

  if echo "$login_response" | grep -q '"requires_2fa"'; then
    echo "  ⚠️  Účet má vynucenou 2FA - tenhle skript neumí dokončit OTP krok interaktivně."
    echo "      Použij účet bez vynucené 2FA, nebo otestuj permission_denied ručně přes Postman."
  else
    # No jq (no extra dependency) - a rough extraction of "token":"..." from the JSON.
    test_token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | head -n1 | cut -d'"' -f4)

    if [ -z "$test_token" ]; then
      echo "  ❌ Přihlášení se nezdařilo - zkontroluj TEST_USER_EMAIL/TEST_USER_PASSWORD."
      echo "     Odpověď serveru: ${login_response}"
    else
      code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
        -X GET "${API_BASE}/${TEST_PROTECTED_ENDPOINT}" \
        -H "Authorization: Bearer ${test_token}")

      printf "  GET /%s -> HTTP %s\n" "$TEST_PROTECTED_ENDPOINT" "$code"

      if [ "$code" = "403" ]; then
        echo "  ✅ Očekávaný výsledek - měl by přibýt záznam 'permission_denied'."
      elif [ "$code" = "200" ]; then
        echo "  ⚠️  Účet MÁ oprávnění na tenhle endpoint - nic se nezalogovalo (očekávané chování,"
        echo "      ne bug). Nastav TEST_PROTECTED_ENDPOINT na endpoint, který účet skutečně nesmí."
      fi
    fi
  fi
fi
echo

echo "=================================================================="
echo " Hotovo. Zkontroluj admin -> Core -> Bezpečnostní monitoring."
echo "=================================================================="
echo " Očekávané typy eventů ze sekcí [1]-[11]:"
echo "   login_failed, login_brute_force_suspected, login_captcha_failed,"
echo "   throttle_exceeded, password_reset_email_rate_limited, scan_probe,"
echo "   refresh_token_invalid, unauthenticated_access_attempt,"
echo "   account_activation_token_invalid, password_reset_token_invalid,"
echo "   login_2fa_session_invalid, sales_lead_token_invalid"
echo
echo " Sekce [12] (volitelná): permission_denied"
echo "=================================================================="
echo
echo " NEAUTOMATIZOVANÉ scénáře (vyžadují ruční zásah do .env/DB, skript je"
echo " záměrně NESPOUŠTÍ, aby nic tiše neměnil):"
echo
echo " • login_captcha_service_error / captcha 'rejected_by_provider':"
echo "   TURNSTILE_SECRET_KEY v .env je nastaven na Cloudflare testovací klíč"
echo "   '1x0000...AA', který VŽDY projde jako platný - proto tenhle skript nemůže"
echo "   vygenerovat skutečné odmítnutí captchou. Pro ruční test dočasně přepni"
echo "   TURNSTILE_SECRET_KEY na '2x0000000000000000000000000000000AA' (Cloudflare"
echo "   dokumentovaný klíč 'vždy zamítne'), spusť 'php artisan config:clear' a zkus"
echo "   login s libovolným captcha_token po překročení CAPTCHA_THRESHOLD. NEZAPOMEŇ"
echo "   klíč po testu vrátit zpět."
echo
echo " • account_activation_blocked_account:"
echo "   vyžaduje reálný účet, který (a) má vygenerovaný platný aktivační token"
echo "   (založ nového uživatele v adminu) A ZÁROVEŇ (b) je is_blocked=1 (zablokuj ho"
echo "   hned po založení, PŘED aktivací). Pak zkus otevřít aktivační odkaz z mailu -"
echo "   měl by se objevit záznam 'account_activation_blocked_account'."
echo "=================================================================="