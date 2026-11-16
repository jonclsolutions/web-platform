/**
 * @file runtime-config.js
 * @path public/runtime-config.js
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of THIS installation read by the Angular app at start (before the
 *   bundle), so one built image serves every client. In production the proxy container serves
 *   its own copy written at start from its environment (deploy/docker/web-entrypoint.sh,
 *   TURNSTILE_SITE_KEY). This empty default only keeps the script tag of index.html valid
 *   elsewhere (ng serve - the development build uses the test key of environment.ts).
 * @security Only PUBLIC values (the Turnstile site key) - never a secret.
 */
window.__RUNTIME_CONFIG__ = {};
