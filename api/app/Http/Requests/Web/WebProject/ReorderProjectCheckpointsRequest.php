<?php
/**
 * @file ReorderProjectCheckpointsRequest.php
 * @path app/Http/Requests/Web/WebProject/ReorderProjectCheckpointsRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New order of the checkpoints of a project: the ids of ALL its checkpoints in the
 *   wanted order (the controller checks they are exactly the project's checkpoints).
 * @dependencies WebProjectController::reorderCheckpoints()
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;

class ReorderProjectCheckpointsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description A list of distinct checkpoint ids.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ids'   => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer', 'distinct'],
        ];
    }
}
