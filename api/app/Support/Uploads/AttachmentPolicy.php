<?php

/**
 * @file AttachmentPolicy.php
 * @path app/Support/Uploads/AttachmentPolicy.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description SINGLE source of the attachment rules (allowed types, count and size limits) of every
 * upload - the profiles come from the registered applications (AppManifest::uploadProfiles()), e.g.
 * the public forms, the customer portal and the admin forms of the web. The FormRequests validate
 * with it and `GET upload-rules` (UploadRulesController) publishes the same values to the
 * frontend, so the browser can refuse a wrong file right when it is chosen and show the allowed
 * types. The two never drift apart.
 * @security Uploads use a WHITELIST checked twice: `mimes:` (type detected from the file
 * CONTENT) and `extensions:` (extension of the file NAME) - both must be allowed. SVG, HTML,
 * XML and other formats that a browser can execute as a page are never on a list. Only
 * INLINE_MIME_TYPES are ever served inline (AttachmentDownloadController::view()); everything
 * else is always a download; an extension of BLOCKED_EXTENSIONS in a profile of an application is
 * dropped here. The checks in the browser are only a convenience - the server always validates
 * again.
 */

namespace App\Support\Uploads;

use App\Support\Apps\AppRegistry;
use InvalidArgumentException;

final class AttachmentPolicy
{
    /** @description Extensions never allowed in any profile (formats a browser runs as a page). */
    public const BLOCKED_EXTENSIONS = ['svg', 'svgz', 'html', 'htm', 'xhtml', 'xml', 'js', 'mjs', 'php', 'phtml'];

    /**
     * @description Types the browser may show inline - none of them can run a script in the
     * page of the application. The type is detected from the stored file content.
     */
    public const INLINE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    /** @description File name extensions offered with a "view" link (CoreAttachmentResource). */
    public const INLINE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

    /**
     * @description Materials a client sends with an inquiry or an order (applications: web
     *   inquiries, project portal orders) - documents, images, archives, audio / video, CAD.
     */
    public const MATERIAL_EXTENSIONS = [
        'pdf', 'doc', 'docx', 'dotx', 'odt', 'pages', 'rtf', 'txt', 'csv',
        'xls', 'xlsx', 'xlsm', 'xltx', 'ods', 'numbers', 'ppt', 'pptx', 'key',
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'heic', 'heif', 'psd', 'ai', 'eps',
        'zip', 'rar', '7z', 'tar', 'gz',
        'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
        'mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm',
        'dwg', 'dxf', 'stp', 'step', 'stl', 'obj',
    ];

    /**
     * @description Upload profiles of all applications, without BLOCKED_EXTENSIONS. `max_file_kb`
     * is the Laravel `max:` value (kilobytes), `max_total_bytes` the AttachmentsTotalSize limit
     * (null = no total limit).
     * @return array<string, array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}>
     */
    public static function profiles(): array
    {
        return array_map(
            fn (array $rules) => ['extensions' => array_values(array_diff($rules['extensions'], self::BLOCKED_EXTENSIONS))] + $rules,
            AppRegistry::uploadProfiles()
        );
    }

    /**
     * @description Returns one upload profile.
     * @param string $profile Profile name (e.g. WebApp::UPLOAD_SALES_ORDER).
     * @return array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}
     * @throws InvalidArgumentException For an unknown profile (a programming error).
     */
    public static function profile(string $profile): array
    {
        $profiles = self::profiles();
        if (!isset($profiles[$profile])) {
            throw new InvalidArgumentException("Unknown upload profile: {$profile}");
        }

        return $profiles[$profile];
    }

    /**
     * @description Validation rules of ONE uploaded file of the profile: the detected content type
     * AND the name extension must both be on the whitelist, and the size within the limit.
     * @param string $profile Profile name.
     * @return array<int, string>
     */
    public static function fileRules(string $profile): array
    {
        $rules = self::profile($profile);
        $list = implode(',', $rules['extensions']);

        return ['file', 'max:' . $rules['max_file_kb'], 'mimes:' . $list, 'extensions:' . $list];
    }

    /**
     * @description All profiles in the shape published to the frontend (GET upload-rules) - sizes
     * in whole megabytes, like the hints shown to the user.
     * @return array<string, array{extensions: list<string>, max_files: int, max_file_size_mb: int, max_total_size_mb: int|null}>
     */
    public static function publicRules(): array
    {
        $out = [];
        foreach (self::profiles() as $name => $rules) {
            $out[$name] = [
                'extensions'        => $rules['extensions'],
                'max_files'         => $rules['max_files'],
                'max_file_size_mb'  => intdiv($rules['max_file_kb'], 1024),
                'max_total_size_mb' => $rules['max_total_bytes'] === null ? null : intdiv($rules['max_total_bytes'], 1024 * 1024),
            ];
        }

        return $out;
    }

    /**
     * @description Whether a stored file with this detected MIME type may be served inline.
     * @param string|null $mimeType Type detected from the file content (Storage::mimeType()).
     * @return bool
     */
    public static function isInlineMimeType(?string $mimeType): bool
    {
        return in_array(strtolower((string) $mimeType), self::INLINE_MIME_TYPES, true);
    }

    /**
     * @description Whether a file name looks previewable (decides only whether a "view" link is
     * offered - the real decision is made from the content when the file is served).
     * @param string|null $fileName Original file name or stored path.
     * @return bool
     */
    public static function isInlineFileName(?string $fileName): bool
    {
        return in_array(strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION)), self::INLINE_EXTENSIONS, true);
    }
}
