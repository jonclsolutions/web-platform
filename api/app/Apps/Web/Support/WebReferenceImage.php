<?php
/**
 * @file WebReferenceImage.php
 * @path app/Apps/Web/Support/WebReferenceImage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Image of a reference of the public website (WebReference): processing of an
 * upload and its storage on the public disk (the website shows it to everybody).
 *   - process: the upload is decoded by GD and re-encoded as WebP, scaled down to fit
 *     MAX_EDGE×MAX_EDGE px (aspect ratio kept, never scaled up). Re-encoding keeps only the
 *     pixels: EXIF / GPS metadata and anything hidden in the file are dropped.
 *   - the file name is random (`references/{id}-{random}.webp`) and changes with every new
 *     image, so a browser never shows a cached old one.
 * @dependencies GD (imagecreatefromstring, imagewebp); public disk (served at /storage).
 */

namespace App\Apps\Web\Support;

use App\Apps\Web\Models\WebReference;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class WebReferenceImage
{
    /** @description Disk of the images (public - shown on the website). */
    public const DISK = 'public';

    /** @description Folder of the images on DISK. */
    public const FOLDER = 'references';

    /** @description Longest edge of the stored image (px) - sharp in the detail on a HiDPI screen. */
    public const MAX_EDGE = 1600;

    /** @description WebP quality of the stored image. */
    private const QUALITY = 82;

    /**
     * @description Decodes, scales and stores the upload as the image of the reference, deletes
     * the previous one and saves the new path.
     * @param WebReference $reference Reference of the image.
     * @param UploadedFile $file Validated upload (JPG / PNG / WebP).
     * @return void
     * @throws RuntimeException When the file is not a decodable image.
     */
    public static function store(WebReference $reference, UploadedFile $file): void
    {
        $path = self::FOLDER . '/' . $reference->id . '-' . Str::lower(Str::random(16)) . '.webp';
        Storage::disk(self::DISK)->put($path, self::process((string) file_get_contents($file->getRealPath())));

        $previous = $reference->image_path;
        $reference->forceFill(['image_path' => $path])->save();
        self::deleteFile($previous);
    }

    /**
     * @description Removes the image of the reference (file and path).
     * @param WebReference $reference Reference of the image.
     * @return void
     */
    public static function remove(WebReference $reference): void
    {
        $previous = $reference->image_path;
        $reference->forceFill(['image_path' => null])->save();
        self::deleteFile($previous);
    }

    /**
     * @description Deletes an image file (no-op for null or a path outside FOLDER).
     * @param string|null $path Path on DISK.
     * @return void
     */
    public static function deleteFile(?string $path): void
    {
        if ($path && str_starts_with($path, self::FOLDER . '/')) {
            Storage::disk(self::DISK)->delete($path);
        }
    }

    /**
     * @description Scales down to fit MAX_EDGE (aspect ratio kept), WebP.
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
        $scale = min(1, self::MAX_EDGE / max($width, $height));
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));

        $target = imagecreatetruecolor($targetWidth, $targetHeight);
        // Transparent PNG / WebP stay transparent.
        imagealphablending($target, false);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
        imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        ob_start();
        imagewebp($target, null, self::QUALITY);
        $webp = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($target);

        return $webp;
    }
}
