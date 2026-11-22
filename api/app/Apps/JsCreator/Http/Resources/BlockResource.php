<?php

/**
 * @file BlockResource.php
 * @path app/Apps/JsCreator/Http/Resources/BlockResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Block in a list: name, size, signed URL of the thumbnail (null until the editor saves
 *   one), version and - when loaded - the templates that use it (`used_by`, trash included;
 *   such a block cannot be deleted). Without the document - BlockDetailResource adds it.
 * @dependencies CreatorBlock, WorkspaceFiles, TemplateUsages::usedBy().
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BlockResource extends JsonResource
{
    /**
     * @description Fields of the block.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'section'    => $this->section,
            'name'       => $this->name,
            'width'      => $this->width,
            'height'     => $this->height,
            'thumb_url'  => WorkspaceFiles::blockThumbUrl($this->resource),
            'thumb_stale' => (bool) $this->thumb_stale,
            'version'    => $this->version,
            // Templates using the block (TemplateUsages::usedBy()).
            'used_by'    => $this->when($this->resource->relationLoaded('usedBy'), fn () => $this->resource->getRelation('usedBy')->values()->all()),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at' => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
