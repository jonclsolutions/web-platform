<?php
/**
 * @file UpdateProjectCheckpointRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdateProjectCheckpointRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Partial change of a checkpoint: title, description (client-visible), due date,
 *   internal note (team only), status, position.
 * @dependencies ProjectController::updateCheckpoint()
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Apps\ProjectPortal\Models\ProjectCheckpoint;

class UpdateProjectCheckpointRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'label'       => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'due_date'    => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'internal_note' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status'     => ['sometimes', 'in:' . implode(',', ProjectCheckpoint::STATUSES)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}