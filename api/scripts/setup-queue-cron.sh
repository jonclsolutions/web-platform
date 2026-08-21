#!/bin/bash
# @file: setup-queue-cron.sh
# @path: scripts/setup-queue-cron.sh
# @project: RPSW Web
# @description: Nastaví zpracování Laravel queue frontu přes CRON (ne Supervisor) -
# stejný mechanismus, jaký používá produkční deploy skript (viz sekce "6b. Queue
# worker" v deploy.sh). Vytažen sem jako SAMOSTATNÝ skript, aby lokální vývoj i
# produkce spouštěly IDENTICKOU logiku - žádné riziko, že se lokální a produkční
# chování postupem času rozjedou (dřív šlo o kód zkopírovaný jen v deploy.sh).
#
# CO DĚLÁ: přidá do uživatelského crontabu řádek, který každou minutu spustí
# `php artisan queue:work --stop-when-empty --tries=3` - ten zpracuje VŠECHNY
# aktuálně čekající joby a SÁM SE UKONČÍ, jakmile je fronta prázdná. Žádný trvale
# běžící proces, žádné sudo/Supervisor - čistě per-uživatelský crontab, funguje
# stejně na sdíleném hostingu i na lokálním vývojovém stroji.
#
# POUŽITÍ:
#   cd api/                  # spustit z kořenového adresáře Laravel projektu
#   bash scripts/setup-queue-cron.sh
#
# IDEMPOTENTNÍ: opakované spuštění (stejná cesta) řádek nepřidá znovu - pozná ho podle
# markeru "# rpsw-queue-worker". Pokud projekt přesuneš na jinou cestu, stará položka
# v crontabu zůstane osiřelá (ukazuje na neexistující adresář) - v tom případě si ji
# ručně smaž přes `crontab -e` a spusť skript znovu z nové cesty.

set -e

if ! command -v crontab &> /dev/null; then
    echo "CHYBA: příkaz 'crontab' není na tomhle systému dostupný."
    echo "Buď nastav zpracování fronty ručně (cron přes admin panel hostingu), nebo"
    echo "dočasně přepni QUEUE_CONNECTION=sync v .env (synchronní odesílání, bez cronu)."
    exit 1
fi

LARAVEL_ABS_PATH="$(pwd)"

if [ ! -f "${LARAVEL_ABS_PATH}/artisan" ]; then
    echo "CHYBA: soubor 'artisan' nenalezen v ${LARAVEL_ABS_PATH}."
    echo "Spusť tento skript z kořenového adresáře Laravel projektu (tam, kde je artisan)."
    exit 1
fi

CRON_MARKER="# rpsw-queue-worker"
CRON_LINE="* * * * * cd ${LARAVEL_ABS_PATH} && php artisan queue:work --stop-when-empty --tries=3 >> ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log 2>&1 ${CRON_MARKER}"

EXISTING_CRON=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING_CRON" | grep -qF "$CRON_MARKER"; then
    echo "Cron záznam už existuje, přeskočeno."
    echo "Aktuální řádek:"
    echo "$EXISTING_CRON" | grep -F "$CRON_MARKER"
else
    (echo "$EXISTING_CRON"; echo "$CRON_LINE") | crontab -
    echo "Cron záznam přidán - fronta se bude zpracovávat každou minutu."
    echo "Cesta: ${LARAVEL_ABS_PATH}"
fi

echo ""
echo "Ověření: 'crontab -l' by teď měl obsahovat řádek s markerem '${CRON_MARKER}'."
echo "Log zpracovaných jobů najdeš v: ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log"