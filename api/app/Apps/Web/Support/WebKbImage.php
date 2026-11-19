<?php
/**
 * @file WebKbImage.php
 * @path app/Apps/Web/Support/WebKbImage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Image of a block of the public knowledge base (WebKbSection) on the public disk:
 * the upload is decoded and re-encoded as WebP by WebReferenceImage::process() (scaled down to
 * 1600 px, metadata and anything hidden in the file dropped); the file name is random
 * (`knowledge-base/{id}-{random}.webp`) and changes with every new image (no stale cache).
 * @dependencies WebReferenceImage::process() (GD); public disk (served at /storage).
 */

namespace App\Apps\Web\Support;

use App\Apps\Web\Models\WebKbSection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class WebKbImage
{
    /** @description Disk of the images (public - shown on the website). */
    public const DISK = 'public';

    /** @description Folder of the images on DISK. */
    public const FOLDER = 'knowledge-base';

    /**
     * @description Decodes, scales and stores the upload as the image of the block, deletes the
     * previous one and saves the new path.
     * @param WebKbSection $section Block of the image.
     * @param UploadedFile $file Validated upload (JPG / PNG / WebP).
     * @return void
     * @throws RuntimeException When the file is not a decodable image.
     */
    public static function store(WebKbSection $section, UploadedFile $file): void
    {
        $path = self::FOLDER . '/' . $section->id . '-' . Str::lower(Str::random(16)) . '.webp';
        Storage::disk(self::DISK)->put($path, WebReferenceImage::process((string) file_get_contents($file->getRealPath())));

        $previous = $section->image_path;
        $section->forceFill(['image_path' => $path])->save();
        self::deleteFile($previous);
    }

    /**
     * @description Removes the image of the block (file and path).
     * @param WebKbSection $section Block of the image.
     * @return void
     */
    public static function remove(WebKbSection $section): void
    {
        $previous = $section->image_path;
        $section->forceFill(['image_path' => null])->save();
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
}
