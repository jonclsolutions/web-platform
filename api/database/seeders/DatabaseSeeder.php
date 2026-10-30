<?php
/**
 * @file DatabaseSeeder.php
 * @path api/database/seeders/DatabaseSeeder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Entry point of `php artisan db:seed`: the base data every installation needs
 *   (BaseDataSeeder) and, ONLY with APP_ENV=local, the local test account and test roles
 *   (DevelopmentSeeder).
 * @refactor-note (2026-10-30) The database is created by Laravel (baseline migration + seeders)
 *   instead of importing database/db.sql. The old seeders (RawRequestCommissionSeeder,
 *   UserLoginSeeder - tables that no longer exist / test data) were removed.
 * @note Safe to run again at any time: every seeder only adds what is missing.
 */

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * @description Seeds the base data, plus the development data in APP_ENV=local.
     * @return void
     */
    public function run(): void
    {
        $this->call(BaseDataSeeder::class);

        if (app()->environment('local')) {
            $this->call(DevelopmentSeeder::class);
        }
    }
}
