#!/bin/bash

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