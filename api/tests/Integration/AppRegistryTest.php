<?php

/**
 * @file AppRegistryTest.php
 * @path api/tests/Integration/AppRegistryTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the application registry (config/apps.php, AppRegistry,
 *   AppManifest): what the core reads from the manifests, that a removed or broken entry is
 *   skipped, and that the core features built on it (upload rules, morph aliases of attachments,
 *   logs of downloads / exports / translations, calendar modules, orphan file folders) follow the
 *   registered applications only.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; test manifests at the end of the file.
 */

namespace Tests\Integration;

use App\Console\Commands\PruneOrphanFilesCommand;
use App\Models\Core\CoreAttachment;
use App\Models\Core\CoreLog;
use App\Apps\Shop\Models\ShopLog;
use App\Apps\Web\Models\WebLog;
use App\Apps\Shop\ShopApp;
use App\Apps\Shop\Http\Middleware\CheckShopActive;
use App\Apps\ProjectPortal\Database\Seeders\ProjectPortalBaseDataSeeder;
use App\Apps\ProjectPortal\Http\Middleware\CheckProjectSession;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Services\ProjectPortalAgendaSource;
use App\Apps\ProjectPortal\ProjectPortalApp;
use App\Apps\Web\Http\Middleware\CheckWebActive;
use App\Apps\Web\WebApp;
use App\Support\Apps\AppManifest;
use App\Support\Apps\AppRegistry;
use App\Support\Uploads\AttachmentPolicy;
use App\Apps\Shop\Database\Seeders\ShopBaseDataSeeder;
use App\Apps\Web\Database\Seeders\WebBaseDataSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description AppRegistry and the core features built on it.
 */
class AppRegistryTest extends TestCase
{
    use ProjectFixtures;

    /**
     * @description The configured applications in order; a missing class, a class that is no
     *   manifest and a duplicate id are skipped; everything the core reads comes from them.
     * @input apps = [web, missing class, stdClass, shop, project portal, second manifest with the id 'web'].
     * @output ids [web, shop, project-portal]; seeders of the three; 3 retention + 3 agenda sources;
     *   upload profiles of web + portal, folders incl. the portal ones; morph aliases of web and
     *   portal; logs WebLog / ShopLog / ProjectPortalLog; translation permissions of web and shop
     *   (the portal has no translations); middleware aliases of the applications registered;
     *   app('nope') null; owner of 'sales_order' and 'project_update' = project-portal.
     */
    public function test_registered_applications(): void
    {
        config(['apps.apps' => [WebApp::class, 'App\\Apps\\Removed\\RemovedApp', \stdClass::class, ShopApp::class, ProjectPortalApp::class, DuplicateWebApp::class]]);

        $this->assertSame(['web', 'shop', 'project-portal'], array_keys(AppRegistry::apps()));
        $this->assertInstanceOf(WebApp::class, AppRegistry::app('web'));
        $this->assertNull(AppRegistry::app('nope'));
        $this->assertSame([WebBaseDataSeeder::class, ShopBaseDataSeeder::class, ProjectPortalBaseDataSeeder::class], AppRegistry::baseDataSeeders());
        $this->assertCount(3, AppRegistry::retentionSources());
        $this->assertSame(['web', 'shop', 'project-portal'], array_map(fn ($pair) => $pair[0]->id(), AppRegistry::agendaSources()));
        $this->assertSame(['raw_request_commission', 'job_application', 'project_thread', 'sales_order'], array_keys(AppRegistry::uploadProfiles()));
        $this->assertContains('web/project_approvals', AppRegistry::uploadFolders());
        $this->assertSame(SalesOrder::class, AppRegistry::morphMap()['sales_order']);
        $this->assertSame([WebLog::class, ShopLog::class, ProjectPortalLog::class], AppRegistry::logModels());
        $this->assertSame(['web-edit-website-update', 'shop-edit-eshop-update'], AppRegistry::translationPermissions());
        $this->assertSame('project-portal', AppRegistry::ownerOfMorph('sales_order')?->id());
        $this->assertSame('project-portal', AppRegistry::ownerOfMorph(SalesOrder::class)?->id());
        $this->assertSame('project-portal', AppRegistry::ownerOfMorph('project_update')?->id());
        $this->assertNull(AppRegistry::ownerOfMorph('App\\Models\\Gone'));
        $aliases = app('router')->getMiddleware();
        $this->assertSame(CheckWebActive::class, $aliases['web.active']);
        $this->assertSame(CheckShopActive::class, $aliases['shop.active']);
        $this->assertSame(CheckProjectSession::class, $aliases['project.session']);
    }

