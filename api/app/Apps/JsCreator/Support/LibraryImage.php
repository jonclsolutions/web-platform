<?php
/**
 * @file LibraryImage.php
 * @path app/Apps/JsCreator/Support/LibraryImage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Processing of an image uploaded to the library of JS Creator (and of the thumbnail
 *   of a template drawn by the editor - thumbnail(); thumbnails of outputs - thumbnailOf()). The upload is
 *   decoded by GD and RE-ENCODED, so only the pixels are kept - EXIF / GPS metadata of a phone
 *   photo and anything hidden in the file are dropped:
 *   - the EXIF orientation of a JPEG is applied first (the photo is stored upright);
 *   - a longer side over MAX_EDGE px is scaled down;
 *   - the format stays (JPEG → JPEG, PNG → PNG, WebP → WebP), transparency is kept;
 *   - a WebP thumbnail of at most THUMB_EDGE px is made for the lists.
 * @note MAX_PIXELS protects the memory of the API process (256 MB in production): a decoded
 *   image takes 4 bytes per pixel.
 * @dependencies GD (imagecreatefromstring, imagejpeg, imagepng, imagewebp), exif (orientation).
 */

namespace App\Apps\JsCreator\Support;

use GdImage;
use RuntimeException;

final class LibraryImage
{
    /** @description Longest stored side (px). */
    public const MAX_EDGE = 4000;

    /** @description Longest side of the thumbnail (px). */
    public const THUMB_EDGE = 480;

    /** @description Largest accepted image (pixels) - 160 MB when decoded. */
    public const MAX_PIXELS = 40_000_000;

    /** @description Largest accepted thumbnail of a template (pixels). */
    public const THUMB_MAX_PIXELS = 4_000_000;

    /** @description Accepted types with the extension of the stored file. */
    public const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    /** @description JPEG / WebP quality of the stored image. */
    private const QUALITY = 90;

    /** @description WebP quality of the thumbnail. */
    private const THUMB_QUALITY = 80;

    /**
     * @description Re-encodes an uploaded image and makes its thumbnail.
     * @param string $binary Raw file.
     * @return array{image: string, thumb: string, mime: string, extension: string, width: int, height: int}
     * @throws RuntimeException `unreadable` (not an image of TYPES) or `too_large` (over MAX_PIXELS).
     */
    public static function process(string $binary): array
    {
        $info = @getimagesizefromstring($binary);
        $mime = $info['mime'] ?? null;
        if (!$info || !isset(self::TYPES[$mime])) {
            throw new RuntimeException('unreadable');
        }
        if ($info[0] * $info[1] > self::MAX_PIXELS) {
            throw new RuntimeException('too_large');
        }

        $source = @imagecreatefromstring($binary);
        if (!$source instanceof GdImage) {
            throw new RuntimeException('unreadable');
        }
        if ($mime === 'image/jpeg') {
            $source = self::applyOrientation($source, self::orientation($binary));
        }

        $image = self::scaled($source, self::MAX_EDGE);
        $thumb = self::scaled($image, self::THUMB_EDGE);
        $result = [
            'image'     => self::encode($image, $mime),
            'thumb'     => self::encode($thumb, 'image/webp', self::THUMB_QUALITY),
            'mime'      => $mime,
            'extension' => self::TYPES[$mime],
            'width'     => imagesx($image),
            'height'    => imagesy($image),
        ];
        unset($source, $image, $thumb);

        return $result;
    }

    /**
     * @description Re-encodes the thumbnail of a template made by the browser (PNG / WebP of the
     *   canvas) to a WebP of at most THUMB_EDGE px - only its pixels are kept.
     * @param string $binary Raw file.
     * @return string WebP.
     * @throws RuntimeException `unreadable` (not a PNG / WebP) or `too_large` (over THUMB_MAX_PIXELS).
     */
    public static function thumbnail(string $binary): string
    {
        $info = @getimagesizefromstring($binary);
        if (!$info || !in_array($info['mime'] ?? null, ['image/png', 'image/webp'], true)) {
            throw new RuntimeException('unreadable');
        }
        if ($info[0] * $info[1] > self::THUMB_MAX_PIXELS) {
            throw new RuntimeException('too_large');
        }
        $source = @imagecreatefromstring($binary);
        if (!$source instanceof GdImage) {
            throw new RuntimeException('unreadable');
        }

        return self::thumbnailOf($source);
    }

    /**
     * @description WebP thumbnail of a decoded image (at most THUMB_EDGE px) - lists of templates
     *   and outputs.
     * @param GdImage $image Decoded image.
     * @return string WebP.
     */
    public static function thumbnailOf(GdImage $image): string
    {
        return self::encode(self::scaled($image, self::THUMB_EDGE), 'image/webp', self::THUMB_QUALITY);
    }

    /**
     * @description EXIF orientation of a JPEG (1 = upright, also when unknown).
     * @param string $binary Raw JPEG.
     * @return int 1 … 8.
     */
    private static function orientation(string $binary): int
    {
        if (!function_exists('exif_read_data')) {
            return 1;
        }
        $stream = fopen('php://memory', 'r+b');
        fwrite($stream, $binary);
        rewind($stream);
        $exif = @exif_read_data($stream);
        fclose($stream);

        $value = (int) ($exif['Orientation'] ?? 1);

        return $value >= 1 && $value <= 8 ? $value : 1;
    }

    /**
     * @description Turns the pixels upright according to the EXIF orientation (imagerotate turns
     *   counter-clockwise).
     * @param GdImage $image Decoded image.
     * @param int $orientation EXIF orientation 1 … 8.
     * @return GdImage Upright image.
     */
    private static function applyOrientation(GdImage $image, int $orientation): GdImage
    {
        $rotation = match ($orientation) {
            3 => 180,
            5, 6 => 270,
            7, 8 => 90,
            default => 0,
        };
        if ($rotation !== 0) {
            $image = imagerotate($image, $rotation, 0);
        }
        if (in_array($orientation, [2, 5, 7], true)) {
            imageflip($image, IMG_FLIP_HORIZONTAL);
        } elseif ($orientation === 4) {
            imageflip($image, IMG_FLIP_VERTICAL);
        }

        return $image;
    }

    /**
     * @description Truecolor copy with alpha, scaled down so that the longer side is at most
     *   $edge (never scaled up).
     * @param GdImage $image Source.
     * @param int $edge Longest side (px).
     * @return GdImage
     */
    private static function scaled(GdImage $image, int $edge): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $ratio = min(1, $edge / max($width, $height));
        $targetWidth = max(1, (int) round($width * $ratio));
        $targetHeight = max(1, (int) round($height * $ratio));

        $target = imagecreatetruecolor($targetWidth, $targetHeight);
        imagealphablending($target, false);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
        imagecopyresampled($target, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        return $target;
    }

    /**
     * @description Encodes an image.
     * @param GdImage $image Image.
     * @param string $mime Target type (TYPES).
     * @param int $quality JPEG / WebP quality.
     * @return string Binary file.
     */
    private static function encode(GdImage $image, string $mime, int $quality = self::QUALITY): string
    {
        ob_start();
        match ($mime) {
            'image/jpeg' => imagejpeg($image, null, $quality),
            'image/png'  => imagepng($image, null, 6),
            default      => imagewebp($image, null, $quality),
        };

        return (string) ob_get_clean();
    }
}
