<?php

/**
 * @file CommonFixtures.php
 * @path api/tests/Support/CommonFixtures.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test helpers shared by the tests of the core and of the applications: stored
 *   attachments, the captcha of the public forms, fake / real upload files, import files and a
 *   broken mailer.
 * @dependencies
 * - App\Models\Core\CoreAttachment; Illuminate\Http\UploadedFile (fake files), Storage, Http.
 */

namespace Tests\Support;

use App\Models\Core\CoreAttachment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * @description Used by the test traits of the applications (WebFixtures, ShopFixtures …) and
 *   directly by core tests.
 */
trait CommonFixtures
{
    /**
     * @description Adds a stored attachment row (+ file on the given disk) to a model.
     * @param Model $model Model with an attachments() relation.
     * @param string $path Path on the disk.
     * @param string $disk Disk name.
     * @return CoreAttachment
     */
    protected function attach(Model $model, string $path = 'web/x/file.pdf', string $disk = 'private'): CoreAttachment
    {
        Storage::disk($disk)->put($path, 'content');

        return $model->attachments()->create([
            'disk' => $disk, 'path' => $path, 'original_filename' => basename($path), 'mime_type' => 'application/pdf', 'size_bytes' => 7,
        ]);
    }

    /**
     * @description Answers the Cloudflare Turnstile verification of the captcha (no real request).
     * @param bool $valid Whether Cloudflare accepts the token.
     * @return void
     */
    protected function fakeCaptcha(bool $valid = true): void
    {
        // A fresh factory: stubs of an earlier fake would otherwise win over the new answer.
        \Illuminate\Support\Facades\Http::swap(new \Illuminate\Http\Client\Factory());
        \Illuminate\Support\Facades\Http::fake([
            config('services.turnstile.verify_url') => \Illuminate\Support\Facades\Http::response(['success' => $valid, 'error-codes' => $valid ? [] : ['invalid-input-response']]),
        ]);
    }

    /**
     * @description The captcha field of a public form submission (accepted by fakeCaptcha()).
     * @return array{captcha_token: string}
     */
    protected function captcha(): array
    {
        return ['captcha_token' => 'test-captcha-token'];
    }

    /**
     * @description A fake uploaded file.
     * @param string $name File name (the extension matters for the validation).
     * @param int $kilobytes Size in KB.
     * @param string|null $mime Reported MIME type.
     * @return UploadedFile
     */
    protected function upload(string $name = 'brief.pdf', int $kilobytes = 10, ?string $mime = 'application/pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, $mime);
    }

    /** @description SVG with a script - a stored XSS when a browser renders it inline. */
    protected const SVG_XSS = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>';

    /** @description HTML page with a script. */
    protected const HTML_XSS = '<!DOCTYPE html><html><body><script>alert(document.domain)</script></body></html>';

    /** @description Smallest valid PNG (1x1 pixel). */
    protected const PNG_BYTES = "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82";

    /**
     * @description A real uploaded file with the given content - unlike UploadedFile::fake(), its
     *   MIME type is detected from the CONTENT (finfo), like on the server.
     * @param string $name Client file name.
     * @param string $content File content.
     * @return UploadedFile
     */
    protected function uploadWithContent(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, null, null, true);
    }

    /**
     * @description A fake import file with the given content.
     * @param string $format 'csv', 'txt' or 'json'.
     * @param string $content File content.
     * @return UploadedFile
     */
    protected function importFile(string $format, string $content): UploadedFile
    {
        return UploadedFile::fake()->createWithContent("import.{$format}", $content);
    }

    /**
     * @description Makes every mail send fail (unknown transport) - with the sync queue of the
     *   tests a queued mail fails at queue() time as well.
     * @return void
     */
    protected function breakMailer(): void
    {
        config(['mail.default' => 'broken', 'mail.mailers.broken' => ['transport' => 'does-not-exist']]);
    }
}
