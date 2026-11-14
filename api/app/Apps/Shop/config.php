<?php
/**
 * @file config.php
 * @path app/Apps/Shop/config.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration of the e-shop, available as `config('shop.…')` (merged by
 *   AppServiceProvider from AppManifest::configFile()).
 */

return [
    // Payment simulation (VT-16): off unless SHOP_PAYMENT_SIMULATION is set explicitly, and
    // never in production whatever the variable says.
    'payment_simulation' => (bool) env('SHOP_PAYMENT_SIMULATION', false) && env('APP_ENV', 'production') !== 'production',
];
