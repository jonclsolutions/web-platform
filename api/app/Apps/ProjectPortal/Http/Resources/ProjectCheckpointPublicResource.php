<?php
/**
 * @file ProjectCheckpointPublicResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectCheckpointPublicResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Checkpoint of a project as the CLIENT sees it in the portal: title, description,
 *   due date, status and when it changed - never the internal note of the team.
 * @dependencies App\Apps\ProjectPortal\Models\ProjectCheckpoint
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectCheckpointPublicResource extends JsonResource
{
    /**
     * @description Client-visible fields of the checkpoint.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'label'             => $this->label,
            'description'       => $this->description,
            'due_date'          => $this->due_date?->format('Y-m-d'),
            'status'            => $this->status,
            'status_changed_at' => $this->status_changed_at?->format('Y-m-d H:i:s'),
            'sort_order'        => $this->sort_order,
        ];
    }
}
