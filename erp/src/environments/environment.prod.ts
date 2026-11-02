/**
 * @file environment.prod.ts
 * @path src/environments/environment.prod.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Production environment. Replaces environment.ts in `ng build --configuration
 * production` (fileReplacements in angular.json) - must keep the same keys as environment.ts.
 * @note The API and the public storage are served from the same origin (see
 * deploy/server/.htaccess), so relative URLs work on any domain.
 * @note `NG_TURNSTILE_SITE_KEY` is injected by deploy/build.sh (`ng build --define`) from the
 * TURNSTILE_SITE_KEY setting - the site key differs per installation and is not committed.
 */
declare const NG_TURNSTILE_SITE_KEY: string | undefined;

export const environment = {
  production: true,
  base_api_url: '/api',
  public_storage_url: '/storage',
  turnstileSiteKey: typeof NG_TURNSTILE_SITE_KEY === 'string' ? NG_TURNSTILE_SITE_KEY : ''
};
