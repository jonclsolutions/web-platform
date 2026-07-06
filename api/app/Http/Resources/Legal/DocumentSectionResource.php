<?php
/**
 * @file DocumentSectionResource.php
 * @path app/Http/Resources/Legal/DocumentSectionResource.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for legal document sections.
 */

namespace App\Http\Resources\Legal;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms DocumentSection model data into a standardized JSON format.
 */
class DocumentSectionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param \Illuminate\Http\Request $request
     * @return array<string, mixed>
     */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'document_type_id' => $this->document_type_id,
            'position' => $this->position,
            'heading' => $this->heading,
            'content' => $this->content,
        ];
    }
}