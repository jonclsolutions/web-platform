<?php

/**
 * @file SiteSettingTest.php
 * @path api/tests/Feature/Web/SiteSettingTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the web settings (WebSiteSettingController, WebPublicController):
 *   maintenance mode with password confirmation, the commission request e-mail template and
 *   the public web status.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures.
 */

namespace Tests\Feature\Web;

use App\Models\User;
use App\Models\Web\WebLog;
use App\Models\Web\WebSiteSetting;
use Illuminate\Support\Facades\Cache;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/settings, /api/web/settings/raw-request-email-template, /api/web/public/status.
 */
class SiteSettingTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Signs in an account that may switch the maintenance mode and edit the template.
     * @return User
     */
    private function admin(): User
    {
        return $this->signIn($this->userWith(['web-set-maintenance-mode', 'web-user-requests-update']));
    }

    /**
     * @description The settings need web-set-maintenance-mode; on first use the row is created active.
     * @input Account without permission: GET; admin: GET with an empty table.
     * @output 403; 200 {is_web_active: true} and one row.
     */
    public function test_show_creates_default_settings(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/settings')->assertStatus(403);

        $this->admin();
        $this->getJson('/api/web/settings')->assertOk()->assertJsonPath('is_web_active', true);
        $this->assertSame(1, WebSiteSetting::count());
    }

    /**
     * @description Switching the web off needs the own password; a wrong one is refused and logged.
     * @input PUT {confirm_password: wrong, is_web_active: false}.
     * @output 403 "Invalid confirmation password."; web log 'unauthorized_maintenance_toggle_attempt'; web stays on.
     */
    public function test_update_requires_correct_password(): void
    {
        $this->admin();
        WebSiteSetting::create(['is_web_active' => true]);

        $this->putJson('/api/web/settings', ['confirm_password' => 'wrong', 'is_web_active' => false])
            ->assertStatus(403)->assertJson(['message' => 'Invalid confirmation password.']);

        $this->assertWebLog('unauthorized_maintenance_toggle_attempt');
        $this->assertTrue(WebSiteSetting::first()->is_web_active);
        $this->putJson('/api/web/settings', [])->assertStatus(422)->assertJsonValidationErrors(['confirm_password']);
    }

    /**
     * @description With the right password the status and message change, the cached status
     *   is dropped and the change is logged.
     * @input Cached status; PUT {confirm_password, is_web_active: false, web_maintenance_message}.
     * @output 200 {success, data}; cache key gone; web log 'maintenance_status_changed' "DISABLED".
     */
    public function test_update_switches_maintenance(): void
    {
        $this->admin();
        Cache::put('site_setting_active_web', 'cached', 300);

        $this->putJson('/api/web/settings', [
            'confirm_password' => $this->defaultPassword, 'is_web_active' => false, 'web_maintenance_message' => 'Back soon',
        ])->assertOk()->assertJsonPath('data.is_web_active', false)->assertJsonPath('data.web_maintenance_message', 'Back soon');

        $this->assertFalse(Cache::has('site_setting_active_web'));
        $this->assertWebLog('maintenance_status_changed', 'DISABLED (Maintenance)');

        $this->putJson('/api/web/settings', ['confirm_password' => $this->defaultPassword, 'is_web_active' => true])->assertOk();
        $this->assertWebLog('maintenance_status_changed', 'ENABLED (Operational)');
    }

    /**
     * @description Changing only the message is saved but not logged as a status change.
     * @input PUT {confirm_password, web_maintenance_message} only.
     * @output 200 with the message; no 'maintenance_status_changed' log.
     */
    public function test_update_message_only(): void
    {
        $this->admin();

        $this->putJson('/api/web/settings', ['confirm_password' => $this->defaultPassword, 'web_maintenance_message' => 'Hi'])
            ->assertOk()->assertJsonPath('data.web_maintenance_message', 'Hi');

        $this->assertSame(0, WebLog::where('event_type', 'maintenance_status_changed')->count());
    }

    /**
     * @description The e-mail template: shown (settings created when missing), saved and logged.
     * @input GET template (empty table); PUT subject + labels i18n.
     * @output 200 with null fields; 200 {success, data} with the arrays; web log 'update'.
     */
    public function test_raw_request_email_template(): void
    {
        $this->admin();

        $this->getJson('/api/web/settings/raw-request-email-template')
            ->assertOk()->assertJson(['raw_request_email_subject_i18n' => null, 'raw_request_email_labels_i18n' => null]);

        $this->putJson('/api/web/settings/raw-request-email-template', [
            'raw_request_email_subject_i18n' => ['cz' => 'Dekujeme', 'en' => 'Thank you'],
            'raw_request_email_labels_i18n'  => ['en' => ['greeting' => 'Hi,']],
        ])->assertOk()->assertJsonPath('data.raw_request_email_subject_i18n.en', 'Thank you');

        $this->assertSame('Hi,', WebSiteSetting::first()->raw_request_email_labels_i18n['en']['greeting']);
        $this->assertWebLog('update', 'Updated confirmation email template');
        $this->putJson('/api/web/settings/raw-request-email-template', ['raw_request_email_title_i18n' => 'x'])->assertStatus(422);
    }

    /**
     * @description The public status is open to everybody and cached.
     * @input No settings row: GET /api/web/public/status; then the row switched off (cache still on).
     * @output {is_web_active: true} both times (cached for 5 minutes); row created.
     */
    public function test_public_status(): void
    {
        $this->getJson('/api/web/public/status')->assertOk()->assertExactJson(['is_web_active' => true]);
        WebSiteSetting::query()->update(['is_web_active' => false]);

        $this->getJson('/api/web/public/status')->assertExactJson(['is_web_active' => true]);
        Cache::flush();
        $this->getJson('/api/web/public/status')->assertExactJson(['is_web_active' => false]);
    }
}
