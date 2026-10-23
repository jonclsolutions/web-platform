<?php

/**
 * @file AttachmentDownloadTest.php
 * @path api/tests/Feature/Other/AttachmentDownloadTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the attachment download / preview (AttachmentDownloadController):
 *   only signed, unexpired URLs work; files of web_attachments (any disk) are served under their
 *   original name; legacy public files (CVs, ticket attachments) are no longer served and the
 *   command `attachments:migrate-legacy` moves them to the private disk (finding #31).
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fakes (private, public).
 */

namespace Tests\Feature\Other;

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
     * @description `attachments:migrate-legacy` moves legacy CVs / ticket attachments to the private
     *   disk as web_attachments (also of trashed records); --dry-run changes nothing; a missing file
     *   only clears the columns; a second run finds nothing; the migrated file is served signed.
     * @input Trashed application cv_files/a.pdf 'Eva CV.pdf'; application web/cv_files/b.pdf without name;
     *        ticket tickets/t.png 'Screen.png'; ticket with tickets/none.png (no file); dry-run, run, run.
     * @output dry-run: nothing moved, files still public; run: 3 moved, 1 missing, exit 0; private files
     *   web/cv_files/a.pdf, web/cv_files/b.pdf, web/tickets/t.png with names 'Eva CV.pdf', 'b.pdf', 'Screen.png';
     *   public files gone; legacy columns null; second run 0 moved; view of the migrated CV 'Eva CV.pdf'.
     */
    public function test_migrate_legacy_command(): void
    {
        foreach (['cv_files/a.pdf', 'web/cv_files/b.pdf', 'tickets/t.png'] as $path) {
            Storage::disk('public')->put($path, 'data-' . $path);
        }
        $a = $this->jobApplication();
        $a->forceFill(['cv_path' => 'cv_files/a.pdf', 'cv_original_name' => 'Eva CV.pdf'])->save();
        $a->delete();
        $b = $this->jobApplication();
        $b->forceFill(['cv_path' => 'web/cv_files/b.pdf', 'cv_original_name' => ''])->save();
        $t = $this->ticket();
        $t->forceFill(['attachment_path' => 'tickets/t.png', 'attachment_original_name' => 'Screen.png'])->save();
        $gone = $this->ticket();
        $gone->forceFill(['attachment_path' => 'tickets/none.png', 'attachment_original_name' => 'None.png'])->save();

        $this->artisan('attachments:migrate-legacy', ['--dry-run' => true])
            ->expectsOutputToContain('[dry-run] would move 3 file(s); missing 1; failed 0.')->assertSuccessful();
        Storage::disk('public')->assertExists('cv_files/a.pdf');
        $this->assertSame(0, \App\Models\Web\WebAttachment::count());
        $this->assertSame('tickets/none.png', $gone->fresh()->attachment_path);

        $this->artisan('attachments:migrate-legacy')->expectsOutputToContain('Moved 3 file(s); missing 1; failed 0.')->assertSuccessful();
        foreach (['web/cv_files/a.pdf' => 'Eva CV.pdf', 'web/cv_files/b.pdf' => 'b.pdf', 'web/tickets/t.png' => 'Screen.png'] as $path => $name) {
            Storage::disk('private')->assertExists($path);
            $this->assertSame($name, \App\Models\Web\WebAttachment::where('path', $path)->value('original_filename'));
        }
        $this->assertSame('data-cv_files/a.pdf', Storage::disk('private')->get('web/cv_files/a.pdf'));
        Storage::disk('public')->assertMissing('cv_files/a.pdf');
        Storage::disk('public')->assertMissing('tickets/t.png');
        $this->assertNull(\App\Models\Web\WebJobApplication::withTrashed()->find($a->id)->cv_path);
        $this->assertNull($gone->fresh()->attachment_path);
        $this->assertSame(1, \App\Models\Web\WebJobApplication::withTrashed()->find($a->id)->attachments()->count());

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
}
