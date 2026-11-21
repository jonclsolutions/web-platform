<?php

/**
 * @file TranslationSeedMerger.php
 * @path app/Support/I18n/TranslationSeedMerger.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Three-way merge of one translation file (`<module>/<lang>.json`) at a release: the
 * texts of the server (edited in the admin), the base texts of the new release (seed) and the base
 * texts applied by the previous sync (base). Per key (dot path of a leaf):
 *   - missing on the server                      → taken from the seed (added);
 *   - unchanged since the previous seed          → follows the seed (updated);
 *   - changed on the server (edited in the admin) → kept;
 *   - removed from the seed, unchanged on server → removed; edited on server → kept.
 * Without a base (first sync) nothing is updated or removed - only missing keys are added.
 * prune() then removes the keys Czech no longer has from the other languages of the module.
 * @note A leaf is a string, a number, a boolean, null or a list (lists are compared as a whole).
 * When the structure of a key differs (text on one side, group of keys on the other), the seed wins.
 * The result follows the order of the seed; keys only on the server follow at the end of their group.
 * @dependencies none
 */

namespace App\Support\I18n;

final class TranslationSeedMerger
{
    /** @description Separator of the parts of a flattened key (never part of a JSON key in practice). */
    private const SEPARATOR = "\x1F";

    /**
     * @description Merges the seed into the texts of the server.
     * @param array<string, mixed> $current Texts on the server (decoded JSON).
     * @param array<string, mixed> $seed Base texts of the new release.
     * @param array<string, mixed>|null $base Base texts applied by the previous sync; null = unknown.
     * @return array{data: array<string, mixed>, added: int, updated: int, removed: int, kept: int}
     *   The merged texts and the counts (kept = keys that stay different from the seed).
     */
    public static function merge(array $current, array $seed, ?array $base): array
    {
        $server = self::flatten($current);
        $next = self::flatten($seed);
        $previous = $base === null ? null : self::flatten($base);
        $merged = [];
        $counts = ['added' => 0, 'updated' => 0, 'removed' => 0, 'kept' => 0];

        foreach ($next as $key => $seedValue) {
            if (!array_key_exists($key, $server)) {
                $merged[$key] = $seedValue;
                $counts['added']++;
            } elseif ($server[$key] === $seedValue) {
                $merged[$key] = $seedValue;
            } elseif (self::untouched($previous, $key, $server[$key])) {
                $merged[$key] = $seedValue;
                $counts['updated']++;
            } else {
                $merged[$key] = $server[$key];
                $counts['kept']++;
            }
        }

        foreach ($server as $key => $value) {
            if (array_key_exists($key, $next)) {
                continue;
            }
            if (self::untouched($previous, $key, $value)) {
                $counts['removed']++;
                continue;
            }
            $merged[$key] = $value;
            $counts['kept']++;
        }

        return ['data' => self::unflatten($merged)] + $counts;
    }

    /**
     * @description Removes from a language of the client (e.g. de.json, not part of the release) the
     *   keys the Czech reference no longer has - the application does not use them any more. Keys
     *   missing in the language are not added: the editor compares every language with Czech and
     *   shows them as missing, the public page shows them as it does today.
     * @param array<string, mixed> $translation Texts of the language on the server.
     * @param array<string, mixed> $reference Czech texts on the server (after the merge).
     * @return array{data: array<string, mixed>, removed: int} The pruned texts and the count.
     */
    public static function prune(array $translation, array $reference): array
    {
        $keys = self::flatten($reference);
        $kept = [];
        $removed = 0;

        foreach (self::flatten($translation) as $key => $value) {
            if (array_key_exists($key, $keys)) {
                $kept[$key] = $value;
            } else {
                $removed++;
            }
        }

        return ['data' => self::unflatten($kept), 'removed' => $removed];
    }

    /**
     * @description True when the value on the server is still the one of the previous seed (nobody
     *   edited it in the admin) - the key may follow the new seed.
     * @param array<string, mixed>|null $previous Flattened previous seed (null = unknown).
     * @param string $key Flattened key.
     * @param mixed $value Value on the server.
     * @return bool
     */
    private static function untouched(?array $previous, string $key, mixed $value): bool
    {
        return $previous !== null && array_key_exists($key, $previous) && $previous[$key] === $value;
    }

    /**
     * @description Flattens nested groups of keys to `path => leaf value`.
     * @param array<string, mixed> $data Decoded JSON object.
     * @param string $prefix Path of the group (internal).
     * @param array<string, mixed> $out Result (internal).
     * @return array<string, mixed>
     */
    private static function flatten(array $data, string $prefix = '', array $out = []): array
    {
        foreach ($data as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix . self::SEPARATOR . $key;
            if (is_array($value) && $value !== [] && !array_is_list($value)) {
                $out = self::flatten($value, $path, $out);
            } else {
                $out[$path] = $value;
            }
        }

        return $out;
    }

    /**
     * @description Builds the nested JSON object back from `path => value`. A key whose path
     *   collides with an earlier one (a text where a group already is, or the other way round) is
     *   left out - the seed keys come first, so the structure of the seed wins.
     * @param array<string, mixed> $flat Flattened keys in the wanted order.
     * @return array<string, mixed>
     */
    private static function unflatten(array $flat): array
    {
        $out = [];
        $leaves = [];
        $groups = [];

        foreach ($flat as $path => $value) {
            $parts = explode(self::SEPARATOR, (string) $path);
            if (isset($groups[$path]) || self::underLeaf($parts, $leaves)) {
                continue;
            }

            $node = &$out;
            $prefix = '';
            foreach (array_slice($parts, 0, -1) as $part) {
                $prefix = $prefix === '' ? $part : $prefix . self::SEPARATOR . $part;
                $groups[$prefix] = true;
                $node[$part] ??= [];
                $node = &$node[$part];
            }
            $node[end($parts)] = $value;
            $leaves[$path] = true;
            unset($node);
        }

        return $out;
    }

    /**
     * @description True when a parent path of the key already holds a text.
     * @param string[] $parts Parts of the key.
     * @param array<string, true> $leaves Paths written as texts so far.
     * @return bool
     */
    private static function underLeaf(array $parts, array $leaves): bool
    {
        $prefix = '';
        foreach (array_slice($parts, 0, -1) as $part) {
            $prefix = $prefix === '' ? $part : $prefix . self::SEPARATOR . $part;
            if (isset($leaves[$prefix])) {
                return true;
            }
        }

        return false;
    }
}
