<?php

/**
 * @file PresetResource.php
 * @path app/Apps/JsCreator/Http/Resources/PresetResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A preset of the form of generating for the admin: name, its template / set and
 *   the values (empty maps as objects).
 * @dependencies CreatorPreset, PresetValues.
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\PresetValues;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PresetResource extends JsonResource
{
    /**
     * @description Fields of the preset.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'section'     => $this->section,
            'template_id' => $this->template_id,
            'set_id'      => $this->set_id,
            'name'        => $this->name,
            'values'      => PresetValues::forJson($this->payload ?? []),
            'created_at'  => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'  => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
