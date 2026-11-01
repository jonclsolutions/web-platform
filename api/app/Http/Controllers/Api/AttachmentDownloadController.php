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
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebAttachment;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentDownloadController extends Controller
{
    /**
     * @description Streams the requested file back to the caller under its
     *              original file name, forcing a browser download.
     * @param string $path Full storage-relative path, e.g. "web/raw_request_commissions/abc123.pdf".
     * @return StreamedResponse
     */
    public function download(string $path): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($path);

        return Storage::disk($disk)->download($relativePath, $displayName);
    }

    /**
     * @description Streams the requested file back to the caller for in-browser
     *              preview (Content-Disposition: inline) instead of forcing a download.
     * @param string $path Full storage-relative path.
     * @return StreamedResponse
     */
    public function view(string $path): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($path);

        return Storage::disk($disk)->response($relativePath, $displayName, [
            'Content-Disposition' => 'inline; filename="' . addslashes($displayName) . '"',
        ]);
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
