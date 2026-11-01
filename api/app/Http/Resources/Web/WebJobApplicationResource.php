<?php
/**
 * @file WebJobApplicationResource.php
 * @path app/Http/Resources/Web/WebJobApplicationResource.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Resource transformation for job application submissions.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebJobApplication model data, including the current CV attachment (if any).
 */
class WebJobApplicationResource extends JsonResource
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
'id'            => $this->id,
'first_name'    => $this->first_name,
'last_name'     => $this->last_name,
'full_name'     => "{$this->first_name} {$this->last_name}",
'email'         => $this->email,
'phone'         => $this->phone,
'position_name' => $this->position_name,
'message'       => $this->message,
'attachments'   => WebAttachmentResource::collection($this->whenLoaded('attachments')),
'state'         => $this->state,
'internal_note' => $this->internal_note,
'created_at'    => $this->created_at?->format('Y-m-d H:i:s'),
'updated_at'    => $this->updated_at?->format('Y-m-d H:i:s'),
'deleted_at'    => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}