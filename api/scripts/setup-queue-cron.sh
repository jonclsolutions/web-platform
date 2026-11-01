#!/bin/bash
# @file: setup-queue-cron.sh
# @path: scripts/setup-queue-cron.sh
# @project: JS web-platform
# @description: Runs the Laravel queue through CRON (not Supervisor) - the same mechanism as
# the production setup (deploy/server/configure-server.sh), so local and production behave
# the same.
#
# WHAT IT DOES: adds a crontab line of the user that runs every minute
# `php artisan queue:work --stop-when-empty --tries=3` - it processes ALL waiting
# jobs and EXITS when the queue is empty. No permanent process, no sudo / Supervisor -
# a per-user crontab, works the same on shared hosting and on a development machine.
#
# USAGE:
#   cd api/                  # run from the root of the Laravel project
#   bash scripts/setup-queue-cron.sh
#
# IDEMPOTENT: running it again (same path) adds no second line - recognized by the
# marker "# rpsw-queue-worker". After moving the project, the old entry stays orphaned
# (pointing to a missing folder) - remove it with `crontab -e` and run the script again
# from the new path.

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