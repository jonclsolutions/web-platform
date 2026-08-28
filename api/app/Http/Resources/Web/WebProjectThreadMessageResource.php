<?php
namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectThreadMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'author_type'  => $this->author_type,
            'author_label' => $this->author_label,
            'body'         => $this->body,
            'created_at'   => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}