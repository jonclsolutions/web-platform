<?php

/**
 * @file PresetValues.php
 * @path app/Apps/JsCreator/Support/PresetValues.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Strict check of the values of a preset (saved filling of the form of generating):
 *   exactly the keys `texts`, `images`, `crops` and `caption`:
 *   - `texts` - field key → text (at most MAX_TEXT characters, line breaks allowed, no other
 *     control characters);
 *   - `images` - field key → id of an own library image or icon (photos of the computer are
 *     never stored - they never leave the browser);
 *   - `crops` - template id (of the preset's template / of the set's templates) → field key →
 *     `{focusX, focusY, zoom}` (0–1, 0–1, 1–4);
 *   - `caption` - text of the post typed by hand, or null (filled from the pattern);
 *   at most MAX_FIELDS keys per map, MAX_BYTES of JSON. Errors are returned as validation paths
 *   (`values.texts.title` …); the ownership of the images is checked by the controller.
 * @dependencies UpdateTemplateRequest (MAX_CAPTION), CreatorSet (MAX_TEMPLATES).
 */

namespace App\Apps\JsCreator\Support;

use App\Apps\JsCreator\Http\Requests\UpdateTemplateRequest;
use App\Apps\JsCreator\Models\CreatorSet;

final class PresetValues
{
    /** @description Largest JSON of the values (bytes). */
    public const MAX_BYTES = 65536;

    /** @description Most keys of one map (texts, images, crops of one template). */
    public const MAX_FIELDS = 50;

    /** @description Longest text of a field (as the form of generating). */
    public const MAX_TEXT = 2000;

    /** @description Key of a field (as TemplateDocument). */
    private const KEY = '/^[a-z][a-z0-9_]{0,39}$/';

    /** @description Control characters a text must not contain (line breaks and tabs are fine). */
    private const CONTROL = '/[\x00-\x08\x0B-\x1F\x7F]/u';

    /**
     * @description Checks the values of a preset.
     * @param mixed $values Decoded JSON (raw body - texts are not trimmed).
     * @param int[] $templateIds Templates whose crops may be stored.
     * @return array<string, string> Path → message (empty = valid).
     */
    public static function check(mixed $values, array $templateIds): array
    {
        if (!is_array($values) || ($values !== [] && array_is_list($values))) {
            return ['values' => 'The values must be an object.'];
        }
        $errors = [];
        $keys = array_keys($values);
        sort($keys);
        if ($keys !== ['caption', 'crops', 'images', 'texts']) {
            return ['values' => 'The values must have exactly the keys texts, images, crops and caption.'];
        }
        $json = json_encode($values);
        if ($json === false || strlen($json) > self::MAX_BYTES) {
            return ['values' => 'The values are too large.'];
        }

        if (self::map($values['texts'], 'values.texts', $errors)) {
            foreach ($values['texts'] as $key => $text) {
                if (!is_string($text) || mb_strlen($text) > self::MAX_TEXT || preg_match(self::CONTROL, $text) === 1 || !mb_check_encoding($text, 'UTF-8')) {
                    $errors["values.texts.{$key}"] = 'The text must be at most ' . self::MAX_TEXT . ' characters without control characters.';
                }
            }
        }
        if (self::map($values['images'], 'values.images', $errors)) {
            foreach ($values['images'] as $key => $id) {
                if (!is_int($id) || $id < 1) {
                    $errors["values.images.{$key}"] = 'The image must be the id of a library image.';
                }
            }
        }
        $crops = $values['crops'];
        if (!is_array($crops) || ($crops !== [] && array_is_list($crops)) || count($crops) > CreatorSet::MAX_TEMPLATES) {
            $errors['values.crops'] = 'The crops must be an object with at most ' . CreatorSet::MAX_TEMPLATES . ' templates.';
        } else {
            foreach ($crops as $templateId => $fields) {
                $path = "values.crops.{$templateId}";
                if (!in_array((int) $templateId, $templateIds, true) || (string) (int) $templateId !== (string) $templateId) {
                    $errors[$path] = 'The crops must belong to a template of the preset.';
                    continue;
                }
                if (!self::map($fields, $path, $errors)) {
                    continue;
                }
                foreach ($fields as $key => $crop) {
                    if (!self::crop($crop)) {
                        $errors["{$path}.{$key}"] = 'The crop must be {focusX, focusY, zoom} with focus 0–1 and zoom 1–4.';
                    }
                }
            }
        }
        $caption = $values['caption'];
        if ($caption !== null && (!is_string($caption) || mb_strlen($caption) > UpdateTemplateRequest::MAX_CAPTION
            || preg_match('/[\x00-\x09\x0B-\x1F\x7F]/u', $caption) === 1 || !mb_check_encoding($caption, 'UTF-8'))) {
            $errors['values.caption'] = 'The text of the post must be at most ' . UpdateTemplateRequest::MAX_CAPTION . ' characters without control characters.';
        }

        return $errors;
    }

    /**
     * @description Library images the values use.
     * @param array $values Checked values.
     * @return int[] Ids without repeats.
     */
    public static function assetIds(array $values): array
    {
        return array_values(array_unique(array_map('intval', $values['images'] ?? [])));
    }

    /**
     * @description Values for a JSON answer: empty maps as objects (`{}`), not arrays.
     * @param array $values Stored values.
     * @return array<string, mixed>
     */
    public static function forJson(array $values): array
    {
        $crops = [];
        foreach ($values['crops'] ?? [] as $templateId => $fields) {
            $crops[(string) $templateId] = (object) $fields;
        }

        return [
            'texts'   => (object) ($values['texts'] ?? []),
            'images'  => (object) ($values['images'] ?? []),
            'crops'   => (object) $crops,
            'caption' => $values['caption'] ?? null,
        ];
    }

    /**
     * @description Checks a map of field keys (object, at most MAX_FIELDS keys, valid keys).
     * @param mixed $map Value.
     * @param string $path Path of the value.
     * @param array<string, string> $errors Errors (added to).
     * @return bool Whether its entries can be checked.
     */
    private static function map(mixed $map, string $path, array &$errors): bool
    {
        if (!is_array($map) || ($map !== [] && array_is_list($map)) || count($map) > self::MAX_FIELDS) {
            $errors[$path] = 'The value must be an object with at most ' . self::MAX_FIELDS . ' fields.';

            return false;
        }
        foreach (array_keys($map) as $key) {
            if (!is_string($key) || preg_match(self::KEY, $key) !== 1) {
                $errors["{$path}.{$key}"] = 'The key of the field is not valid.';

                return false;
            }
        }

        return true;
    }

    /**
     * @description Whether a crop is `{focusX, focusY, zoom}` in its ranges.
     * @param mixed $crop Value.
     * @return bool
     */
    private static function crop(mixed $crop): bool
    {
        if (!is_array($crop)) {
            return false;
        }
        $keys = array_keys($crop);
        sort($keys);
        if ($keys !== ['focusX', 'focusY', 'zoom']) {
            return false;
        }
        foreach ($crop as $value) {
            if (!is_int($value) && !is_float($value)) {
                return false;
            }
        }

        return $crop['focusX'] >= 0 && $crop['focusX'] <= 1 && $crop['focusY'] >= 0 && $crop['focusY'] <= 1
            && $crop['zoom'] >= 1 && $crop['zoom'] <= 4;
    }
}
