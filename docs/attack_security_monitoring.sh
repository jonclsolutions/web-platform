#!/usr/bin/env bash
#
# @file attack_security_monitoring.sh
# @project RPSW Web
# @description LOKÁLNÍ zátěžový/testovací skript pro bezpečnostní monitoring
# (core_security_events). Generuje reálný HTTP provoz proti VLASTNÍMU dev API, který
# spustí jednotlivé detekční hooky (CaptchaVerificationService, AuthController,
# throttle exception handler v bootstrap/app.php, fallback routa v api.php,
# CheckPermission middleware, AccountActivationController, PasswordResetController,
# WebSalesLeadController).
#
# POUZE PRO LOKÁLNÍ VÝVOJ/TESTOVÁNÍ - nikdy nespouštět proti produkci nebo cizí doméně.
# Cílem je API (Laravel), NE Angular dev server na :4200 - žádný z hooků neběží
# v prohlížeči, monitoring sleduje jen backendový provoz.
#
# @bugfix-note (2026-08-22) Curl volání bez timeoutu ČEKALA NEKONEČNĚ (resp. dokud to
# nevzdá OS síťová vrstva, klidně minuty), pokud API vůbec neposlouchá (server neběží,
# špatný port/URL) - skript pak vypadal jako "zaseklý" bez jakékoliv chybové hlášky.
# Přidány `--connect-timeout`/`--max-time` na KAŽDÉ volání a preflight kontrola
# dostupnosti API na začátku, která selhání ohlásí hned a srozumitelně, místo aby se
# celý skript tiše zasekl na prvním requestu.
#
# @bugfix-note (2026-08-22v2) Chyběla hlavička `Accept: application/json`. Bez ní
# Laravel u chyby validace (např. neúplný payload na /sales_orders) defaultně dělá
# `redirect()->back()` místo vrácení JSON 422 - v terminálu se to projevilo jako
# matoucí `HTTP 302` u prvních pokusů, než se stihl limit throttlu. Na samotný
# bezpečnostní monitoring to vliv nemělo (throttle_exceeded se zapisuje bez ohledu na
# Accept hlavičku), ale výstup skriptu teď realističtěji odpovídá tomu, co posílá
# skutečný Angular frontend (DataHandler tuhle hlavičku nastavuje vždy).
#
# @refactor-note (2026-08-25) ROZŠÍŘENO O VŠECHNY NOVĚ PŘIDANÉ DETEKČNÍ HOOKY (backlog
# "security_events musí pokrýt VŠECHNY typy útoku/obran/nesrovnalostí"). Přidáno 6
# nových povinných sekcí ([6]-[11]) pokrývajících CheckPermission middleware (401/403),
# AccountActivationController, PasswordResetController (neplatný token - rate limit na
# e-mail je vedlejší efekt sekce [2], viz poznámka tam) a WebSalesLeadController.
# Dále přidána JEDNA volitelná sekce [12] (permission_denied s reálným nízko-
# privilegovaným účtem - vyžaduje TEST_USER_EMAIL/TEST_USER_PASSWORD) a dvě čistě
# DOKUMENTAČNÍ poznámky na konci pro scénáře, které NEJDE bezpečně automatizovat bez
# ruční úpravy `.env`/DB (captcha "rejected_by_provider" a
# account_activation_blocked_account) - skript je NESPOUŠTÍ, jen vysvětluje proč a jak
# je otestovat ručně.
#
# Použití:
#   chmod +x attack_security_monitoring.sh
#   ./attack_security_monitoring.sh
#
#   # Volitelně pro sekci [12] (permission_denied) - reálný účet s NÍZKÝM oprávněním,
#   # který NEMÁ 'core-security-view' (jinak sekce jen vypíše, že přístup prošel):
#   TEST_USER_EMAIL="nizke-opravneni@example.com" TEST_USER_PASSWORD="Heslo123!" \
#     ./attack_security_monitoring.sh
#
# Vyžaduje: bash + curl (dostupné na Linuxu/macOS/WSL/Git Bash).
# Vyžaduje BĚŽÍCÍ Laravel server (např. `php artisan serve`) na adrese níže.

