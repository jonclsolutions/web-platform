<?php

/**
 * @file        HandlesFileUploads.php
 * @path        app/Traits/HandlesFileUploads.php
 * @project     RPSW Web
 * @author      RPSW
 * @created     2026
 * @description Small helper trait for controllers that store a single
 *              uploaded file per model (WebJobApplication::cv_path,
 *              WebSupportTicket::attachment_path). Wraps UploadedFile::store()
 *              so the client's original file name is captured and sanitized
 *              at the same point the file is written to disk, instead of
 *              being lost entirely (previous behaviour - only the random
 *              hashed on-disk name was ever persisted).
 * @note        Not used by WebSalesOrder / WebRawRequestCommission - those
 *              were already migrated to the polymorphic `web_attachments`
 *              relation (see HandlesAttachments trait) and are out of scope
 *              here.
 */

namespace App\Traits;

use Illuminate\Http\UploadedFile;

/**
 * @description Provides storeUploadedFile(), a single entry point that
 *              returns both the on-disk path and the sanitized original
 *              file name, so callers persist them together in one line.
 */
trait HandlesFileUploads
{
    /**
     * @description Stores $file under its usual random hashed name (via
     *              Laravel's UploadedFile::store(), unchanged behaviour) and
     *              additionally returns the sanitized client-original file
     *              name. The hashed path must stay internal-only - the
     *              original name is what should ever be shown to a user or
     *              sent back as a download's Content-Disposition file name.
     * @param UploadedFile $file
     * @param string $folder
     * @param string $disk
     * @return array{path: string, original_name: string}
     */
    protected function storeUploadedFile(UploadedFile $file, string $folder, string $disk = 'public'): array
    {
        return [
            'path' => $file->store($folder, $disk),
            'original_name' => $this->sanitizeOriginalFileName($file->getClientOriginalName()),
        ];
    }

    /**
     * @description Strips path separators and control characters from a
     *              client-supplied file name before it is persisted or ever
     *              echoed back into an HTTP header (Content-Disposition).
     *              Without this, a malicious client could supply a file name
     *              containing "/", "\", or control characters.
     * @param string $originalName
     * @return string
     */
    protected function sanitizeOriginalFileName(string $originalName): string
    {
        $clean = preg_replace('/[\/\\\\\x00-\x1F]/', '', $originalName) ?? '';
        $clean = trim($clean);

        if ($clean === '') {
            $clean = 'file';
        }

        // Guard against exceeding the varchar(255) column added by the SQL fix.
        return mb_substr($clean, 0, 255);
    }
}