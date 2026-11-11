<?php

/**
 * @file RetentionSourcesTest.php
 * @path api/tests/Unit/Core/RetentionSourcesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the retention module registry (VT-18): unknown keys are refused by the
 *   core and the module sources, the e-shop source contributes only its log, an invalid config
 *   entry is skipped and a failing clean-up of a module does not stop the purge.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema).
 */

namespace Tests\Unit\Core;

use App\Models\Shop\ShopLog;
use App\Services\Retention\RetentionPurgeService;
use App\Services\Retention\RetentionSource;
use App\Services\Shop\ShopRetentionSource;
use App\Services\Web\WebRetentionSource;
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
     * @input purge('unknown') on the service, the web source and the e-shop source.
     * @output InvalidArgumentException ×3.
     */
    public function test_unknown_keys_are_refused(): void
    {
        foreach ([app(RetentionPurgeService::class), new WebRetentionSource(), new ShopRetentionSource()] as $target) {
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
     * @description Only existing RetentionSource classes are used; other config entries are skipped.
     * @input sources = [web source, missing class, a non-source class, a number].
     * @output one source (the web source).
     */
    public function test_invalid_config_entries_are_skipped(): void
    {
        config(['retention.sources' => [WebRetentionSource::class, 'App\\Missing\\Gone', \stdClass::class, 5]]);

        $sources = RetentionPurgeService::sources();
        $this->assertCount(1, $sources);
        $this->assertInstanceOf(WebRetentionSource::class, $sources[0]);
    }

    /**
     * @description A module whose clean-up fails is reported, the others still run.
     * @input sources = [failing test source, web source].
     * @output failedKeys ['FailingRetentionSource:clean_up']; result has expired_portal_sessions 0;
     *   Log::error 'Retention purge failed'.
     */
    public function test_failing_clean_up_is_isolated(): void
    {
        config(['retention.sources' => [FailingRetentionSource::class, WebRetentionSource::class]]);
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
