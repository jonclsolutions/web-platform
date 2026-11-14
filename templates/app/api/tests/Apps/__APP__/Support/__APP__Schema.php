<?php

/**
 * @file __APP__Schema.php
 * @path api/tests/Apps/__APP__/Support/__APP__Schema.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Test tables of the application "__NAME__" (SQLite mirror of its migrations).
 * @dependencies Tests\Support\TestSchema (audit log shape); run by TestSchema::create() while
 *   the application is in config/apps.php.
 */

namespace Tests\Apps\__APP__\Support;

use Tests\Support\TestSchema;

/**
 * @description Creates the tables of the application in the test database.
 */
final class __APP__Schema
{
    /**
     * @description Creates every table of the application.
     * @return void
     */
    public static function create(): void
    {
        TestSchema::auditLog('__app_snake___logs');
    }
}
