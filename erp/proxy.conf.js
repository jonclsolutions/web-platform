/**
 * @file proxy.conf.js
 * @path erp/proxy.conf.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-31
 * @description Dev-server proxy of `ng serve` (angular.json → serve.options.proxyConfig):
 *   relative /api, /erp and /storage requests go to the Laravel API.
 *   Target: API_PROXY_TARGET (compose.yaml sets http://api:8000 - the api container),
 *   otherwise http://127.0.0.1:8000 (ng serve running directly on the host).
 * @refactor-note (2026-10-31) Replaces proxy.conf.json (fixed target 127.0.0.1:8000, which inside
 *   the erp container is the container itself, not the API).
 */

const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

/** Same options for every proxied path. */
const route = { target, secure: false, changeOrigin: true };

module.exports = {
  '/api': route,
  '/erp': route,
  '/storage': route,
};