set -uo pipefail

# ── Konfigurace - uprav podle svého lokálního prostředí ─────────────────────
API_BASE="http://127.0.0.1:8000/api"   # z local_laravel_.env: APP_URL=http://127.0.0.1:8000
FAKE_EMAIL="utok-test@example.com"      # e-mail použitý pro simulaci brute-force loginu
SCANNER_UA="Mozilla/5.0 (compatible; SecurityTestBot/1.0)"

# Volitelné - viz sekce [12] (permission_denied). Prázdné = sekce se přeskočí.
TEST_USER_EMAIL="${TEST_USER_EMAIL:-}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-}"
# Endpoint, na který testovací účet NESMÍ mít oprávnění, aby sekce [12] něco ukázala.
TEST_PROTECTED_ENDPOINT="${TEST_PROTECTED_ENDPOINT:-core/security_events}"

# Timeouty pro KAŽDÉ curl volání - bez nich curl čeká na TCP spojení donekonečna,
# pokud server na dané adrese vůbec neposlouchá (viz bugfix-note výše).
CONNECT_TIMEOUT=3   # max. sekund na navázání TCP spojení
MAX_TIME=8          # max. sekund na celý request (spojení + odpověď)

# `-H "Accept: application/json"` - viz bugfix-note v2 v hlavičce souboru.
curl_opts=(--connect-timeout "${CONNECT_TIMEOUT}" --max-time "${MAX_TIME}" -s -H "Accept: application/json")

echo "=================================================================="
echo " Bezpečnostní monitoring - LOKÁLNÍ testovací provoz"
echo " Cíl: ${API_BASE}"
echo "=================================================================="
echo

# ── Preflight: ověř, že API vůbec odpovídá, PŘED spuštěním útoku ───────────
# Používá veřejný, autentizaci nevyžadující endpoint (web/public/status).
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
# ──        login_captcha_failed - viz AuthController::CAPTCHA_THRESHOLD)    ──
# POZOR: RateLimiter klíč 'login-fail:<email>' žije v cache (CACHE_STORE=database,
# TTL 15 minut - viz AuthController::FAILED_ATTEMPTS_DECAY_SECONDS). Pokud skript
# spouštíš opakovaně na stejný FAKE_EMAIL do 15 minut, captcha bude vyžadovaná
# HNED od 1. pokusu (počítadlo si "pamatuje" předchozí běh) - to je správné chování,
# ne bug. Pro čistou demonstraci od nuly buď počkej, spusť `php artisan cache:clear`,
# nebo změň FAKE_EMAIL níže na jiný řetězec.
#
# Od 4. pokusu (CAPTCHA_THRESHOLD=3 je právě překročen) skript NEPOSÍLÁ captcha_token,
# takže CaptchaVerificationService::verify() dostane prázdný token a zapíše
# `login_captcha_failed` (reason: empty_token) - tahle sekce tak zároveň otestuje i tenhle
# hook, samostatná sekce pro něj není potřeba.
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

