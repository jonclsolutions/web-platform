#!/usr/bin/env bash
#
# @file attack_security_monitoring.sh
# @project RPSW Web
# @description LOKÁLNÍ zátěžový/testovací skript pro bezpečnostní monitoring
# (core_security_events). Generuje reálný HTTP provoz proti VLASTNÍMU dev API, který
# spustí jednotlivé detekční hooky (CaptchaVerificationService, AuthController,
# throttle exception handler v bootstrap/app.php, fallback routa v api.php).
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
# Použití:
#   chmod +x attack_security_monitoring.sh
#   ./attack_security_monitoring.sh
#
# Vyžaduje: bash + curl (dostupné na Linuxu/macOS/WSL/Git Bash).
# Vyžaduje BĚŽÍCÍ Laravel server (např. `php artisan serve`) na adrese níže.

set -uo pipefail

# ── Konfigurace - uprav podle svého lokálního prostředí ─────────────────────
API_BASE="http://127.0.0.1:8000/api"   # z local_laravel_.env: APP_URL=http://127.0.0.1:8000
FAKE_EMAIL="utok-test@example.com"      # e-mail použitý pro simulaci brute-force loginu
SCANNER_UA="Mozilla/5.0 (compatible; SecurityTestBot/1.0)"

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

# ── 1) Brute-force login (login_failed, login_brute_force_suspected,        ──
# ──    captcha_failed po 3. pokusu - viz AuthController::CAPTCHA_THRESHOLD) ──
# POZOR: RateLimiter klíč 'login-fail:<email>' žije v cache (CACHE_STORE=database,
# TTL 15 minut - viz AuthController::FAILED_ATTEMPTS_DECAY_SECONDS). Pokud skript
# spouštíš opakovaně na stejný FAKE_EMAIL do 15 minut, captcha bude vyžadovaná
# HNED od 1. pokusu (počítadlo si "pamatuje" předchozí běh) - to je správné chování,
# ne bug. Pro čistou demonstraci od nuly buď počkej, spusť `php artisan cache:clear`,
# nebo změň FAKE_EMAIL níže na jiný řetězec.
echo "[1/5] Simuluji brute-force login (10 pokusů, email: ${FAKE_EMAIL})..."
for i in $(seq 1 10); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/login" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (SecurityTestScript)" \
    -d "{\"email\":\"${FAKE_EMAIL}\",\"password\":\"spatne-heslo-${i}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── 2) Throttle na /forgot-password (throttle:5,1 - 5 požadavků/minutu) ─────
echo "[2/5] Zahlcuji /forgot-password (8 rychlých požadavků, limit je 5/min)..."
for i in $(seq 1 8); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/forgot-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${FAKE_EMAIL}\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── 3) Throttle na veřejný /sales_orders (throttle:10,1 - 10 požadavků/min) ─
echo "[3/5] Zahlcuji /sales_orders (14 rychlých požadavků, limit je 10/min)..."
for i in $(seq 1 14); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/sales_orders" \
    -H "Content-Type: application/json" \
    -d "{\"client_email\":\"spam-cil-${i}@example.com\",\"thema\":\"test\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

# ── 4) Scanning/probing - typické cesty hledané automatizovanými skenery ───
# Poznámka: zachytí je jen fallback routa uvnitř routes/api.php, tedy cesty POD
# /api/... - reálný bot často zkouší i kořenové cesty (/.env, /wp-login.php mimo
# /api), ty by v tomhle projektu padly do web.php a NEBYLY by zachyceny (web.php
# vlastní fallback nemá) - to je případné budoucí rozšíření, ne bug tohoto skriptu.
echo "[4/5] Simuluji scanning/probing pod /api/... (typické cesty skenerů zranitelností)..."
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

# ── 5) Neplatný refresh token (refresh_token_invalid) ───────────────────────
echo "[5/5] Posílám neplatné refresh tokeny (5x)..."
for i in $(seq 1 5); do
  code=$(curl "${curl_opts[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"neplatny-token-${i}-$(date +%s%N)\"}")
  printf "  pokus %-2s -> HTTP %s\n" "$i" "$code"
done
echo

echo "=================================================================="
echo " Hotovo. Zkontroluj admin -> Core -> Bezpečnostní monitoring."
echo " Očekávané typy eventů: login_failed, login_brute_force_suspected,"
echo " captcha_failed, throttle_exceeded, scan_probe, refresh_token_invalid."
echo "=================================================================="