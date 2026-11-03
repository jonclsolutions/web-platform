<?php
/**
 * @file config/cors.php
 * @path config/cors.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration for Cross-Origin Resource Sharing (CORS) settings.
 * @security The admin, the public web and the API share ONE origin (production: /api on the same
 * domain, development: the /api proxy of ng serve), so no other origin needs access. Allowed
 * origins come only from CORS_ALLOWED_ORIGINS (comma separated, exact origins such as
 * https://www.example.com) and default to none - never '*': with credentials a wildcard would let
 * any site send authenticated requests and read the answers.
 */

/**
 * @description Defines the permitted origins, methods, and headers for cross-origin requests.
 * This configuration manages how the application interacts with decoupled frontends,
 * specifically enabling Laravel Sanctum's session-based authentication via cookie support.
 */
return [

    /*
     * Enable or disable CORS for your application.
     */
    'enabled' => true,

    /*
     * The paths that are allowed to make CORS requests.
     * Sanctum requires `/sanctum/csrf-cookie` to initiate the session state.
     */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    /*
     * Exact origins allowed to make cross-origin requests (CORS_ALLOWED_ORIGINS) - empty = only
     * the application's own origin, which needs no CORS at all.
     */
    'allowed_origins' => array_values(array_diff(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))), ['*'])),

    /*
     * The HTTP methods allowed for CORS requests.
     */
    'allowed_methods' => ['*'],

    /*
     * The HTTP headers allowed for CORS requests.
     */
    'allowed_headers' => ['*'],

    /*
     * The headers that are exposed to the browser.
     */
    'exposed_headers' => [],

    /*
     * The maximum age for the preflight request in seconds.
     */
    'max_age' => 0,

    /*
     * Whether to support credentials (cookies, HTTP authentication, etc.).
     * Crucial for Laravel Sanctum SPA session-based authentication.
     */
    'supports_credentials' => true,

];