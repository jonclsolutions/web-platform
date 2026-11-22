<?php

/**
 * @file LibraryBulkTest.php
 * @path api/tests/Apps/JsCreator/Feature/LibraryBulkTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the multiselect of the library: bulk actions on images / own
 *   icons and fonts (used files and taken font faces skipped, foreign ids ignored, permission),
 *   the download of one file under its name and the ZIP of several files (only own files outside
 *   the trash, names made unique, size limit).
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk, ZipArchive.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFont;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;
use ZipArchive;

/**
 * @description /api/js-creator/library/{assets,fonts}/{bulk,zip}, /api/js-creator/files/assets/{id}/download,
 *   /api/js-creator/files/library-zip.
 */
class LibraryBulkTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Base path of the library. */
    private const BASE = '/api/js-creator/library';

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description Images and icons in bulk: a used image is skipped with its templates, a foreign
     *   one is ignored, the others go to the trash, back and away for good.
     * @input image used by a template, free image, own icon, foreign image; delete all; restore the
     *   icon; destroy the rest of the trash
     * @output delete count 2, skipped [used, in_use, used_by Post]; foreign untouched; restore 1;
     *   destroy 1 (free image gone with its files)
     */
    public function test_assets_in_bulk(): void
    {
        $this->signIn($this->creator());
        $foreign = $this->upload('foreign.png');
        $this->signIn($this->creator());
        $used = $this->upload('used.png');
        $free = $this->upload('free.png');
        $icon = $this->upload('icon.png', 'icon');
        $this->template([$this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => $used]])]);

        $response = $this->postJson(self::BASE . '/assets/bulk', ['action' => 'delete', 'ids' => [$used, $free, $icon, $foreign]])->assertOk()
            ->assertJsonPath('data.count', 2)->assertJsonPath('data.skipped.0.id', $used)->assertJsonPath('data.skipped.0.reason', 'in_use');
        $this->assertSame('Post', $response->json('data.skipped.0.used_by.0.name'));
        $this->assertFalse(CreatorAsset::find($foreign)->trashed());
        $this->postJson(self::BASE . '/assets/bulk', ['action' => 'restore', 'ids' => [$icon]])->assertOk()->assertJsonPath('data.count', 1);
        $path = CreatorAsset::withTrashed()->find($free)->path;
        $this->postJson(self::BASE . '/assets/bulk', ['action' => 'destroy', 'ids' => [$free, $icon, $used]])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertNull(CreatorAsset::withTrashed()->find($free));
        $this->assertFalse(Storage::disk('private')->exists($path));

        $this->signIn($this->creator(['view', 'create', 'update']));
        $this->postJson(self::BASE . '/assets/bulk', ['action' => 'delete', 'ids' => [1]])->assertForbidden();
    }

    /**
     * @description Fonts in bulk: a used font is skipped; a restore whose face is taken again is
     *   skipped as face_taken.
     * @input fonts A (used) and B; delete both; a new font with the face of B; restore B
     * @output delete count 1, skipped A in_use; restore count 0, skipped B face_taken; destroy B count 1
     */
    public function test_fonts_in_bulk(): void
    {
        $this->signIn($this->creator());
        $a = $this->addFont('Alpha');
        $b = $this->addFont('Beta');
        $this->template([$this->layer('text', ['font' => ['family' => "user:{$a}", 'weight' => 400, 'style' => 'normal']])]);

        $this->postJson(self::BASE . '/fonts/bulk', ['action' => 'delete', 'ids' => [$a, $b]])->assertOk()
            ->assertJsonPath('data.count', 1)->assertJsonPath('data.skipped.0.id', $a)->assertJsonPath('data.skipped.0.reason', 'in_use');
        $this->addFont('Beta');
        $this->postJson(self::BASE . '/fonts/bulk', ['action' => 'restore', 'ids' => [$b]])->assertOk()
            ->assertJsonPath('data.count', 0)->assertJsonPath('data.skipped.0.reason', 'face_taken');
        $this->postJson(self::BASE . '/fonts/bulk', ['action' => 'destroy', 'ids' => [$b]])->assertOk()->assertJsonPath('data.count', 1);
        $this->assertNull(CreatorFont::withTrashed()->find($b));
    }

    /**
     * @description One file is downloaded under its name; several as a ZIP of own files outside
     *   the trash with unique names; a ZIP over the size limit is refused.
     * @input image "Logo" (PNG), second image "Logo", trashed image, foreign image; fonts Brand 400 and 700 italic
     * @output download "Logo.png" attachment; ZIP of the library: Logo.png, Logo (2).png; ZIP of fonts:
     *   Brand-400.woff2, Brand-700-italic.woff2; changed URL 403; 422 nothing / too large
     */
    public function test_download_and_zip(): void
    {
        $this->signIn($this->creator());
        $foreign = $this->upload('foreign.png');
        $this->signIn($this->creator());
        $logo = $this->upload('Logo.png');
        $again = $this->upload('Logo.png');
        $trashed = $this->upload('old.png');
        $this->deleteJson(self::BASE . "/assets/{$trashed}")->assertNoContent();

        $item = collect($this->getJson(self::BASE . '/assets')->assertOk()->json('data'))->firstWhere('id', $logo);
        $download = $this->get($item['download_url'])->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertStringContainsString('attachment', (string) $download->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Logo.png', (string) $download->headers->get('Content-Disposition'));

        $url = $this->postJson(self::BASE . '/assets/zip', ['ids' => [$logo, $again, $trashed, $foreign]])->assertOk()
            ->assertJsonPath('data.count', 2)->json('data.url');
        $this->get(str_replace('ids=', 'ids=' . $foreign . '%2C', $url))->assertForbidden();
        $this->assertSame(['Logo (2).png', 'Logo.png'], $this->zipNames($this->get($url)->assertOk()->assertHeader('Content-Type', 'application/zip')));

        $regular = $this->addFont('Brand');
        $italic = (int) $this->post(self::BASE . '/fonts', ['file' => $this->font(), 'family' => 'Brand', 'weight' => 700, 'style' => 'italic'], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');
        $fontUrl = $this->postJson(self::BASE . '/fonts/zip', ['ids' => [$regular, $italic]])->assertOk()->json('data.url');
        $this->assertSame(['Brand-400.woff2', 'Brand-700-italic.woff2'], $this->zipNames($this->get($fontUrl)->assertOk()));
        $single = collect($this->getJson(self::BASE . '/fonts')->json('data'))->firstWhere('id', $italic);
        $this->assertStringContainsString('Brand-700-italic.woff2', (string) $this->get($single['url'])->assertOk()->headers->get('Content-Disposition'));

        $this->postJson(self::BASE . '/assets/zip', ['ids' => [$foreign]])->assertUnprocessable()->assertJsonValidationErrors('ids');
        CreatorAsset::query()->whereKey($logo)->update(['size_bytes' => 600 * 1024 * 1024]);
        $this->postJson(self::BASE . '/assets/zip', ['ids' => [$logo]])->assertUnprocessable();
    }

    /**
     * @description Uploads a PNG to the library of the signed-in account.
     * @param string $name File name.
     * @param string $kind image | icon.
     * @return int Its id.
     */
    private function upload(string $name, string $kind = 'image'): int
    {
        return (int) $this->post(self::BASE . '/assets', ['kind' => $kind, 'files' => [$this->png(30, 20, $name)]], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.0.id');
    }

    /**
     * @description Uploads a font face (400, normal) of a family.
     * @param string $family Family.
     * @return int Its id.
     */
    private function addFont(string $family): int
    {
        return (int) $this->post(self::BASE . '/fonts', ['file' => $this->font(), 'family' => $family, 'weight' => 400, 'style' => 'normal'], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');
    }

    /**
     * @description Creates a template of the signed-in account with layers.
     * @param array<int, array<string, mixed>> $layers
     * @return int Its id.
     */
    private function template(array $layers): int
    {
        $id = (int) $this->postJson('/api/js-creator/images/templates', ['name' => 'Post', 'width' => 1080, 'height' => 1080])->assertCreated()->json('data.id');
        $this->putJson("/api/js-creator/images/templates/{$id}", [
            'name' => 'Post', 'width' => 1080, 'height' => 1080, 'output_format' => 'png', 'output_quality' => 90,
            'caption_template' => null, 'version' => 1, 'document' => $this->document($layers),
        ])->assertOk();

        return $id;
    }

    /**
     * @description Sorted names of the entries of a downloaded ZIP.
     * @param TestResponse $response Download.
     * @return string[]
     */
    private function zipNames(TestResponse $response): array
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'zip-test');
        file_put_contents($path, $response->streamedContent() ?: file_get_contents($response->baseResponse->getFile()->getPathname()));
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($path) === true);
        $names = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $names[] = $zip->getNameIndex($i);
        }
        $zip->close();
        unlink($path);
        sort($names);

        return $names;
    }
}
