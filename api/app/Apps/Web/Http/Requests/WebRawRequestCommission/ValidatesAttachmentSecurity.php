<?php
/**
 * @file ValidatesAttachmentSecurity.php
 * @path app/Apps/Web/Http/Requests/WebRawRequestCommission/ValidatesAttachmentSecurity.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Second line of defence of the attachment upload: refuses executable / script MIME
 *   types detected from the file content. The first line is the whitelist of
 *   App\Support\Uploads\AttachmentPolicy (`mimes:` + `extensions:`).
 */

namespace App\Apps\Web\Http\Requests\WebRawRequestCommission;

/**
 * @description Blocks executable / script MIME types (detected from the content) as an extra check
 * next to the whitelist.
 */
trait ValidatesAttachmentSecurity
{
    /**
     * Returns a list of forbidden MIME types.
     *
     * @return array
     */
    public static function forbiddenMimes(): array
    {
        return [
            'application/x-msdownload',
            'application/x-msdos-program',
            'application/x-sh',
            'application/x-bat',
            'application/vnd.android.package-archive',
            'application/x-executable',
            'application/x-elf',
            'application/x-mach-binary',
            'application/java-archive',
            'text/x-php',
            'application/x-httpd-php',
            // Formats a browser runs as a page (stored XSS when shown inline).
            'text/html',
            'application/xhtml+xml',
            'image/svg+xml',
        ];
    }

    /**
     * Validates MIME type of every uploaded attachment to prevent disguise of malicious
     * files (extension can be spoofed, MIME sniffing is an extra layer of defense).
     *
     * @param \Illuminate\Validation\Validator $validator
     * @return void
     */
    public function validateAttachmentMime($validator): void
    {
        if (!$this->hasFile('attachments')) return;

        foreach ($this->file('attachments') as $index => $file) {
            if (!$file || !$file->isValid()) continue;

            $mime = $file->getMimeType();

            if (in_array($mime, self::forbiddenMimes(), true)) {
                $validator->errors()->add(
                    "attachments.{$index}",
                    "The file \"{$file->getClientOriginalName()}\" has an unauthorized type and was not accepted for security reasons."
                );
            }
        }
    }
}