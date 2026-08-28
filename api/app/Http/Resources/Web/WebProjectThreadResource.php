<?php
/**
 * @file WebProjectThreadResource.php
 * @path app/Http/Resources/Web/WebProjectThreadResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared by BOTH the admin cross-project table (needs `project_name`
 * badge - consultation note 2) AND the customer's per-project thread list (where
 * `project_name` is simply redundant/ignored by the frontend, not a leak - it's the
 * customer's own project).
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectThreadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'project_id'      => $this->project_id,
            'project_name'    => $this->whenLoaded('project', fn() => $this->project->name),
            'subject'         => $this->subject,
            'priority'        => $this->priority,
            'status'          => $this->status,
            'opened_by'       => $this->opened_by,
            'last_message_at' => $this->last_message_at?->format('Y-m-d H:i:s'),
            'messages'        => WebProjectThreadMessageResource::collection($this->whenLoaded('messages')),
            'created_at'      => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}