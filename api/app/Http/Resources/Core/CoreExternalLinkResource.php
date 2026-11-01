<?php
/**
 * @file CoreExternalLinkResource.php
 * @path app/Http/Resources/Core/CoreExternalLinkResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API resource of CoreExternalLink - one response shape for index / show / store /
 * update / restore. `user_id` is NOT returned: the frontend never needs it (links are always
 * scoped to the logged-in user).
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CoreExternalLinkResource extends JsonResource
{
    /**
     * @description Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'url'        => $this->url,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
        ];
    }
}