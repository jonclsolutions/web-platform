<?php

/**
 * @file LibraryAssetTest.php
 * @path api/tests/Apps/JsCreator/Feature/LibraryAssetTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the images of the library (AssetController, LibraryImage,
 *   FileController): re-encoding (EXIF orientation applied, metadata dropped, transparency kept,
 *   large images scaled down, WebP thumbnail), refused files, the quota, the trash, the signed
 *   file URLs, the isolation of workspaces, the images of a template by their ids and the own
 *   icons (kind icon: PNG / JPG only, at most 1024 px, own list and trash).
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorSetting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/library/assets and /api/js-creator/files/assets.
 */
class LibraryAssetTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description A phone photo is stored upright without its metadata; a thumbnail is WebP.
     * @input JPEG 40×20 with EXIF orientation 6 (red left, blue right) and a camera name.
     * @output 20×40 JPEG, red on top and blue at the bottom, no EXIF / camera name in the file;
     *   thumbnail image/webp; size = image + thumbnail.
     */
    public function test_photo_is_stored_upright_without_metadata(): void
    {
        $this->signIn($this->creator());
        $response = $this->post('/api/js-creator/library/assets', ['files' => [$this->orientedJpeg()]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.0.width', 20)->assertJsonPath('data.0.height', 40)
            ->assertJsonPath('data.0.name', 'photo')->assertJsonPath('data.0.mime', 'image/jpeg');

        $asset = CreatorAsset::findOrFail($response->json('data.0.id'));
        $stored = Storage::disk('private')->get($asset->path);
        $this->assertStringNotContainsString('TestCam', $stored);
        $this->assertStringNotContainsString('Exif', $stored);

        $image = imagecreatefromstring($stored);
        $top = imagecolorsforindex($image, imagecolorat($image, 10, 5));
        $bottom = imagecolorsforindex($image, imagecolorat($image, 10, 35));
        $this->assertGreaterThan(200, $top['red']);
        $this->assertGreaterThan(200, $bottom['blue']);

        $thumb = Storage::disk('private')->get($asset->thumb_path);
        $this->assertSame('image/webp', getimagesizefromstring($thumb)['mime']);
        $this->assertSame(strlen($stored) + strlen($thumb), $asset->size_bytes);
        $this->assertStringStartsWith('js-creator/' . $asset->user_id . '/library/', $asset->path);
    }

    /**
     * @description A transparent PNG stays transparent; an image over 4000 px is scaled down.
     * @input semi-transparent PNG 30×20; PNG 4100×50.
     * @output PNG with alpha at (5,5); 4000×49 (rounded).
     */
    public function test_transparency_and_scaling(): void
    {
        $this->signIn($this->creator());
        $id = $this->post('/api/js-creator/library/assets', ['files' => [$this->png(30, 20, 'logo.png', 100)]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
        $png = imagecreatefromstring(Storage::disk('private')->get(CreatorAsset::find($id)->path));
        $this->assertGreaterThan(90, imagecolorsforindex($png, imagecolorat($png, 5, 5))['alpha']);

        $this->post('/api/js-creator/library/assets', ['files' => [$this->png(4100, 50, 'wide.png')]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.0.width', 4000)->assertJsonPath('data.0.height', 49);
    }

    /**
     * @description Only real JPG / PNG / WebP are accepted; nothing is stored on a refusal.
     * @input text renamed to .png; an SVG; a PNG renamed to .gif; no file.
     * @output 422 each time; no row, no file.
     */
    public function test_refused_files(): void
    {
        $this->signIn($this->creator());
        $bad = [
            UploadedFile::fake()->createWithContent('fake.png', 'not an image at all'),
            UploadedFile::fake()->createWithContent('vector.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            $this->png(10, 10, 'renamed.gif'),
        ];
        foreach ($bad as $file) {
            $this->post('/api/js-creator/library/assets', ['files' => [$file]], ['Accept' => 'application/json'])->assertStatus(422);
        }
        $this->postJson('/api/js-creator/library/assets', [])->assertStatus(422)->assertJsonValidationErrors('files');
        $this->assertSame(0, CreatorAsset::withTrashed()->count());
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    /**
     * @description A full workspace refuses an upload (the trash counts too) until space is freed.
     * @input default quota 1 MB; images uploaded until it is full (counted bytes forced high).
     * @output 422 quota_exceeded with nothing stored; after emptying the trash the upload works.
     */
    public function test_quota(): void
    {
        CreatorSetting::query()->create(['default_quota_mb' => 1]);
        $this->signIn($this->creator());
        $id = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->assertCreated()->json('data.0.id');
        CreatorAsset::whereKey($id)->update(['size_bytes' => 1024 * 1024]);
        $this->deleteJson("/api/js-creator/library/assets/{$id}")->assertNoContent();

        $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('error_code', 'quota_exceeded');
        $this->assertSame(1, CreatorAsset::withTrashed()->count());

        $this->deleteJson('/api/js-creator/library/assets/trash')->assertNoContent();
        $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->assertCreated();
    }

    /**
     * @description Rename, trash, restore, permanent deletion (with the files), list filters.
     * @input two images; rename one; search; trash it; restore; trash and force.
     * @output names and lists as expected; files gone after the permanent deletion.
     */
    public function test_rename_trash_and_list(): void
    {
        $this->signIn($this->creator());
        $a = $this->post('/api/js-creator/library/assets', ['files' => [$this->png(10, 10, 'alpha.png')]], ['Accept' => 'application/json'])->json('data.0.id');
        $this->post('/api/js-creator/library/assets', ['files' => [$this->png(10, 10, 'beta.png')]], ['Accept' => 'application/json'])->assertCreated();

        $this->putJson("/api/js-creator/library/assets/{$a}", ['name' => '  Logo firmy  '])->assertOk()->assertJsonPath('data.name', 'Logo firmy');
        $this->getJson('/api/js-creator/library/assets?search=firmy')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a);
        $this->getJson('/api/js-creator/library/assets?search=%25')->assertJsonPath('meta.total', 0);

        $this->deleteJson("/api/js-creator/library/assets/{$a}")->assertNoContent();
        $this->getJson('/api/js-creator/library/assets')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/js-creator/library/assets?only_trashed=1')->assertJsonPath('data.0.id', $a);
        $this->postJson("/api/js-creator/library/assets/{$a}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);

        $asset = CreatorAsset::find($a);
        $this->deleteJson("/api/js-creator/library/assets/{$a}?force=1")->assertNotFound();
        $this->deleteJson("/api/js-creator/library/assets/{$a}")->assertNoContent();
        $this->deleteJson("/api/js-creator/library/assets/{$a}?force=1")->assertNoContent();
        Storage::disk('private')->assertMissing([$asset->path, $asset->thumb_path]);
    }

    /**
     * @description The files are served only through their signed URL; a changed URL is refused
     *   and recorded; the answer is never sniffed or run.
     * @input URL of the image and of the thumbnail; the image URL with another id.
     * @output 200 image/png + nosniff + sandbox; 200 image/webp; 403 + security event.
     */
    public function test_signed_file_urls(): void
    {
        $this->signIn($this->creator());
        $data = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0');

        $this->get($data['url'])->assertOk()->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        $this->get($data['thumb_url'])->assertOk()->assertHeader('Content-Type', 'image/webp');

        $this->get(str_replace("/assets/{$data['id']}/", '/assets/' . ($data['id'] + 1) . '/', $data['url']))->assertForbidden();
        $this->assertSecurityEvent('invalid_signed_url');
        $this->get("/api/js-creator/files/assets/{$data['id']}/original")->assertForbidden();
    }

    /**
     * @description Another account - also the sysadmin - finds no image of a workspace.
     * @input image of A (and one in A's trash); requests of B and of a sysadmin.
     * @output empty lists; 404 for rename, delete, restore, force.
     */
    public function test_isolation_of_workspaces(): void
    {
        $this->signIn($this->creator());
        $own = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $trashed = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $this->deleteJson("/api/js-creator/library/assets/{$trashed}")->assertNoContent();

        foreach ([$this->creator(), $this->sysadmin()] as $other) {
            $this->signIn($other);
            $this->getJson('/api/js-creator/library/assets')->assertOk()->assertJsonPath('meta.total', 0);
            $this->getJson('/api/js-creator/library/assets?only_trashed=1')->assertJsonPath('meta.total', 0);
            $this->putJson("/api/js-creator/library/assets/{$own}", ['name' => 'x'])->assertNotFound();
            $this->deleteJson("/api/js-creator/library/assets/{$own}")->assertNotFound();
            $this->postJson("/api/js-creator/library/assets/{$trashed}/restore")->assertNotFound();
            $this->deleteJson("/api/js-creator/library/assets/{$trashed}?force=1")->assertNotFound();
            $this->deleteJson('/api/js-creator/library/assets/trash')->assertNoContent();
        }

        $this->assertSame(2, CreatorAsset::withTrashed()->count());
    }

    /**
     * @description `ids` lists only the given own images (the images a template uses), never those
     *   of another account.
     * @input own images A, B, C; image D of another account; ids=A,C,D
     * @output A and C only.
     */
    public function test_images_by_ids(): void
    {
        $owner = $this->signIn($this->creator());
        $ids = array_map(fn () => $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id'), range(1, 3));
        $this->signIn($this->creator());
        $foreign = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0.id');
        $this->signIn($owner);

        $listed = $this->getJson('/api/js-creator/library/assets?ids=' . implode(',', [$ids[0], $ids[2], $foreign]))->assertOk()->json('data.*.id');
        $this->assertEqualsCanonicalizing([$ids[0], $ids[2]], $listed);
    }

    /**
     * @description Own icons: PNG / JPG only (a WebP is refused), scaled to 1024 px, listed apart
     *   from the images; a template can use them; the trash is emptied per kind; `ids` finds both kinds.
     * @input PNG 2000×1000 as an icon; WebP as an icon; an image; list of each kind; trash of both
     *   kinds and emptying the icon trash.
     * @output icon 1024×512 kind icon; 422 for WebP; lists of one kind each; `ids` lists both;
     *   after emptying the icon trash the image is still in its trash.
     */
    public function test_own_icons(): void
    {
        $this->signIn($this->creator());
        $icon = $this->post('/api/js-creator/library/assets', ['kind' => 'icon', 'files' => [$this->png(2000, 1000, 'arrow.png')]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.0.kind', 'icon')->assertJsonPath('data.0.width', 1024)->assertJsonPath('data.0.height', 512)->json('data.0.id');
        $image = imagecreatetruecolor(20, 20);
        ob_start();
        imagewebp($image);
        $webp = UploadedFile::fake()->createWithContent('icon.webp', (string) ob_get_clean());
        $this->post('/api/js-creator/library/assets', ['kind' => 'icon', 'files' => [$webp]], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('files.0');
        $this->post('/api/js-creator/library/assets', ['kind' => 'other', 'files' => [$this->png()]], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('kind');
        $photo = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.0.kind', 'image')->json('data.0.id');

        $this->getJson('/api/js-creator/library/assets')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $photo);
        $this->getJson('/api/js-creator/library/assets?kind=icon')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $icon);
        $this->getJson("/api/js-creator/library/assets?ids={$icon},{$photo}")->assertOk()->assertJsonCount(2, 'data');

        $this->deleteJson("/api/js-creator/library/assets/{$icon}")->assertNoContent();
        $this->deleteJson("/api/js-creator/library/assets/{$photo}")->assertNoContent();
        $this->deleteJson('/api/js-creator/library/assets/trash?kind=icon')->assertNoContent();
        $this->assertNull(CreatorAsset::withTrashed()->find($icon));
        $this->assertTrue(CreatorAsset::withTrashed()->find($photo)->trashed());
    }
}
