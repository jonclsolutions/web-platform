<?php

/**
 * @file        AttachmentDownloadController.php
 * @path        app/Http/Controllers/Api/AttachmentDownloadController.php
 * @project     RPSW Web
 * @author      RPSW
 * @created     2026
 * @description Serves attachment files for download and inline preview, resolving the
 *              original human-readable file name from the owning DB record.
 *
 * @refactor-note (2026-08-31) BACKLOG "privátní úložiště citlivých příloh": PŘEJMENOVÁN
 * z `PublicFileDownloadController` - už není "Public", protože routy nyní vyžadují
 * platný Laravel `signed` middleware podpis (viz routes/api.php - `attachments.download`/
 * `attachments.view` route names). Přílohy se dnes typicky ukládají na `private` disk
 * (viz HandlesAttachments::storeAttachments() default), který je fyzicky nedosažitelný
 * přímo přes webserver (žádný symlink) - jediná cesta k souboru je přes tenhle
 * controller. Autorizace probíhá NEPŘÍMO: krátkodobě podepsanou (10 min TTL) URL
 * vygeneruje `WebAttachmentResource` teprve poté, co admin projde autentizovaným a
 * permission-gated endpointem (`GET web/raw_request_commissions/{id}` apod.) - stejná
 * ochrana jako dnes, jen se ověřuje na jiném místě (při vydání URL, ne při stažení).
 *
 * Route parametr se změnil z DVOU segmentů (`{folder}/{file}`) na JEDEN wildcard
 * (`{path}`) - moduly teď mají prefixované cesty (`web/raw_request_commissions/...`),
 * takže "folder" segment sám o sobě může obsahovat lomítko a dva oddělené route
 * parametry by kolidovaly.
 *
 * Files are resolved from the polymorphic `web_attachments` table (WebAttachment model),
 * looked up by `path`, disk per row (`$attachment->disk`, private by default).
 *
 * @refactor-note (2026-10-23) Open finding #31 (GDPR): the second, legacy source - CVs
 * (`web_job_applications.cv_path`) and ticket attachments (`web_support_tickets.attachment_path`)
 * on the PUBLIC disk - was removed. Those files were reachable without a signed URL through the
 * public storage link, and no resource generates links to them any more. The one-time command
 * `php artisan attachments:migrate-legacy` moves them to the private disk as web_attachments.
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
