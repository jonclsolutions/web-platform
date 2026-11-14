<?php
/**
 * @file 2026_11_23_000000_rename_core_attachment_and_consent_tables.php
 * @path api/database/migrations/2026_11_23_000000_rename_core_attachment_and_consent_tables.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Two tables of the core still carried the prefix of the web application: the
 *   attachments of every application (`web_attachments` → `core_attachments`, CoreAttachment) and
 *   the anonymous cookie consent records (`web_cookie_consents` → `legal_cookie_consents`,
 *   CookieConsent). Renamed with their indexes, so a removed web application leaves no core table
 *   with its name. Rows, morph aliases and files stay unchanged.
 * @dependencies web_attachments, web_cookie_consents
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, string> Old table name => new table name. */
    private const TABLES = [
        'web_attachments'     => 'core_attachments',
        'web_cookie_consents' => 'legal_cookie_consents',
    ];

    /**
     * @description Renames the tables and their indexes (`<table>_…` index names).
     */
    public function up(): void
    {
        foreach (self::TABLES as $from => $to) {
            $this->rename($from, $to);
        }
    }

    /**
     * @description Restores the former names.
     */
    public function down(): void
    {
        foreach (self::TABLES as $from => $to) {
            $this->rename($to, $from);
        }
    }

    /**
     * @description Renames one table and every index whose name starts with the old table name.
     * @param string $from Current name.
     * @param string $to New name.
     */
    private function rename(string $from, string $to): void
    {
        if (!Schema::hasTable($from) || Schema::hasTable($to)) {
            return;
        }
        Schema::rename($from, $to);
        if (DB::getDriverName() !== 'mysql' && DB::getDriverName() !== 'mariadb') {
            return;
        }
        foreach (Schema::getIndexes($to) as $index) {
            if (!$index['primary'] && str_starts_with($index['name'], "{$from}_")) {
                $new = $to . substr($index['name'], strlen($from));
                DB::statement("ALTER TABLE `{$to}` RENAME INDEX `{$index['name']}` TO `{$new}`");
            }
        }
    }
};
