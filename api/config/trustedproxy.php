<?php

/**
 * @file trustedproxy.php
 * @path config/trustedproxy.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reverse proxies the application trusts (read by Laravel's TrustProxies middleware).
 * Only the X-Forwarded-* headers of a TRUSTED proxy are used for the client IP and the scheme.
 * @security Why it matters: every rate limit of the API (login, public forms, portal…) and every
 * security event is keyed by the client IP. Behind a proxy (Cloudflare, a load balancer, a hosting
 * front server) WITHOUT this setting all requests carry the proxy's IP - the per-IP limits would
 * become one counter shared by every visitor, and a handful of people would block everybody.
 * TRUSTED_PROXIES (comma separated IPs / CIDR ranges of the proxy, or '*' when ALL traffic can
 * reach the server only through the proxy) - empty = no proxy, the direct connection IP is used.
 * Never set '*' when the server is reachable directly: a client could then fake its IP with an
 * X-Forwarded-For header and escape every limit.
 */

$proxies = trim((string) env('TRUSTED_PROXIES', ''));

return [
    'proxies' => match (true) {
        $proxies === ''  => null,
        $proxies === '*' => '*',
        default          => array_values(array_filter(array_map('trim', explode(',', $proxies)))),
    },
];
