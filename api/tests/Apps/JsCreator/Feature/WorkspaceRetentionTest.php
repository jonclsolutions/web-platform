<?php

/**
 * @file WorkspaceRetentionTest.php
 * @path api/tests/Apps/JsCreator/Feature/WorkspaceRetentionTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tests of the storage limitation of JS Creator: the trash is emptied after its
 *   period (JsCreatorRetentionSource::purge), files without a record are removed (cleanUp), and
 *   an account deleted for good takes its whole workspace with it (foreign keys), while an
 *   account in the trash keeps it.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorUserQuota;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description Retention and account deletion.
 */
class WorkspaceRetentionTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description Items in the trash longer than the period are deleted for good with their
     *   files; newer items of the trash and items outside it stay.
     * @input image, font and folder subtree trashed 31 days ago; image trashed 5 days ago; active image.
     * @output default 30 days; purge deletes 3 items + files; the rest stays.
     */
    public function test_trash_is_emptied_after_its_period(): void
    {
        $source = new JsCreatorRetentionSource();
        $this->assertSame(['js_creator_trash' => 30], $source->defaults());

        $this->signIn($this->creator());
        $old = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $recent = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $active = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $font = $this->post('/api/js-creator/library/fonts', ['file' => $this->font(), 'family' => 'B', 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])->json('data.id');
        $parent = $this->postJson('/api/js-creator/folders', ['name' => 'P'])->json('data.id');
        $child = $this->postJson('/api/js-creator/folders', ['name' => 'C', 'parent_id' => $parent])->json('data.id');
        foreach (["library/assets/{$old}", "library/assets/{$recent}", "library/fonts/{$font}", "folders/{$parent}"] as $path) {
            $this->deleteJson("/api/js-creator/{$path}")->assertNoContent();
        }
        CreatorAsset::onlyTrashed()->whereKey($old)->update(['deleted_at' => Carbon::now()->subDays(31)]);
        CreatorAsset::onlyTrashed()->whereKey($recent)->update(['deleted_at' => Carbon::now()->subDays(5)]);
        CreatorFont::onlyTrashed()->whereKey($font)->update(['deleted_at' => Carbon::now()->subDays(31)]);
        CreatorFolder::onlyTrashed()->update(['deleted_at' => Carbon::now()->subDays(31)]);
        $oldPath = CreatorAsset::withTrashed()->find($old)->path;

        $this->assertSame(3, $source->purge('js_creator_trash', Carbon::now()->subDays(30)));
        $this->assertNull(CreatorAsset::withTrashed()->find($old));
        Storage::disk('private')->assertMissing($oldPath);
        $this->assertNull(CreatorFont::withTrashed()->find($font));
        $this->assertNull(CreatorFolder::withTrashed()->find($child));
        $this->assertNotNull(CreatorAsset::withTrashed()->find($recent));
        $this->assertNotNull(CreatorAsset::find($active));
    }

    /**
     * @description The clean-up deletes files of the workspaces without a record that are older
     *   than a day; known and fresh files stay.
     * @input stored image; old orphan file; fresh orphan file.
     * @output 1 deleted (the old orphan).
     */
    public function test_clean_up_of_files_without_a_record(): void
    {
        $this->signIn($this->creator());
        $id = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $disk = Storage::disk('private');
        $disk->put('js-creator/999/library/old.png', 'x');
        touch($disk->path('js-creator/999/library/old.png'), Carbon::now()->subDays(2)->getTimestamp());
        $disk->put('js-creator/999/library/fresh.png', 'x');
        $known = CreatorAsset::find($id);
        touch($disk->path($known->path), Carbon::now()->subDays(2)->getTimestamp());

        $this->assertSame(['js_creator_orphan_files' => 1], (new JsCreatorRetentionSource())->cleanUp());
        $disk->assertMissing('js-creator/999/library/old.png');
        $disk->assertExists(['js-creator/999/library/fresh.png', $known->path, $known->thumb_path]);
    }

    /**
     * @description An account in the trash keeps its workspace; deleted for good, the workspace
     *   rows go with it (foreign keys) and its files are cleaned up.
     * @input account with a folder, an image, a font, a quota; soft delete; force delete; clean-up.
     * @output rows kept after soft delete; none after force delete; files removed by the clean-up.
     */
    public function test_workspace_goes_with_the_account(): void
    {
        $owner = $this->signIn($this->creator());
        $this->postJson('/api/js-creator/folders', ['name' => 'A'])->assertCreated();
        $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->assertCreated();
        $this->post('/api/js-creator/library/fonts', ['file' => $this->font(), 'family' => 'B', 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])->assertCreated();
        CreatorUserQuota::create(['user_id' => $owner->id, 'quota_mb' => 10]);

        $owner->delete();
        $this->assertSame(1, CreatorFolder::count());
        $this->assertSame(1, CreatorAsset::count());

        $owner->forceDelete();
        $this->assertSame(0, CreatorFolder::withTrashed()->count() + CreatorAsset::withTrashed()->count() + CreatorFont::withTrashed()->count() + CreatorUserQuota::count());

        $disk = Storage::disk('private');
        foreach ($disk->allFiles('js-creator') as $path) {
            touch($disk->path($path), Carbon::now()->subDays(2)->getTimestamp());
        }
        (new JsCreatorRetentionSource())->cleanUp();
        $this->assertSame([], $disk->allFiles('js-creator'));
    }
}
