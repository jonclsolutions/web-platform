<?php

/**
 * @file AttachmentDownloadTest.php
 * @path api/tests/Integration/AttachmentDownloadTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the attachment download / preview (AttachmentDownloadController):
 *   only signed, unexpired URLs work; files of web_attachments (any disk) are served under their
 *   original name; legacy public files (CVs) are no longer served and the
 *   command `attachments:migrate-legacy` moves them to the private disk (finding #31).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures; Storage fakes (private, public).
 */

namespace Tests\Integration;

use App\Models\Core\CoreSecurityEvent;
use App\Apps\Web\Models\WebLog;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description GET /api/attachments/{download,view}/{path}.
 */
class AttachmentDownloadTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Fake attachment disks.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Storage::fake('public');
    }

    /**
     * @description Signed URL of an attachment route (10 minutes, like CoreAttachmentResource).
     * @param string $route 'download' or 'view'.
     * @param string $path Stored path.
     * @return string
     */
    private function signed(string $route, string $path): string
    {
        return URL::temporarySignedRoute("attachments.{$route}", now()->addMinutes(10), ['path' => $path]);
    }

    /**
     * @description SECURITY: without a valid signature (missing, changed path, expired) nothing
     *   is served; a path with '..' is refused even when signed.
     * @input Attachment web/x/brief.pdf: unsigned URL; signature of another path; URL after 11 minutes;
     *        signed '../.env'.
     * @output 403, 403, 403; 404.
     */
    public function test_signature_is_required(): void
    {
        $this->attach($this->rawRequest(), 'web/x/brief.pdf');
        $signed = $this->signed('download', 'web/x/brief.pdf');

        $this->get('/api/attachments/download/web/x/brief.pdf')->assertStatus(403);
        $this->get(str_replace('brief.pdf', 'other.pdf', $signed))->assertStatus(403);
        $this->travel(11)->minutes();
        $this->get($signed)->assertStatus(403);
        $this->travelBack();
        $this->get($this->signed('download', 'web/../.env'))->assertStatus(404);
    }

    /**
     * @description web_attachments: download (attachment) and preview (inline) under the original
     *   name from the record's disk; a missing file or unknown path is 404.
     * @input Attachment 'Offer 2026.pdf' on private disk; public-disk attachment without name;
     *        attachment row whose file is gone; unknown path.
     * @output download: attachment; filename "Offer 2026.pdf" + content; view: inline with an
     *   ASCII fallback name and the UTF-8 name (RFC 6266), Content-Type application/pdf;
     *   public file under its base name; 404; 404.
     */
    public function test_web_attachments(): void
    {
        $owner = $this->rawRequest();
        $attachment = $this->attach($owner, 'web/x/abc.pdf');
        $attachment->update(['original_filename' => 'Nabídka 2026.pdf']);
        $public = $this->attach($owner, 'web/x/pub.pdf', 'public');
        $public->update(['original_filename' => '', 'disk' => '']);
        Storage::disk('private')->put('web/x/pub.pdf', 'content');
        $gone = $this->attach($owner, 'web/x/gone.pdf');
        Storage::disk('private')->delete('web/x/gone.pdf');

        $download = $this->get($this->signed('download', 'web/x/abc.pdf'))->assertOk();
        $this->assertStringStartsWith('attachment;', $download->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Nab', $download->headers->get('Content-Disposition'));
        $this->assertSame('content', $download->streamedContent());

        $view = $this->get($this->signed('view', 'web/x/abc.pdf'))->assertOk();
        $this->assertSame('inline; filename="Nabidka 2026.pdf"; filename*=utf-8\'\'Nab%C3%ADdka%202026.pdf', $view->headers->get('Content-Disposition'));
        $this->assertSame('application/pdf', $view->headers->get('Content-Type'));

        $this->assertStringContainsString('pub.pdf', $this->get($this->signed('download', 'web/x/pub.pdf'))->assertOk()->headers->get('Content-Disposition'));
        $this->get($this->signed('download', $gone->path))->assertStatus(404);
        $this->get($this->signed('download', 'web/x/none.pdf'))->assertStatus(404);
    }

    /**
     * @description VT-02 (stored XSS): view() serves inline ONLY a PDF or a raster image, decided
     *   by the stored CONTENT; SVG, HTML and an SVG hidden behind a .png name are always a
     *   download. Every answer has nosniff, all but the PDF a sandbox CSP.
     * @input Attachments evil.svg (script), page.html (script), fake.png (SVG content),
     *        photo.png (real PNG), doc.pdf (real PDF); view of each; download of photo.png.
     * @output svg / html / fake.png: attachment disposition, sandbox CSP, nosniff;
     *   photo.png: inline image/png + sandbox CSP; doc.pdf: inline application/pdf, CSP
     *   frame-ancestors only (no sandbox), nosniff; download: attachment + sandbox CSP + nosniff.
     */
    public function test_view_serves_only_safe_types_inline(): void
    {
        $owner = $this->rawRequest();
        $files = [
            'web/x/evil.svg'  => self::SVG_XSS,
            'web/x/page.html' => self::HTML_XSS,
            'web/x/fake.png'  => self::SVG_XSS,
            'web/x/photo.png' => self::PNG_BYTES,
            'web/x/doc.pdf'   => "%PDF-1.4\n%\xe2\xe3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
        ];
        foreach ($files as $path => $content) {
            $this->attach($owner, $path);
            Storage::disk('private')->put($path, $content);
        }
        $sandbox = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

        foreach (['web/x/evil.svg', 'web/x/page.html', 'web/x/fake.png'] as $path) {
            $response = $this->get($this->signed('view', $path))->assertOk();
            $this->assertStringStartsWith('attachment;', $response->headers->get('Content-Disposition'), $path);
            $this->assertSame($sandbox, $response->headers->get('Content-Security-Policy'), $path);
            $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'), $path);
        }

        $png = $this->get($this->signed('view', 'web/x/photo.png'))->assertOk();
        $this->assertStringStartsWith('inline;', $png->headers->get('Content-Disposition'));
        $this->assertSame('image/png', $png->headers->get('Content-Type'));
        $this->assertSame($sandbox, $png->headers->get('Content-Security-Policy'));

        $pdf = $this->get($this->signed('view', 'web/x/doc.pdf'))->assertOk();
        $this->assertStringStartsWith('inline;', $pdf->headers->get('Content-Disposition'));
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));
        $this->assertSame("frame-ancestors 'self'", $pdf->headers->get('Content-Security-Policy'));
        $this->assertSame('nosniff', $pdf->headers->get('X-Content-Type-Options'));

        $download = $this->get($this->signed('download', 'web/x/photo.png'))->assertOk();
        $this->assertStringStartsWith('attachment;', $download->headers->get('Content-Disposition'));
        $this->assertSame($sandbox, $download->headers->get('Content-Security-Policy'));
        $this->assertSame('nosniff', $download->headers->get('X-Content-Type-Options'));
    }

    /**
     * @description GDPR (finding #31): legacy single-file paths on the public disk are not served
     *   any more, even with a valid signature - only web_attachments are.
     * @input Job application with cv_files/a.pdf on the public disk; signed download / view.
     * @output 404 for both.
     */
    public function test_legacy_files_are_not_served(): void
    {
        Storage::disk('public')->put('cv_files/a.pdf', 'x');
        $this->jobApplication()->forceFill(['cv_path' => 'cv_files/a.pdf', 'cv_original_name' => 'Eva CV.pdf'])->save();

        $this->get($this->signed('download', 'cv_files/a.pdf'))->assertStatus(404);
        $this->get($this->signed('view', 'cv_files/a.pdf'))->assertStatus(404);
    }

    /**
     * @description `attachments:migrate-legacy` moves legacy CVs to the private
     *   disk as web_attachments (also of trashed records); --dry-run changes nothing; a missing file
     *   only clears the columns; a second run finds nothing; the migrated file is served signed.
     * @input Trashed application cv_files/a.pdf 'Eva CV.pdf'; application web/cv_files/b.pdf without name;
     *        application with cv_files/none.pdf (no file); dry-run, run, run.
     * @output dry-run: nothing moved, files still public; run: 2 moved, 1 missing, exit 0; private files
     *   web/cv_files/a.pdf, web/cv_files/b.pdf with names 'Eva CV.pdf', 'b.pdf';
     *   public files gone; legacy columns null; second run 0 moved; view of the migrated CV 'Eva CV.pdf'.
     */
    public function test_migrate_legacy_command(): void
    {
        foreach (['cv_files/a.pdf', 'web/cv_files/b.pdf'] as $path) {
            Storage::disk('public')->put($path, 'data-' . $path);
        }
        $a = $this->jobApplication();
        $a->forceFill(['cv_path' => 'cv_files/a.pdf', 'cv_original_name' => 'Eva CV.pdf'])->save();
        $a->delete();
        $b = $this->jobApplication();
        $b->forceFill(['cv_path' => 'web/cv_files/b.pdf', 'cv_original_name' => ''])->save();
        $gone = $this->jobApplication();
        $gone->forceFill(['cv_path' => 'cv_files/none.pdf', 'cv_original_name' => 'None.pdf'])->save();

        $this->artisan('attachments:migrate-legacy', ['--dry-run' => true])
            ->expectsOutputToContain('[dry-run] would move 2 file(s); missing 1; failed 0.')->assertSuccessful();
        Storage::disk('public')->assertExists('cv_files/a.pdf');
        $this->assertSame(0, \App\Models\Core\CoreAttachment::count());
        $this->assertSame('cv_files/none.pdf', $gone->fresh()->cv_path);

        $this->artisan('attachments:migrate-legacy')->expectsOutputToContain('Moved 2 file(s); missing 1; failed 0.')->assertSuccessful();
        foreach (['web/cv_files/a.pdf' => 'Eva CV.pdf', 'web/cv_files/b.pdf' => 'b.pdf'] as $path => $name) {
            Storage::disk('private')->assertExists($path);
            $this->assertSame($name, \App\Models\Core\CoreAttachment::where('path', $path)->value('original_filename'));
        }
        $this->assertSame('data-cv_files/a.pdf', Storage::disk('private')->get('web/cv_files/a.pdf'));
        Storage::disk('public')->assertMissing('cv_files/a.pdf');
        $this->assertNull(\App\Apps\Web\Models\WebJobApplication::withTrashed()->find($a->id)->cv_path);
        $this->assertNull($gone->fresh()->cv_path);
        $this->assertSame(1, \App\Apps\Web\Models\WebJobApplication::withTrashed()->find($a->id)->attachments()->count());

        $this->artisan('attachments:migrate-legacy')->expectsOutputToContain('Moved 0 file(s); missing 0; failed 0.')->assertSuccessful();
        $this->assertSame('inline; filename="Eva CV.pdf"', $this->get($this->signed('view', 'web/cv_files/a.pdf'))->assertOk()->headers->get('Content-Disposition'));
    }

    /**
     * @description A file that cannot be registered is reported, the command fails and the public
     *   file and its legacy columns stay untouched (nothing lost).
     * @input Job application with cv_files/x.pdf; web_attachments INSERT fails.
     * @output Exit code 1, 'failed 1'; public file kept, no private copy left; cv_path unchanged.
     */
    public function test_migrate_legacy_command_failure(): void
    {
        Storage::disk('public')->put('cv_files/x.pdf', 'x');
        $application = $this->jobApplication();
        $application->forceFill(['cv_path' => 'cv_files/x.pdf'])->save();
        $this->failOn('web_attachments', 'INSERT');

        $this->artisan('attachments:migrate-legacy')->expectsOutputToContain('failed 1.')->assertFailed();
        Storage::disk('public')->assertExists('cv_files/x.pdf');
        Storage::disk('private')->assertMissing('web/cv_files/x.pdf');
        $this->assertSame('cv_files/x.pdf', $application->fresh()->cv_path);
    }

    /**
     * @description Every served file is logged (web log, id / owner / type / size - not the file
     *   name); a changed or expired signature and a path with '..' are security events.
     * @input Attachment 'CV Jan Novak.pdf' of an inquiry: download, view; unsigned URL; signed '../.env'.
     * @output web log attachment_download + attachment_view (CoreAttachment #id of
     *   WebRawRequestCommission #id), no 'Novak' and no signature in the log; security events
     *   invalid_signed_url, path_traversal_attempt (critical).
     */
    public function test_access_is_logged(): void
    {
        $owner = $this->rawRequest();
        $attachment = $this->attach($owner, 'web/x/cv.pdf');
        $attachment->update(['original_filename' => 'CV Jan Novak.pdf']);

        $this->get($this->signed('download', 'web/x/cv.pdf'))->assertOk();
        $this->get($this->signed('view', 'web/x/cv.pdf'))->assertOk();
        $this->get('/api/attachments/download/web/x/cv.pdf')->assertStatus(403);
        $this->get($this->signed('download', 'web/../.env'))->assertStatus(404);

        $rows = WebLog::orderBy('id')->get();
        $this->assertSame(['attachment_download', 'attachment_view'], $rows->pluck('event_type')->all());
        $this->assertStringContainsString("Attachment #{$attachment->id} of WebRawRequestCommission #{$owner->id}", $rows[0]->description);
        $this->assertStringNotContainsString('Novak', $rows->toJson());
        $this->assertStringNotContainsString('signature', $rows->toJson());
        $this->assertTrue(CoreSecurityEvent::where('event_type', 'invalid_signed_url')->exists());
        $this->assertSame('critical', CoreSecurityEvent::where('event_type', 'path_traversal_attempt')->value('severity'));
    }
}
