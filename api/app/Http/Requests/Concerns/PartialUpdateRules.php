<?php
/**
 * @file PartialUpdateRules.php
 * @path app/Http/Requests/Concerns/PartialUpdateRules.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Turns the validation rules of a create request into the rules of a partial update:
 *   every field gets `sometimes` (validated only when sent), so a PUT / PATCH may change any subset
 *   of the fields while a sent field still has to satisfy the create rules. Used by the Update*
 *   requests that extend their Store* request, so the field rules live in one place.
 * @usage `return self::partial(parent::rules());` in an Update request extending the Store request.
 */

namespace App\Http\Requests\Concerns;

trait PartialUpdateRules
{
    /**
     * @description Adds `sometimes` in front of the rules of every field (string or array form);
     *   fields that already have it stay unchanged.
     * @param array<string, string|array<int, mixed>> $rules Rules of the create request.
     * @return array<string, string|array<int, mixed>> Rules of the partial update.
     */
    protected static function partial(array $rules): array
    {
        foreach ($rules as $field => $rule) {
            if (is_string($rule)) {
                $rules[$field] = str_starts_with($rule, 'sometimes') ? $rule : 'sometimes|' . $rule;
            } elseif (is_array($rule) && !in_array('sometimes', $rule, true)) {
                $rules[$field] = ['sometimes', ...$rule];
            }
        }

        return $rules;
    }
}
