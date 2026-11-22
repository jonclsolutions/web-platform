<?php
/**
 * @file WorkspaceFiles.php
 * @path app/Apps/JsCreator/Support/WorkspaceFiles.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Files of the workspaces of JS Creator on the private disk: one folder per account
 *   (`js-creator/<user_id>/<kind>/<random>.<ext>`), paths generated only here (never from user
 *   input), and the signed URLs that show them (routes `js-creator.files.*`).
 *   - The URLs are RELATIVE (`signed:relative`, like the profile photos): the browser loads them
 *     from the origin of the admin, also behind a proxy.
 *   - They are valid until the end of the next full hour and do not change within an hour, so
 *     the browser can cache a thumbnail; `v` (file name) changes with every new file.
 *   - A ZIP of outputs has its own short-lived URL bound to the account and the chosen outputs.
 * @note The folder is NOT an upload folder of the core (AppManifest::uploadFolders()): the core
 *   command storage:prune-orphans knows only attachments and would delete these files. Files
 *   without a record are removed by JsCreatorRetentionSource::cleanUp().
 * @dependencies private disk; routes `js-creator.files.asset`, `js-creator.files.font`,
 *   `js-creator.files.template`, `js-creator.files.block`, `js-creator.files.output`,
 *   `js-creator.files.zip`.
 */

namespace App\Apps\JsCreator\Support;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorTemplate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

final class WorkspaceFiles
{
    /** @description Disk of the files (never public). */
    public const DISK = 'private';

    /** @description Root folder of every workspace on DISK. */
    public const ROOT = 'js-creator';

    /** @description Validity of the URL of a ZIP of outputs (minutes). */
    public const ZIP_MINUTES = 10;

    /**
     * @description New unique path of a file of an account.
     * @param int $userId Owner.
     * @param string $kind Sub-folder: `library`, `thumbs`, `fonts`, `templates`, `blocks`, `outputs` (`staging` - see stagedPaths()).
     * @param string $extension File extension (from the detected type, never from the upload name).
     * @return string Path on DISK.
     */
    public static function newPath(int $userId, string $kind, string $extension): string
    {
        return self::ROOT . "/{$userId}/{$kind}/" . Str::random(32) . '.' . $extension;
    }

    /**
     * @description Stores the content of a file.
     * @param string $path Path from newPath().
     * @param string $content Binary content.
     * @return void
     */
    public static function put(string $path, string $content): void
    {
        Storage::disk(self::DISK)->put($path, $content);
    }

    /**
     * @description Deletes files (missing ones and nulls are ignored).
     * @param array<int, string|null> $paths Paths on DISK.
     * @return void
     */
    public static function delete(array $paths): void
    {
        $paths = array_values(array_filter($paths));
        if ($paths !== []) {
            Storage::disk(self::DISK)->delete($paths);
        }
    }

    /**
     * @description Signed URL of an image of the library.
     * @param CreatorAsset $asset Image.
     * @param string $variant `original` | `thumb` (shown in the page) | `download` (saved as a file under its name).
     * @return string Relative URL.
     */
    public static function assetUrl(CreatorAsset $asset, string $variant): string
    {
        $path = $variant === 'thumb' ? $asset->thumb_path : $asset->path;

        return URL::temporarySignedRoute('js-creator.files.asset', self::expiry(), [
            'id' => $asset->id, 'variant' => $variant, 'v' => pathinfo($path, PATHINFO_FILENAME),
        ], false);
    }

    /**
     * @description Signed URL of an own font.
     * @param CreatorFont $font Font.
     * @return string Relative URL.
     */
    public static function fontUrl(CreatorFont $font): string
    {
        return URL::temporarySignedRoute('js-creator.files.font', self::expiry(), [
            'id' => $font->id, 'v' => pathinfo($font->path, PATHINFO_FILENAME),
        ], false);
    }

    /**
     * @description Signed URL of the thumbnail of a template.
     * @param CreatorTemplate $template Template with a thumbnail.
     * @return string|null Relative URL; null without a thumbnail.
     */
    public static function templateThumbUrl(CreatorTemplate $template): ?string
    {
        if ($template->thumb_path === null) {
            return null;
        }

        return URL::temporarySignedRoute('js-creator.files.template', self::expiry(), [
            'id' => $template->id, 'v' => pathinfo($template->thumb_path, PATHINFO_FILENAME),
        ], false);
    }

