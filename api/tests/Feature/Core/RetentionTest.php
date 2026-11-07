<?php

/**
 * @file RetentionTest.php
 * @path api/tests/Feature/Core/RetentionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the GDPR retention (VT-10): the settings API
 *   (CoreRetentionSettingController - defaults, validation, permissions, log) and the purge
 *   (`retention:purge`, RetentionPurgeService) - records last changed before the period are
 *   deleted for good with their files, also from the trash; fresh records, records of a switched
 *   off retention and projects with a recent message stay; expired portal sessions go.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake (private / public disks).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebCookieConsent;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThreadMessage;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Models\Web\WebSupportTicket;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description core/retention_settings and the retention purge.
 */
class RetentionTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Fake disks of the attachments and the legacy uploads.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Storage::fake('public');
    }

    /**
     * @description Moves the last change of a record into the past (no model events).
     * @param Model $model Record.
     * @param int $days Days ago.
     * @return void
     */
    private function age(Model $model, int $days): void
    {
        DB::table($model->getTable())->where('id', $model->id)->update(['updated_at' => now()->subDays($days)]);
    }

    /**
     * @description The settings list every kind of data with its default in a fixed order (rows
     *   created on first use); view and update need the legal config permissions.
     * @input GET as viewer; GET / PUT without permissions.
     * @output 8 rows = DEFAULTS in order; 403 ×2.
     */
    public function test_settings_defaults_and_permissions(): void
    {
        $this->signIn($this->userWith(['core-legal-config-view']));

        $rows = $this->getJson('/api/core/retention_settings')->assertOk()->json('data');
        $this->assertSame(CoreRetentionSetting::DEFAULTS, array_column($rows, 'retention_days', 'data_key'));

        $this->putJson('/api/core/retention_settings', ['settings' => [['data_key' => 'raw_requests', 'retention_days' => 365]]])->assertForbidden();
        $this->signIn($this->userWith([]));
        $this->getJson('/api/core/retention_settings')->assertForbidden();
    }

    /**
     * @description Update: periods are stored and every real change is logged; null switches
     *   the deletion off; unknown keys, too short / long periods and a missing value are refused.
     * @input PUT raw_requests 365, job_applications null, sales_leads unchanged; invalid bodies.
     * @output 200 with the new values; 2 core log entries 'retention_updated'; 422 ×4.
     */
    public function test_update_validates_and_logs(): void
    {
        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));

        $rows = $this->putJson('/api/core/retention_settings', ['settings' => [
            ['data_key' => 'raw_requests', 'retention_days' => 365],
            ['data_key' => 'job_applications', 'retention_days' => null],
            ['data_key' => 'sales_leads', 'retention_days' => 730],
        ]])->assertOk()->json('data');
        $values = array_column($rows, 'retention_days', 'data_key');
        $this->assertSame([365, null, 730], [$values['raw_requests'], $values['job_applications'], $values['sales_leads']]);
        $this->assertSame(2, CoreLog::where('event_type', 'retention_updated')->count());

        foreach ([
            [['data_key' => 'shop_orders', 'retention_days' => 365]],
            [['data_key' => 'raw_requests', 'retention_days' => CoreRetentionSetting::MIN_DAYS - 1]],
            [['data_key' => 'raw_requests', 'retention_days' => CoreRetentionSetting::MAX_DAYS + 1]],
            [['data_key' => 'raw_requests']],
        ] as $settings) {
            $this->putJson('/api/core/retention_settings', ['settings' => $settings])->assertStatus(422);
        }
    }

    /**
     * @description The purge deletes every expired record with its files (also trashed ones and
     *   legacy single files), keeps fresh ones, keeps everything of a switched off retention,
     *   keeps a project with a recent message, deletes old consents and expired portal sessions,
     *   and stores the result on the settings.
     * @input Per kind one record older and one younger than the default; a trashed old inquiry;
     *        tickets off; an old project with a message 10 days ago; consents 4 years / 1 day old;
     *        an expired portal session; `artisan retention:purge`.
     * @output Old records, their attachment rows and files gone; young ones, tickets and the
     *   active project kept; last_deleted_count per kind; expired session gone.
     */
    public function test_purge_deletes_expired_records_and_files(): void
    {
        CoreRetentionSetting::allInOrder();
        CoreRetentionSetting::where('data_key', 'support_tickets')->update(['retention_days' => null]);

        $oldCv = $this->jobApplication(['cv_path' => 'cv_files/legacy.pdf']);
        Storage::disk('public')->put('cv_files/legacy.pdf', 'cv');
        $this->attach($oldCv, 'web/cv_files/old.pdf');
        $this->age($oldCv, 181);
        $freshCv = $this->jobApplication();
        $this->age($freshCv, 179);

        $oldRequest = $this->rawRequest();
        $this->attach($oldRequest, 'web/raw_request_commissions/old.pdf');
        $oldRequest->delete();
        $this->age($oldRequest, 731);
        $freshRequest = $this->rawRequest();

        $oldLead = $this->lead();
        $this->age($oldLead, 731);
        $this->lead();

        $oldTicket = $this->ticket();
        $this->age($oldTicket, 5000);

        $oldOrder = $this->salesOrder();
        $this->attach($oldOrder, 'web/sales_orders/old.pdf');
        $this->age($oldOrder, 3651);
        $this->salesOrder();

        $oldProject = $this->project();
        $thread = $this->thread($oldProject, [], [['customer', 'Hello']]);
        $this->attach($thread->messages->first(), 'web/project_threads/old.png');
        $this->portalSession($oldProject);
        $this->age($oldProject, 3651);
        DB::table('web_project_thread_messages')->update(['created_at' => now()->subDays(3651)]);
        $activeProject = $this->project();
        $this->thread($activeProject, [], [['customer', 'Still here']]);
        $this->age($activeProject, 3651);
        DB::table('web_project_thread_messages')->where('thread_id', '!=', $thread->id)->update(['created_at' => now()->subDays(10)]);
        WebProjectSession::query()->where('project_id', $activeProject->id)->delete();
        $this->portalSession($activeProject);
        DB::table('web_project_sessions')->where('project_id', $activeProject->id)->update(['expires_at' => now()->subMinute()]);

        WebCookieConsent::create(['consent_id' => '11111111-1111-4111-8111-111111111111', 'version' => 1, 'functional' => true, 'analytics' => false, 'marketing' => false]);
        DB::table('web_cookie_consents')->update(['created_at' => now()->subYears(4)]);
        WebCookieConsent::create(['consent_id' => '22222222-2222-4222-8222-222222222222', 'version' => 1, 'functional' => true, 'analytics' => true, 'marketing' => false]);

        $this->artisan('retention:purge')->assertSuccessful();

        $this->assertSame([$freshCv->id], WebJobApplication::withTrashed()->pluck('id')->all());
        $this->assertSame([$freshRequest->id], WebRawRequestCommission::withTrashed()->pluck('id')->all());
        $this->assertSame(1, WebSalesLead::withTrashed()->count());
        $this->assertFalse(WebSalesLead::withTrashed()->whereKey($oldLead->id)->exists());
        $this->assertSame(1, WebSupportTicket::count());
        $this->assertSame(1, WebSalesOrder::count());
        $this->assertSame([$activeProject->id], WebProject::withTrashed()->pluck('id')->all());
        $this->assertSame(1, WebProjectThreadMessage::count());
        $this->assertSame(0, WebProjectSession::count());
        $this->assertSame(['22222222-2222-4222-8222-222222222222'], WebCookieConsent::pluck('consent_id')->all());

        $this->assertSame(0, WebAttachment::count());
        foreach (['web/cv_files/old.pdf', 'web/raw_request_commissions/old.pdf', 'web/sales_orders/old.pdf', 'web/project_threads/old.png'] as $path) {
            Storage::disk('private')->assertMissing($path);
        }
        Storage::disk('public')->assertMissing('cv_files/legacy.pdf');

        $counts = CoreRetentionSetting::pluck('last_deleted_count', 'data_key')->all();
        $this->assertSame(
            ['job_applications' => 1, 'raw_requests' => 1, 'sales_leads' => 1, 'support_tickets' => null, 'sales_orders' => 1, 'projects' => 1, 'cookie_consents' => 1, 'audit_logs' => 0],
            $counts
        );
        $this->assertNotNull(CoreRetentionSetting::where('data_key', 'raw_requests')->value('last_run_at'));
    }

    /**
     * @description "Run now" in the admin runs the same purge, answers the counts and logs the run;
     *   it needs the update permission.
     * @input An inquiry 800 days old; POST purge as editor; as viewer.
     * @output 200 deleted.raw_requests 1, settings included; core log 'retention_purge'; 403.
     */
    public function test_manual_purge(): void
    {
        $old = $this->rawRequest();
        $this->age($old, 800);

        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        $this->postJson('/api/core/retention_settings/purge')->assertOk()
            ->assertJsonPath('data.deleted.raw_requests', 1)
            ->assertJsonPath('data.deleted.expired_portal_sessions', 0)
            ->assertJsonCount(count(CoreRetentionSetting::DEFAULTS), 'data.settings');
        $this->assertSame(1, CoreLog::where('event_type', 'retention_purge')->count());

        $this->signIn($this->userWith(['core-legal-config-view']));
        $this->postJson('/api/core/retention_settings/purge')->assertForbidden();
    }
}
