<?php

/**
 * @file AttachmentPolicy.php
 * @path app/Support/Uploads/AttachmentPolicy.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description SINGLE source of the attachment rules (allowed types, count and size limits) of every
 * upload of the web module - the public forms, the customer portal and the admin forms. The
 * FormRequests validate with it and `GET upload-rules` (UploadRulesController) publishes the same
 * values to the frontend, so the browser can refuse a wrong file right when it is chosen and show
 * the allowed types. The two never drift apart.
 * @security Uploads use a WHITELIST checked twice: `mimes:` (type detected from the file
 * CONTENT) and `extensions:` (extension of the file NAME) - both must be allowed. SVG, HTML,
 * XML and other formats that a browser can execute as a page are never on a list. Only
 * INLINE_MIME_TYPES are ever served inline (AttachmentDownloadController::view()); everything
 * else is always a download. The checks in the browser are only a convenience - the server
 * always validates again.
 */

namespace App\Support\Uploads;

use InvalidArgumentException;

final class AttachmentPolicy
{
    /** @description Inquiries (WebRawRequestCommission) - public contact form and the admin. */
    public const RAW_REQUEST_COMMISSION = 'raw_request_commission';

    /** @description Orders (WebSalesOrder) - public order form and the admin. */
    public const SALES_ORDER = 'sales_order';

    /** @description CV of a job application (WebJobApplication) - one file. */
    public const JOB_APPLICATION = 'job_application';

    /** @description Attachment of a helpdesk ticket (WebSupportTicket) - one file. */
    public const SUPPORT_TICKET = 'support_ticket';

    /** @description Attachments of the project portal threads (customer and admin). */
    public const PROJECT_THREAD = 'project_thread';

    /**
     * @description Allowed attachments of the inquiry / order forms - documents, images, archives,
     * audio / video, CAD.
     */
    public const COMMISSION_EXTENSIONS = [
        'pdf', 'doc', 'docx', 'dotx', 'odt', 'pages', 'rtf', 'txt', 'csv',
        'xls', 'xlsx', 'xlsm', 'xltx', 'ods', 'numbers', 'ppt', 'pptx', 'key',
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'heic', 'heif', 'psd', 'ai', 'eps',
        'zip', 'rar', '7z', 'tar', 'gz',
        'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
        'mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm',
        'dwg', 'dxf', 'stp', 'step', 'stl', 'obj',
    ];

    /**
     * @description Upload profiles. `max_file_kb` is the Laravel `max:` value (kilobytes),
     * `max_total_bytes` the AttachmentsTotalSize limit (null = no total limit).
     * @var array<string, array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}>
     */
    public const PROFILES = [
        self::RAW_REQUEST_COMMISSION => [
            'extensions' => self::COMMISSION_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
        self::SALES_ORDER => [
            'extensions' => self::COMMISSION_EXTENSIONS, 'max_files' => 10, 'max_file_kb' => 20480, 'max_total_bytes' => 50 * 1024 * 1024,
        ],
        self::JOB_APPLICATION => [
            'extensions' => ['pdf', 'doc', 'docx', 'odt', 'pages', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'zip', 'rar', '7z'],
            'max_files' => 1, 'max_file_kb' => 20480, 'max_total_bytes' => null,
        ],
        self::SUPPORT_TICKET => [
            'extensions' => [
                'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif',
                'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx',
                'zip',
            ],
            'max_files' => 1, 'max_file_kb' => 20480, 'max_total_bytes' => null,
        ],
        self::PROJECT_THREAD => [
            'extensions' => [
                'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
                'jpg', 'jpeg', 'png', 'gif', 'webp',
                'zip', 'rar', '7z',
            ],
            'max_files' => 5, 'max_file_kb' => 15360, 'max_total_bytes' => null,
        ],
    ];

    /**
     * @description Types the browser may show inline - none of them can run a script in the
     * page of the application. The type is detected from the stored file content.
     */
    public const INLINE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    /** @description File name extensions offered with a "view" link (WebAttachmentResource). */
    public const INLINE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

    /**
     * @description Returns one upload profile.
     * @param string $profile One of the profile constants (e.g. self::SALES_ORDER).
     * @return array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}
     * @throws InvalidArgumentException For an unknown profile (a programming error).
     */
    public static function profile(string $profile): array
    {
        if (!isset(self::PROFILES[$profile])) {
            throw new InvalidArgumentException("Unknown upload profile: {$profile}");
        }

        return self::PROFILES[$profile];
    }

    /**
     * @description Validation rules of ONE uploaded file of the profile: the detected content type
     * AND the name extension must both be on the whitelist, and the size within the limit.
     * @param string $profile Profile constant.
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
        foreach (self::PROFILES as $name => $rules) {
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
