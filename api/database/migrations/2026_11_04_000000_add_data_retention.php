<?php
/**
 * @file 2026_11_04_000000_add_data_retention.php
 * @path api/database/migrations/2026_11_04_000000_add_data_retention.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description GDPR storage limitation (Art. 5(1)(e)) and proof of consent (Art. 7(1)):
 *   - `core_retention_settings` - retention period of every kind of personal data (one row per
 *     kind, `retention_days` NULL = kept until deleted by hand), filled with the defaults of
 *     CoreRetentionSetting::DEFAULTS; enforced daily by `retention:purge`;
 *   - `web_sales_leads.public_token_expires_at` - the public order form link of a lead expires
 *     (WebSalesLead::PUBLIC_TOKEN_TTL_DAYS); an existing unused link gets the full period from now,
 *     so no link sent before this change stops working at once;
 *   - `web_cookie_consents` - anonymous record of every cookie consent decision (random consent id,
 *     version, categories, time) - no IP address, no user agent.
 * @note down() drops the tables and the column.
 */

use App\Models\Core\CoreRetentionSetting;
use App\Models\Web\WebSalesLead;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Creates the retention settings (with defaults), the lead link expiry and the
     * consent records.
     * @return void
     */
    public function up(): void
    {
        Schema::create('core_retention_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('data_key', 50)->unique();
            $table->unsignedInteger('retention_days')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->unsignedInteger('last_deleted_count')->nullable();
            $table->timestamps();
        });

        $now = now();
        foreach (CoreRetentionSetting::DEFAULTS as $key => $days) {
            DB::table('core_retention_settings')->insert([
                'data_key' => $key, 'retention_days' => $days, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        Schema::table('web_sales_leads', function (Blueprint $table) {
            $table->timestamp('public_token_expires_at')->nullable()->after('public_token_used_at');
        });

        DB::table('web_sales_leads')
            ->whereNotNull('public_token')
            ->whereNull('public_token_used_at')
            ->update(['public_token_expires_at' => $now->copy()->addDays(WebSalesLead::PUBLIC_TOKEN_TTL_DAYS)]);

        Schema::create('web_cookie_consents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->char('consent_id', 36);
            $table->unsignedSmallInteger('version');
            $table->boolean('functional');
            $table->boolean('analytics');
            $table->boolean('marketing');
            $table->timestamp('created_at')->useCurrent();
            $table->index('consent_id', 'web_cookie_consents_consent_id_index');
            $table->index('created_at', 'web_cookie_consents_created_at_index');
        });
    }

    /**
     * @description Drops the consent records, the lead link expiry and the retention settings.
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('web_cookie_consents');
        Schema::table('web_sales_leads', function (Blueprint $table) {
            $table->dropColumn('public_token_expires_at');
        });
        Schema::dropIfExists('core_retention_settings');
    }
};
