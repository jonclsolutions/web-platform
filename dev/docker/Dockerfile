# syntax=docker/dockerfile:1
# =============================================================================
# @file Dockerfile
# @path dev/docker/Dockerfile
# @project RPSW Web
# @author RPSW
# @created 2026-10-31
# @description ONE development image for the whole monorepo - everything the app needs to run,
#   test and build, so the host needs only Docker and git:
#   - PHP 8.5 CLI (same major/minor as the FORPSI hosting) + the extensions of Laravel / the
#     tests (bcmath, gd, intl, mysqli, pdo_mysql, zip, pcntl, exif; pdo_sqlite and sodium are
#     built in) + pcov (test coverage, optional), Composer 2;
#   - Node.js 24 LTS + npm (Angular 21 needs ^20.19 || ^22.12 || >=24);
#   - Chromium for the Karma unit tests of erp (CHROME_BIN);
#   - git, unzip, zip, rsync, openssl, mariadb-client - used by Composer, deploy/build.sh,
#     the dev certificate and ./dev.sh db-import / db-dump.
#   Used by the services api, queue, scheduler and erp of compose.yaml and by every
#   `./dev.sh <tool>` command.
# @note The image runs as the user `dev` with the UID / GID of the host user (build args from
#   dev/.env, written by init-workspace.sh), so files created in the mounted repository
#   (vendor/, node_modules/, storage/, build/) belong to you, not to root.
# @note Versions: PHP_VERSION / NODE_VERSION are build args (compose.yaml passes them from .env).
#   Keep PHP equal to the hosting (FORPSI: administration → PHP version).
# @refactor-note (2026-10-31) Moved from docker/app/ to dev/docker/ (root clean-up).
# @security Base images are official (php, node, composer) or the widely used
#   mlocati/php-extension-installer; no secrets are copied into the image (the repository is
#   mounted at run time, never COPY-ed).
# =============================================================================

ARG PHP_VERSION=8.5
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-trixie-slim AS node
FROM composer:2 AS composer
FROM mlocati/php-extension-installer:2 AS php-ext

FROM php:${PHP_VERSION}-cli-trixie

ARG HOST_UID=1000
ARG HOST_GID=1000

# System tools (see @description). --no-install-recommends keeps the image small.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        git unzip zip rsync openssl ca-certificates curl mariadb-client \
        chromium fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# PHP extensions. pcov only adds the test coverage - the image is still usable without it.
COPY --from=php-ext /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions bcmath gd intl mysqli pdo_mysql zip pcntl exif \
 && (install-php-extensions pcov || echo "pcov not available for this PHP version - tests run without coverage") \
 && printf 'memory_limit=1G\nupload_max_filesize=20M\npost_max_size=25M\n' > "$PHP_INI_DIR/conf.d/zz-dev.ini"

# Composer and Node.js (binaries of the official images - same Debian release).
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && node --version && npm --version && composer --version

# User with the host UID / GID (-o: the IDs may already exist in the base image).
RUN groupadd -o -g "${HOST_GID}" dev \
 && useradd -o -m -u "${HOST_UID}" -g "${HOST_GID}" -s /bin/bash dev \
 && mkdir -p /workspace /home/dev/.cache/npm /home/dev/.cache/composer \
 && chown -R dev:dev /workspace /home/dev

ENV CHROME_BIN=/usr/bin/chromium \
    COMPOSER_CACHE_DIR=/home/dev/.cache/composer \
    npm_config_cache=/home/dev/.cache/npm \
    npm_config_update_notifier=false \
    NG_CLI_ANALYTICS=false \
    IN_DEV_CONTAINER=1

USER dev
WORKDIR /workspace
CMD ["bash"]
