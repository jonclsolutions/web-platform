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
 *   their detected type (thumbnails of templates and blocks as WebP) or saved as a file under
 *   their name (`download`), fonts as a download named after their face (FontFace loads them
 *   with fetch); never sniffed, never run as a page (CSP sandbox). An output is shown inline or
 *   saved as a file under its own name; a ZIP of outputs or of library files (images / own
 *   icons, own fonts) is made on request from the items the signed URL names (only those of the
 *   account the URL was issued to, outside the trash).
 * @dependencies CreatorAsset, CreatorFont, CreatorTemplate, CreatorBlock, CreatorOutput, WorkspaceFiles, FontFile
 *   (content types), ZipArchive (ext-zip).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorOutputFile;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Support\FontFile;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use ZipArchive;

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
     * @param string $variant `original` | `thumb` | `download` (route constraint).
     * @return Response 200; 404.
     */
    public function asset(string $id, string $variant): Response
    {
        $asset = CreatorAsset::withTrashed()->find((int) $id);
        $path = $variant === 'thumb' ? $asset?->thumb_path : $asset?->path;
        abort_unless($path && Storage::disk(WorkspaceFiles::DISK)->exists($path), 404);
        if ($variant === 'download') {
            return Storage::disk(WorkspaceFiles::DISK)->download($path, self::assetFileName($asset), ['Content-Type' => $asset->mime] + self::HEADERS);
        }

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

        return Storage::disk(WorkspaceFiles::DISK)->download($font->path, self::fontFileName($font), [
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

    /**
     * @description The thumbnail of a block (also in the trash).
     * @param string $id Block.
     * @return Response 200; 404.
     */
    public function block(string $id): Response
    {
        $path = CreatorBlock::withTrashed()->find((int) $id)?->thumb_path;
        abort_unless($path && Storage::disk(WorkspaceFiles::DISK)->exists($path), 404);

        return Storage::disk(WorkspaceFiles::DISK)->response($path, null, ['Content-Type' => 'image/webp'] + self::HEADERS);
    }

    /**
     * @description The first page of an output (also in the trash): `original` inline, `thumb`
     *   (WebP) inline, `download` as a file named after the output.
     * @param string $id Output.
     * @param string $variant original | thumb | download (route constraint).
     * @return Response 200; 404.
     */
    public function output(string $id, string $variant): Response
    {
        $output = CreatorOutput::withTrashed()->find((int) $id);
        $file = $output?->files()->first();
        $path = $variant === 'thumb' ? $file?->thumb_path : $file?->path;
        abort_unless($path && Storage::disk(WorkspaceFiles::DISK)->exists($path), 404);

        if ($variant === 'download') {
            return Storage::disk(WorkspaceFiles::DISK)->download($path, self::fileName($output->name, $output->format), [
                'Content-Type' => $file->mime,
            ] + self::HEADERS);
        }

        return Storage::disk(WorkspaceFiles::DISK)->response($path, null, [
            'Content-Type' => $variant === 'thumb' ? 'image/webp' : $file->mime,
        ] + self::HEADERS);
    }

    /**
     * @description ZIP of the outputs named by the signed URL (`user`, `ids`) - only outputs of
     *   that account outside the trash; files stored without compression (PNG / JPG are already
     *   compressed), names made unique.
     * @param Request $request Signed request.
     * @return Response 200 the ZIP; 404 nothing to pack.
     */
    public function zip(Request $request): Response
    {
        $ids = array_slice(array_map('intval', explode(',', (string) $request->query('ids', ''))), 0, 200);
        $outputs = CreatorOutput::query()->ownedBy((int) $request->query('user'))->whereIn('id', $ids)->with('files')->orderBy('id')->get();
        abort_if($outputs->isEmpty(), 404);

        $disk = Storage::disk(WorkspaceFiles::DISK);
        $temp = (string) tempnam(sys_get_temp_dir(), 'jsc-zip-');
        $zip = new ZipArchive();
        abort_unless($zip->open($temp, ZipArchive::OVERWRITE) === true, 500);
        $taken = [];
        foreach ($outputs as $output) {
            foreach ($output->files as $file) {
                /** @var CreatorOutputFile $file */
                if (!$disk->exists($file->path)) {
                    continue;
                }
                $suffix = $output->page_count > 1 ? " ({$file->page})" : '';
                $entry = self::uniqueName(self::fileName($output->name . $suffix, $output->format), $taken);
                $zip->addFile($disk->path($file->path), $entry);
                $zip->setCompressionName($entry, ZipArchive::CM_STORE);
            }
        }
        $zip->close();

        return response()->download($temp, 'js-creator-' . Carbon::now()->format('Y-m-d-His') . '.zip', [
            'Content-Type' => 'application/zip',
        ] + self::HEADERS)->deleteFileAfterSend();
    }

    /**
     * @description ZIP of library files named by the signed URL (`user`, `kind` assets | fonts,
     *   `ids`) - only files of that account outside the trash, stored without compression, under
     *   their names (made unique).
     * @param Request $request Signed request.
     * @return Response 200 the ZIP; 404 nothing to pack.
     */
    public function libraryZip(Request $request): Response
    {
        $ids = array_slice(array_map('intval', explode(',', (string) $request->query('ids', ''))), 0, 200);
        $userId = (int) $request->query('user');
        $fonts = $request->query('kind') === 'fonts';
        $items = $fonts
            ? CreatorFont::query()->ownedBy($userId)->whereIn('id', $ids)->orderBy('id')->get()
            : CreatorAsset::query()->ownedBy($userId)->whereIn('id', $ids)->orderBy('id')->get();
        abort_if($items->isEmpty(), 404);

        $disk = Storage::disk(WorkspaceFiles::DISK);
        $temp = (string) tempnam(sys_get_temp_dir(), 'jsc-zip-');
        $zip = new ZipArchive();
        abort_unless($zip->open($temp, ZipArchive::OVERWRITE) === true, 500);
        $taken = [];
        foreach ($items as $item) {
            if (!$disk->exists($item->path)) {
                continue;
            }
            $entry = self::uniqueName($item instanceof CreatorFont ? self::fontFileName($item) : self::assetFileName($item), $taken);
            $zip->addFile($disk->path($item->path), $entry);
            $zip->setCompressionName($entry, ZipArchive::CM_STORE);
        }
        $zip->close();
        $what = $fonts ? 'fonts' : 'library';

        return response()->download($temp, "js-creator-{$what}-" . Carbon::now()->format('Y-m-d-His') . '.zip', [
            'Content-Type' => 'application/zip',
        ] + self::HEADERS)->deleteFileAfterSend();
    }

    /**
     * @description File name of a library image / own icon: its name with the extension of the
     *   stored file (the type detected on upload).
     * @param CreatorAsset $asset
     * @return string
     */
    public static function assetFileName(CreatorAsset $asset): string
    {
        return self::safeName($asset->name, strtolower(pathinfo($asset->path, PATHINFO_EXTENSION)) ?: 'png', 'image');
    }

    /**
     * @description File name of an own font: family, weight and style, e.g. `Brand-700-italic.woff2`.
     * @param CreatorFont $font
     * @return string
     */
    public static function fontFileName(CreatorFont $font): string
    {
        return self::safeName($font->family . '-' . $font->weight . ($font->style === 'italic' ? '-italic' : ''), $font->format, 'font');
    }

    /**
     * @description File name of an output: its name without characters that are not allowed in
     *   file names, with the extension of its format.
     * @param string $name Name of the output.
     * @param string $format png | jpg.
     * @return string
     */
    public static function fileName(string $name, string $format): string
    {
        return self::safeName($name, $format === 'jpg' ? 'jpg' : 'png', 'output');
    }

    /**
     * @description File name without characters that are not allowed in file names (at most
     *   120 characters before the extension).
     * @param string $name Wanted name.
     * @param string $extension Extension without the dot.
     * @param string $fallback Name when nothing is left.
     * @return string
     */
    private static function safeName(string $name, string $extension, string $fallback): string
    {
        $base = trim((string) preg_replace('~[\\\\/:*?"<>|\x00-\x1F\x7F]+~u', '-', $name), " .-");
        $base = mb_substr($base, 0, 120);

        return ($base === '' ? $fallback : $base) . '.' . $extension;
    }

    /**
     * @description Name not used yet in a ZIP: the name itself, or "name (2).png", "(3)" ….
     * @param string $name Wanted name.
     * @param array<string, true> $taken Names used so far (lower case); the result is added.
     * @return string
     */
    private static function uniqueName(string $name, array &$taken): string
    {
        $dot = strrpos($name, '.');
        [$base, $extension] = $dot === false ? [$name, ''] : [substr($name, 0, $dot), substr($name, $dot)];
        $candidate = $name;
        for ($n = 2; isset($taken[mb_strtolower($candidate)]); $n++) {
            $candidate = "{$base} ({$n}){$extension}";
        }
        $taken[mb_strtolower($candidate)] = true;

        return $candidate;
    }
}
