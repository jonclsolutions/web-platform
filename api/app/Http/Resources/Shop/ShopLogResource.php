<?php
/**
 * @file ShopLogResource.php
 * @path app/Http/Resources/Shop/ShopLogResource.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for system audit logs.
 */

namespace App\Http\Resources\Shop;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms ShopLog model data into a JSON response, including user identification and context data.
 */
class ShopLogResource extends JsonResource
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
            'id'                     => $this->id,
            'origin'                 => $this->origin,
            'event_type'             => $this->event_type,
            'module'                 => $this->module,
            'description'            => $this->description,
            'affected_entity_type'   => $this->affected_entity_type,
            'affected_entity_id'     => $this->affected_entity_id,
            'user' => [
                'id'         => $this->user_id,
                'user_email' => $this->user ? $this->user->user_email : 'Neznámý uživatel'
            ],
            'context_data'           => $this->context_data,
            'created_at'             => $this->created_at?->format('Y-m-d H:i:s'),
            'user_id_plain'          => $this->user_id_plain,
            'user_plain'             => $this->user_plain,
        ];
    }
}