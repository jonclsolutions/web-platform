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
#   Before a role starts, the storage skeleton is completed (a new or older volume), the base
#   translations missing in the volume are copied from the image (/opt/seed - never over the
#   ones edited in the admin) and the Laravel caches (config, routes, views, events) are built
#   from the environment of the container.
# @note Migrations do NOT run here - the deploy script runs them once per release (several
#   containers start at the same time).
# @security No secret is printed (artisan optimize prints only the cached parts).
# =============================================================================
set -eu

role="${1:-app}"

# The volume `storage` may come from an older release - the folders Laravel writes to must exist.
mkdir -p storage/logs storage/app/private storage/app/public \
         storage/framework/cache/data storage/framework/sessions storage/framework/views

# Base translations of a new installation (or of a new language / application of a release):
# only the files that do not exist yet - the texts edited in the admin are kept.
if [ -d /opt/seed/translations ]; then
    cp -R --update=none /opt/seed/translations storage/app/public/
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
