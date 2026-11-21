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
# @note Base images are pinned by digest (tag@sha256:...): a build always uses exactly the
#   reviewed image, an update of the image comes as a Dependabot pull request (dependabot.yml).
#   The PHP version (8.5 here) must stay equal to PHP_VERSION of dev/.env.example and to the
#   Composer platform of api/composer.json - to change it, replace the whole reference (tag and
#   digest): docker buildx imagetools inspect php:<version>-fpm-trixie
# @security Runs as www-data (no root). The code belongs to root and is read-only for PHP - only
#   storage/ and bootstrap/cache are writable, so even a compromised request cannot change the
#   application. No secret is copied in (the build context is limited by
#   api.Dockerfile.dockerignore to the code - no .env, no keys, no storage). expose_php off.
# =============================================================================

FROM composer:2@sha256:50ea4d33fdcde1adb0f045547295faa1548b33872e5f789dae5b02ce2fb5de93 AS composer
FROM mlocati/php-extension-installer:2@sha256:4fd45396c16685266d32bf147a24ecd5e81029d3820295895bf4a90131190ac9 AS php-ext

# -----------------------------------------------------------------------------
# base: PHP-FPM with the extensions and the production php.ini / pool settings.
# -----------------------------------------------------------------------------
FROM php:8.5-fpm-trixie@sha256:7fd2766bd3bb6efcfb49591e4bf014e123c18f01149093bd508525c6bdf0cf9f AS base

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
# admin afterwards) are kept as the seed of the release - api-entrypoint.sh brings them into the
# volume (translations:sync: new keys and texts added, texts edited in the admin kept). Then the storage skeleton, bootstrap/cache, the authoritative
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
# runtime: the code owned by root (read-only for PHP), run as www-data; writable only storage/
# (the volume) and bootstrap/cache (the caches built by the entrypoint).
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
COPY --from=vendor /var/www/html /var/www/html
COPY --from=vendor /opt/seed /opt/seed
RUN chown -R www-data:www-data storage bootstrap/cache
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
