<?php
/**
 * @file ImportRowValidator.php
 * @path app/Services/Import/ImportRowValidator.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates imported rows against the REAL validation rules of the resource - reuses
 * `rules()` of the existing `Store*Request` (`importable_resources.php` -> `store_request`),
 * limited to `importable_columns`. No duplicated validation: an import follows the same business
 * rules as a record created in the form.
 * @security Validated in the dry run (`importValidate()`) AND again on commit (`importCommit()`) -
 * the state (e.g. existing records for duplicate checks) may change in between.
 */

namespace App\Services\Import;

use Illuminate\Support\Facades\Validator;

class ImportRowValidator
{
    /**
     * @description Builds the import validation rules: `rules()` of the `Store*Request` limited
     * to `importable_columns` (rules of `attachments` and other non-column fields are dropped -
     * an import carries data only, no files).
     *
     * @param class-string $storeRequestClass
     * @param string[] $importableColumns
     * @return array<string, array>
     */
    public function buildRules(string $storeRequestClass, array $importableColumns): array
    {
        /** @var \Illuminate\Foundation\Http\FormRequest $instance */
        $instance = new $storeRequestClass();
        $allRules = method_exists($instance, 'rules') ? $instance->rules() : [];

        $filtered = [];
        foreach ($importableColumns as $column) {
            if (isset($allRules[$column])) {
                // 'required' stays as it is - an import row WITHOUT a required value is as invalid as a
                // form without it.
                $filtered[$column] = $allRules[$column];
            }
        }

        return $filtered;
    }

    /**
     * @description Validates one row. Returns `null` when valid, otherwise the error messages
     * (key = column).
     */
    public function validateRow(array $row, array $rules): ?array
    {
        $validator = Validator::make($row, $rules);

        if ($validator->fails()) {
            return $validator->errors()->toArray();
        }

        return null;
    }
}