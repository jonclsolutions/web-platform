<?php
/**
 * @file ProjectCheckpointResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectCheckpointResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Checkpoint of a project for the ADMINISTRATION - with the internal note of the
 *   team. The client portal uses ProjectCheckpointPublicResource (no internal note).
 * @dependencies App\Apps\ProjectPortal\Models\ProjectCheckpoint
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectCheckpointResource extends JsonResource
{
    /**
     * @description Fields of the checkpoint.
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
            'internal_note'     => $this->internal_note,
            'status'            => $this->status,
            'status_changed_at' => $this->status_changed_at?->format('Y-m-d H:i:s'),
            'sort_order'        => $this->sort_order,
        ];
    }
}
