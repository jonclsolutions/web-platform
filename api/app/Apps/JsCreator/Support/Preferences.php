<?php

/**
 * @file Preferences.php
 * @path app/Apps/JsCreator/Support/Preferences.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Strict check of the personal settings of an account: exactly the keys `colors`
 *   (at most MAX_COLORS colours `#rrggbb`, no repeats) and `hashtag_sets` (at most MAX_SETS
 *   items `{name, tags}` - name 1–60 characters, tags 1–MAX_TAGS characters, both without
 *   control characters, names unique ignoring case). Errors are validation paths.
 * @dependencies none
 */

namespace App\Apps\JsCreator\Support;

final class Preferences
{
    /** @description Most brand colours. */
    public const MAX_COLORS = 16;

    /** @description Most hashtag sets. */
    public const MAX_SETS = 30;

    /** @description Longest text of a hashtag set. */
    public const MAX_TAGS = 500;

    /** @description Settings of an account without a saved row. */
    public const EMPTY = ['colors' => [], 'hashtag_sets' => []];

    /**
     * @description Checks the settings.
     * @param mixed $value Decoded JSON (raw body).
     * @return array<string, string> Path → message (empty = valid).
     */
    public static function check(mixed $value): array
    {
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            return ['preferences' => 'The preferences must be an object.'];
        }
        $keys = array_keys($value);
        sort($keys);
        if ($keys !== ['colors', 'hashtag_sets']) {
            return ['preferences' => 'The preferences must have exactly the keys colors and hashtag_sets.'];
        }
        $errors = [];
        $colors = $value['colors'];
        if (!is_array($colors) || !array_is_list($colors) || count($colors) > self::MAX_COLORS) {
            $errors['colors'] = 'At most ' . self::MAX_COLORS . ' colours.';
        } else {
            foreach ($colors as $i => $color) {
                if (!is_string($color) || preg_match('/^#[0-9a-f]{6}$/', $color) !== 1) {
                    $errors["colors.{$i}"] = 'A colour must be #rrggbb (lower case).';
                }
            }
            if ($errors === [] && count(array_unique($colors)) !== count($colors)) {
                $errors['colors'] = 'A colour is there twice.';
            }
        }
        $sets = $value['hashtag_sets'];
        if (!is_array($sets) || !array_is_list($sets) || count($sets) > self::MAX_SETS) {
            $errors['hashtag_sets'] = 'At most ' . self::MAX_SETS . ' hashtag sets.';
        } else {
            $names = [];
            foreach ($sets as $i => $set) {
                $keys = is_array($set) ? array_keys($set) : [];
                sort($keys);
                if ($keys !== ['name', 'tags']) {
                    $errors["hashtag_sets.{$i}"] = 'A hashtag set must be {name, tags}.';
                    continue;
                }
                if (!self::text($set['name'], 60)) {
                    $errors["hashtag_sets.{$i}.name"] = 'The name must be 1–60 characters without control characters.';
                } elseif (in_array(mb_strtolower($set['name']), $names, true)) {
                    $errors["hashtag_sets.{$i}.name"] = 'The name is there twice.';
                } else {
                    $names[] = mb_strtolower($set['name']);
                }
                if (!self::text($set['tags'], self::MAX_TAGS)) {
                    $errors["hashtag_sets.{$i}.tags"] = 'The hashtags must be 1–' . self::MAX_TAGS . ' characters without control characters.';
                }
            }
        }

        return $errors;
    }

    /**
     * @description A non-empty trimmed text of at most `max` characters without control characters.
     * @param mixed $value Value.
     * @param int $max Most characters.
     * @return bool
     */
    private static function text(mixed $value, int $max): bool
    {
        return is_string($value) && trim($value) === $value && $value !== '' && mb_strlen($value) <= $max
            && mb_check_encoding($value, 'UTF-8') && preg_match('/[\x00-\x1F\x7F]/u', $value) !== 1;
    }
}
