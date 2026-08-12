<?php
/**
 * @file WebSupportTicketResource.php
 * @path app/Http/Resources/Web/WebSupportTicketResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for support tickets.
 * @refactor-note (2026-08-2) `attachment_path`/`attachment_url` nahrazeny `attachments`
 *      kolekcí (viz WebAttachment.php/WebAttachmentResource.php) - stejný tvar jako u
 *      WebSalesOrderResource/WebRawRequestCommissionResource, aby frontend mohl použít
 *      stejnou komponentu pro zobrazení/stažení/náhled napříč všemi čtyřmi entitami.
 *      Nejvýš 1 prvek v kolekci (vynuceno v HandlesAttachments::storeSingleAttachment()).
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