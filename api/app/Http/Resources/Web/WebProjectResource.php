<?php
/**
 * @file WebProjectResource.php
 * @path app/Http/Resources/Web/WebProjectResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description ADMIN-facing project resource.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                         => $this->id,
            'lead_id'                    => $this->lead_id,
            'order_id'                   => $this->order_id,
            'name'                       => $this->name,
            'description'                => $this->description,
            'platform'                   => $this->platform,
            'project_lead'               => $this->project_lead,
            'contact_phone'              => $this->contact_phone,
            'contact_email'              => $this->contact_email,
            'technologies'               => $this->technologies,
            'estimated_completion_from'  => $this->estimated_completion_from?->format('Y-m-d'),
            'estimated_completion_to'    => $this->estimated_completion_to?->format('Y-m-d'),
            'visibility'                 => $this->visibility,
            'status'                     => $this->status,
            'assignee_id'                => $this->assignee_id,
            'assignee_name'              => $this->whenLoaded('assignee', fn () => $this->assignee?->full_name),
            'access_token'               => $this->access_token,
            'public_url'                 => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/projects/{$this->access_token}",
            'accounts_count'             => $this->whenCounted('accounts'),
            'pending_approvals_count' => $this->when(isset($this->pending_approvals_count), fn () => (int) $this->pending_approvals_count),
            'published_updates_count' => $this->when(isset($this->published_updates_count), fn () => (int) $this->published_updates_count),
            'open_threads_count'      => $this->when(isset($this->open_threads_count), fn () => (int) $this->open_threads_count),
            'checkpoints_total'          => $this->whenCounted('checkpoints'),
            'unread_messages_count'      => $this->when(isset($this->unread_messages_count), fn () => (int) $this->unread_messages_count),
            // Open threads where the client wrote last - an answer is owed.
            'waiting_threads_count'      => $this->when(isset($this->waiting_threads_count), fn () => (int) $this->waiting_threads_count),
            'checkpoints_done'           => $this->when(isset($this->checkpoints_done_count), $this->checkpoints_done_count),
            'checkpoints'                => WebProjectCheckpointResource::collection($this->whenLoaded('checkpoints')),
            'created_at'                 => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'                 => $this->updated_at?->format('Y-m-d H:i:s'),
            'lead'                       => new WebSalesLeadResource($this->whenLoaded('lead')),
            'order'                      => new WebSalesOrderResource($this->whenLoaded('order')),
        ];
    }
}