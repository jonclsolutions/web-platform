#!/bin/sh
# =============================================================================
# @file api-entrypoint.sh
# @path deploy/docker/api-entrypoint.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Start of a container of the API image (api.Dockerfile). The first argument is the
#   role of the container (deploy/compose.prod.yaml):
#     app        php-fpm (requests from Caddy)
#     queue      php artisan queue:work (e-mails, imports)
#     scheduler  php artisan schedule:work (GDPR clean-up, reminders)
#     anything else is run as a command (e.g. `php artisan migrate --force`).
#   Before a role starts, the storage skeleton is completed (a new or older volume), the `app`
#   container brings the base translations of the release into the volume (translations:sync -
#   new and updated texts are added, texts edited in the admin are kept) and the Laravel caches
#   (config, routes, views, events) are built from the environment of the container.
# @note Migrations do NOT run here - the deploy script runs them once per release (several
#   containers start at the same time).
# @security No secret is printed (artisan optimize prints only the cached parts).
# =============================================================================
set -eu

role="${1:-app}"

# The volume `storage` may come from an older release - the folders Laravel writes to must exist.
mkdir -p storage/logs storage/app/private storage/app/public \
         storage/framework/cache/data storage/framework/sessions storage/framework/views

# Base translations of the release (SyncTranslationsCommand): a new installation gets all of them,
# a release adds its new keys and texts, the texts edited in the admin are kept. Only in `app`
# (one container, so queue / scheduler starting at the same time never write the same files).
# A failure is reported but does not stop the start - the app works with the texts it has.
if [ "$role" = app ] && [ -d /opt/seed/translations ]; then
    php artisan translations:sync --no-interaction \
        || echo "api-entrypoint: translations:sync failed - the texts of the release were not synchronised (docker compose logs app)" >&2
fi

# Caches of this container from its environment. A wrong setting stops the start here (visible in
# `docker compose logs`) instead of failing on the first request.
case "$role" in
    app|queue|scheduler) php artisan optimize --no-interaction ;;
esac

case "$role" in
    app)       exec php-fpm --nodaemonize ;;
    queue)     exec php artisan queue:work --sleep=3 --tries=3 --timeout=90 --max-time=3600 --memory=192 ;;
    scheduler) exec php artisan schedule:work ;;
    *)         exec "$@" ;;
esac
