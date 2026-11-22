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
 * @note The folder is NOT an upload folder of the core (AppManifest::uploadFolders()): the core
 *   command storage:prune-orphans knows only attachments and would delete these files. Files
 *   without a record are removed by JsCreatorRetentionSource::cleanUp().
 * @dependencies private disk; routes `js-creator.files.asset`, `js-creator.files.font`,
 *   `js-creator.files.template`.
 */

namespace App\Apps\JsCreator\Support;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFont;
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

    /**
     * @description New unique path of a file of an account.
     * @param int $userId Owner.
     * @param string $kind Sub-folder: `library`, `thumbs`, `fonts`, `templates`.
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
     * @param string $variant `original` | `thumb`.
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
     * @description Expiry of the signed URLs: the end of the next full hour (1-2 hours, the same
     *   URL within one hour).
     * @return Carbon
     */
    private static function expiry(): Carbon
    {
        return Carbon::now()->startOfHour()->addHours(2);
    }
}
