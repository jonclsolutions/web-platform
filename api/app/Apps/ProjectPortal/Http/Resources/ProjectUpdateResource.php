<?php
/**
 * @file ProjectUpdateResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectUpdateResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Update of the supplier (administration and portal - the portal gets published ones only).
 * @dependencies App\Apps\ProjectPortal\Models\ProjectUpdate, CoreAttachmentResource
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use App\Http\Resources\Core\CoreAttachmentResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectUpdateResource extends JsonResource
{
    /**
     * @description Fields of the update.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'body'         => $this->body,
            'author_label' => $this->author_label,
            'is_published' => $this->published_at !== null,
            'published_at' => $this->published_at?->format('Y-m-d H:i:s'),
            'attachments'  => CoreAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'   => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'   => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
