#!/bin/bash
set -e

# --- 1. Variable Configuration ---
LARAVEL_DIR="laravel"

echo "Starting initial server configuration..."

# --- 2. Change to Laravel directory ---
cd "$LARAVEL_DIR" || { echo "ERROR: Directory $LARAVEL_DIR does not exist!"; exit 1; }

# --- 3. Composer Install ---
echo "Installing dependencies..."
composer install --no-dev --optimize-autoloader

# --- 4. .env file setup ---
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ".env file created. !!! YOU MUST EDIT IT MANUALLY (DB, URL, etc.) NOW !!!"
fi

echo ""
echo "!!! REMINDER: set TURNSTILE_SECRET_KEY in .env (captcha login protection) !!!"
echo "    Get it from https://dash.cloudflare.com -> Turnstile -> your site."
echo ""
echo "!!! REMINDER: database schema/data comes from your own SQL dump import process"
echo "    (separate from this script) - make sure it has already been applied before"
echo "    continuing, including latest core_permissions/core_role_permissions and any"
echo "    new tables (core_security_events, core_security_settings, core_import_batches, ...) !!!"
echo ""

# Pause for .env configuration
read -p "Have you edited the .env file AND imported the latest DB dump? Press [Enter] to continue..."

# --- 5. Generate key and clear cache ---
php artisan key:generate --force
php artisan config:clear
php artisan cache:clear

# --- 6. Storage link (within Laravel) ---
php artisan storage:link --force

# --- 6b. Queue worker + Scheduler (cron, ne Supervisor - sdílený hosting nemá sudo/
# persistentní procesy) ---
# Dva NEZÁVISLÉ cron záznamy, oba idempotentní (vlastní marker, kontrola existence
# před přidáním):
#
# 1) QUEUE WORKER - "queue:work --stop-when-empty" zpracuje všechny aktuálně čekající
#    joby (potvrzovací e-maily, ImportRowsJob u velkých importů) a SÁM SE UKONČÍ, jakmile
#    je fronta prázdná. Žádný trvalý proces, žádné sudo.
#
# 2) SCHEDULER - "schedule:run" je NUTNÝ pro jakékoliv `Schedule::command(...)` volání
#    v routes/console.php (PurgeSecurityEventsCommand, PurgeImportBatchesCommand apod.) -
#    Laravel scheduler sám o sobě nic nespouští, jen při KAŽDÉM zavolání "schedule:run"
#    zkontroluje, jestli něco nemá naplánované na tuhle minutu. BEZ TOHOTO CRONU se
#    žádná naplánovaná úloha (denní GDPR purge, úklid nevyzvednutých importů...)
#    NIKDY NESPUSTÍ, i kdyby byla v kódu správně nadefinovaná.
echo "Configuring queue processing and scheduler via user crontab..."

if command -v crontab &> /dev/null; then
    LARAVEL_ABS_PATH="$(pwd)"
    EXISTING_CRON=$(crontab -l 2>/dev/null || true)
    NEW_CRON="$EXISTING_CRON"

    QUEUE_MARKER="# rpsw-queue-worker"
    QUEUE_LINE="* * * * * cd ${LARAVEL_ABS_PATH} && php artisan queue:work --stop-when-empty --tries=3 >> ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log 2>&1 ${QUEUE_MARKER}"

    SCHEDULE_MARKER="# rpsw-scheduler"
    SCHEDULE_LINE="* * * * * cd ${LARAVEL_ABS_PATH} && php artisan schedule:run >> ${LARAVEL_ABS_PATH}/storage/logs/scheduler-cron.log 2>&1 ${SCHEDULE_MARKER}"

    if echo "$EXISTING_CRON" | grep -qF "$QUEUE_MARKER"; then
        echo "Queue worker cron entry already present, skipping."
    else
        NEW_CRON="$(printf '%s\n%s' "$NEW_CRON" "$QUEUE_LINE")"
        echo "Queue worker cron entry added - queue will be processed every minute."
    fi

    if echo "$EXISTING_CRON" | grep -qF "$SCHEDULE_MARKER"; then
        echo "Scheduler cron entry already present, skipping."
    else
        NEW_CRON="$(printf '%s\n%s' "$NEW_CRON" "$SCHEDULE_LINE")"
        echo "Scheduler cron entry added - scheduled commands (Purge*, ...) will run every minute."
    fi

    echo "$NEW_CRON" | crontab -
else
    echo "WARNING: 'crontab' command not available on this host."
    echo "Neither the queue NOR the scheduler (daily GDPR purge, import cleanup, ...) will"
    echo "run automatically. Either:"
    echo "  a) set up TWO cron jobs manually via your hosting's admin panel, running:"
    echo "     * * * * * cd $(pwd) && php artisan queue:work --stop-when-empty --tries=3"
    echo "     * * * * * cd $(pwd) && php artisan schedule:run"
    echo "  b) or switch QUEUE_CONNECTION=sync in .env for the queue part (no cron needed"
    echo "     for that one) - schedule:run has NO synchronous equivalent, it always"
    echo "     needs a cron entry regardless."
fi

# --- 7. Permissions configuration ---
echo "Setting write permissions for storage and cache..."
chmod -R 775 storage bootstrap/cache
# If your server requires www-data ownership, uncomment the line below:
# chown -R www-data:www-data storage bootstrap/cache

# --- 8. External Symlink (in web root) ---
echo "Creating public symlink for the web root..."
cd ..
rm -rf storage # Removes old symlink if it exists
ln -s "$LARAVEL_DIR/storage/app/public" storage

echo "COMPLETE!"