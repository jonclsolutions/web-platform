<?php
/**
 * @file ExportRequest.php
 * @path app/Apps/JsCreator/Http/Requests/ExportRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Selection of an export: `template_ids`, `block_ids`, `set_ids` (each optional, at
 *   most MAX_IDS ids, at least one id in all). Own items of the section are checked by
 *   TransferExport.
 * @dependencies TransferController::export()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

class ExportRequest extends FormRequest
{
    /** @description Most ids of one kind. */
    public const MAX_IDS = 200;

    /** @description Lists of the selection. */
    public const LISTS = ['template_ids', 'block_ids', 'set_ids'];

    /** @description Access is decided by the route (permission) and the export (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Three optional lists of ids, not all empty.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [];
        foreach (self::LISTS as $list) {
            $rules[$list] = ['sometimes', 'array', 'max:' . self::MAX_IDS];
            $rules["{$list}.*"] = ['integer', 'min:1', 'distinct'];
        }
        $rules['template_ids'][] = function (string $attribute, mixed $value, Closure $fail) {
            if ($this->ids('template_ids') === [] && $this->ids('block_ids') === [] && $this->ids('set_ids') === []) {
                $fail('Select at least one template, block or set.');
            }
        };
        $rules['template_ids'][0] = 'required_without_all:block_ids,set_ids';

        return $rules;
    }

    /**
     * @description Ids of one list as unique integers.
     * @param string $list One of LISTS.
     * @return int[]
     */
    public function ids(string $list): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input($list, []))));
    }
}
