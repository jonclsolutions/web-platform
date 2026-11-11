<?php
/**
 * @file seeders.php
 * @path config/seeders.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Modules whose base data BaseDataSeeder adds after the core data (permissions, page
 * titles, settings rows, default media - see Database\Seeders\ModuleBaseDataSeeder). A seeder
 * whose class does not exist (module folder removed) is skipped - remove its line together with
 * the module.
 */

return [
    'base_data' => [
        Database\Seeders\Web\WebBaseDataSeeder::class,
        Database\Seeders\Shop\ShopBaseDataSeeder::class,
    ],
];
