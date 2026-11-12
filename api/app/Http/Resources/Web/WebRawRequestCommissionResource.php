<?php
/**
 * @file WebRawRequestCommissionResource.php
 * @path app/Http/Resources/Web/WebRawRequestCommissionResource.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Resource transformation for raw commission requests.
 */

namespace App\Http\Resources\Web;

use App\Http\Resources\Core\CoreAttachmentResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms raw request commission data, including the attachment collection.
 */
class WebRawRequestCommissionResource extends JsonResource
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
            'thema'             => $this->thema,
            'contact_email'     => $this->contact_email,
            'contact_phone'     => $this->contact_phone,
            'order_description' => $this->order_description,
            'status'            => $this->status,
            'priority'          => $this->priority,
            'note'              => $this->note,
            'attachments'       => CoreAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'        => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}