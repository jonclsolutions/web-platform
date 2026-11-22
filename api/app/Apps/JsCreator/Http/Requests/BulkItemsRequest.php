<?php
/**
 * @file BulkItemsRequest.php
 * @path app/Apps/JsCreator/Http/Requests/BulkItemsRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One action on several templates, blocks or sets of a section, or on several files
 *   of the library - images / own icons, fonts (multiselect of the lists): `action` delete (to the trash) | restore | destroy (items of the trash for good) and
 *   `ids` (1 … MAX_IDS). Items that are not own (or not reachable for the action) are ignored by
 *   the controller.
 * @dependencies TemplateController::bulk(), BlockController::bulk(), SetController::bulk(),
 *   AssetController::bulk(), FontController::bulk()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkItemsRequest extends FormRequest
{
    /** @description Most items in one request. */
    public const MAX_IDS = 200;

    /** @description Bulk actions. */
    public const ACTIONS = ['delete', 'restore', 'destroy'];

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Action and ids.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'in:' . implode(',', self::ACTIONS)],
            'ids'    => ['required', 'array', 'min:1', 'max:' . self::MAX_IDS],
            'ids.*'  => ['integer', 'min:1', 'distinct'],
        ];
    }

    /**
     * @description The ids as unique integers.
     * @return int[]
     */
    public function ids(): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input('ids', []))));
    }
}
