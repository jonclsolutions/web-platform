<?php

/**
 * @file EffectiveFields.php
 * @path app/Apps/JsCreator/Support/EffectiveFields.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Fields of a template as the form of generating shows them: the fields of the
 *   template, then the fields of its block instances (layers of the first page from the bottom,
 *   each block in the order of its fields). A field of an instance keeps its key while it is
 *   free; a key already taken gets `_2`, `_3` … (at most 40 characters) - so two instances of
 *   one block, or a block field named like a template field, are filled separately.
 *   Used by sets: fields with the same key must have the same kind in every template of a set.
 * @usage `EffectiveFields::types($template->document, [$blockId => $blockDocument])` → `['title' => 'text', …]`.
 * @note The same rules are in the frontend: apps/js-creator/admin/shared/render/block-fields.ts
 *   (effectiveFields(), freeFieldKey()) - change both places together.
 * @dependencies none (validated documents as arrays).
 */

namespace App\Apps\JsCreator\Support;

final class EffectiveFields
{
    /** @description Longest field key. */
    private const MAX_KEY = 40;

    /**
     * @description Kinds of the effective fields of a template.
     * @param array<string, mixed> $document Document of the template (validated).
     * @param array<int, array<string, mixed>> $blocks Documents of its blocks by id (a missing block is skipped).
     * @return array<string, string> Key → `text` | `image`, in the order of the form.
     */
    public static function types(array $document, array $blocks): array
    {
        $types = [];
        foreach ($document['fields'] ?? [] as $field) {
            $types[$field['key']] = $field['type'];
        }
        foreach ($document['pages'][0]['layers'] ?? [] as $layer) {
            $block = ($layer['type'] ?? null) === 'block' ? ($blocks[$layer['blockId']] ?? null) : null;
            foreach (is_array($block) ? ($block['fields'] ?? []) : [] as $field) {
                $types[self::freeKey($field['key'], $types)] = $field['type'];
            }
        }

        return $types;
    }

    /**
     * @description The key itself when it is free, otherwise the key with the first free `_<n>` (n ≥ 2).
     * @param string $key Key of the field in its block.
     * @param array<string, mixed> $taken Keys already used (as array keys).
     * @return string
     */
    public static function freeKey(string $key, array $taken): string
    {
        if (!array_key_exists($key, $taken)) {
            return $key;
        }
        for ($i = 2; ; $i++) {
            $suffix = "_{$i}";
            $candidate = substr($key, 0, self::MAX_KEY - strlen($suffix)) . $suffix;
            if (!array_key_exists($candidate, $taken)) {
                return $candidate;
            }
        }
    }
}
