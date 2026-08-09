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

# Pause for .env configuration
read -p "Have you edited the .env file? Press [Enter] to continue..."

# --- 5. Generate key and clear cache ---
php artisan key:generate --force
php artisan config:clear
php artisan cache:clear

# --- 6. Storage link (within Laravel) ---
php artisan storage:link --force

# --- 6b. Queue worker (cron, ne Supervisor - sdílený hosting nemá sudo/persistentní procesy) ---
# Místo trvale běžícího "queue:work" (to by sdílený hosting stejně ukončil) se nastaví
# cron úloha každou minutu, která spustí "queue:work --stop-when-empty" - zpracuje
# všechny aktuálně čekající joby a SÁMA SE UKONČÍ, jakmile je fronta prázdná. Žádný
# trvalý proces, žádné sudo - crontab je čistě per-uživatelská věc.
echo "Configuring queue processing via user crontab..."

if command -v crontab &> /dev/null; then
    LARAVEL_ABS_PATH="$(pwd)"
    CRON_MARKER="# rpsw-queue-worker"
    CRON_LINE="* * * * * cd ${LARAVEL_ABS_PATH} && php artisan queue:work --stop-when-empty --tries=3 >> ${LARAVEL_ABS_PATH}/storage/logs/queue-cron.log 2>&1 ${CRON_MARKER}"

    # Idempotentní: pokud tam řádek se stejným markerem už je, nepřidává se znovu.
    EXISTING_CRON=$(crontab -l 2>/dev/null || true)
    if echo "$EXISTING_CRON" | grep -qF "$CRON_MARKER"; then
        echo "Cron entry already present, skipping."
    else
        (echo "$EXISTING_CRON"; echo "$CRON_LINE") | crontab -
        echo "Cron entry added - queue will be processed every minute."
    fi
else
    echo "WARNING: 'crontab' command not available on this host."
    echo "Queue jobs will NOT be processed automatically. Either:"
    echo "  a) set up a CRON job manually via your hosting's admin panel, running:"
    echo "     cd $(pwd) && php artisan queue:work --stop-when-empty --tries=3"
    echo "  b) or switch QUEUE_CONNECTION=sync in .env (processes emails synchronously, no cron needed)."
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