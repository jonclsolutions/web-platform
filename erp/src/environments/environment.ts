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
  base_api_url: 'http://127.0.0.1:8000/api',
  public_storage_url: 'http://127.0.0.1:8000/storage',
  // Cloudflare Turnstile test key (always passes) - local development only.
  turnstileSiteKey: '1x00000000000000000000AA'
};