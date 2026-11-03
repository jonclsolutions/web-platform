/**
 * @file environment.ts
 * @path src/environments/environment.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Development environment (ng serve, development build, unit tests). The production
 * build replaces this file with environment.prod.ts (fileReplacements in angular.json) - keep the
 * keys of both files identical.
 */
export const environment = {
  production: false,
  // Same origin as production: ng serve proxies /api and /storage to the Laravel API
  // (proxy.conf.js), so the HttpOnly auth cookies work the same way as on the server.
  base_api_url: '/api',
  public_storage_url: '/storage',
  // Cloudflare Turnstile test key (always passes) - local development only.
  turnstileSiteKey: '1x00000000000000000000AA'
};