    /**
     * @description Without any application the core still works: no profiles, folders or logs of
     *   applications; the upload rules are empty; the orphan check keeps the core folder.
     * @input apps = [].
     * @output apps []; upload rules {}; profile('sales_order') refused; prune folders = avatars only.
     */
    public function test_core_without_applications(): void
    {
        config(['apps.apps' => []]);

        $this->assertSame([], AppRegistry::apps());
        $this->getJson('/api/upload-rules')->assertOk()->assertExactJson(['data' => []]);
        $this->assertSame(PruneOrphanFilesCommand::CORE_FOLDERS, PruneOrphanFilesCommand::folders());
        $this->expectException(\InvalidArgumentException::class);
        AttachmentPolicy::profile(ProjectPortalApp::UPLOAD_SALES_ORDER);
    }

    /**
     * @description SECURITY: an application cannot allow a format a browser runs as a page - the
     *   blocked extensions are dropped from its profile.
     * @input apps = [test manifest with a profile allowing pdf, svg, html, xml, js, png].
     * @output profile extensions [pdf, png]; the same in GET upload-rules.
     */
    public function test_blocked_extensions_are_dropped(): void
    {
        config(['apps.apps' => [UnsafeUploadApp::class]]);

        $this->assertSame(['pdf', 'png'], AttachmentPolicy::profile('unsafe')['extensions']);
        $this->getJson('/api/upload-rules')->assertOk()->assertJsonPath('data.unsafe.extensions', ['pdf', 'png']);
    }

