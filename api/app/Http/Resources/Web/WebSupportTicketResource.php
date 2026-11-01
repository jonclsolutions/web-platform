<?php
/**
 * @file WebSupportTicketResource.php
 * @path app/Http/Resources/Web/WebSupportTicketResource.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Resource transformation for support tickets.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebSupportTicket model data, including the current attachment (if any).
 */
class WebSupportTicketResource extends JsonResource
{
/**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
public function toArray(Request $request): array
    {
return [
'id'                => $this->id,
'user_id'           => $this->user_id,
'user_name_plain'   => $this->user_name_plain,
'user_plain'        => $this->user_plain,
'category'          => $this->category,
'priority'          => $this->priority,
'state'             => $this->state,
'subject'           => $this->subject,
'description'       => $this->description,
'attachments'       => WebAttachmentResource::collection($this->whenLoaded('attachments')),
'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
'deleted_at'        => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}