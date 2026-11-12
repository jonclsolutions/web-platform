<?php

/**
 * @file HousekeepingTest.php
 * @path api/tests/Feature/Core/HousekeepingTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the scheduled clean-ups that keep the database and the disk from
 *   growing for ever: `auth:prune` (expired / used authentication rows, expired cache rows),
 *   `storage:prune-orphans` (uploaded files without a record) and the `audit_logs` retention
 *   (audit logs of the three modules and finished import batches).
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake; Carbon test time.
 */

namespace Tests\Feature\Core;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreImportBatch;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRetentionSetting;
use App\Models\PasswordResetToken;
use App\Models\RefreshToken;
use App\Models\Shop\ShopLog;
use App\Models\TwoFactorCode;
use App\Models\Web\WebLog;
use App\Services\Retention\RetentionPurgeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description Scheduled clean-ups of rolling data and orphan files.
 */
class HousekeepingTest extends TestCase
{
    use WebFixtures;

    /**
     * @description auth:prune deletes the rows expired or used more than a day ago and keeps the
     *   valid ones and those of a login in progress; with the database cache store it deletes the
     *   expired cache rows; with another store the cache is left alone.
     * @input Per table one old (expired 2 days ago / used 2 days ago) and one valid row; cache
     *   rows expired / valid; then the array store.
     * @output Only the valid rows stay; 1 cache row stays; counts printed.
     */
    public function test_auth_prune_removes_expired_and_used_rows(): void
    {
        $user = $this->user();
        $old = Carbon::now()->subDays(2);
        $later = Carbon::now()->addMinutes(10);
        $row = fn (string $hash, array $extra) => ['user_id' => $user->id, 'login_token_hash' => $hash, 'code_hash' => $hash] + $extra;

        TwoFactorCode::create($row('a', ['expires_at' => $old]));
        TwoFactorCode::create($row('b', ['expires_at' => $later, 'used_at' => $old]));
        TwoFactorCode::create($row('c', ['expires_at' => $later]));
        PasswordResetToken::create(['user_id' => $user->id, 'token_hash' => 'r1', 'expires_at' => $old]);
        PasswordResetToken::create(['user_id' => $user->id, 'token_hash' => 'r2', 'expires_at' => $later]);
        AccountActivationToken::create(['user_id' => $user->id, 'token_hash' => 'a1', 'expires_at' => $old]);
        AccountActivationToken::create(['user_id' => $user->id, 'token_hash' => 'a2', 'expires_at' => $later]);
        RefreshToken::create(['user_id' => $user->id, 'token' => 't1', 'expires_at' => $old]);
        RefreshToken::create(['user_id' => $user->id, 'token' => 't2', 'expires_at' => $later]);

        Schema::create('cache', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->mediumText('value');
            $t->integer('expiration');
        });
        DB::table('cache')->insert([
            ['key' => 'old', 'value' => 'x', 'expiration' => Carbon::now()->subMinute()->getTimestamp()],
            ['key' => 'new', 'value' => 'x', 'expiration' => Carbon::now()->addHour()->getTimestamp()],
        ]);
        config(['cache.default' => 'database']);

        $this->artisan('auth:prune')->expectsOutputToContain('two_factor_codes')->assertSuccessful();

        $this->assertSame(['c'], TwoFactorCode::pluck('code_hash')->all());
        $this->assertSame(['r2'], PasswordResetToken::pluck('token_hash')->all());
        $this->assertSame(['a2'], AccountActivationToken::pluck('token_hash')->all());
        $this->assertSame(['t2'], RefreshToken::pluck('token')->all());
        $this->assertSame(['new'], DB::table('cache')->pluck('key')->all());

        config(['cache.default' => 'array']);
        DB::table('cache')->update(['expiration' => 0]);
        $this->artisan('auth:prune')->assertSuccessful();
        $this->assertSame(1, DB::table('cache')->count());
    }

    /**
     * @description storage:prune-orphans deletes only files of the upload folders that no
     *   attachment row refers to and that are older than a day; --dry-run deletes nothing.
     * @input private disk: an attached old CV, an orphan old CV, an orphan fresh order file, an
     *   old file outside the upload folders; --dry-run; run.
     * @output dry run: "Files without a record: 1", all files kept; run: only the old orphan gone.
     */
    public function test_orphan_files_are_deleted(): void
    {
        $disk = Storage::fake('private');
        $application = $this->jobApplication();
        $this->attach($application, 'web/cv_files/kept.pdf');
        foreach (['web/cv_files/orphan.pdf', 'web/sales_orders/fresh.pdf', 'other/old.txt'] as $path) {
            $disk->put($path, 'x');
        }
        foreach (['web/cv_files/kept.pdf', 'web/cv_files/orphan.pdf', 'other/old.txt'] as $path) {
            touch($disk->path($path), Carbon::now()->subDays(2)->getTimestamp());
        }

        $this->artisan('storage:prune-orphans', ['--dry-run' => true])->expectsOutput('Files without a record: 1')->assertSuccessful();
        $disk->assertExists('web/cv_files/orphan.pdf');

        $this->artisan('storage:prune-orphans')->expectsOutput('Deleted files without a record: 1')->assertSuccessful();
        $disk->assertMissing('web/cv_files/orphan.pdf');
        $disk->assertExists('web/cv_files/kept.pdf');
        $disk->assertExists('web/sales_orders/fresh.pdf');
        $disk->assertExists('other/old.txt');
    }

    /**
     * @description The audit_logs retention deletes log rows of all three modules and finished
     *   import batches created before the cut-off (in batches), keeps younger rows and unfinished
     *   batches; switched off it deletes nothing.
     * @input Per log table one row 800 days and one 10 days old; a completed and a validated batch
     *   800 days old; purge('audit_logs', now - 730 days); retention off + purgeAll().
     * @output 4 deleted; one row per log table left; the validated batch kept; off -> null.
     */
    public function test_audit_logs_retention(): void
    {
        foreach ([CoreLog::class, WebLog::class, ShopLog::class] as $model) {
            foreach ([800, 10] as $days) {
                $log = $model::create(['event_type' => 'update', 'module' => 'Test', 'description' => 'x', 'origin' => '127.0.0.1']);
                DB::table($log->getTable())->where('id', $log->id)->update(['created_at' => Carbon::now()->subDays($days)]);
            }
        }
        foreach (['completed', 'validated'] as $status) {
            $batch = CoreImportBatch::create(['resource' => 'web_sales_leads', 'format' => 'csv', 'status' => $status]);
            DB::table('core_import_batches')->where('id', $batch->id)->update(['created_at' => Carbon::now()->subDays(800)]);
        }

        $deleted = app(RetentionPurgeService::class)->purge('audit_logs', Carbon::now()->subDays(CoreRetentionSetting::DEFAULTS['audit_logs']));

        $this->assertSame(4, $deleted);
        $this->assertSame([1, 1, 1], [CoreLog::count(), WebLog::count(), ShopLog::count()]);
        $this->assertSame(['validated'], CoreImportBatch::pluck('status')->all());

        CoreRetentionSetting::allInOrder();
        CoreRetentionSetting::where('data_key', 'audit_logs')->update(['retention_days' => null]);
        $this->assertNull(app(RetentionPurgeService::class)->purgeAll()['audit_logs']);
    }
}
