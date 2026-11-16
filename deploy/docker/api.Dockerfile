# syntax=docker/dockerfile:1
# =============================================================================
# @file api.Dockerfile
# @path deploy/docker/api.Dockerfile
# @project JS web-platform
# @author JS
# @created 2026
# @description PRODUCTION image of the Laravel API: PHP-FPM 8.5 with the extensions of the app,
#   OPcache, the code and the production Composer dependencies (no dev packages, no tests).
#   One image runs three services of deploy/compose.prod.yaml: `app` (php-fpm, behind Caddy),
#   `queue` (queue:work) and `scheduler` (schedule:work) - see api-entrypoint.sh.
# @usage From the repository root (the context must be the root):
#   docker build -f deploy/docker/api.Dockerfile --build-arg APP_VERSION=v2026.11.1 -t web-platform-api:v2026.11.1 .
# @note Data are NOT in the image: storage/ (uploads, logs) is the volume `storage`, the settings
#   come from the environment (/srv/app/.env on the server via env_file). A new release only
#   replaces the image.
# @note PHP_VERSION must stay equal to dev/docker/Dockerfile (same PHP in development and
#   production) and to the Composer platform of api/composer.json.
# @security Runs as www-data (no root). No secret is copied in (the build context is limited by
#   api.Dockerfile.dockerignore to the code - no .env, no keys, no storage). expose_php off.
# =============================================================================

ARG PHP_VERSION=8.5

FROM composer:2 AS composer
FROM mlocati/php-extension-installer:2 AS php-ext

# -----------------------------------------------------------------------------
# base: PHP-FPM with the extensions and the production php.ini / pool settings.
# -----------------------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-trixie AS base

# libfcgi-bin = cgi-fcgi for the healthcheck (php-fpm ping); unzip for Composer dist archives.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libfcgi-bin unzip \
 && rm -rf /var/lib/apt/lists/*

# Same extensions as the development image (minus mysqli and pcov - tests only). OPcache is part
# of PHP 8.5; on an older PHP it is installed here.
COPY --from=php-ext /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions bcmath gd intl pdo_mysql zip pcntl exif \
 && (php -m | grep -qi '^Zend OPcache$' || install-php-extensions opcache) \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY deploy/docker/php/zz-app.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY deploy/docker/php/zz-pool.conf /usr/local/etc/php-fpm.d/zz-pool.conf

# -----------------------------------------------------------------------------
# vendor: production dependencies + optimized autoloader (dependencies cached as a layer).
# -----------------------------------------------------------------------------
FROM base AS vendor
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY api/composer.json api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --no-progress --prefer-dist
COPY api/ ./
# Base translations of the public web / shop (storage/app/public/translations, edited in the
# admin afterwards) are kept as the seed of a new installation - api-entrypoint.sh copies the
# missing ones into the volume. Then the storage skeleton, bootstrap/cache, the authoritative
# class map and package discovery (no .env needed).
RUN mkdir -p /opt/seed \
 && mv storage/app/public/translations /opt/seed/translations \
 && mkdir -p storage/logs storage/app/private storage/app/public \
        storage/framework/cache/data storage/framework/sessions storage/framework/views \
        bootstrap/cache \
 && composer dump-autoload --no-dev --optimize --classmap-authoritative --no-interaction \
 && rm -f bootstrap/cache/*.php \
 && php artisan package:discover --ansi

# -----------------------------------------------------------------------------
# runtime: the code owned by www-data, run as www-data.
# -----------------------------------------------------------------------------
FROM base AS runtime

ARG APP_VERSION=local
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="web-platform-api" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"
# Release of the code: GET /api/version, the deploy smoke test, the logs.
ENV APP_VERSION=${APP_VERSION}

WORKDIR /var/www/html
COPY --from=vendor --chown=www-data:www-data /var/www/html /var/www/html
COPY --from=vendor --chown=www-data:www-data /opt/seed /opt/seed
COPY --chmod=755 deploy/docker/api-entrypoint.sh /usr/local/bin/api-entrypoint
# Deployment bundle of this release: deploy/vps/deploy.sh installs compose.yaml and itself from
# here, so the server always runs the files of the deployed release (deploy_workflow.md).
COPY --chmod=644 deploy/compose.prod.yaml /opt/deploy/compose.yaml
COPY --chmod=755 deploy/vps/deploy.sh /opt/deploy/deploy.sh

USER www-data
EXPOSE 9000

# php-fpm answers its ping (zz-pool.conf) = the app is able to serve requests. `env -i`: the
# environment of the container (the settings) is not sent along as FastCGI parameters.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD env -i SCRIPT_NAME=/fpm-ping SCRIPT_FILENAME=/fpm-ping REQUEST_METHOD=GET cgi-fcgi -bind -connect 127.0.0.1:9000 | grep -q pong || exit 1

ENTRYPOINT ["api-entrypoint"]
CMD ["app"]
