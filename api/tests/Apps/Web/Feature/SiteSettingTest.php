<?php

/**
 * @file SiteSettingTest.php
 * @path api/tests/Apps/Web/Feature/SiteSettingTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the web settings (WebSiteSettingController, WebPublicController):
 *   maintenance mode with password confirmation, the commission request e-mail template and
 *   the public web status.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures.
 */

namespace Tests\Apps\Web\Feature;

use App\Models\User;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use Illuminate\Support\Facades\Cache;
use Tests\Apps\Web\Support\WebFixtures;
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
        $this->getJson('/api/web/settings')->assertOk()->assertJsonPath('data.is_web_active', true);
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
     * @output 200 {data}; cache key gone; web log 'maintenance_status_changed' "DISABLED"; no log row
     *   holds the password (`confirm_password` stripped from context_data, 2026-10-26).
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

        // The confirming password is never written into the audit log (2026-10-26 security fix).
        foreach (WebLog::all() as $log) {
            $this->assertArrayNotHasKey('confirm_password', $log->context_data ?? []);
            $this->assertStringNotContainsString($this->defaultPassword, json_encode($log->context_data));
        }
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
     * @description The e-mail template: shown (settings created when missing) with the texts
     *   missing per active web language, saved only with every Czech text (the default language)
     *   and logged.
     * @input GET template (empty table); PUT subject + labels i18n without the other Czech texts;
     *   PUT with the complete Czech texts + English subject / greeting; PUT title 'x'.
     * @output 200 with null fields and missing cz (every key); 422 errors.missing (title …),
     *   nothing stored; 200 {success, data} with the arrays; web log 'update'; 422.
     */
    public function test_raw_request_email_template(): void
    {
        $this->admin();
        $all = array_keys(RawRequestEmailTemplate::DEFAULTS);

        $this->getJson('/api/web/settings/raw-request-email-template')
            ->assertOk()->assertJson(['data' => ['raw_request_email_subject_i18n' => null, 'raw_request_email_labels_i18n' => null]])
            ->assertJsonPath('data.missing.cz', $all);

        $this->putJson('/api/web/settings/raw-request-email-template', [
            'raw_request_email_subject_i18n' => ['cz' => 'Dekujeme', 'en' => 'Thank you'],
            'raw_request_email_labels_i18n'  => ['en' => ['greeting' => 'Hi,']],
        ])->assertStatus(422)->assertJsonPath('errors.missing', array_values(array_diff($all, ['subject'])));
        $this->assertNull(WebSiteSetting::first()->raw_request_email_subject_i18n);

        $czech = RawRequestEmailTemplate::DEFAULTS;
        $this->putJson('/api/web/settings/raw-request-email-template', [
            'raw_request_email_subject_i18n' => ['cz' => 'Dekujeme', 'en' => 'Thank you'],
            'raw_request_email_title_i18n'   => ['cz' => $czech['title']],
            'raw_request_email_intro_i18n'   => ['cz' => $czech['intro']],
            'raw_request_email_outro_i18n'   => ['cz' => $czech['outro']],
            'raw_request_email_labels_i18n'  => ['cz' => array_diff_key($czech, array_flip(RawRequestEmailTemplate::FLAT)), 'en' => ['greeting' => 'Hi,']],
        ])->assertOk()->assertJsonPath('data.raw_request_email_subject_i18n.en', 'Thank you');

        $this->assertSame('Hi,', WebSiteSetting::first()->raw_request_email_labels_i18n['en']['greeting']);
        $this->assertWebLog('update', 'Updated confirmation email template');
        $this->putJson('/api/web/settings/raw-request-email-template', ['raw_request_email_title_i18n' => 'x'])->assertStatus(422);
    }

    /**
     * @description The public status is open to everybody and cached.
     * @input No settings row: GET /api/web/public/status; then the row switched off (cache still on).
     * @output {is_web_active: true, show_footer_copyright: true} both times (cached for 5
     *   minutes); row created.
     */
    public function test_public_status(): void
    {
        $this->getJson('/api/web/public/status')->assertOk()->assertExactJson(['data' => ['is_web_active' => true, 'show_footer_copyright' => true]]);
        WebSiteSetting::query()->update(['is_web_active' => false]);

        $this->getJson('/api/web/public/status')->assertExactJson(['data' => ['is_web_active' => true, 'show_footer_copyright' => true]]);
        Cache::flush();
        $this->getJson('/api/web/public/status')->assertExactJson(['data' => ['is_web_active' => false, 'show_footer_copyright' => true]]);
    }

    /**
     * @description The copyright line of the website footer is switched on the texts page: read
     *   with web-edit-website-view, switched with web-edit-website-update (no password - a text
     *   of the pages, not their availability); the public status follows at once (cache cleared);
     *   logged; a non-boolean is refused.
     * @input viewer: GET / PUT; editor: PUT false; GET status; PUT 'x'; no row: PUT true.
     * @output viewer 200 true / 403; editor 200 false, status show_footer_copyright false, web log
     *   'Footer copyright line hidden.'; 422; row created with true.
     */
    public function test_footer_copyright_option(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view']));
        $this->getJson('/api/web/settings/footer')->assertOk()->assertExactJson(['data' => ['show_footer_copyright' => true]]);
        $this->putJson('/api/web/settings/footer', ['show_footer_copyright' => false])->assertStatus(403);

        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        $this->putJson('/api/web/settings/footer', ['show_footer_copyright' => true])->assertOk();
        $this->getJson('/api/web/public/status')->assertJsonPath('data.show_footer_copyright', true);
        $this->putJson('/api/web/settings/footer', ['show_footer_copyright' => false])->assertOk()->assertJsonPath('data.show_footer_copyright', false);
        $this->getJson('/api/web/public/status')->assertJsonPath('data.show_footer_copyright', false);
        $this->assertSame('Footer copyright line hidden.', \App\Apps\Web\Models\WebLog::query()->latest('id')->value('description'));
        $this->putJson('/api/web/settings/footer', ['show_footer_copyright' => 'x'])->assertStatus(422);
        $this->assertSame(1, WebSiteSetting::count());
    }

    /**
     * @description Web maintenance blocks the web-only public endpoints (open finding #7: the
     *   `web.active` middleware was registered but used on no route).
     * @input Settings row switched off (is_web_active false, own message), cache cleared; the
     *   two public form POSTs; then status / legal config; then web on.
     * @output 503 {success:false, message:<maintenance message>} for the guarded routes; status and
     *   legal config still 200; with the web active again the form answers 422 (validation), not 503.
     */
    public function test_maintenance_blocks_public_web_endpoints(): void
    {
        WebSiteSetting::query()->updateOrCreate(['id' => 1], ['is_web_active' => false, 'web_maintenance_message' => 'Back soon']);
        Cache::forget('site_setting_active_web');

        foreach (['raw_request_commissions', 'job_applications'] as $form) {
            $this->postJson("/api/{$form}", [])->assertStatus(503)->assertExactJson(['message' => 'Back soon']);
        }

        $this->getJson('/api/web/public/status')->assertOk()->assertJsonPath('data.is_web_active', false);
        $this->getJson('/api/public/legal/config')->assertOk();

        WebSiteSetting::query()->update(['is_web_active' => true]);
        Cache::flush();
        $this->postJson('/api/raw_request_commissions', [])->assertStatus(422);
    }
}
