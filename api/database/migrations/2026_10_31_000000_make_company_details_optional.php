<?php
/**
 * @file 2026_10_31_000000_make_company_details_optional.php
 * @path api/database/migrations/2026_10_31_000000_make_company_details_optional.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-31
 * @description Company details (legal_site_settings): only the company name and the contact
 *   e-mail stay required (the e-mail is used by the outgoing mails). Every other field can be
 *   switched off in the admin:
 *   - new column `hidden_fields` (JSON list of switched-off field keys) - a switched-off field
 *     keeps its value in the database (switching it on again restores it) but is never sent
 *     to the public pages or the e-mails;
 *   - ico, brand_tagline, copyright_text and address become nullable (an installation may
 *     have no value for them at all);
 *   - an existing row gets every EMPTY field switched off (e.g. no DIČ, no GA ID), so the
 *     admin form opens without a required-but-empty field.
 * @note Non-destructive: no value is changed. down() restores NOT NULL only after filling
 *   empty values with '' (MariaDB would refuse NULL rows) and drops `hidden_fields`.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string> Columns that were NOT NULL and become optional. */
    private const OPTIONAL_COLUMNS = ['ico', 'brand_tagline', 'copyright_text', 'address'];

    /**
     * @var array<int, string> Fields that can be switched off (copy of SiteSetting::HIDEABLE_FIELDS
     *   as of this migration - a migration must not change when the model changes later).
     */
    private const HIDEABLE_FIELDS = [
        'brand_tagline', 'copyright_text', 'ico', 'dic', 'google_analytics_id', 'contact_phone', 'address', 'footer_text',
    ];

    /**
     * @description Adds `hidden_fields` and makes the optional columns nullable.
     * @return void
     */
    public function up(): void
    {
        Schema::table('legal_site_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('legal_site_settings', 'hidden_fields')) {
                $table->json('hidden_fields')->nullable()->after('logo_path');
            }
            $table->string('ico', 20)->nullable()->change();
            $table->string('brand_tagline', 255)->nullable()->change();
            $table->string('copyright_text', 255)->nullable()->change();
            $table->text('address')->nullable()->change();
        });

        $this->hideEmptyFields();
    }

    /**
     * @description Switches off every empty field of the existing rows (HIDEABLE_FIELDS, by its
     *   base column). Rows that already have `hidden_fields` stay as they are.
     * @return void
     */
    private function hideEmptyFields(): void
    {
        foreach (DB::table('legal_site_settings')->whereNull('hidden_fields')->get() as $row) {
            $hidden = [];
            foreach (self::HIDEABLE_FIELDS as $field) {
                if (trim((string) ($row->{$field} ?? '')) === '') {
                    $hidden[] = $field;
                }
            }
            DB::table('legal_site_settings')->where('id', $row->id)->update(['hidden_fields' => json_encode($hidden)]);
        }
    }

    /**
     * @description Drops `hidden_fields` and restores NOT NULL (empty values become '').
     * @return void
     */
    public function down(): void
    {
        foreach (self::OPTIONAL_COLUMNS as $column) {
            DB::table('legal_site_settings')->whereNull($column)->update([$column => '']);
        }

        Schema::table('legal_site_settings', function (Blueprint $table) {
            $table->dropColumn('hidden_fields');
            $table->string('ico', 20)->nullable(false)->change();
            $table->string('brand_tagline', 255)->nullable(false)->change();
            $table->string('copyright_text', 255)->nullable(false)->change();
            $table->text('address')->nullable(false)->change();
        });
    }
};
