<?php
/**
 * @file config/cors.php
 * @path config/cors.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Configuration for Cross-Origin Resource Sharing (CORS) settings.
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
     * The domains from which to allow CORS requests.
     * NOTE: Using ['*'] is suitable for development; however, replace this with 
     * specific production domains for security.
     */
    'allowed_origins' => ['*'],

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