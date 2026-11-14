<?php

/**
 * @file RetentionTest.php
 * @path api/tests/Integration/RetentionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the GDPR retention (VT-10): the settings API
 *   (CoreRetentionSettingController - defaults, validation, permissions, log) and the purge
 *   (`retention:purge`, RetentionPurgeService) - records last changed before the period are
 *   deleted for good with their files, also from the trash; fresh records, records of a switched
 *   off retention and projects with a recent message stay; expired portal sessions go.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures; Storage fake (private / public disks).
 */

namespace Tests\Integration;

use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use App\Models\Core\CoreAttachment;
use App\Models\Legal\CookieConsent;
use App\Apps\Web\Models\WebJobApplication;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Models\ProjectThreadMessage;
use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\Web\Models\WebRawRequestCommission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description core/retention_settings and the retention purge.
 */
class RetentionTest extends TestCase
{
    use ProjectFixtures, WebFixtures;

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
     * @output 8 rows = defaults() (web kinds + audit_logs) in order; 403 ×2.
     */
    public function test_settings_defaults_and_permissions(): void
    {
        $this->signIn($this->userWith(['core-legal-config-view']));

        $rows = $this->getJson('/api/core/retention_settings')->assertOk()->json('data');
        $this->assertSame(CoreRetentionSetting::defaults(), array_column($rows, 'retention_days', 'data_key'));

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
     *        an old project with a message 10 days ago; consents 4 years / 1 day old;
     *        an expired portal session; `artisan retention:purge`; then leads off, a lead
     *        5000 days old, purge again.
     * @output Old records, their attachment rows and files gone; young ones and the
     *   active project kept; last_deleted_count per kind; expired session gone; a kind switched
     *   off afterwards (leads) keeps even a very old record.
     */
    public function test_purge_deletes_expired_records_and_files(): void
    {
        CoreRetentionSetting::allInOrder();

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

        $oldOrder = $this->salesOrder();
        $this->attach($oldOrder, 'web/sales_orders/old.pdf');
        $this->age($oldOrder, 3651);
        $this->salesOrder();

        $oldProject = $this->project();
        $thread = $this->thread($oldProject, [], [['customer', 'Hello']]);
        $this->attach($thread->messages->first(), 'web/project_threads/old.png');
        $this->portalSession($oldProject);
        $this->age($oldProject, 3651);
        DB::table('project_portal_project_thread_messages')->update(['created_at' => now()->subDays(3651)]);
        $activeProject = $this->project();
        $this->thread($activeProject, [], [['customer', 'Still here']]);
        $this->age($activeProject, 3651);
        DB::table('project_portal_project_thread_messages')->where('thread_id', '!=', $thread->id)->update(['created_at' => now()->subDays(10)]);
        ProjectSession::query()->where('project_id', $activeProject->id)->delete();
        $this->portalSession($activeProject);
        DB::table('project_portal_project_sessions')->where('project_id', $activeProject->id)->update(['expires_at' => now()->subMinute()]);

        CookieConsent::create(['consent_id' => '11111111-1111-4111-8111-111111111111', 'version' => 1, 'functional' => true, 'analytics' => false, 'marketing' => false]);
        DB::table('legal_cookie_consents')->update(['created_at' => now()->subYears(4)]);
        CookieConsent::create(['consent_id' => '22222222-2222-4222-8222-222222222222', 'version' => 1, 'functional' => true, 'analytics' => true, 'marketing' => false]);

        $this->artisan('retention:purge')->assertSuccessful();

        $this->assertSame([$freshCv->id], WebJobApplication::withTrashed()->pluck('id')->all());
        $this->assertSame([$freshRequest->id], WebRawRequestCommission::withTrashed()->pluck('id')->all());
        $this->assertSame(1, SalesLead::withTrashed()->count());
        $this->assertFalse(SalesLead::withTrashed()->whereKey($oldLead->id)->exists());
        $this->assertSame(1, SalesOrder::count());
        $this->assertSame([$activeProject->id], Project::withTrashed()->pluck('id')->all());
        $this->assertSame(1, ProjectThreadMessage::count());
        $this->assertSame(0, ProjectSession::count());
        $this->assertSame(['22222222-2222-4222-8222-222222222222'], CookieConsent::pluck('consent_id')->all());

        $this->assertSame(0, CoreAttachment::count());
        foreach (['web/cv_files/old.pdf', 'web/raw_request_commissions/old.pdf', 'web/sales_orders/old.pdf', 'web/project_threads/old.png'] as $path) {
            Storage::disk('private')->assertMissing($path);
        }
        Storage::disk('public')->assertMissing('cv_files/legacy.pdf');

        $counts = CoreRetentionSetting::pluck('last_deleted_count', 'data_key')->all();
        $this->assertSame(
            ['job_applications' => 1, 'raw_requests' => 1, 'sales_leads' => 1, 'sales_orders' => 1, 'projects' => 1, 'cookie_consents' => 1, 'audit_logs' => 0],
            $counts
        );
        $this->assertNotNull(CoreRetentionSetting::where('data_key', 'raw_requests')->value('last_run_at'));

        CoreRetentionSetting::where('data_key', 'sales_leads')->update(['retention_days' => null]);
        $keptLead = $this->lead();
        $this->age($keptLead, 5000);
        $this->artisan('retention:purge')->assertSuccessful();
        $this->assertTrue(SalesLead::whereKey($keptLead->id)->exists());
    }

    /**
     * @description "Run now" in the admin runs the same purge, answers the counts and logs the run;
     *   it needs the update permission.
     * @input An inquiry 800 days old; POST purge as editor; as viewer.
     * @output 200 deleted.raw_requests 1, failed [], settings included; core log 'retention_purge'; 403.
     */
    public function test_manual_purge(): void
    {
        $old = $this->rawRequest();
        $this->age($old, 800);

        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        $this->postJson('/api/core/retention_settings/purge')->assertOk()
            ->assertJsonPath('data.deleted.raw_requests', 1)
            ->assertJsonPath('data.deleted.expired_portal_sessions', 0)
            ->assertJsonPath('data.failed', [])
            ->assertJsonCount(count(CoreRetentionSetting::defaults()), 'data.settings');
        $this->assertSame(1, CoreLog::where('event_type', 'retention_purge')->count());

        $this->signIn($this->userWith(['core-legal-config-view']));
        $this->postJson('/api/core/retention_settings/purge')->assertForbidden();
    }

    /**
     * @description One kind of data that fails (database error, missing class of a removed module)
     *   no longer stops the whole purge: the next kinds still run, the failure is logged, the
     *   failed setting keeps its old `last_run_at`, the command ends with an error code and the
     *   manual run answers the failed keys.
     * @input Old inquiry whose DELETE fails (trigger); cookie consent 4 years old; command; manual run.
     * @output command FAILED raw_requests, exit 1; consent deleted (later kind ran); inquiry kept;
     *   raw_requests last_run_at null, cookie_consents set; Log::error; manual run 200 failed
     *   ['raw_requests'].
     */
    public function test_one_failing_kind_does_not_stop_the_others(): void
    {
        $old = $this->rawRequest();
        $this->age($old, 800);
        $this->failOn($old->getTable(), 'DELETE');
        CookieConsent::create(['consent_id' => '33333333-3333-4333-8333-333333333333', 'version' => 1, 'functional' => true, 'analytics' => false, 'marketing' => false]);
        DB::table('legal_cookie_consents')->update(['created_at' => now()->subYears(4)]);
        \Illuminate\Support\Facades\Log::spy();

        $this->artisan('retention:purge')->expectsOutputToContain('FAILED')->assertFailed();

        $this->assertSame(0, CookieConsent::count());
        $this->assertTrue(DB::table($old->getTable())->where('id', $old->id)->exists());
        $this->assertNull(CoreRetentionSetting::where('data_key', 'raw_requests')->value('last_run_at'));
        $this->assertNotNull(CoreRetentionSetting::where('data_key', 'cookie_consents')->value('last_run_at'));
        \Illuminate\Support\Facades\Log::shouldHaveReceived('error')->withArgs(fn ($message, $context = []) => $message === 'Retention purge failed' && $context['data_key'] === 'raw_requests');

        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        $this->postJson('/api/core/retention_settings/purge')->assertOk()
            ->assertJsonPath('data.failed', ['raw_requests'])
            ->assertJsonPath('data.deleted.raw_requests', null);
    }

    /**
     * @description VT-18: the core names no module model - only the registered sources take part. A
     *   source whose class no longer exists (removed module) is skipped: its kinds are not listed
     *   and not purged, nothing fails, the core audit log is still purged.
     * @input config apps.apps = [missing manifest]; old inquiry, old core log, old web log; command.
     * @output settings = the core ones only [cookie_consents, audit_logs]; command OK, no FAILED; inquiry kept; core log row
     *   deleted, web log row kept (web not registered); PUT of a web key 422.
     */
    public function test_only_registered_modules_take_part(): void
    {
        config(['apps.apps' => ['App\\Services\\Removed\\RemovedApp']]);
        $old = $this->rawRequest();
        $this->age($old, 800);
        foreach ([CoreLog::class, \App\Apps\Web\Models\WebLog::class] as $model) {
            $log = $model::create(['origin' => '127.0.0.1', 'event_type' => 'update', 'module' => 'X', 'description' => 'old', 'user_id_plain' => '0', 'user_plain' => 'system']);
            DB::table($log->getTable())->where('id', $log->id)->update(['created_at' => now()->subYears(3)]);
        }

        $this->assertSame(['cookie_consents', 'audit_logs'], array_column(CoreRetentionSetting::allInOrder(), 'data_key'));
        $this->artisan('retention:purge')->doesntExpectOutputToContain('FAILED')->assertSuccessful();

        $this->assertTrue(DB::table($old->getTable())->where('id', $old->id)->exists());
        $this->assertSame(0, CoreLog::count());
        $this->assertSame(1, \App\Apps\Web\Models\WebLog::count());

        $this->signIn($this->userWith(['core-legal-config-view', 'core-legal-config-update']));
        $this->putJson('/api/core/retention_settings', ['settings' => [['data_key' => 'raw_requests', 'retention_days' => 365]]])
            ->assertUnprocessable();
    }
}
