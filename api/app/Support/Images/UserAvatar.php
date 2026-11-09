<?php
/**
 * @file UserAvatar.php
 * @path app/Support/Images/UserAvatar.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Profile photos of the admin accounts: processing of an upload, storage on the
 * private disk and the signed URL that shows it.
 *   - process: the upload is decoded by GD and re-encoded - cropped to a centred square, scaled to
 *     SIZE×SIZE px and saved as WebP. Re-encoding keeps only the pixels: EXIF / GPS metadata of a
 *     phone photo and anything hidden in the file are dropped, and a photo is a few kB whatever
 *     was uploaded.
 *   - url: a signed URL (no login cookie / token needed by <img>), valid until the end of the
 *     next day and the same all day, so the browser caches the photo; the file name in `v`
 *     changes with every new photo. RELATIVE (`/api/users/{id}/avatar?…`, route middleware
 *     `signed:relative`): the browser loads it from the origin of the admin, also behind a proxy
 *     that hands the API another host name (the dev server sends `api:8000`).
 * @dependencies GD (imagecreatefromstring, imagewebp); private disk; route `users.avatar`.
 */

namespace App\Support\Images;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use RuntimeException;

class UserAvatar
{
    /** @description Disk of the photos (never public). */
    public const DISK = 'private';

    /** @description Folder of the photos on DISK. */
    public const FOLDER = 'avatars';

    /** @description Edge of the stored square photo (px) - sharp up to ~128 px on a HiDPI screen. */
    public const SIZE = 256;

    /** @description WebP quality of the stored photo. */
    private const QUALITY = 82;

    /**
     * @description Decodes, crops, scales and stores the upload as the photo of the user, deletes
     * the previous one and saves the new path.
     * @param User $user Account of the photo.
     * @param UploadedFile $file Validated upload (JPG / PNG / WebP).
     * @return void
     * @throws RuntimeException When the file is not a decodable image.
     */
    public static function store(User $user, UploadedFile $file): void
    {
        $path = self::FOLDER . '/' . $user->id . '-' . Str::random(16) . '.webp';
        Storage::disk(self::DISK)->put($path, self::process((string) file_get_contents($file->getRealPath())));

        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => $path])->save();
        self::deleteFile($previous);
    }

    /**
     * @description Removes the photo of the user (file and path) - the default image is shown.
     * @param User $user Account of the photo.
     * @return void
     */
    public static function remove(User $user): void
    {
        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => null])->save();
        self::deleteFile($previous);
    }

    /**
     * @description Deletes a photo file (no-op for null).
     * @param string|null $path Path on DISK.
     * @return void
     */
    public static function deleteFile(?string $path): void
    {
        if ($path) {
            Storage::disk(self::DISK)->delete($path);
        }
    }

    /**
     * @description Signed URL of the photo of the user, null without a photo.
     * @param User $user Account of the photo.
     * @return string|null
     */
    public static function url(User $user): ?string
    {
        if (!$user->avatar_path) {
            return null;
        }

        return URL::temporarySignedRoute(
            'users.avatar',
            now()->addDays(2)->startOfDay(),
            ['id' => $user->id, 'v' => pathinfo($user->avatar_path, PATHINFO_FILENAME)],
            false
        );
    }

    /**
     * @description Centred square crop, SIZE×SIZE, WebP.
     * @param string $binary Raw image file.
     * @return string WebP image.
     * @throws RuntimeException When GD cannot decode the image.
     */
    public static function process(string $binary): string
    {
        $source = @imagecreatefromstring($binary);
        if ($source === false) {
            throw new RuntimeException('The file is not a readable image.');
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $edge = min($width, $height);

        $target = imagecreatetruecolor(self::SIZE, self::SIZE);
        // Transparent PNG / WebP stay transparent.
        imagealphablending($target, false);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
        imagecopyresampled(
            $target, $source,
            0, 0, intdiv($width - $edge, 2), intdiv($height - $edge, 2),
            self::SIZE, self::SIZE, $edge, $edge
        );

        ob_start();
        imagewebp($target, null, self::QUALITY);
        $webp = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($target);

        return $webp;
    }
}
