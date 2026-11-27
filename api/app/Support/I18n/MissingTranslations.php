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
 * orange attention notification of the editor page (WebNotificationSource, ShopNotificationSource),
 * also per language (byLanguage() - the admin sees which language lacks the texts).
 * @note Inactive languages are not counted - visitors cannot switch to them (a language being
 * translated stays quiet until it is switched on). Lists count per item, as in the editor.
 * @note A missing or broken Czech file counts 0 (nothing to compare with); a missing or broken
 * file of another active language counts all its texts as missing.
 * @note complete(): the texts of a language as the visitors get them - every key of Czech, a
 *   missing / empty text is MISSING_TEXT ('Cannot load text'). Never the text of another
 *   language: a text that is not there shows that something is wrong, the visitor is not misled.
 *   forLanguage(): the same count for any language (also a switched off one - may it be switched on?).
 * @note Keys an application switched off on its public pages (AppManifest::hiddenTextKeys() - e.g.
 *   the copyright line of the footer) are not counted (countedKeys()).
 * @dependencies TranslationController::activeLanguageCodes(), AppRegistry
 */

namespace App\Support\I18n;

use App\Http\Controllers\Api\TranslationController;
use App\Support\Apps\AppRegistry;
use Illuminate\Support\Facades\File;

final class MissingTranslations
{
    /** @description Primary language - the reference of every other one (the editor does the same). */
    public const PRIMARY = 'cz';

    /** @description Text shown in place of a missing one (the same everywhere: web, e-shop, content, portal). */
    public const MISSING_TEXT = 'Cannot load text';

    /**
     * @description Texts missing in the active languages of a module.
     * @param string $module Translation module (application id).
     * @return int
     */
    public static function count(string $module): int
    {
        return array_sum(self::byLanguage($module));
    }

    /**
     * @description Texts missing per active language of a module (or per given language) - only
     *   the languages that miss something (a complete language is left out).
     * @param string $module Translation module (application id).
     * @param string[]|null $codes Languages to check; null = the active ones (the switched off
     *   ones being prepared: TranslationController::inactiveLanguageCodes()).
     * @return array<string, int> Language code => missing texts, e.g. ['en' => 120, 'cz' => 3].
     */
    public static function byLanguage(string $module, ?array $codes = null): array
    {
        $primary = self::read($module, self::PRIMARY);
        if ($primary === null) {
            return [];
        }
        $keys = self::countedKeys($module, $primary);
        $missing = [];

        foreach ($codes ?? TranslationController::activeLanguageCodes($module) as $code) {
            $count = self::countMissing($keys, strtolower($code) === self::PRIMARY ? $primary : (self::read($module, $code) ?? []));
            if ($count > 0) {
                $missing[$code] = $count;
            }
        }

        return $missing;
    }

    /**
     * @description Texts missing in one language of a module, switched on or off.
     * @param string $module Translation module.
     * @param string $code Language code.
     * @return int Keys of Czech without a text in the language (0 without a Czech file).
     */
    public static function forLanguage(string $module, string $code): int
    {
        $primary = self::read($module, self::PRIMARY);
        if ($primary === null) {
            return 0;
        }
        $texts = strtolower($code) === self::PRIMARY ? $primary : (self::read($module, $code) ?? []);

        return self::countMissing(self::countedKeys($module, $primary), $texts);
    }

    /**
     * @description Keys of the texts switched off on the public pages of the applications using a
     *   module (AppManifest::hiddenTextKeys()).
     * @param string $module Translation module.
     * @return array<int, string> Dot paths.
     */
    public static function hiddenKeys(string $module): array
    {
        $keys = [];
        foreach (AppRegistry::apps() as $app) {
            if ($app->languageModule() === $module) {
                array_push($keys, ...$app->hiddenTextKeys());
            }
        }

        return array_values(array_unique($keys));
    }

    /**
     * @description Keys of Czech that must have a text in every language (without the switched-off ones).
     * @param string $module Translation module.
     * @param array<mixed> $primary Czech texts.
     * @return array<int, string>
     */
    private static function countedKeys(string $module, array $primary): array
    {
        return array_values(array_diff(array_keys(self::flatten($primary)), self::hiddenKeys($module)));
    }

    /**
     * @description Texts of a language as the visitors get them: every key of Czech (the
     *   structure), the texts of the language; a missing or empty text is MISSING_TEXT. Keys only
     *   the language has stay. Never a text of another language.
     * @param string $module Translation module.
     * @param array<mixed> $texts Stored texts of the language ([] when it has no file).
     * @return array<mixed>|null The completed texts, null when the module has no Czech file.
     */
    public static function complete(string $module, array $texts): ?array
    {
        $primary = self::read($module, self::PRIMARY);

        return $primary === null ? null : self::completeWith($primary, $texts);
    }

    /**
     * @param array<mixed> $reference Czech texts (structure).
     * @param array<mixed> $texts Texts of the language.
     * @return array<mixed>
     */
    private static function completeWith(array $reference, array $texts): array
    {
        $out = $texts;
        foreach ($reference as $key => $value) {
            $own = $texts[$key] ?? null;
            if (is_array($value)) {
                $out[$key] = self::completeWith($value, is_array($own) ? $own : []);
            } else {
                $out[$key] = is_scalar($own) && trim((string) $own) !== '' ? $own : self::MISSING_TEXT;
            }
        }

        return $out;
    }

    /**
     * @param array<int, string> $keys Keys of Czech.
     * @param array<mixed> $texts Texts of the language.
     * @return int Keys without a text.
     */
    private static function countMissing(array $keys, array $texts): int
    {
        $flat = self::flatten($texts);
        $count = 0;
        foreach ($keys as $key) {
            if (trim($flat[$key] ?? '') === '') {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @description Key paths of texts the way the editor sees them (dot paths of every text,
     *   lists per item) - used to compare an uploaded file with the primary language.
     * @param array<mixed> $data Texts.
     * @return array<int, string>
     */
    public static function keyPaths(array $data): array
    {
        return array_keys(self::flatten($data));
    }

    /**
     * @description Texts of the primary language of a module on the server.
     * @param string $module Module.
     * @return array<mixed>|null Null when the module has no valid primary file yet.
     */
    public static function primary(string $module): ?array
    {
        return self::read($module, self::PRIMARY);
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
