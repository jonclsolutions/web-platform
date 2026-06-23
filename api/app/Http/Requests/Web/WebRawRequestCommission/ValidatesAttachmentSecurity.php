<?php
namespace App\Http\Requests\Web\WebRawRequestCommission;

/**
 * Sdílená logika pro validaci nahrávaných příloh.
 * Blacklist přístup - zakazuje pouze potenciálně spustitelné/škodlivé typy,
 * vše ostatní (pdf, obrázky, dokumenty, archivy, text...) je povoleno.
 */
trait ValidatesAttachmentSecurity
{
    public static function forbiddenExtensions(): array
    {
        return [
            'exe', 'bat', 'sh', 'apk', 'cmd', 'com', 'msi', 'msp',
            'scr', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1',
            'ps1xml', 'psc1', 'psm1', 'jar', 'app', 'gadget', 'cpl',
            'dll', 'so', 'dylib', 'bin', 'run', 'phar', 'php', 'phtml',
        ];
    }

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
     * Validační closure pro pravidlo 'attachment' ve FormRequestu.
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
     * Doplňková kontrola MIME typu - chrání i proti přejmenovanému spustitelnému souboru.
     * Voláno z withValidator() v konkrétním FormRequestu.
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