<?php
/**
 * @file FolderResource.php
 * @path app/Apps/JsCreator/Http/Resources/FolderResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Folder of the own workspace (the frontend builds the tree from `parent_id`).
 * @dependencies App\Apps\JsCreator\Models\CreatorFolder
 */

namespace App\Apps\JsCreator\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FolderResource extends JsonResource
{
    /**
     * @description Fields of the folder.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'parent_id'  => $this->parent_id,
            'name'       => $this->name,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at' => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
