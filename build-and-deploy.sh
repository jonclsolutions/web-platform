#!/bin/bash

# 1. Path configuration
PROJECT_ROOT=$(pwd)
ANGULAR_PATH="$PROJECT_ROOT/erp"
API_PATH="$PROJECT_ROOT/api"
SERVER_CONF_PATH="$PROJECT_ROOT/server_conf"
BUILD_DIR="$PROJECT_ROOT/app_build"
WWW_PATH="$BUILD_DIR/www"
ZIP_NAME="www.zip"
LARAVEL_TARGET="$WWW_PATH/laravel"
DIST_PATH="$ANGULAR_PATH/dist/rp_website/browser"

echo "------------------------------------------"
echo "START: Complex Build and Deployment"
echo "------------------------------------------"

# 2. Prepare app_build directory
echo "1/8: Preparing target directory $BUILD_DIR..."
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    echo "   - Old build removed."
fi
mkdir -p "$WWW_PATH"
echo "   - Directories created."

# 3. Build Angular
echo "2/8: Compiling Angular in $ANGULAR_PATH..."
cd "$ANGULAR_PATH" || exit
ng build --configuration production

if [ $? -ne 0 ]; then
    echo "ERROR: Angular build failed!"
    exit 1
fi

cp -r "$DIST_PATH"/. "$WWW_PATH/"
echo "   - Angular files copied to app_build/www"

# 4. Copy API (Laravel)
echo "3/8: Preparing Laravel in $LARAVEL_TARGET..."
mkdir -p "$LARAVEL_TARGET"
if [ -d "$API_PATH" ]; then
    cp -r "$API_PATH"/. "$LARAVEL_TARGET/"
    echo "   - Laravel (api) copied to app_build/www/laravel"
else
    echo "WARNING: /api directory does not exist."
fi

# 5. Copy server_conf (Config, .htaccess, scripts)
echo "4/8: Copying configuration files (server_conf)..."
if [ -d "$SERVER_CONF_PATH" ]; then
    cp -r "$SERVER_CONF_PATH"/. "$WWW_PATH/"
    echo "   - server_conf contents copied to app_build/www"
else
    echo "WARNING: /server_conf directory does not exist."
fi

# 6. Explicitly copy SQL files to the build root
echo "5/8: Copying SQL dumps for export..."
if ls "$SERVER_CONF_PATH"/*.sql &>/dev/null; then
    cp "$SERVER_CONF_PATH"/*.sql "$BUILD_DIR/"
    echo "   - SQL files copied to app_build/ (for easy access)"
else
    echo "INFO: No .sql files found."
fi

# 7. Copy documentation (to both build root and www)
echo "6/8: Copying server_setup and README to both locations..."
find_server_setup() {
    if [ -f "$PROJECT_ROOT/server_setup.md" ]; then echo "$PROJECT_ROOT/server_setup.md"
    elif [ -f "$PROJECT_ROOT/server_setup.txt" ]; then echo "$PROJECT_ROOT/server_setup.txt"
    fi
}

# Copy server_setup
server_setup_SRC=$(find_server_setup)
if [ -n "$server_setup_SRC" ]; then
    cp "$server_setup_SRC" "$WWW_PATH/"      # Goes into zip
    cp "$server_setup_SRC" "$BUILD_DIR/"     # For quick preview
    echo "   - server_setup copied."
fi

# Copy README (supports .md and .txt)
if [ -f "$PROJECT_ROOT/README.md" ]; then
    cp "$PROJECT_ROOT/README.md" "$WWW_PATH/"
    cp "$PROJECT_ROOT/README.md" "$BUILD_DIR/"
    echo "   - README.md copied."
elif [ -f "$PROJECT_ROOT/README.txt" ]; then
    cp "$PROJECT_ROOT/README.txt" "$WWW_PATH/"
    cp "$PROJECT_ROOT/README.txt" "$BUILD_DIR/"
    echo "   - README.txt copied."
fi

# 8. Final ZIP archiving (within app_build)
echo "7/8: Creating archive $ZIP_NAME..."
cd "$BUILD_DIR" || exit
if command -v zip &> /dev/null; then
    zip -r "$ZIP_NAME" www > /dev/null
    echo "   - Archive created in $BUILD_DIR/$ZIP_NAME"
else
    echo "ERROR: 'zip' command not found!"
fi

echo "------------------------------------------"
echo "COMPLETE: Everything prepared in folder: /app_build"
echo "------------------------------------------"