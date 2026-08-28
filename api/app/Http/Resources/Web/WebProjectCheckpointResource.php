<?php
namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectCheckpointResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'label'             => $this->label,
            'status'            => $this->status,
            'status_changed_at' => $this->status_changed_at?->format('Y-m-d H:i:s'),
            'sort_order'        => $this->sort_order,
        ];
    }
}