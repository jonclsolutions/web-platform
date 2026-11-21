<?php

/**
 * @file LibraryFontTest.php
 * @path api/tests/Apps/JsCreator/Feature/LibraryFontTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the own fonts (FontController, FontFile): the type is checked by
 *   the signature of the content and must fit the extension, a face exists once outside the
 *   trash, change of the face, trash and restore, the signed download and the isolation.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorFont;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/library/fonts and /api/js-creator/files/fonts.
 */
class LibraryFontTest extends TestCase
{
    use JsCreatorFixtures;

    /** @description Fake disk for every test. */
    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeDisk();
    }

    /**
     * @description Uploads a font face.
     * @param array<string, mixed> $fields Fields overriding the defaults (family Brand, 400, normal).
     * @return \Illuminate\Testing\TestResponse
     */
    private function upload(array $fields = [])
    {
        return $this->post('/api/js-creator/library/fonts', $fields + [
            'file' => $this->font(), 'family' => 'Brand', 'weight' => 400, 'style' => 'normal',
        ], ['Accept' => 'application/json']);
    }

    /**
     * @description Every allowed signature is accepted with a fitting extension; a wrong one,
     *   a mismatch and a font collection are refused.
     * @input woff2, woff, OTTO as .otf, TrueType as .ttf and .otf; text as .ttf; wOF2 as .ttf;
     *   ttcf collection; weight 450; style oblique; family "<b>".
     * @output 201 with the detected format; 422 for the rest.
     */
    public function test_type_checks(): void
    {
        $this->signIn($this->creator());
        $this->upload()->assertCreated()->assertJsonPath('data.format', 'woff2')->assertJsonPath('data.size_bytes', 2048);
        $this->upload(['file' => $this->font('wOFF', 'a.woff'), 'weight' => 500])->assertCreated()->assertJsonPath('data.format', 'woff');
        $this->upload(['file' => $this->font('OTTO', 'a.otf'), 'weight' => 600])->assertCreated()->assertJsonPath('data.format', 'otf');
        $this->upload(['file' => $this->font("\x00\x01\x00\x00", 'a.ttf'), 'weight' => 700])->assertCreated()->assertJsonPath('data.format', 'ttf');
        $this->upload(['file' => $this->font("\x00\x01\x00\x00", 'b.otf'), 'weight' => 800])->assertCreated()->assertJsonPath('data.format', 'ttf');

        $this->upload(['file' => $this->font('abcd', 'x.ttf'), 'weight' => 100])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload(['file' => $this->font('wOF2', 'x.ttf'), 'weight' => 100])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload(['file' => $this->font('ttcf', 'x.ttf'), 'weight' => 100])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload(['file' => $this->font('wOF2', 'x.exe'), 'weight' => 100])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload(['weight' => 450])->assertStatus(422)->assertJsonValidationErrors('weight');
        $this->upload(['style' => 'oblique'])->assertStatus(422)->assertJsonValidationErrors('style');
        $this->upload(['family' => '<b>'])->assertStatus(422)->assertJsonValidationErrors('family');
        $this->assertSame(5, CreatorFont::count());
    }

    /**
     * @description A face (family case-insensitive + weight + style) exists once outside the trash;
     *   its change and its restore respect it.
     * @input Brand 400 normal; "brand" 400 normal; Brand 400 italic; change italic → normal;
     *   trash the first, upload it again, restore the trashed one.
     * @output 201, 422, 201, 422, then 201 and restore 422.
     */
    public function test_unique_faces(): void
    {
        $this->signIn($this->creator());
        $first = $this->upload()->assertCreated()->json('data.id');
        $this->upload(['family' => 'brand'])->assertStatus(422)->assertJsonValidationErrors('family');
        $italic = $this->upload(['style' => 'italic'])->assertCreated()->json('data.id');
        $this->putJson("/api/js-creator/library/fonts/{$italic}", ['family' => 'Brand', 'weight' => 400, 'style' => 'normal'])
            ->assertStatus(422)->assertJsonValidationErrors('family');
        $this->putJson("/api/js-creator/library/fonts/{$italic}", ['family' => 'Brand Two', 'weight' => 300, 'style' => 'italic'])
            ->assertOk()->assertJsonPath('data.family', 'Brand Two')->assertJsonPath('data.weight', 300);

        $this->deleteJson("/api/js-creator/library/fonts/{$first}")->assertNoContent();
        $this->upload()->assertCreated();
        $this->postJson("/api/js-creator/library/fonts/{$first}/restore")->assertStatus(422)->assertJsonValidationErrors('family');
    }

    /**
     * @description The font is downloaded only through its signed URL with the font type; trash
     *   and permanent deletion remove the file.
     * @input upload, GET url, trash, force.
     * @output 200 font/woff2 attachment + nosniff; file gone after force; list empty.
     */
    public function test_download_and_trash(): void
    {
        $this->signIn($this->creator());
        $data = $this->upload()->json('data');
        $response = $this->get($data['url'])->assertOk()->assertHeader('Content-Type', 'font/woff2')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        $this->get("/api/js-creator/files/fonts/{$data['id']}")->assertForbidden();

        $path = CreatorFont::find($data['id'])->path;
        $this->deleteJson("/api/js-creator/library/fonts/{$data['id']}")->assertNoContent();
        $this->getJson('/api/js-creator/library/fonts?only_trashed=1')->assertJsonPath('data.0.id', $data['id']);
        $this->deleteJson('/api/js-creator/library/fonts/trash')->assertNoContent();
        Storage::disk('private')->assertMissing($path);
        $this->getJson('/api/js-creator/library/fonts?only_trashed=1')->assertJsonCount(0, 'data');
    }

    /**
     * @description Another account - also the sysadmin - finds no font of a workspace.
     * @input font of A; requests of B and of a sysadmin.
     * @output empty lists; 404 for change, delete, restore, force.
     */
    public function test_isolation_of_workspaces(): void
    {
        $this->signIn($this->creator());
        $id = $this->upload()->json('data.id');

        foreach ([$this->creator(), $this->sysadmin()] as $other) {
            $this->signIn($other);
            $this->getJson('/api/js-creator/library/fonts')->assertOk()->assertJsonCount(0, 'data');
            $this->putJson("/api/js-creator/library/fonts/{$id}", ['family' => 'X', 'weight' => 400, 'style' => 'normal'])->assertNotFound();
            $this->deleteJson("/api/js-creator/library/fonts/{$id}")->assertNotFound();
            $this->postJson("/api/js-creator/library/fonts/{$id}/restore")->assertNotFound();
            $this->deleteJson("/api/js-creator/library/fonts/{$id}?force=1")->assertNotFound();
            // The same face in its own workspace is fine.
            $this->upload()->assertCreated();
        }
        $this->assertSame('Brand', CreatorFont::find($id)->family);
    }
}