    /**
     * @description Signed URL of the thumbnail of a block.
     * @param CreatorBlock $block Block with a thumbnail.
     * @return string|null Relative URL; null without a thumbnail.
     */
    public static function blockThumbUrl(CreatorBlock $block): ?string
    {
        if ($block->thumb_path === null) {
            return null;
        }

        return URL::temporarySignedRoute('js-creator.files.block', self::expiry(), [
            'id' => $block->id, 'v' => pathinfo($block->thumb_path, PATHINFO_FILENAME),
        ], false);
    }

    /**
     * @description Signed URL of a page of an output (the first page by default).
     * @param CreatorOutput $output Output with its files loaded.
     * @param string $variant `original` (shown in the page), `thumb` (lists), `download` (saved as a file).
     * @param int $page Page (1 = the first; a carousel has more).
     * @return string|null Relative URL; null when the output has no such page.
     */
    public static function outputUrl(CreatorOutput $output, string $variant, int $page = 1): ?string
    {
        $file = $output->files->firstWhere('page', $page);
        if ($file === null) {
            return null;
        }
        $params = ['id' => $output->id, 'variant' => $variant, 'v' => pathinfo($variant === 'thumb' ? $file->thumb_path : $file->path, PATHINFO_FILENAME)];
        if ($page > 1) {
            $params['page'] = $page;
        }

        return URL::temporarySignedRoute('js-creator.files.output', self::expiry(), $params, false);
    }

    /**
     * @description A new token of a staged page of a carousel output (the name of its files).
     * @return string 32 letters / digits.
     */
    public static function newStageToken(): string
    {
        return Str::random(32);
    }

    /**
     * @description Paths of a staged page of an account: the converted picture and its thumbnail.
     *   Staged files have no row - an unused one is removed by the clean-up of files without a
     *   record (JsCreatorRetentionSource, after a day).
     * @param int $userId Owner.
     * @param string $token Token of the page (STAGE_TOKEN).
     * @param string $extension Extension of the picture (png | jpg).
     * @return array{0: string, 1: string} Picture, thumbnail.
     */
    public static function stagedPaths(int $userId, string $token, string $extension): array
    {
        $base = self::ROOT . "/{$userId}/staging/{$token}";

        return ["{$base}.{$extension}", "{$base}-thumb.webp"];
    }

    /**
     * @description Size of the staged pages of an account (they count when a new page is staged,
     *   so an unfinished carousel cannot fill the disk past the quota).
     * @param int $userId Owner.
     * @return int Bytes.
     */
    public static function stagedBytes(int $userId): int
    {
        $disk = Storage::disk(self::DISK);
        $folder = self::ROOT . "/{$userId}/staging";

        return $disk->exists($folder) ? array_sum(array_map(fn (string $path) => $disk->size($path), $disk->files($folder))) : 0;
    }

    /**
     * @description Moves a file on DISK (a staged page into the outputs).
     * @param string $from Path.
     * @param string $to Path.
     * @return void
     */
    public static function move(string $from, string $to): void
    {
        Storage::disk(self::DISK)->move($from, $to);
    }

    /**
     * @description Signed URL of a ZIP with outputs of an account (valid ZIP_MINUTES).
     * @param int $userId Owner of the outputs.
     * @param array<int, int> $ids Outputs (already checked to be own).
     * @return string Relative URL.
     */
    public static function zipUrl(int $userId, array $ids): string
    {
        return URL::temporarySignedRoute('js-creator.files.zip', Carbon::now()->addMinutes(self::ZIP_MINUTES), [
            'user' => $userId, 'ids' => implode(',', $ids),
        ], false);
    }

    /**
     * @description Signed URL of a ZIP with library files of an account (valid ZIP_MINUTES).
     * @param int $userId Owner of the files.
     * @param string $kind `assets` (images / own icons) | `fonts`.
     * @param array<int, int> $ids Files (already checked to be own).
     * @return string Relative URL.
     */
    public static function libraryZipUrl(int $userId, string $kind, array $ids): string
    {
        return URL::temporarySignedRoute('js-creator.files.library-zip', Carbon::now()->addMinutes(self::ZIP_MINUTES), [
            'user' => $userId, 'kind' => $kind, 'ids' => implode(',', $ids),
        ], false);
    }

    /**
     * @description Expiry of the signed URLs: the end of the next full hour (1-2 hours, the same
     *   URL within one hour).
     * @return Carbon
     */
    private static function expiry(): Carbon
    {
        return Carbon::now()->startOfHour()->addHours(2);
    }
}
