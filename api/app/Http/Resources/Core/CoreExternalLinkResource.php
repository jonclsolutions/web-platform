<?php
/**
 * @file CoreExternalLinkResource.php
 * @path app/Http/Resources/Core/CoreExternalLinkResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description API resource pro CoreExternalLink - jednotný tvar odpovědi napříč
 * index()/show()/store()/update()/restore(). `user_id` se záměrně NEVRACÍ - frontend
 * ho nikdy nepotřebuje (odkazy jsou vždy scoped na přihlášeného uživatele) a jeho
 * vynechání z odpovědi je jedna vrstva ochrany navíc proti náhodnému leaku cizího ID
 * v budoucích úpravách frontendu.
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