<?php
/**
 * @file retention.php
 * @path config/retention.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Modules taking part in the retention purge (GDPR Art. 5(1)(e)). Each source
 * (App\Services\Retention\RetentionSource) brings its kinds of data, default periods, audit log
 * and clean-ups; the core purge only runs the registered sources. A source whose class does not
 * exist (module folder removed) is skipped - remove its line together with the module.
 */

return [
    'sources' => [
        App\Services\Web\WebRetentionSource::class,
        App\Services\Shop\ShopRetentionSource::class,
    ],
];
