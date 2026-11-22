<?php
/**
 * @file OutputSelectionRequest.php
 * @path app/Apps/JsCreator/Http/Requests/OutputSelectionRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Several outputs at once: `ids` (1 … MAX_IDS) and, for the bulk actions, `action`
 *   (move | delete | restore | destroy) with `folder_id` of a move (null = top level). Outputs
 *   that are not own (or not reachable for the action) are ignored by OutputController.
 * @dependencies OutputController::bulk(), OutputController::zip()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OutputSelectionRequest extends FormRequest
{
    /** @description Most outputs in one request (also the most outputs of one ZIP). */
    public const MAX_IDS = 200;

    /** @description Bulk actions. */
    public const ACTIONS = ['move', 'delete', 'restore', 'destroy'];

    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Ids of outputs; the action and the target folder only on the bulk route.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'ids'   => ['required', 'array', 'min:1', 'max:' . self::MAX_IDS],
            'ids.*' => ['integer', 'min:1', 'distinct'],
        ];
        if ($this->routeIs('js-creator.outputs.bulk')) {
            $rules['action'] = ['required', 'string', 'in:' . implode(',', self::ACTIONS)];
            $rules['folder_id'] = ['nullable', 'integer', 'min:1'];
        }

        return $rules;
    }

    /**
     * @description The ids as integers.
     * @return array<int, int>
     */
    public function ids(): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input('ids', []))));
    }
}
