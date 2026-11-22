<?php

/**
 * @file OutputTest.php
 * @path api/tests/Apps/JsCreator/Feature/OutputTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the generated outputs (OutputController, OutputImage, FileController,
 *   FolderTree with outputs): generating (PNG check, conversion to PNG / JPG, thumbnail, quota,
 *   template and folder of the own workspace), list (folder, search, sorting), rename / move,
 *   trash (also with a deleted folder), bulk actions, ZIP, signed files, the isolation of
 *   workspaces (another account and the sysadmin), usage, retention and the audit log without
 *   names or texts.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk, GD, ZipArchive.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorOutputFile;
use App\Apps\JsCreator\Models\CreatorSetting;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\JsCreatorRetentionSource;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;
use ZipArchive;

/**
 * @description /api/js-creator/images/outputs, /api/js-creator/outputs and /api/js-creator/files/outputs|zip.
 */
class OutputTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Generating in the section Images. */
    private const GENERATE = '/api/js-creator/images/outputs';

    /** @description The outputs of every section. */
    private const BASE = '/api/js-creator/outputs';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description Generating stores the PNG re-encoded with a WebP thumbnail, the text of the
     *   post and the name of the template; a JPG template gets a JPEG laid over white; an empty
     *   name becomes the template and the time; the log names only ids.
     * @input template 200×100 PNG; PNG 200×100 with name and caption; template switched to JPG 80
     *   and a fully transparent PNG; no name.
     * @output 201 with urls; stored PNG 200×100 and WebP thumbnail, size_bytes = both; JPEG
     *   200×100 white; name "Promo 2026-11-22 10:30"; log "Output #id generated from template #t"
     *   without the name and the caption.
     */
    public function test_generate_png_and_jpg(): void
    {
        Carbon::setTestNow('2026-11-22 10:30:00');
        $user = $this->signIn($this->creator());
        $template = $this->template('Promo');

        $response = $this->generate($template, $this->png(200, 100, 'output.png'), ['name' => 'Summer sale', 'caption' => "Big sale!\n#summer"])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Summer sale')->assertJsonPath('data.caption', "Big sale!\n#summer")
            ->assertJsonPath('data.template_id', $template)->assertJsonPath('data.template_name', 'Promo')
            ->assertJsonPath('data.folder_id', null)->assertJsonPath('data.format', 'png')
            ->assertJsonPath('data.width', 200)->assertJsonPath('data.height', 100)->assertJsonPath('data.section', 'images');
        $this->assertNotNull($response->json('data.url'));
        $this->assertNotNull($response->json('data.thumb_url'));
        $this->assertNotNull($response->json('data.download_url'));

        $output = CreatorOutput::with('files')->find($response->json('data.id'));
        $file = $output->files->first();
        $png = Storage::disk('private')->get($file->path);
        $thumb = Storage::disk('private')->get($file->thumb_path);
        $info = getimagesizefromstring($png);
        $this->assertSame(['image/png', 200, 100], [$info['mime'], $info[0], $info[1]]);
        $this->assertSame('image/webp', getimagesizefromstring($thumb)['mime']);
        $this->assertSame(strlen($png) + strlen($thumb), $output->size_bytes);
        $this->assertSame($output->size_bytes, WorkspaceQuota::usedBytes($user->id));
        $this->assertStringStartsWith("js-creator/{$user->id}/outputs/", $file->path);

        CreatorTemplate::query()->whereKey($template)->update(['output_format' => 'jpg', 'output_quality' => 80]);
        $jpg = $this->generate($template, $this->png(200, 100, 'output.png', 127))->assertCreated()
            ->assertJsonPath('data.format', 'jpg')->assertJsonPath('data.name', 'Promo 2026-11-22 10:30');
        $stored = Storage::disk('private')->get(CreatorOutput::with('files')->find($jpg->json('data.id'))->files->first()->path);
        $this->assertSame('image/jpeg', getimagesizefromstring($stored)['mime']);
        $pixel = imagecolorsforindex($image = imagecreatefromstring($stored), imagecolorat($image, 100, 50));
        $this->assertGreaterThan(245, $pixel['red'] + 0);
        $this->assertGreaterThan(245, $pixel['blue'] + 0);

        $log = JsCreatorLog::query()->where('affected_entity_type', 'Output')->where('affected_entity_id', $output->id)->first();
        $this->assertSame("Output #{$output->id} generated from template #{$template}", $log?->description);
        $logs = JsCreatorLog::query()->get()->toJson();
        $this->assertStringNotContainsString('Summer sale', $logs);
        $this->assertStringNotContainsString('Big sale', $logs);
        $this->assertStringNotContainsString('output.png', $logs);
        Carbon::setTestNow();
    }

    /**
     * @description Generating refuses a picture of another size, a file that is not a PNG, a
     *   template or folder that is not own / is in the trash, a full workspace and an account
     *   without the create permission.
     * @input wrong size; JPEG named .png; text file; template of another account; template in the
     *   trash; folder of another account; folder in the trash; quota of 1 MB filled; view-only account.
     * @output 422 file / template_id / folder_id / quota_exceeded; 403; nothing stored.
     */
    public function test_generate_is_validated(): void
    {
        $other = $this->creator();
        $otherTemplate = CreatorTemplate::query()->create($this->templateRow($other, 'Theirs'));
        $otherFolder = CreatorFolder::create(['user_id' => $other->id, 'parent_id' => null, 'name' => 'Theirs']);

        $user = $this->signIn($this->creator());
        $template = $this->template('Mine');

        $this->generate($template, $this->png(201, 100, 'output.png'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $jpeg = imagecreatetruecolor(200, 100);
        ob_start();
        imagejpeg($jpeg);
        $this->generate($template, UploadedFile::fake()->createWithContent('output.png', (string) ob_get_clean()))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->generate($template, UploadedFile::fake()->createWithContent('output.png', 'not an image'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->generate($otherTemplate->id, $this->png(200, 100))->assertUnprocessable()->assertJsonValidationErrors('template_id');
        $this->generate($template, $this->png(200, 100), ['folder_id' => $otherFolder->id])->assertUnprocessable()->assertJsonValidationErrors('folder_id');
        $trashedFolder = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => null, 'name' => 'Old']);
        $this->deleteJson("/api/js-creator/folders/{$trashedFolder->id}")->assertNoContent();
        $this->generate($template, $this->png(200, 100), ['folder_id' => $trashedFolder->id])->assertUnprocessable()->assertJsonValidationErrors('folder_id');
        $trashed = $this->template('Trashed');
        CreatorTemplate::query()->whereKey($trashed)->first()->delete();
        $this->generate($trashed, $this->png(200, 100))->assertUnprocessable()->assertJsonValidationErrors('template_id');

        CreatorSetting::query()->create(['default_quota_mb' => 1]);
        CreatorTemplate::query()->whereKey($template)->update(['thumb_bytes' => WorkspaceQuota::MB]);
        $this->generate($template, $this->png(200, 100))->assertUnprocessable()->assertJsonPath('error_code', 'quota_exceeded');
        $this->assertSame(0, CreatorOutput::count());
        $this->assertSame([], Storage::disk('private')->allFiles("js-creator/{$user->id}/outputs"));

        $this->signIn($this->creator(['view']));
        $this->generate($template, $this->png(200, 100))->assertForbidden();
    }

    /**
     * @description The list shows the outputs of one folder (none = the top level), a search
     *   looks into every folder, sorting works; another account and the sysadmin never see or
     *   change an output (404 / count 0).
     * @input outputs "Alpha" (top), "Beta" and "Gamma" (folder); requests of another account and
     *   of the sysadmin.
     * @output top 1, folder 2, search "a" 3, sort by name; intruders: empty list, 404 for update /
     *   delete / restore / files of the list, bulk count 0, ZIP 422.
     */
    public function test_list_and_isolation(): void
    {
        $owner = $this->signIn($this->creator());
        $template = $this->template('T');
        $folder = CreatorFolder::create(['user_id' => $owner->id, 'parent_id' => null, 'name' => 'Campaign']);
        $alpha = $this->makeOutput($template, 'Alpha');
        $this->makeOutput($template, 'Beta', $folder->id);
        $this->makeOutput($template, 'Gamma', $folder->id);

        $this->getJson(self::BASE)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha');
        $this->getJson(self::BASE . "?folder_id={$folder->id}&sort_by=name&sort_direction=asc")->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Beta')->assertJsonPath('data.1.name', 'Gamma');
        $this->getJson(self::BASE . '?search=a&sort_by=name&sort_direction=desc')->assertJsonCount(3, 'data')->assertJsonPath('data.0.name', 'Gamma');
        $this->getJson(self::BASE . '?section=images')->assertJsonCount(1, 'data');

        foreach ([$this->creator(), $this->sysadmin()] as $intruder) {
            $this->signIn($intruder);
            $this->getJson(self::BASE . '?search=a')->assertOk()->assertJsonCount(0, 'data');
            $this->getJson(self::BASE . "?folder_id={$folder->id}")->assertJsonCount(0, 'data');
            $this->putJson(self::BASE . "/{$alpha}", ['name' => 'Hacked'])->assertNotFound();
            $this->deleteJson(self::BASE . "/{$alpha}")->assertNotFound();
            $this->postJson(self::BASE . "/{$alpha}/restore")->assertNotFound();
            $this->postJson(self::BASE . '/bulk', ['action' => 'delete', 'ids' => [$alpha]])->assertOk()->assertJsonPath('data.count', 0);
            $this->postJson(self::BASE . '/zip', ['ids' => [$alpha]])->assertUnprocessable();
        }
        $this->assertSame('Alpha', CreatorOutput::find($alpha)->name);
    }

    /**
     * @description Rename and move; a move to a folder that is not own fails; delete to the trash,
     *   restore (to the top level when its folder is in the trash), delete for good with the
     *   files, empty the trash.
     * @input output in a folder; second output.
     * @output renamed + moved; 422 folder_id; trash lists 1; restored to the top level; files
     *   deleted; trash empty; log without names.
     */
    public function test_rename_move_and_trash(): void
    {
        $user = $this->signIn($this->creator());
        $template = $this->template('T');
        $folder = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => null, 'name' => 'A']);
        $target = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => null, 'name' => 'B']);
        $foreign = CreatorFolder::create(['user_id' => $this->creator()->id, 'parent_id' => null, 'name' => 'X']);
        $id = $this->makeOutput($template, 'First', $folder->id);
        $second = $this->makeOutput($template, 'Second');

        $this->putJson(self::BASE . "/{$id}", ['name' => 'Renamed post'])->assertOk()->assertJsonPath('data.name', 'Renamed post');
        $this->putJson(self::BASE . "/{$id}", ['folder_id' => $target->id])->assertOk()->assertJsonPath('data.folder_id', $target->id);
        $this->putJson(self::BASE . "/{$id}", ['folder_id' => $foreign->id])->assertUnprocessable()->assertJsonValidationErrors('folder_id');
        $this->putJson(self::BASE . "/{$id}", ['name' => ''])->assertUnprocessable();

        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->getJson(self::BASE . "?folder_id={$target->id}")->assertJsonCount(0, 'data');
        $this->getJson(self::BASE . '?only_trashed=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
        $this->deleteJson("/api/js-creator/folders/{$target->id}")->assertNoContent();
        $this->postJson(self::BASE . "/{$id}/restore")->assertOk()->assertJsonPath('data.folder_id', null);

        $paths = CreatorOutputFile::query()->where('output_id', $second)->get()->flatMap(fn ($f) => [$f->path, $f->thumb_path])->all();
        $this->deleteJson(self::BASE . "/{$second}")->assertNoContent();
        $this->deleteJson(self::BASE . "/{$second}?force=1")->assertNoContent();
        foreach ($paths as $path) {
            Storage::disk('private')->assertMissing($path);
        }
        $this->assertNull(CreatorOutput::withTrashed()->find($second));

        $this->deleteJson(self::BASE . "/{$id}")->assertNoContent();
        $this->deleteJson(self::BASE . "/{$id}?force=0")->assertNotFound();
        $this->deleteJson(self::BASE . '/trash')->assertNoContent();
        $this->assertSame(0, CreatorOutput::withTrashed()->count());
        $this->assertStringNotContainsString('Renamed post', JsCreatorLog::query()->get()->toJson());
    }

    /**
     * @description A deleted folder takes its outputs to the trash (they are not separate items of
     *   the output trash), a restore brings them back, a permanent deletion removes them with the
     *   files; an output deleted by itself before stays in the trash and goes to the top level.
     * @input folder with a subfolder, output in each; one more output deleted by itself first.
     * @output folder trashed → outputs hidden, trash items 1 (the own one); restore → 2 back;
     *   trash + force → rows and files gone, the own trash item keeps folder_id null.
     */
    public function test_folder_trash_carries_its_outputs(): void
    {
        $user = $this->signIn($this->creator());
        $template = $this->template('T');
        $root = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => null, 'name' => 'Root']);
        $sub = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => $root->id, 'name' => 'Sub']);
        $inRoot = $this->makeOutput($template, 'In root', $root->id);
        $inSub = $this->makeOutput($template, 'In sub', $sub->id);
        $own = $this->makeOutput($template, 'Own', $sub->id);
        $this->deleteJson(self::BASE . "/{$own}")->assertNoContent();

        $this->deleteJson("/api/js-creator/folders/{$root->id}")->assertNoContent();
        $this->getJson(self::BASE . '?search=in')->assertJsonCount(0, 'data');
        $this->getJson(self::BASE . '?only_trashed=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own);
        $this->assertSame($root->id, CreatorOutput::withTrashed()->find($inSub)->trash_root_id);

        $this->postJson("/api/js-creator/folders/{$root->id}/restore")->assertOk();
        $this->getJson(self::BASE . "?folder_id={$sub->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inSub);
        $this->assertNull(CreatorOutput::find($inRoot)->trash_root_id);

        $paths = CreatorOutputFile::query()->whereIn('output_id', [$inRoot, $inSub])->get()->flatMap(fn ($f) => [$f->path, $f->thumb_path])->all();
        $this->deleteJson("/api/js-creator/folders/{$root->id}")->assertNoContent();
        $this->deleteJson("/api/js-creator/folders/{$root->id}?force=1")->assertNoContent();
        $this->assertSame(0, CreatorOutput::withTrashed()->whereIn('id', [$inRoot, $inSub])->count());
        foreach ($paths as $path) {
            Storage::disk('private')->assertMissing($path);
        }
        $this->assertNull(CreatorOutput::withTrashed()->find($own)->folder_id);
        $this->postJson(self::BASE . "/{$own}/restore")->assertOk()->assertJsonPath('data.folder_id', null);
    }

    /**
     * @description Bulk actions change only own outputs reachable for the action; a move needs the
     *   update permission, the trash actions the delete permission.
     * @input 3 own outputs + 1 of another account; folder; account with view + update only.
     * @output move 3 (foreign skipped); delete 3; restore 2; destroy 1; the update-only account may
     *   move but gets 403 for delete; 422 for a foreign target folder.
     */
    public function test_bulk_actions(): void
    {
        $other = $this->creator();
        $foreign = CreatorOutput::query()->create($this->outputRow($other, 'Foreign'));
        $user = $this->signIn($this->creator());
        $template = $this->template('T');
        $folder = CreatorFolder::create(['user_id' => $user->id, 'parent_id' => null, 'name' => 'Target']);
        $ids = [$this->makeOutput($template, 'A'), $this->makeOutput($template, 'B'), $this->makeOutput($template, 'C')];

        $this->postJson(self::BASE . '/bulk', ['action' => 'move', 'ids' => [...$ids, $foreign->id], 'folder_id' => $folder->id])
            ->assertOk()->assertJsonPath('data.count', 3);
        $this->assertSame(3, CreatorOutput::query()->where('folder_id', $folder->id)->count());
        $this->postJson(self::BASE . '/bulk', ['action' => 'move', 'ids' => $ids, 'folder_id' => CreatorFolder::create(['user_id' => $other->id, 'parent_id' => null, 'name' => 'X'])->id])
            ->assertUnprocessable();
        $this->postJson(self::BASE . '/bulk', ['action' => 'delete', 'ids' => $ids])->assertOk()->assertJsonPath('data.count', 3);
        $this->postJson(self::BASE . '/bulk', ['action' => 'restore', 'ids' => [$ids[0], $ids[1]]])->assertOk()->assertJsonPath('data.count', 2);
        $this->postJson(self::BASE . '/bulk', ['action' => 'destroy', 'ids' => $ids])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertSame(2, CreatorOutput::query()->ownedBy($user)->count());
        $this->assertNotNull(CreatorOutput::find($foreign->id));
        $this->postJson(self::BASE . '/bulk', ['action' => 'nope', 'ids' => $ids])->assertUnprocessable();
        $this->postJson(self::BASE . '/bulk', ['action' => 'delete', 'ids' => range(1, 201)])->assertUnprocessable();

        $editor = $this->signIn($this->creator(['view', 'update']));
        $mine = CreatorOutput::query()->create($this->outputRow($editor, 'Mine'));
        $this->postJson(self::BASE . '/bulk', ['action' => 'move', 'ids' => [$mine->id], 'folder_id' => null])->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson(self::BASE . '/bulk', ['action' => 'delete', 'ids' => [$mine->id]])->assertForbidden();
    }

    /**
     * @description Files of an output are reachable only through their signed URLs: the picture
     *   inline, the thumbnail as WebP, the download as an attachment named after the output; a
     *   ZIP contains the chosen own outputs with unique names and no outputs of the trash.
     * @input two outputs named "Post" (PNG + JPG), one in the trash; ZIP of all three.
     * @output inline image/png with nosniff; image/webp; attachment "Post.png"; changed URL 403;
     *   ZIP entries "Post.jpg", "Post.png" … without the trashed one; changed ids 403.
     */
    public function test_files_and_zip(): void
    {
        $this->signIn($this->creator());
        $template = $this->template('T');
        $png = $this->generate($template, $this->png(200, 100), ['name' => 'Post'])->json('data');
        CreatorTemplate::query()->whereKey($template)->update(['output_format' => 'jpg']);
        $jpg = $this->generate($template, $this->png(200, 100), ['name' => 'Post'])->json('data');
        $trashed = $this->makeOutput($template, 'Trashed');
        $this->deleteJson(self::BASE . "/{$trashed}")->assertNoContent();

        $this->get($png['url'])->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->get($png['thumb_url'])->assertOk()->assertHeader('Content-Type', 'image/webp');
        $download = $this->get($png['download_url'])->assertOk();
        $this->assertStringContainsString('attachment', (string) $download->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Post.png', (string) $download->headers->get('Content-Disposition'));
        $this->get($png['url'] . 'x')->assertForbidden();

        $url = $this->postJson(self::BASE . '/zip', ['ids' => [$png['id'], $jpg['id'], $trashed]])->assertOk()
            ->assertJsonPath('data.count', 2)->json('data.url');
        $this->get(str_replace('ids=', 'ids=' . $trashed . '%2C', $url))->assertForbidden();
        $response = $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/zip');
        $path = tempnam(sys_get_temp_dir(), 'zip-test');
        file_put_contents($path, $response->streamedContent() ?: file_get_contents($response->baseResponse->getFile()->getPathname()));
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($path) === true);
        $names = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $names[] = $zip->getNameIndex($i);
        }
        $zip->close();
        unlink($path);
        $this->assertEqualsCanonicalizing(['Post.png', 'Post.jpg'], $names);

        CreatorOutput::query()->whereKey($png['id'])->update(['size_bytes' => 600 * 1024 * 1024]);
        $this->postJson(self::BASE . '/zip', ['ids' => [$png['id']]])->assertUnprocessable();
    }

    /**
     * @description Outputs count towards the usage, the trash and the account overview; the
     *   retention deletes outputs of the trash older than the period (and the clean-up keeps the
     *   files of outputs); a template deleted for good leaves its outputs with its name; deleting
     *   an account for good deletes its outputs.
     * @input two outputs, one trashed 31 days ago; template deleted for good; account deleted.
     * @output usage counts.outputs 1, trash_bytes; purge 1 with files; active files kept by the
     *   clean-up; template_id null + template_name kept; no rows after the account deletion.
     */
    public function test_usage_retention_and_deletions(): void
    {
        $user = $this->signIn($this->creator());
        $template = $this->template('Kept name');
        $old = $this->makeOutput($template, 'Old');
        $active = $this->makeOutput($template, 'Active');
        $this->deleteJson(self::BASE . "/{$old}")->assertNoContent();
        $usage = $this->getJson('/api/js-creator/usage')->assertOk();
        $this->assertSame(1, $usage->json('data.counts.outputs'));
        $this->assertSame(CreatorOutput::withTrashed()->find($old)->size_bytes, $usage->json('data.trash_bytes'));

        CreatorOutput::onlyTrashed()->update(['deleted_at' => Carbon::now()->subDays(31)]);
        $oldFile = CreatorOutputFile::query()->where('output_id', $old)->first()->path;
        $this->assertSame(1, (new JsCreatorRetentionSource())->purge('js_creator_trash', Carbon::now()->subDays(30)));
        Storage::disk('private')->assertMissing($oldFile);

        $activeFile = CreatorOutputFile::query()->where('output_id', $active)->first();
        foreach ([$activeFile->path, $activeFile->thumb_path] as $path) {
            touch(Storage::disk('private')->path($path), Carbon::now()->subDays(2)->getTimestamp());
        }
        (new JsCreatorRetentionSource())->cleanUp();
        Storage::disk('private')->assertExists($activeFile->path);
        Storage::disk('private')->assertExists($activeFile->thumb_path);

        CreatorTemplate::query()->whereKey($template)->first()->deleteWithFiles();
        $this->getJson(self::BASE)->assertJsonPath('data.0.template_id', null)->assertJsonPath('data.0.template_name', 'Kept name');

        User::query()->whereKey($user->id)->first()->forceDelete();
        $this->assertSame(0, CreatorOutput::withTrashed()->count());
        $this->assertSame(0, CreatorOutputFile::count());
    }

    /**
     * @description New template of the signed-in account (200×100, PNG).
     * @param string $name Name.
     * @return int Id.
     */
    private function template(string $name): int
    {
        return $this->postJson('/api/js-creator/images/templates', ['name' => $name, 'width' => 200, 'height' => 100])->assertCreated()->json('data.id');
    }

    /**
     * @description Row of a template of an account (created directly, without the API).
     * @param User $user Owner.
     * @param string $name Name.
     * @return array<string, mixed>
     */
    private function templateRow(User $user, string $name): array
    {
        return [
            'user_id' => $user->id, 'section' => 'images', 'name' => $name, 'width' => 200, 'height' => 100, 'schema_version' => 1,
            'document' => $this->document(), 'output_format' => 'png', 'output_quality' => 90, 'version' => 1,
        ];
    }

    /**
     * @description Row of an output of an account without files (created directly).
     * @param User $user Owner.
     * @param string $name Name.
     * @return array<string, mixed>
     */
    private function outputRow(User $user, string $name): array
    {
        return [
            'user_id' => $user->id, 'folder_id' => null, 'section' => 'images', 'name' => $name, 'template_id' => null,
            'template_name' => 'T', 'caption' => null, 'width' => 200, 'height' => 100, 'format' => 'png', 'page_count' => 1, 'size_bytes' => 10,
        ];
    }

    /**
     * @description Sends a generated picture.
     * @param int $template Template.
     * @param UploadedFile $file Picture.
     * @param array<string, mixed> $fields Further fields (name, caption, folder_id).
     * @return \Illuminate\Testing\TestResponse
     */
    private function generate(int $template, UploadedFile $file, array $fields = [])
    {
        return $this->post(self::GENERATE, ['template_id' => $template, 'file' => $file, ...$fields], ['Accept' => 'application/json']);
    }

    /**
     * @description Generates an output through the API.
     * @param int $template Template.
     * @param string $name Name.
     * @param int|null $folderId Folder.
     * @return int Id of the output.
     */
    private function makeOutput(int $template, string $name, ?int $folderId = null): int
    {
        return $this->generate($template, $this->png(200, 100), ['name' => $name, 'folder_id' => $folderId])->assertCreated()->json('data.id');
    }
}