    /**
     * @description A new attachment stores the morph alias of its owner, the relation resolves it
     *   back; the download is logged into the log of the owning application (the core log for an
     *   owner no application knows).
     * @input sales order with an attachment; signed download; an attachment with an unknown type.
     * @output attachable_type 'sales_order'; attachable is the order; 1 ProjectPortalLog row
     *   attachment_download 'of SalesOrder #id'; unknown owner → 1 CoreLog row.
     */
    public function test_attachments_use_morph_aliases_and_the_owner_log(): void
    {
        Storage::fake('private');
        $order = $this->salesOrder();
        $attachment = $this->attach($order, 'web/sales_orders/a.pdf');

        $this->assertSame('sales_order', DB::table('core_attachments')->where('id', $attachment->id)->value('attachable_type'));
        $this->assertTrue(CoreAttachment::find($attachment->id)->attachable->is($order));

        $this->get(URL::temporarySignedRoute('attachments.download', now()->addMinutes(5), ['path' => 'web/sales_orders/a.pdf']))->assertOk();
        $log = ProjectPortalLog::where('event_type', 'attachment_download')->sole();
        $this->assertStringContainsString("of SalesOrder #{$order->id}", $log->description);

        Storage::disk('private')->put('x/b.pdf', 'b');
        DB::table('core_attachments')->insert(['attachable_type' => 'removed_thing', 'attachable_id' => 1, 'disk' => 'private', 'path' => 'x/b.pdf',
            'original_filename' => 'b.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 1]);
        $this->get(URL::temporarySignedRoute('attachments.download', now()->addMinutes(5), ['path' => 'x/b.pdf']))->assertOk();
        $this->assertSame(1, CoreLog::where('event_type', 'attachment_download')->count());
    }

    /**
     * @description The calendar offers only the registered applications: without the portal its
     *   events and reminders disappear, the e-shop and the core stay.
     * @input apps = [shop]; sysadmin; a project with a deadline in the range.
     * @output modules [personal, shop, core]; no project_deadline event; the portal constants still
     *   describe the portal source (follow-up after 14 days).
     */
    public function test_calendar_follows_the_registered_applications(): void
    {
        config(['apps.apps' => [ShopApp::class]]);
        $this->project(['estimated_completion_to' => now()->addDays(3)->toDateString()]);
        $this->signIn($this->sysadmin());

        $data = $this->getJson('/api/core/agenda?from=' . now()->toDateString() . '&to=' . now()->addDays(10)->toDateString())->assertOk()->json('data');

        $this->assertSame(['personal', 'shop', 'core'], $data['modules']);
        $this->assertNotContains('project_deadline', array_column($data['events'], 'type'));
        $this->assertSame(14, ProjectPortalAgendaSource::LEAD_FOLLOW_UP_DAYS);
    }

    /**
     * @description The morph-alias migration converts the class names of existing attachments
     *   and back; it ran while the table still had its former name, so the rename migration is
     *   reverted first (and checked on the way back).
     * @input rows with the former class names of an order and a thread message, one unknown type.
     * @output down of the rename: `web_attachments` / `web_cookie_consents`; up: 'sales_order' /
     *   'project_thread_message', unknown kept; down: class names again; up of the rename:
     *   `core_attachments` / `legal_cookie_consents` with the rows.
     */
    public function test_morph_alias_migration(): void
    {
        $rename = require base_path('database/migrations/2026_11_23_000000_rename_core_attachment_and_consent_tables.php');
        $migration = require base_path('database/migrations/2026_11_21_000001_attachment_morph_aliases.php');
        $rename->down();
        $this->assertTrue(Schema::hasTable('web_attachments') && Schema::hasTable('web_cookie_consents'));
        $this->assertFalse(Schema::hasTable('core_attachments'));
        foreach (['App\\Models\\Web\\WebSalesOrder', 'App\\Models\\Web\\WebProjectThreadMessage', 'Other\\Thing'] as $i => $type) {
            DB::table('web_attachments')->insert(['attachable_type' => $type, 'attachable_id' => $i + 1, 'disk' => 'private', 'path' => "p{$i}", 'original_filename' => 'f', 'mime_type' => 'x', 'size_bytes' => 1]);
        }

        $migration->up();
        $this->assertSame(['sales_order', 'project_thread_message', 'Other\\Thing'], DB::table('web_attachments')->orderBy('id')->pluck('attachable_type')->all());

        $migration->down();
        $this->assertSame(['App\\Models\\Web\\WebSalesOrder', 'App\\Models\\Web\\WebProjectThreadMessage', 'Other\\Thing'], DB::table('web_attachments')->orderBy('id')->pluck('attachable_type')->all());

        $rename->up();
        $this->assertTrue(Schema::hasTable('core_attachments') && Schema::hasTable('legal_cookie_consents'));
        $this->assertFalse(Schema::hasTable('web_attachments') || Schema::hasTable('web_cookie_consents'));
        $this->assertSame(3, DB::table('core_attachments')->count());
    }
}

/**
 * @description Test manifest with the id of the web (a duplicate - skipped).
 */
final class DuplicateWebApp extends AppManifest
{
    /** @description Same id as the web. */
    public function id(): string
    {
        return 'web';
    }

    /** @description Test tab permission. */
    public function tabPermission(): string
    {
        return 'view-duplicate';
    }

    /** @description Any log model. */
    public function logModel(): string
    {
        return CoreLog::class;
    }
}

/**
 * @description Test manifest whose upload profile lists dangerous extensions.
 */
final class UnsafeUploadApp extends AppManifest
{
    /** @description Test id. */
    public function id(): string
    {
        return 'unsafe';
    }

    /** @description Test tab permission. */
    public function tabPermission(): string
    {
        return 'view-unsafe';
    }

    /** @description Any log model. */
    public function logModel(): string
    {
        return CoreLog::class;
    }

    /** @description A profile with formats a browser runs as a page. */
    public function uploadProfiles(): array
    {
        return ['unsafe' => ['extensions' => ['pdf', 'svg', 'html', 'xml', 'js', 'png'], 'max_files' => 1, 'max_file_kb' => 100, 'max_total_bytes' => null]];
    }
}
