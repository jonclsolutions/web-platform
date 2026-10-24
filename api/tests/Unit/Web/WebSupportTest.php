<?php

/**
 * @file WebSupportTest.php
 * @path api/tests/Unit/Web/WebSupportTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the web helpers called directly: the AttachmentsTotalSize rule,
 *   the HandlesAttachments trait edge cases (invalid uploads skipped, nothing to remove) and
 *   the CheckWebActive maintenance middleware.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures; Storage fake.
 */

namespace Tests\Unit\Web;

use App\Http\Middleware\CheckWebActive;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebSiteSetting;
use App\Rules\AttachmentsTotalSize;
use App\Traits\HandlesAttachments;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Rules\AttachmentsTotalSize, App\Traits\HandlesAttachments, App\Http\Middleware\CheckWebActive.
 */
class WebSupportTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Runs the rule and returns the failure messages.
     * @param mixed $value Validated value.
     * @param int $maxBytes Limit.
     * @return string[]
     */
    private function totalSize(mixed $value, int $maxBytes): array
    {
        $errors = [];
        (new AttachmentsTotalSize($maxBytes))->validate('attachments', $value, function (string $message) use (&$errors) {
            $errors[] = $message;
        });

        return $errors;
    }

    /**
     * @description The total-size rule ignores non-array values and non-file items, passes at
     *   the limit and fails above it with the limit in MB.
     * @input 'x'; [2 KB file, 'text'] with limit 2 KB; [2 × 600 KB] with limit 1 MB.
     * @output []; []; ['The total size of all attachments must not exceed 1 MB.'].
     */
    public function test_attachments_total_size_rule(): void
    {
        $this->assertSame([], $this->totalSize('x', 1));
        $this->assertSame([], $this->totalSize([UploadedFile::fake()->create('a.pdf', 2), 'text'], 2048));
        $this->assertSame(
            ['The total size of all attachments must not exceed 1 MB.'],
            $this->totalSize([UploadedFile::fake()->create('a.pdf', 600), UploadedFile::fake()->create('b.pdf', 600)], 1024 * 1024)
        );
    }

    /**
     * @description Object exposing the protected trait methods.
     * @return object
     */
    private function handler(): object
    {
        return new class {
            use HandlesAttachments;

            /** Proxies a protected trait method. */
            public function __call(string $method, array $args): mixed
            {
                return $this->{$method}(...$args);
            }
        };
    }

    /**
     * @description Uploads that did not arrive completely are skipped (multi and single),
     *   removing an empty id list is a no-op.
     * @input Request with attachments [partial upload, ok.pdf] and attachment = partial upload;
     *        deleteAttachmentsByIds([]) on a record with one attachment.
     * @output Only ok.pdf stored; single upload stores nothing; existing attachment kept.
     */
    public function test_handles_attachments_edge_cases(): void
    {
        Storage::fake('private');
        $partial = new UploadedFile(UploadedFile::fake()->create('p.pdf', 1)->getPathname(), 'p.pdf', 'application/pdf', UPLOAD_ERR_PARTIAL, true);
        $request = Request::create('/x', 'POST', [], [], ['attachments' => [$partial, UploadedFile::fake()->create('ok.pdf', 1)], 'attachment' => $partial]);
        $record = $this->rawRequest();
        $handler = $this->handler();

        $handler->storeAttachments($request, $record, 'web/test');
        $this->assertSame(['ok.pdf'], $record->attachments()->pluck('original_filename')->all());

        $ticket = $this->ticket();
        $handler->storeSingleAttachment($request, $ticket, 'web/test', 'attachment');
        $this->assertSame(0, $ticket->attachments()->count());

        $handler->deleteAttachmentsByIds($record, []);
        $this->assertSame(1, WebAttachment::count());
    }

    /**
     * @description Runs the maintenance middleware for one request.
     * @return Response
     */
    private function webActive(): Response
    {
        Cache::forget('site_setting_active_web');

        return (new CheckWebActive())->handle(Request::create('/api/x'), fn () => response()->json(['ok' => true]));
    }

    /**
     * @description The maintenance middleware lets requests through while the web is active
     *   (creating the default settings row when missing) and answers 503 with the configured
     *   or default message otherwise.
     * @input No settings row; web inactive with message 'Back at 10'; inactive without message.
     * @output 200 + row created; 503 'Back at 10'; 503 default message.
     */
    public function test_check_web_active(): void
    {
        $this->assertSame(200, $this->webActive()->getStatusCode());
        $this->assertTrue((bool) WebSiteSetting::findOrFail(1)->is_web_active);

        WebSiteSetting::whereKey(1)->update(['is_web_active' => false, 'web_maintenance_message' => 'Back at 10']);
        $response = $this->webActive();
        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame(['message' => 'Back at 10'], $response->getData(true));

        WebSiteSetting::whereKey(1)->update(['web_maintenance_message' => null]);
        $this->assertSame('We apologize, the website is currently undergoing maintenance.', $this->webActive()->getData(true)['message']);
    }
}
