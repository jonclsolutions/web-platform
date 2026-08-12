<?php

/**
 * @file        PublicFileDownloadController.php
 * @path        app/Http/Controllers/Api/PublicFileDownloadController.php
 * @project     RPSW Web
 * @author      RPSW
 * @created     2026
 * @description Serves attachment files for download and inline preview.
 *              Resolves the original, human-readable file name from the
 *              owning DB record so the browser saves/shows the file under
 *              the name the user originally uploaded it as, instead of the
 *              internal random storage name.
 *
 *              Two independent sources are checked, in order:
 *              1. The polymorphic `web_attachments` table (WebAttachment
 *                 model, see HandlesAttachments trait) - used by WebSalesOrder,
 *                 WebRawRequestCommission, and any future entity that adopts
 *                 the trait. Looked up directly by `path` since the stored
 *                 hashed name is already unique - no need to know which
 *                 model/folder owns it.
 *              2. The legacy single-file-per-record models that still use a
 *                 plain "*_path" column - WebJobApplication (cv_files) and
 *                 WebSupportTicket (tickets). See FOLDER_MAP.
 *
 *              Replaces the previous inline closure route in routes/api.php,
 *              which called Storage::download($path) with no explicit
 *              download name - that method falls back to the raw on-disk
 *              file name, which is why downloads used to show the hashed
 *              name instead of the real one.
 * @note        TEMPORARY, SCOPE-LIMITED FIX: this endpoint is intentionally
 *              still public/unauthenticated and reads from the disk recorded
 *              on the attachment (or "public" for the legacy models),
 *              matching current behaviour. A separate, already-planned task
 *              will move attachments to a private disk and require an
 *              authenticated + permission-checked (or signed, single-use
 *              token) request to download them, and will also add audit
 *              logging of who downloaded what. Only the file-name bug is in
 *              scope here.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebAttachment;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebSupportTicket;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @description Reverse-looks-up the original client file name for a
 *              requested storage path (either via the WebAttachment table
 *              or, as a fallback, via FOLDER_MAP) and streams the file back
 *              under that name, either as a forced download or an inline
 *              preview.
 */
class PublicFileDownloadController extends Controller
{
    /**
     * @description Maps a storage sub-folder to the Eloquent model / path
     *              column / original-name column that owns files stored
     *              there. ONLY for legacy models that store a single file
     *              per row via a plain "*_path" column. Multi-attachment
     *              models using `web_attachments` do NOT need an entry here
     *              - they are resolved generically via WebAttachment::path
     *              before this map is even consulted.
     * @var array<string, array{model: class-string, path_column: string, name_column: string}>
     */
    private const FOLDER_MAP = [
        'cv_files' => [
            'model' => WebJobApplication::class,
            'path_column' => 'cv_path',
            'name_column' => 'cv_original_name',
        ],
        'tickets' => [
            'model' => WebSupportTicket::class,
            'path_column' => 'attachment_path',
            'name_column' => 'attachment_original_name',
        ],
    ];

    /**
     * @description Streams the requested file back to the caller under its
     *              original file name where known, forcing a browser
     *              download (Content-Disposition: attachment). Keeps the
     *              exact same route signature as the previous closure
     *              ("/download-file/{folder}/{file}") so no frontend change
     *              is required for the "download" action.
     * @param string $folder
     * @param string $file
     * @return StreamedResponse
     * @throws \Symfony\Component\HttpKernel\Exception\NotFoundHttpException When the file does not exist or the path looks malformed.
     */
    public function download(string $folder, string $file): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($folder, $file);

        return Storage::disk($disk)->download($relativePath, $displayName);
    }

    /**
     * @description Streams the requested file back to the caller for
     *              in-browser preview (Content-Disposition: inline) instead
     *              of forcing a download - used by "view attachment" /
     *              "open in new tab" actions in the admin, which must NOT
     *              link directly to a public storage symlink (that bypasses
     *              this controller entirely and serves the raw hashed file
     *              name with no way to rename it). Same original-file-name
     *              resolution as download().
     * @param string $folder
     * @param string $file
     * @return StreamedResponse
     * @throws \Symfony\Component\HttpKernel\Exception\NotFoundHttpException When the file does not exist or the path looks malformed.
     */
    public function view(string $folder, string $file): StreamedResponse
    {
        [$disk, $relativePath, $displayName] = $this->resolveRequest($folder, $file);

        return Storage::disk($disk)->response($relativePath, $displayName, [
            'Content-Disposition' => 'inline; filename="' . addslashes($displayName) . '"',
        ]);
    }

    /**
     * @description Shared validation + original-name resolution used by both
     *              download() and view(), so the traversal guard and lookup
     *              logic exist in exactly one place. Tries the polymorphic
     *              `web_attachments` table first (covers WebSalesOrder,
     *              WebRawRequestCommission, and future entities), then falls
     *              back to FOLDER_MAP for the two legacy single-file models.
     * @param string $folder
     * @param string $file
     * @return array{0: string, 1: string, 2: string} [$disk, $relativePath, $displayName]
     * @throws \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
     */
    private function resolveRequest(string $folder, string $file): array
    {
        // Defensive check kept even though this is a narrow, scope-limited
        // fix: reject anything that looks like a traversal attempt instead
        // of relying solely on Storage::exists() to contain the path.
        if (str_contains($folder, '..') || str_contains($file, '..') || str_contains($file, '/')) {
            abort(404);
        }

        $relativePath = $folder . '/' . $file;

        // 1) Polymorphic multi-attachment table (WebSalesOrder, WebRawRequestCommission, ...).
        //    The on-disk path is already a unique random hash, so a direct
        //    match against `path` is enough - the folder segment tells us
        //    nothing extra we need here.
        $attachment = WebAttachment::where('path', $relativePath)->first();

        if ($attachment !== null) {
            $disk = $attachment->disk ?: 'public';

            if (!Storage::disk($disk)->exists($relativePath)) {
                abort(404);
            }

            $displayName = $attachment->original_filename ?: $file;

            return [$disk, $relativePath, $displayName];
        }

        // 2) Legacy single-file-per-record models (WebJobApplication, WebSupportTicket).
        if (!Storage::disk('public')->exists($relativePath)) {
            abort(404);
        }

        $displayName = $this->resolveOriginalName($folder, $relativePath) ?? $file;

        return ['public', $relativePath, $displayName];
    }

    /**
     * @description Looks up the human-readable original file name for a
     *              given stored path using the FOLDER_MAP. Includes
     *              soft-deleted rows (withTrashed) since rejected /
     *              archived applications and tickets must remain
     *              downloadable by staff who already have access to this
     *              endpoint.
     * @param string $folder
     * @param string $relativePath
     * @return string|null Null when the folder is unmapped, the record was hard-deleted, or no name was ever stored for it (legacy upload, predates this fix).
     */
    private function resolveOriginalName(string $folder, string $relativePath): ?string
    {
        $mapping = self::FOLDER_MAP[$folder] ?? null;

        if ($mapping === null) {
            return null;
        }

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