<?php
/**
 * @file WebRawRequestCommissionResource.php
 * @path app/Http/Resources/Web/WebRawRequestCommissionResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for raw commission requests.
 *
 * @refactor-note (2026-08) Odstraněna jednosouborová pole `file_path`/`file_url` -
 * nahrazeno `attachments` kolekcí (viz WebAttachment.php/WebAttachmentResource.php),
 * podporující až 10 příloh na jeden požadavek místo jedné.
 */

namespace App\Http\Resources\Web;

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
            'attachments'       => WebAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'        => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}