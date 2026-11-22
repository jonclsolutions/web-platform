<?php
/**
 * @file FileController.php
 * @path app/Apps/JsCreator/Http/Controllers/FileController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Files of the workspaces - reachable ONLY through the signed URLs that
 *   WorkspaceFiles issues to the owner (route middleware `signed:relative`; a changed or expired
 *   URL is refused and recorded as a security event by the core). Images are served inline with
 *   their detected type (thumbnails of templates as WebP), fonts as a download (FontFace loads them with fetch); never sniffed,
 *   never run as a page (CSP sandbox).
 * @dependencies CreatorAsset, CreatorFont, CreatorTemplate, WorkspaceFiles, FontFile (content types).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Support\FontFile;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class FileController extends Controller
{
    /** @description Headers of every file answer. */
    private const HEADERS = [
        'Cache-Control'           => 'private, max-age=3600',
        'X-Content-Type-Options'  => 'nosniff',
        'Content-Security-Policy' => "default-src 'none'; sandbox",
    ];

    /**
     * @description An image of a library (also in the trash - its owner sees it there).
     * @param string $id Image.
     * @param string $variant `original` | `thumb` (route constraint).
     * @return Response 200; 404.
     */
    public function asset(string $id, string $variant): Response
    {
        $asset = CreatorAsset::withTrashed()->find((int) $id);
        $path = $variant === 'thumb' ? $asset?->thumb_path : $asset?->path;
        abort_unless($path && Storage::disk(WorkspaceFiles::DISK)->exists($path), 404);

        return Storage::disk(WorkspaceFiles::DISK)->response($path, null, [
            'Content-Type' => $variant === 'thumb' ? 'image/webp' : $asset->mime,
        ] + self::HEADERS);
    }

    /**
     * @description An own font (also in the trash).
     * @param string $id Font.
     * @return Response 200; 404.
     */
    public function font(string $id): Response
    {
        $font = CreatorFont::withTrashed()->find((int) $id);
        abort_unless($font && Storage::disk(WorkspaceFiles::DISK)->exists($font->path), 404);

        return Storage::disk(WorkspaceFiles::DISK)->download($font->path, "font.{$font->format}", [
            'Content-Type' => FontFile::MIME_TYPES[$font->format] ?? 'application/octet-stream',
        ] + self::HEADERS);
    }

    /**
     * @description The thumbnail of a template (also in the trash).
     * @param string $id Template.
     * @return Response 200; 404.
     */
    public function template(string $id): Response
    {
        $path = CreatorTemplate::withTrashed()->find((int) $id)?->thumb_path;
        abort_unless($path && Storage::disk(WorkspaceFiles::DISK)->exists($path), 404);

        return Storage::disk(WorkspaceFiles::DISK)->response($path, null, ['Content-Type' => 'image/webp'] + self::HEADERS);
    }
}
