<?php
/**
 * @file ValidatesAttachmentSecurity.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/ValidatesAttachmentSecurity.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Trait providing shared security logic for validating file attachments using a blacklist approach.
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

/**
 * @description Provides helper methods to block dangerous file types, improving security against malicious uploads.
 */
trait ValidatesAttachmentSecurity
{
    /**
     * Returns a list of forbidden file extensions.
     * * @return array
     */
    public static function forbiddenExtensions(): array
    {
        return [
            'exe', 'bat', 'sh', 'apk', 'cmd', 'com', 'msi', 'msp',
            'scr', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1',
            'ps1xml', 'psc1', 'psm1', 'jar', 'app', 'gadget', 'cpl',
            'dll', 'so', 'dylib', 'bin', 'run', 'phar', 'php', 'phtml',
        ];
    }

    /**
     * Returns a list of forbidden MIME types.
     * * @return array
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
        ];
    }

    /**
     * Validation rule for file extensions.
     * * @return \Closure
     */
    public function attachmentExtensionRule(): \Closure
    {
        return function ($attribute, $value, $fail) {
            if (!$value) return;

            $ext = strtolower($value->getClientOriginalExtension());
            if (in_array($ext, self::forbiddenExtensions(), true)) {
                $fail('Tento typ souboru není z bezpečnostních důvodů povolen.');
            }
        };
    }

    /**
     * Validates MIME type to prevent disguise of malicious files.
     * * @param \Illuminate\Validation\Validator $validator
     * @return void
     */
    public function validateAttachmentMime($validator): void
    {
        if (!$this->hasFile('attachment')) return;

        $mime = $this->file('attachment')->getMimeType();

        if (in_array($mime, self::forbiddenMimes(), true)) {
            $validator->errors()->add('attachment', 'Tento typ souboru není z bezpečnostních důvodů povolen.');
        }
    }
}