<?php
/**
 * @file StoreProjectCheckpointRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectCheckpointRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New checkpoint of a project: title, optional description (client-visible), due
 *   date and internal note (team only), status, position (default: at the end).
 * @dependencies WebProjectController::storeCheckpoint()
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Web\WebProjectCheckpoint;

class StoreProjectCheckpointRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'label'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'due_date'    => ['nullable', 'date_format:Y-m-d'],
            'internal_note' => ['nullable', 'string', 'max:5000'],
            'status'     => ['nullable', 'in:' . implode(',', WebProjectCheckpoint::STATUSES)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}