# ── [2/12] Throttle na /forgot-password (throttle:5,1) + email rate limit ──
# 8 requestů na STEJNÝ e-mail zároveň spolehlivě překročí i samostatný per-e-mail
# limiter uvnitř PasswordResetController (EMAIL_MAX_ATTEMPTS=3/15min) - od 4. volání
# tak vedle `throttle_exceeded` (IP throttle na routě) očekávej i
# `password_reset_email_rate_limited` (vlastní limiter cílený na schránku, ne IP).
echo "[2/12] Zahlcuji /forgot-password (8 rychlých požadavků, limit je 5/min IP + 3/15min e-mail)..."
for i in $(seq 1 8); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/forgot-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${FAKE_EMAIL}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [3/12] Throttle na veřejný /sales_orders (throttle:10,1) ────────────────
echo "[3/12] Zahlcuji /sales_orders (14 rychlých požadavků, limit je 10/min)..."
for i in $(seq 1 14); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/sales_orders" \
    -H "Content-Type: application/json" \
    -d "{\"client_email\":\"spam-cil-${i}@example.com\",\"thema\":\"test\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [4/12] Scanning/probing - typické cesty hledané automatizovanými skenery ─
# Poznámka: zachytí je jen fallback routa uvnitř routes/api.php, tedy cesty POD
# /api/... - reálný bot často zkouší i kořenové cesty (/.env, /wp-login.php mimo
# /api), ty by v tomhle projektu padly do web.php a NEBYLY by zachyceny (web.php
# vlastní fallback nemá) - to je případné budoucí rozšíření, ne bug tohoto skriptu.
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

# ── [5/12] Neplatný refresh token (refresh_token_invalid) ───────────────────
echo "[5/12] Posílám neplatné refresh tokeny (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"neplatny-token-${i}-$(date +%s%N)\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [6/12] Neautentizovaný přístup na chráněnou routu, ŽÁDNÝ token ──────────
# Zachytává globální AuthenticationException handler v bootstrap/app.php
# (unauthenticated_access_attempt, severity info) - `auth:sanctum` middleware tenhle
# request odmítne dřív, než se vůbec dostane ke CheckPermission.
echo "[6/12] Volám chráněný endpoint (core/users) BEZ jakéhokoliv tokenu (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/core/users")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [7/12] Neautentizovaný přístup - NEPLATNÝ/uhodnutý Bearer token ─────────
# Stejný event_type jako [6] (unauthenticated_access_attempt), ale jiná cesta k němu -
# token FORMÁTOVĚ vypadá jako platný Sanctum token, jen neexistuje v DB. Testuje, že
# hook funguje i při "skoro platném" tokenu, ne jen při jeho úplné absenci.
echo "[7/12] Volám chráněný endpoint s NEPLATNÝM Bearer tokenem (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/core/users" \
    -H "Authorization: Bearer 999${i}|neexistujici-sanctum-token-${i}$(date +%s%N)")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [8/12] Aktivace účtu - neplatný/neexistující token (GET i POST) ─────────
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

# ── [9/12] Reset hesla - neplatný/neexistující token ────────────────────────
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

# ── [10/12] 2FA - neplatná/neexistující pending-login session ───────────────
# login_2fa_session_invalid (info) - AuthController::verifyTwoFactor()/resendTwoFactor().
# Testuje hádání `login_token` (opaque session identifikátor), NE hádání 6místného OTP
# kódu (to už pokrývá login_2fa_invalid, netestováno tady - vyžadovalo by reálný účet
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

# ── [11/12] Veřejný lead token - neexistující ───────────────────────────────
# sales_lead_token_invalid (warning) - WebSalesLeadController::showByToken().
# Endpoint vrací osobní údaje kontaktu, takže enumerace tokenů je citlivější než u
# čistě informačních veřejných endpointů - proto vlastní event_type, ne jen 404 potichu.
echo "[11/12] Načítám objednávkový formulář přes NEEXISTUJÍCÍ lead token (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X GET "${API_BASE}/public/sales-leads/neexistujici-lead-token-${i}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── [12/12] VOLITELNÉ: permission_denied s reálným nízko-privilegovaným účtem ─
# Na rozdíl od [6]/[7] (chybějící/neplatný token) tahle sekce testuje PLATNĚ
# přihlášeného uživatele, kterému chybí konkrétní oprávnění - to je scénář, který nejde
# simulovat bez skutečného účtu v DB. Bez TEST_USER_EMAIL/TEST_USER_PASSWORD se sekce
# přeskočí (nejde o chybu skriptu, jen chybí předpoklad k jejímu spuštění).
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
    # Bez jq (aby skript nepotřeboval další závislost) - hrubé vytažení "token":"..." z JSON.
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