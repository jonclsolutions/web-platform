<?php
/**
 * @file WebProjectApprovalResource.php
 * @path app/Http/Resources/Web/WebProjectApprovalResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Approval request with its files, checkpoint and the history of the client's
 *   decisions (administration and portal - the portal never gets cancelled ones).
 * @dependencies App\Models\Web\WebProjectApproval, WebAttachmentResource
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectApprovalResource extends JsonResource
{
    /**
     * @description Fields of the approval.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'title'              => $this->title,
            'description'        => $this->description,
            'status'             => $this->status,
            'due_date'           => $this->due_date?->format('Y-m-d'),
            'checkpoint_id'      => $this->checkpoint_id,
            'checkpoint_label'   => $this->whenLoaded('checkpoint', fn () => $this->checkpoint?->label),
            'requested_by_label' => $this->requested_by_label,
            'requested_at'       => $this->requested_at?->format('Y-m-d H:i:s'),
            'decided_at'         => $this->decided_at?->format('Y-m-d H:i:s'),
            'attachments'        => WebAttachmentResource::collection($this->whenLoaded('attachments')),
            'decisions'          => $this->whenLoaded('decisions', fn () => $this->decisions->map(fn ($decision) => [
                'id'           => $decision->id,
                'decision'     => $decision->decision,
                'comment'      => $decision->comment,
                'author_label' => $decision->author_label,
                'account_id'   => $decision->account_id,
                'created_at'   => $decision->created_at?->format('Y-m-d H:i:s'),
            ])->values()),
            'created_at'         => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}
