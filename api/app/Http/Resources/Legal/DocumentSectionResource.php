<?php
namespace App\Http\Resources\Legal;

use Illuminate\Http\Resources\Json\JsonResource;

class DocumentSectionResource extends JsonResource
{
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