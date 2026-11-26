<?php
/**
 * @file 2026_11_29_000000_web_inquiry_email_czech_complete.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_29_000000_web_inquiry_email_czech_complete.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Czech is the default language of the inquiry confirmation e-mail (2026-11): the template is saved
 *   only with every Czech text filled in, and every other language falls back to Czech (never to
 *   a built-in English wording any more). Fills the empty Czech texts of the stored template with
 *   the built-in Czech texts (RawRequestEmailTemplate::DEFAULTS) - filled texts and other languages stay.
 * @note No settings row yet (new installation, the seed comes later): nothing to do.
 * @note down() changes nothing - the filled-in texts cannot be told from texts typed in.
 * @dependencies WebSiteSetting, RawRequestEmailTemplate
 */

use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Completes the Czech texts of the template.
     * @return void
     */
    public function up(): void
    {
        if (!Schema::hasTable('web_site_settings') || !Schema::hasColumn('web_site_settings', 'raw_request_email_labels_i18n')) {
            return;
        }
        $settings = WebSiteSetting::query()->first();
        if ($settings && RawRequestEmailTemplate::completeDefaults($settings)) {
            $settings->save();
        }
    }

    /**
     * @description Nothing to undo (see the file header).
     * @return void
     */
    public function down(): void
    {
    }
};
