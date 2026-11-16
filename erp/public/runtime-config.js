/**
 * @file runtime-config.js
 * @path public/runtime-config.js
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of THIS installation read by the Angular app at start (before the
 *   bundle), so one built image serves every client. In the Docker deployment the proxy
 *   container replaces this file at start from its environment (deploy/docker/web-entrypoint.sh,
 *   TURNSTILE_SITE_KEY). This default is empty: environment.prod.ts then falls back to the key
 *   built in by deploy/build.sh (`ng build --define`), the development build uses its test key.
 * @security Only PUBLIC values (the Turnstile site key) - never a secret.
 */
window.__RUNTIME_CONFIG__ = {};
