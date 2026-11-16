# syntax=docker/dockerfile:1
# =============================================================================
# @file web.Dockerfile
# @path deploy/docker/web.Dockerfile
# @project JS web-platform
# @author JS
# @created 2026
# @description PRODUCTION image of the front: the Angular app (erp) built for production, served
#   by Caddy with HTTPS (Let's Encrypt), the /api route to php-fpm and the security headers
#   (Caddyfile). Container `proxy` of deploy/compose.prod.yaml.
# @usage From the repository root:
#   docker build -f deploy/docker/web.Dockerfile --build-arg APP_VERSION=v2026.11.1 -t web-platform-web:v2026.11.1 .
# @note The Turnstile site key is NOT built in - web-entrypoint.sh writes it at start from the
#   environment, so one image serves every client.
# @note NODE_VERSION must stay equal to dev/docker/Dockerfile.
# @security The build stage (node_modules, sources) is not part of the final image - only the
#   static files of dist/ and Caddy. Caddy's data (certificates) is the volume `caddy-data`.
# =============================================================================

ARG NODE_VERSION=24

# -----------------------------------------------------------------------------
# build: npm ci (cached layer) + ng build --configuration production.
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS build
ENV NG_CLI_ANALYTICS=false \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false
WORKDIR /src
COPY erp/package.json erp/package-lock.json ./
RUN npm ci
COPY erp/ ./
RUN npx ng build --configuration production \
 && test -f dist/rp_website/browser/index.html

# -----------------------------------------------------------------------------
# runtime: Caddy with the built app.
# -----------------------------------------------------------------------------
FROM caddy:2-alpine AS runtime

ARG APP_VERSION=local
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="web-platform-web" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"
ENV APP_VERSION=${APP_VERSION}

COPY deploy/docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 deploy/docker/web-entrypoint.sh /usr/local/bin/web-entrypoint
COPY --from=build /src/dist/rp_website/browser /srv/www

EXPOSE 80 443 443/udp

# The admin API of Caddy answers = the server runs (only inside the container).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:2019/config/ || exit 1

ENTRYPOINT ["web-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
