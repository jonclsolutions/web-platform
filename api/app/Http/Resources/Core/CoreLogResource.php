<?php
/**
 * @file CoreLogResource.php
 * @path app/Http/Resources/Core/CoreLogResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Transforms CoreLog models into a stable API response shape. Mirrors
 * WebLogResource / ShopLogResource field-for-field.
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Resources\Json\JsonResource;

class CoreLogResource extends JsonResource
{
    /**
     * @param \Illuminate\Http\Request $request
     * @return array
     */
    public function toArray($request): array
    {
        return [
            'id'                   => $this->id,
            'origin'               => $this->origin,
            'event_type'           => $this->event_type,
            'module'               => $this->module,
            'description'          => $this->description,
            'affected_entity_type' => $this->affected_entity_type,
            'affected_entity_id'   => $this->affected_entity_id,
            'user_id'              => $this->user_id,
            'context_data'         => $this->context_data,
            'user_id_plain'        => $this->user_id_plain,
            'user_plain'           => $this->user_plain,
            'created_at'           => $this->created_at,
        ];
    }
}