<?php

/**
 * @file AttachmentDownloadTest.php
 * @path api/tests/Feature/Other/AttachmentDownloadTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the attachment download / preview (AttachmentDownloadController):
 *   only signed, unexpired URLs work; files of web_attachments (any disk) and of the legacy
 *   single-file columns (CVs, ticket attachments) are served under their original name.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fakes (private, public).
 */

namespace Tests\Feature\Other;

use App\Models\Web\WebJobApplication;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\Support\WebFixtures;
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
     * @description Signed URL of an attachment route (10 minutes, like WebAttachmentResource).
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
     * @input Attachment 'Nabídka 2026.pdf' on private disk; public-disk attachment without name;
     *        attachment row whose file is gone; unknown path.
     * @output download: attachment; filename "Nabídka 2026.pdf" (ASCII fallback) + content; view: inline;
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
        $this->assertSame('inline; filename="Nabídka 2026.pdf"', $view->headers->get('Content-Disposition'));

        $this->assertStringContainsString('pub.pdf', $this->get($this->signed('download', 'web/x/pub.pdf'))->assertOk()->headers->get('Content-Disposition'));
        $this->get($this->signed('download', $gone->path))->assertStatus(404);
        $this->get($this->signed('download', 'web/x/none.pdf'))->assertStatus(404);
    }

    /**
     * @description Legacy single-file records on the public disk: CVs by folder 'cv_files' or
     *   'web/cv_files' and ticket attachments; the original name comes from the record (also a
     *   trashed one), else the stored file name; a file without record is served under its name,
     *   a missing file is 404.
     * @input Trashed job application with cv_files/a.pdf 'Eva CV.pdf'; web/cv_files/b.pdf with empty
     *        name; ticket tickets/t.png 'Screen.png'; cv_files/orphan.pdf without record; cv_files/none.pdf.
     * @output Names 'Eva CV.pdf', 'b.pdf', 'Screen.png', 'orphan.pdf'; 404.
     */
    public function test_legacy_files(): void
    {
        foreach (['cv_files/a.pdf', 'web/cv_files/b.pdf', 'tickets/t.png', 'cv_files/orphan.pdf'] as $path) {
            Storage::disk('public')->put($path, 'x');
        }
        $application = $this->jobApplication();
        $application->forceFill(['cv_path' => 'cv_files/a.pdf', 'cv_original_name' => 'Eva CV.pdf'])->save();
        $application->delete();
        $this->jobApplication()->forceFill(['cv_path' => 'web/cv_files/b.pdf', 'cv_original_name' => ''])->save();
        $this->ticket()->forceFill(['attachment_path' => 'tickets/t.png', 'attachment_original_name' => 'Screen.png'])->save();

        $name = fn (string $path) => $this->get($this->signed('view', $path))->assertOk()->headers->get('Content-Disposition');
        $this->assertSame('inline; filename="Eva CV.pdf"', $name('cv_files/a.pdf'));
        $this->assertSame('inline; filename="b.pdf"', $name('web/cv_files/b.pdf'));
        $this->assertSame('inline; filename="Screen.png"', $name('tickets/t.png'));
        $this->assertSame('inline; filename="orphan.pdf"', $name('cv_files/orphan.pdf'));
        $this->get($this->signed('download', 'cv_files/none.pdf'))->assertStatus(404);
        $this->get($this->signed('download', 'unknown/file.pdf'))->assertStatus(404);
        $this->assertSame(1, WebJobApplication::onlyTrashed()->count());
    }
}
