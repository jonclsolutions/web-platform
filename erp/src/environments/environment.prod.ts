/**
 * @file environment.prod.ts
 * @path src/environments/environment.prod.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Production environment. Replaces environment.ts in `ng build --configuration
 * production` (fileReplacements in angular.json) - must keep the same keys as environment.ts.
 * @note The API and the public storage are served from the same origin (see
 * deploy/docker/Caddyfile), so relative URLs work on any domain.
 * @note The Turnstile site key differs per installation and is not committed. It comes from
 * `window.__RUNTIME_CONFIG__` (public/runtime-config.js, written at start by the proxy container
 * from TURNSTILE_SITE_KEY of /srv/app/.env - one image for every client).
 */

/** Settings of this installation loaded before the bundle (public/runtime-config.js). */
const runtimeConfig =
  (globalThis as { __RUNTIME_CONFIG__?: { turnstileSiteKey?: string } }).__RUNTIME_CONFIG__ ?? {};

export const environment = {
  production: true,
  base_api_url: '/api',
  public_storage_url: '/storage',
  turnstileSiteKey: runtimeConfig.turnstileSiteKey ?? ''
};
