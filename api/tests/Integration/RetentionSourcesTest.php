<?php

/**
 * @file RetentionSourcesTest.php
 * @path api/tests/Integration/RetentionSourcesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the retention module registry (VT-18): unknown keys are refused by the
 *   core and the module sources, the e-shop source contributes only its log, an invalid config
 *   entry is skipped and a failing clean-up of a module does not stop the purge.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema).
 */

namespace Tests\Integration;

use App\Apps\Shop\Models\ShopLog;
use App\Services\Retention\RetentionPurgeService;
use App\Services\Retention\RetentionSource;
use App\Apps\Shop\Services\ShopRetentionSource;
use App\Apps\ProjectPortal\ProjectPortalApp;
use App\Apps\ProjectPortal\Services\ProjectPortalRetentionSource;
use App\Apps\Web\WebApp;
use App\Apps\Web\Services\WebRetentionSource;
use App\Support\Apps\AppManifest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * @description App\Services\Retention\RetentionPurgeService registry + module sources.
 */
class RetentionSourcesTest extends TestCase
{
    /**
     * @description A key no registered module declares is refused - by the core and by each source.
     * @input purge('unknown') on the service, the web, e-shop and project portal sources.
     * @output InvalidArgumentException ×4.
     */
    public function test_unknown_keys_are_refused(): void
    {
        foreach ([app(RetentionPurgeService::class), new WebRetentionSource(), new ShopRetentionSource(), new ProjectPortalRetentionSource()] as $target) {
            try {
                $target->purge('unknown', Carbon::now());
                $this->fail('No exception for ' . $target::class);
            } catch (InvalidArgumentException $e) {
                $this->assertStringContainsString('unknown', $e->getMessage());
            }
        }
    }

    /**
     * @description The e-shop has no kinds of data and no clean-up, only its audit log.
     * @input ShopRetentionSource.
     * @output defaults [], cleanUp [], auditLogModels [ShopLog].
     */
    public function test_shop_source_contributes_only_its_log(): void
    {
        $source = new ShopRetentionSource();
        $this->assertSame([], $source->defaults());
        $this->assertSame([], $source->cleanUp());
        $this->assertSame([ShopLog::class], $source->auditLogModels());
    }

    /**
     * @description Only existing RetentionSource classes of existing manifests are used; other
     *   entries are skipped.
     * @input apps = [missing manifest, a non-manifest class, a number, test manifest listing
     *   web source + missing class + a non-source class].
     * @output one source (the web source).
     */
    public function test_invalid_config_entries_are_skipped(): void
    {
        config(['apps.apps' => ['App\\Missing\\GoneApp', \stdClass::class, 5, MixedSourcesApp::class]]);

        $sources = RetentionPurgeService::sources();
        $this->assertCount(1, $sources);
        $this->assertInstanceOf(WebRetentionSource::class, $sources[0]);
    }

    /**
     * @description A module whose clean-up fails is reported, the others still run.
     * @input apps = [manifest of the failing test source, project portal].
     * @output failedKeys ['FailingRetentionSource:clean_up']; result has expired_portal_sessions 0;
     *   Log::error 'Retention purge failed'.
     */
    public function test_failing_clean_up_is_isolated(): void
    {
        config(['apps.apps' => [FailingApp::class, ProjectPortalApp::class]]);
        Log::spy();

        $service = app(RetentionPurgeService::class);
        $result = $service->purgeAll();

        $this->assertSame(['FailingRetentionSource:clean_up'], $service->failedKeys());
        $this->assertSame(0, $result['expired_portal_sessions']);
        Log::shouldHaveReceived('error')->withArgs(fn ($message) => $message === 'Retention purge failed');
    }
}

/**
 * @description Test source whose always-run clean-up fails.
 */
final class FailingRetentionSource implements RetentionSource
{
    /** @description No kinds of data. */
    public function defaults(): array
    {
        return [];
    }

    /** @description Never called (no keys). */
    public function purge(string $key, Carbon $cutoff): int
    {
        return 0;
    }

    /** @description No log. */
    public function auditLogModels(): array
    {
        return [];
    }

    /** @description Always fails. */
    public function cleanUp(): array
    {
        throw new \RuntimeException('clean-up failed');
    }
}

/**
 * @description Test manifest: the failing source only.
 */
final class FailingApp extends AppManifest
{
    /** @description Test id. */
    public function id(): string
    {
        return 'failing';
    }

    /** @description Test tab permission. */
    public function tabPermission(): string
    {
        return 'view-failing';
    }

    /** @description Any log model (not used). */
    public function logModel(): string
    {
        return ShopLog::class;
    }

    /** @description The failing source. */
    public function retentionSources(): array
    {
        return [FailingRetentionSource::class];
    }
}

/**
 * @description Test manifest listing a valid source next to invalid entries.
 */
final class MixedSourcesApp extends AppManifest
{
    /** @description Test id. */
    public function id(): string
    {
        return 'mixed';
    }

    /** @description Test tab permission. */
    public function tabPermission(): string
    {
        return 'view-mixed';
    }

    /** @description Any log model (not used). */
    public function logModel(): string
    {
        return ShopLog::class;
    }

    /** @description Web source, a missing class and a class that is no source. */
    public function retentionSources(): array
    {
        return [WebRetentionSource::class, 'App\\Missing\\Gone', \stdClass::class];
    }
}
