<?php
/**
 * @file 2026_11_08_000001_remove_on_update_from_expiry_columns.php
 * @path api/database/migrations/2026_11_08_000001_remove_on_update_from_expiry_columns.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Removes `ON UPDATE CURRENT_TIMESTAMP` from the expiry columns of the baseline
 *   schema. MariaDB / MySQL then overwrote the expiry with the current time on EVERY change of the
 *   row: one wrong 2FA code (attempts + 1) made the code expire at once, so the correct code
 *   typed next was refused and the user had to log in again; the same applied to the other
 *   token tables whenever a row changed. The columns keep their type, NOT NULL and default.
 * @note Only for MySQL / MariaDB (SQLite has no ON UPDATE). down() restores the former
 *   definition.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description Tables whose `expires_at` had ON UPDATE CURRENT_TIMESTAMP. */
    private const TABLES = ['two_factor_codes', 'password_reset_tokens', 'account_activation_tokens', 'web_project_sessions'];

    /**
     * @description Redefines `expires_at` without ON UPDATE.
     * @return void
     */
    public function up(): void
    {
        $this->redefine('');
    }

    /**
     * @description Restores ON UPDATE CURRENT_TIMESTAMP.
     * @return void
     */
    public function down(): void
    {
        $this->redefine(' ON UPDATE CURRENT_TIMESTAMP');
    }

    /**
     * @description Redefines the column on every table (MySQL / MariaDB only).
     * @param string $onUpdate '' or ' ON UPDATE CURRENT_TIMESTAMP'.
     * @return void
     */
    private function redefine(string $onUpdate): void
    {
        if (!in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }
        foreach (self::TABLES as $table) {
            DB::statement("ALTER TABLE `{$table}` MODIFY `expires_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP{$onUpdate}");
        }
    }
};
