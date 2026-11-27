<?php
/**
 * @file 2026_11_30_000001_remove_application_texts_from_company_profile.php
 * @path api/database/migrations/2026_11_30_000001_remove_application_texts_from_company_profile.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Company details (legal_site_settings) keep only what belongs to the company as a
 *   whole: the copyright line (shown only in the website footer) and the footer text (shown only
 *   in the e-shop footer) are texts of those applications and move into their own texts
 *   (`footer.copyright_text` of Texty webu / Texty e-shopu, seeded by translations:sync). The core
 *   no longer holds anything of a single application, so removing an application needs no change
 *   of the core. Drops `copyright_text`, `copyright_text_i18n`, `footer_text`, `footer_text_i18n`
 *   and their keys in `hidden_fields`.
 * @note The stored values were test data only (2026-11, agreed) - they are not moved anywhere.
 * @note `footer_text_i18n` existed only on a database where a removed local migration
 *   (2026_11_30_000000_translatable_footer_text, never released) ran - dropped when present.
 * @note down() adds the columns back empty (the texts are not restored).
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string> Removed columns. */
    private const COLUMNS = ['copyright_text', 'copyright_text_i18n', 'footer_text', 'footer_text_i18n'];

    /** @var array<int, string> Removed keys of `hidden_fields`. */
    private const FIELDS = ['copyright_text', 'footer_text'];

    /**
     * @description Removes the keys from `hidden_fields` and drops the columns.
     * @return void
     */
    public function up(): void
    {
        foreach (DB::table('legal_site_settings')->whereNotNull('hidden_fields')->get(['id', 'hidden_fields']) as $row) {
            $hidden = json_decode((string) $row->hidden_fields, true);
            if (is_array($hidden)) {
                DB::table('legal_site_settings')->where('id', $row->id)
                    ->update(['hidden_fields' => json_encode(array_values(array_diff($hidden, self::FIELDS)))]);
            }
        }

        foreach (self::COLUMNS as $column) {
            if (Schema::hasColumn('legal_site_settings', $column)) {
                Schema::table('legal_site_settings', fn (Blueprint $table) => $table->dropColumn($column));
            }
        }
    }

    /**
     * @description Adds the columns back, empty.
     * @return void
     */
    public function down(): void
    {
        Schema::table('legal_site_settings', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                if (Schema::hasColumn('legal_site_settings', $column)) {
                    continue;
                }
                str_ends_with($column, '_i18n') ? $table->json($column)->nullable() : $table->string($column, 255)->nullable();
            }
        });
    }
};
