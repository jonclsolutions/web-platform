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
# marker "# web-platform-queue-worker"; an entry with the former marker "# rpsw-queue-worker"
# is replaced. After moving the project, the old entry stays orphaned (pointing to a missing
# folder) - remove it with `crontab -e` and run the script again from the new path.
# Each run OVERWRITES storage/logs/queue-cron.log (`>`), so the log holds only the last run.

set -e

if ! command -v crontab &> /dev/null; then
    echo "ERROR: the 'crontab' command is not available on this system."
    echo "Either set up the queue processing by hand (a cron job in the hosting control panel), or"
    echo "temporarily switch QUEUE_CONNECTION=sync in .env (synchronous sending, no cron)."
    exit 1
fi

LARAVEL_ABS_PATH="$(pwd)"

if [ ! -f "${LARAVEL_ABS_PATH}/artisan" ]; then
    echo "ERROR: file 'artisan' not found in ${LARAVEL_ABS_PATH}."
    echo "Run this script from the root directory of the Laravel project (where artisan is)."
    exit 1
fi

CRON_MARKER="# web-platform-queue-worker"
LEGACY_CRON_MARKER="# rpsw-queue-worker"
CRON_LINE="* * * * * cd ${LARAVEL_ABS_PATH} && php artisan queue:work --stop-when-empty --tries=3 > ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log 2>&1 ${CRON_MARKER}"

EXISTING_CRON=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING_CRON" | grep -qF "$LEGACY_CRON_MARKER"; then
    EXISTING_CRON=$(echo "$EXISTING_CRON" | grep -vF "$LEGACY_CRON_MARKER" || true)
    echo "$EXISTING_CRON" | crontab -
    echo "The entry with the former marker was removed - it is replaced below."
fi

if echo "$EXISTING_CRON" | grep -qF "$CRON_MARKER"; then
    echo "The cron entry already exists, skipped."
    echo "Current line:"
    echo "$EXISTING_CRON" | grep -F "$CRON_MARKER"
else
    (echo "$EXISTING_CRON"; echo "$CRON_LINE") | crontab -
    echo "Cron entry added - the queue is processed every minute."
    echo "Path: ${LARAVEL_ABS_PATH}"
fi

echo ""
echo "Check: 'crontab -l' should now contain a line with the marker '${CRON_MARKER}'."
echo "The log of the processed jobs is in: ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log"