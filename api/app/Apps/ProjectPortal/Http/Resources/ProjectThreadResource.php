<?php
/**
 * @file ProjectThreadResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectThreadResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared by BOTH the admin cross-project table (needs `project_name`
 * badge - consultation note 2) AND the customer's per-project thread list (where
 * `project_name` is simply redundant/ignored by the frontend, not a leak - it's the
 * customer's own project).
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectThreadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                     => $this->id,
            'project_id'             => $this->project_id,
            'project_name'           => $this->whenLoaded('project', fn() => $this->project->name),
            'subject'                => $this->subject,
            'priority'               => $this->priority,
            'status'                 => $this->status,
            'opened_by'              => $this->opened_by,
            // The team's assignee - only where the administration loads it (never in the portal).
            'assignee_id'            => $this->when($this->relationLoaded('assignee'), fn () => $this->assignee_id),
            'assignee_name'          => $this->when($this->relationLoaded('assignee'), fn () => $this->assignee?->full_name),
            // 'supplier' | 'customer' | null - whose turn it is (ProjectThread::waitingOn()).
            'waiting_on'             => $this->waitingOn(),
            'last_message_at'        => $this->last_message_at?->format('Y-m-d H:i:s'),
            // Until when the client has read the thread - "read by the client" of admin replies.
            'customer_last_read_at'  => $this->customer_last_read_at?->format('Y-m-d H:i:s'),
            // Client messages the administration has not read yet (admin list only).
            'admin_unread_count'     => $this->when(isset($this->admin_unread_count), fn () => (int) $this->admin_unread_count),
            'unread_count'           => $this->when($this->relationLoaded('messages'), function () {
                $adminMessages = $this->messages->where('author_type', 'admin')->where('is_internal', false);
                if (!$this->customer_last_read_at) {
                    return $adminMessages->count();
                }
                return $adminMessages->filter(
                    fn($msg) => $msg->created_at && $msg->created_at->gt($this->customer_last_read_at)
                )->count();
            }),
            'messages'               => ProjectThreadMessageResource::collection($this->whenLoaded('messages')),
            'created_at'             => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}