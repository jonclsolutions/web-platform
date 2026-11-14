<?php
/**
 * @file UpdateProjectCheckpointRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdateProjectCheckpointRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Partial change of a checkpoint: the fields of StoreProjectCheckpointRequest, each
 *   optional; status and position cannot be emptied.
 * @dependencies ProjectController::updateCheckpoint()
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Apps\ProjectPortal\Models\ProjectCheckpoint;
use App\Http\Requests\Concerns\PartialUpdateRules;

class UpdateProjectCheckpointRequest extends StoreProjectCheckpointRequest
{
    use PartialUpdateRules;

    /**
     * @description Rules of the create request, each field optional.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...self::partial(parent::rules()),
            'status'     => ['sometimes', 'in:' . implode(',', ProjectCheckpoint::STATUSES)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
