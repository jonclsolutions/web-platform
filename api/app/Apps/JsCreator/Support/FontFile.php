<?php
/**
 * @file FontFile.php
 * @path app/Apps/JsCreator/Support/FontFile.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Type of an uploaded font, detected from the first bytes of the file (the server
 *   does nothing else with a font - only the browser reads it, and browsers sanitize fonts
 *   before use). The content type detection of PHP (finfo) does not name font types reliably,
 *   so the `mimes:` rule of the other uploads is not used for fonts.
 * @usage `FontFile::detect($head)` → 'ttf' | 'otf' | 'woff' | 'woff2' | null;
 *   `FontFile::matchesExtension($format, $extension)`.
 */

namespace App\Apps\JsCreator\Support;

final class FontFile
{
    /** @description Extensions of the accepted files. */
    public const EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];

    /** @description Content type of every stored format. */
    public const MIME_TYPES = ['ttf' => 'font/ttf', 'otf' => 'font/otf', 'woff' => 'font/woff', 'woff2' => 'font/woff2'];

    /**
     * @description Format of a font file from its signature.
     * @param string $head At least the first 4 bytes of the file.
     * @return string|null Format, or null for anything else (also font collections).
     */
    public static function detect(string $head): ?string
    {
        return match (substr($head, 0, 4)) {
            "\x00\x01\x00\x00", 'true' => 'ttf',
            'OTTO' => 'otf',
            'wOFF' => 'woff',
            'wOF2' => 'woff2',
            default => null,
        };
    }

    /**
     * @description Whether the extension of the upload fits the detected format (TrueType and
     *   OpenType files share the extensions .ttf / .otf).
     * @param string $format Detected format.
     * @param string $extension Lower-case extension of the uploaded file name.
     * @return bool
     */
    public static function matchesExtension(string $format, string $extension): bool
    {
        return in_array($format, ['ttf', 'otf'], true)
            ? in_array($extension, ['ttf', 'otf'], true)
            : $format === $extension;
    }
}
