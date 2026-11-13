<?php
/**
 * @file ProjectThreadMessageResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectThreadMessageResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description JSON shape for a single project thread message. `author_label` may
 * be `null` for customer messages by design - see `ProjectThreadMessage` model
 * header. Frontend resolves the display label from `author_type` when `null`.
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use App\Http\Resources\Core\CoreAttachmentResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectThreadMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'author_type'  => $this->author_type,
            'author_label' => $this->author_label,
            // Client account of a client message (the portal tells "you" from colleagues).
            'author_account_id' => $this->account_id,
            'is_internal'  => (bool) $this->is_internal,
            'body'         => $this->body,
            'attachments'  => CoreAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'   => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}