<?php

/**
 * @file MissingTranslations.php
 * @path app/Support/I18n/MissingTranslations.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Number of texts missing in the active languages of a translation module (web,
 * shop, …) - the same rule as the "Missing" counter of the text editor
 * (base-translation-editor.component.ts): every key of the Czech (primary) texts must have a
 * non-empty value in every active language; Czech itself counts its empty values. Feeds the
 * orange attention notification of the editor page (WebNotificationSource, ShopNotificationSource).
 * @note Inactive languages are not counted - visitors cannot switch to them (a language being
 * translated stays quiet until it is switched on). Lists count per item, as in the editor.
 * @note A missing or broken Czech file counts 0 (nothing to compare with); a missing or broken
 * file of another active language counts all its texts as missing.
 * @dependencies TranslationController::activeLanguageCodes()
 */

namespace App\Support\I18n;

use App\Http\Controllers\Api\TranslationController;
use Illuminate\Support\Facades\File;

final class MissingTranslations
{
    /** @description Primary language - the reference of every other one (the editor does the same). */
    public const PRIMARY = 'cz';

    /**
     * @description Texts missing in the active languages of a module.
     * @param string $module Translation module (application id).
     * @return int
     */
    public static function count(string $module): int
    {
        $primary = self::read($module, self::PRIMARY);
        if ($primary === null) {
            return 0;
        }
        $keys = array_keys(self::flatten($primary));
        $missing = 0;

        foreach (TranslationController::activeLanguageCodes($module) as $code) {
            $texts = strtolower($code) === self::PRIMARY ? self::flatten($primary) : self::flatten(self::read($module, $code) ?? []);
            foreach ($keys as $key) {
                if (trim($texts[$key] ?? '') === '') {
                    $missing++;
                }
            }
        }

        return $missing;
    }

    /**
     * @description Decodes the translation file of a language.
     * @param string $module Module.
     * @param string $code Language code (file name).
     * @return array<mixed>|null Null when it does not exist or is not valid JSON.
     */
    private static function read(string $module, string $code): ?array
    {
        $path = storage_path("app/public/translations/{$module}/{$code}.json");
        if (!File::exists($path)) {
            return null;
        }
        $data = json_decode((string) File::get($path), true);

        return is_array($data) ? $data : null;
    }

    /**
     * @description Flattens the texts like the editor: every nested group and list item becomes a
     *   dot path, values become strings (null = empty).
     * @param array<mixed> $data Texts.
     * @param string $prefix Path of the group (internal).
     * @param array<string, string> $out Result (internal).
     * @return array<string, string>
     */
    private static function flatten(array $data, string $prefix = '', array $out = []): array
    {
        foreach ($data as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix . '.' . $key;
            if (is_array($value)) {
                $out = self::flatten($value, $path, $out);
            } else {
                $out[$path] = match (true) {
                    $value === null => '',
                    is_bool($value) => $value ? 'true' : 'false',
                    default => (string) $value,
                };
            }
        }

        return $out;
    }
}
