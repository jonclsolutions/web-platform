<?php
/**
 * @file OutputImage.php
 * @path app/Apps/JsCreator/Support/OutputImage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Conversion of a generated output. The browser draws the template with the
 *   renderer and sends the canvas as a PNG of the exact size of the template; the API checks it
 *   (a real PNG, exactly that size) and RE-ENCODES it to the format of the template, so only the
 *   pixels are kept:
 *   - PNG: lossless, transparency kept;
 *   - JPG: with the quality of the template, transparent parts laid over white (JPEG has no
 *     alpha);
 *   - plus a WebP thumbnail of at most LibraryImage::THUMB_EDGE px for the lists.
 * @note A template has at most 3000 × 3000 px - 36 MB decoded, within the memory of the API.
 * @dependencies GD (imagecreatefromstring, imagepng, imagejpeg), LibraryImage (thumbnailOf).
 */

namespace App\Apps\JsCreator\Support;

use GdImage;
use RuntimeException;

final class OutputImage
{
    /** @description Formats of outputs with their type and extension. */
    public const FORMATS = [
        'png' => ['mime' => 'image/png', 'extension' => 'png'],
        'jpg' => ['mime' => 'image/jpeg', 'extension' => 'jpg'],
    ];

    /** @description zlib level of a stored PNG (lossless; 6 = size / speed balance). */
    private const PNG_LEVEL = 6;

    /**
     * @description Checks the PNG of the browser and converts it to the output format.
     * @param string $png Raw upload.
     * @param int $width Width of the template (px).
     * @param int $height Height of the template (px).
     * @param string $format png | jpg (FORMATS).
     * @param int $quality JPEG quality 1-100.
     * @return array{file: string, thumb: string, mime: string, extension: string}
     * @throws RuntimeException `not_png` (not a readable PNG) or `wrong_size` (other size than the template).
     */
    public static function convert(string $png, int $width, int $height, string $format, int $quality): array
    {
        $info = @getimagesizefromstring($png);
        if (!$info || ($info['mime'] ?? null) !== 'image/png') {
            throw new RuntimeException('not_png');
        }
        if ($info[0] !== $width || $info[1] !== $height) {
            throw new RuntimeException('wrong_size');
        }
        $source = @imagecreatefromstring($png);
        if (!$source instanceof GdImage) {
            throw new RuntimeException('not_png');
        }
        imagesavealpha($source, true);
        $target = self::FORMATS[$format] ?? self::FORMATS['png'];

        $file = $target['mime'] === 'image/jpeg'
            ? self::encodeJpeg($source, max(1, min(100, $quality)))
            : self::encodePng($source);

        $result = [
            'file'      => $file,
            'thumb'     => LibraryImage::thumbnailOf($source),
            'mime'      => $target['mime'],
            'extension' => $target['extension'],
        ];
        unset($source);

        return $result;
    }

    /**
     * @description Lossless PNG with transparency.
     * @param GdImage $image Decoded image.
     * @return string
     */
    private static function encodePng(GdImage $image): string
    {
        ob_start();
        imagepng($image, null, self::PNG_LEVEL);

        return (string) ob_get_clean();
    }

    /**
     * @description JPEG of the image laid over white.
     * @param GdImage $image Decoded image (may be transparent).
     * @param int $quality 1-100.
     * @return string
     */
    private static function encodeJpeg(GdImage $image, int $quality): string
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $flat = imagecreatetruecolor($width, $height);
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagealphablending($flat, true);
        imagecopy($flat, $image, 0, 0, 0, 0, $width, $height);
        ob_start();
        imagejpeg($flat, null, $quality);

        return (string) ob_get_clean();
    }
}
