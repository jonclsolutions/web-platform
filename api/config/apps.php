<?php
/**
 * @file apps.php
 * @path config/apps.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The applications of the platform - the ONLY place where the core learns which
 * applications exist. Every entry is the manifest class of one application
 * (App\Support\Apps\AppManifest): its base data seeders, retention sources, calendar (agenda)
 * sources, upload profiles and folders, audit log, morph aliases and translation hooks. The core
 * reads everything through App\Support\Apps\AppRegistry.
 * @note Removing an application = deleting its folders and its line here. A listed class that
 *   does not exist (folder already deleted) is skipped. Order = order of the applications in the
 *   admin calendar filter and of their base data.
 */

return [
    'apps' => [
        App\Services\Web\WebApp::class,
        App\Services\Shop\ShopApp::class,
    ],
];
