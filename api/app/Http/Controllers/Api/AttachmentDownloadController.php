<?php

/**
 * @file        AttachmentDownloadController.php
 * @path        app/Http/Controllers/Api/AttachmentDownloadController.php
 * @project     JS web-platform
 * @author      JS
 * @created     2026
 * @description Serves attachment files for download and inline preview, resolving the
 *              original human-readable file name from the owning DB record.
 *              The route takes ONE wildcard `{path}` - module paths contain slashes
 *              (`web/raw_request_commissions/...`).
 *              Files are resolved from the polymorphic `web_attachments` table (WebAttachment),
 *              looked up by `path`, disk per row (`$attachment->disk`, private by default).
 * @security The files are uploaded by the public (inquiries, orders, portal threads) and the API
 *              runs on the same origin as the admin, so a file the browser renders as a page
 *              (HTML, SVG, XML) would run its script in the admin. Therefore:
 *              - only AttachmentPolicy::INLINE_MIME_TYPES (PDF, JPEG, PNG, GIF, WebP) are ever
 *                served inline - the type is detected from the stored CONTENT, never taken from
 *                the name or the upload; anything else is sent as a download, also by view();
 *              - every answer carries `X-Content-Type-Options: nosniff` (the browser must not
 *                guess another type) and, except PDF, a sandbox CSP (no script, no same-origin
 *                access even if a file is rendered);
 *              - Content-Disposition is built by Symfony (RFC 6266, ASCII fallback + filename*).
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebAttachment;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentDownloadController extends Controller
{
    /** @description CSP of a served file: nothing may run or load, the document is sandboxed. */
    private const SANDBOX_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

    /**
     * @description CSP of an inline PDF - no sandbox (the browser PDF viewers refuse a sandboxed
     * document), only no framing by other sites.
     */
    private const PDF_CSP = "frame-ancestors 'self'";

    /**
     * @description Streams the requested file back to the caller under its
     *              original file name, forcing a browser download.
     * @param string $path Full storage-relative path, e.g. "web/raw_request_commissions/abc123.pdf".
     * @return StreamedResponse
     */
    public function download(string $path): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($path);

        return Storage::disk($disk)->download($relativePath, $displayName, $this->securityHeaders(self::SANDBOX_CSP));
    }

    /**
     * @description Streams the requested file for in-browser preview (Content-Disposition:
     *              inline) - but ONLY when its content is a previewable type
     *              (AttachmentPolicy::INLINE_MIME_TYPES); any other file is sent as a download.
     * @param string $path Full storage-relative path.
     * @return StreamedResponse
     */
    public function view(string $path): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($path);
        $storage = Storage::disk($disk);
        $mimeType = strtolower((string) $storage->mimeType($relativePath));

        if (!AttachmentPolicy::isInlineMimeType($mimeType)) {
            return $storage->download($relativePath, $displayName, $this->securityHeaders(self::SANDBOX_CSP));
        }

        $csp = $mimeType === 'application/pdf' ? self::PDF_CSP : self::SANDBOX_CSP;

        return $storage->response(
            $relativePath,
            $displayName,
            ['Content-Type' => $mimeType] + $this->securityHeaders($csp),
            'inline'
        );
    }

    /**
     * @description Headers sent with every served file.
     * @param string $csp Content-Security-Policy of the answer.
     * @return array<string, string>
     */
    private function securityHeaders(string $csp): array
    {
        return [
            'X-Content-Type-Options'  => 'nosniff',
            'Content-Security-Policy' => $csp,
        ];
    }

    /**
     * @description Shared validation + original-name resolution used by both
     *              download() and view().
     * @param string $path
     * @return array{0: string, 1: string, 2: string} [$disk, $relativePath, $displayName]
     * @throws \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
     */
    private function resolveRequest(string $path): array
    {
        // Defensive check - reject anything that looks like a traversal attempt,
        // even though `signed` middleware already guarantees the request wasn't
        // tampered with after URL generation.
        if (str_contains($path, '..')) {
            abort(404);
        }

        $attachment = WebAttachment::where('path', $path)->first();

        if ($attachment === null) {
            abort(404);
        }

        $disk = $attachment->disk ?: 'private';

        if (!Storage::disk($disk)->exists($path)) {
            abort(404);
        }

        return [$disk, $path, $attachment->original_filename ?: basename($path)];
    }
}
