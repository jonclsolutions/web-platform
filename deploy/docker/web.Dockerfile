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
# @note Base images are pinned by digest (tag@sha256:...): a build always uses exactly the
#   reviewed image, an update of the image comes as a Dependabot pull request (dependabot.yml).
#   The Node.js version (24 here) must stay equal to NODE_VERSION of dev/.env.example - to change
#   it, replace the whole reference (tag and digest): docker buildx imagetools inspect node:<version>-trixie-slim
# @security The build stage (node_modules, sources) is not part of the final image - only the
#   static files of dist/ and Caddy. Caddy's data (certificates) is the volume `caddy-data`.
# =============================================================================

# -----------------------------------------------------------------------------
# build: npm ci (cached layer) + ng build --configuration production.
# -----------------------------------------------------------------------------
FROM node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0 AS build
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
FROM caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0 AS runtime

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

# The app is served (internal door of the Caddyfile, only inside the container) - independent of
# the DNS and the certificate.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["web-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
