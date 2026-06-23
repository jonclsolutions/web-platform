<?php

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebRawRequestCommissionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
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
            'file_path'         => $this->file_path,
            // Sjednoceno: používáme asset() stejně jako u tiketu
            'file_url'          => $this->file_path ? asset('storage/' . $this->file_path) : null,
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'        => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}