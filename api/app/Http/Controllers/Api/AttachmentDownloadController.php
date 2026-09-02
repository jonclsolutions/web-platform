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
 * Two independent sources are checked, in order:
 * 1. The polymorphic `web_attachments` table (WebAttachment model) - looked up
 *    directly by `path`, disk podle `$attachment->disk` (private i public).
 * 2. The legacy single-file-per-record models that still use a plain "*_path"
 *    column - WebJobApplication (cv_files) and WebSupportTicket (tickets), pro
 *    záznamy vzniklé PŘED přechodem na `web_attachments`. Tahle větev zůstává
 *    natrvalo na `public` disku (viz FOLDER_MAP `disk` klíč) - je to čistě
 *    zpětná kompatibilita se starými soubory, nová data touto větví neprochází.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebSupportTicket;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentDownloadController extends Controller
{
    /**
     * @description Maps a legacy storage sub-folder to the Eloquent model / path
     *              column / original-name column / disk that owns files stored
     *              there. ONLY for legacy pre-migration records that store a single
     *              file per row via a plain "*_path" column - multi-attachment
     *              records (via `web_attachments`) are resolved generically before
     *              this map is even consulted, regardless of disk.
     * @var array<string, array{model: class-string, path_column: string, name_column: string, disk: string}>
     */
private const FOLDER_MAP = [
    'cv_files' => [
        'model'       => WebJobApplication::class,
        'path_column' => 'cv_path',
        'name_column' => 'cv_original_name',
        'disk'        => 'public',
    ],
    'tickets' => [
        'model'       => WebSupportTicket::class,
        'path_column' => 'attachment_path',
        'name_column' => 'attachment_original_name',
        'disk'        => 'public',
    ],
];

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

        // 1) Polymorphic multi-attachment table - resolves disk (private/public) per row.
        $attachment = WebAttachment::where('path', $path)->first();

        if ($attachment !== null) {
            $disk = $attachment->disk ?: 'private';

            if (!Storage::disk($disk)->exists($path)) {
                abort(404);
            }

            $displayName = $attachment->original_filename ?: basename($path);

            return [$disk, $path, $displayName];
        }

        // 2) Legacy single-file-per-record models - always on 'public' disk (see FOLDER_MAP).
        $folder = dirname($path); // e.g. "cv_files" or "web/cv_files" pre/post prefixing
        $mapping = self::FOLDER_MAP[$folder] ?? self::FOLDER_MAP[basename($folder)] ?? null;

        if ($mapping === null || !Storage::disk($mapping['disk'])->exists($path)) {
            abort(404);
        }

        $displayName = $this->resolveOriginalName($mapping, $path) ?? basename($path);

        return [$mapping['disk'], $path, $displayName];
    }

    /**
     * @description Looks up the human-readable original file name for a given stored
     *              path using a resolved FOLDER_MAP entry. Includes soft-deleted rows
     *              (withTrashed) since rejected/archived applications and tickets
     *              must remain downloadable by staff who already have access.
     * @param array{model: class-string, path_column: string, name_column: string, disk: string} $mapping
     * @param string $relativePath
     * @return string|null
     */
    private function resolveOriginalName(array $mapping, string $relativePath): ?string
    {
        /** @var class-string<\Illuminate\Database\Eloquent\Model> $modelClass */
        $modelClass = $mapping['model'];

        $record = $modelClass::withTrashed()
            ->where($mapping['path_column'], $relativePath)
            ->first();

        if ($record === null) {
            return null;
        }

        $originalName = $record->{$mapping['name_column']} ?? null;

        return ($originalName !== null && $originalName !== '') ? $originalName : null;
    }
}